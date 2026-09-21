#!/usr/bin/env python3
"""
Inspect generated clips without ears.

  npm run voice:check                 # the 26 names and the sounds
  npm run voice:check -- 'read/word/*'

For every clip it reports duration, how much silence is left at each end, how
much of it is periodic, and - the number that matters for a phonics app - the
length of the voiced tail after the last consonant. That tail is the "uh" in
"buh", and anything over about 90 ms will be heard as one.

Flags, one per line, so a bad clip cannot hide in a table:
  SHORT     under 120 ms: likely truncated
  LONG      over 1.2 s for a name or a sound: likely babbling
  LEADSIL   more than 110 ms of silence at the front. Every clip carries a
            constant 46 ms of LAME encoder priming that no decoder strips
            (the build writes no Xing header on purpose, so the delay is the
            same everywhere and voice.ts starts playback past it).
  TAILSIL   more than 120 ms of silence at the end
  SCHWA     voiced tail longer than the budget for that clip
  QUIET     peak more than 6 dB below the set's median

With --spectrogram it also writes PNGs, which is the closest thing to looking
at the sound that a build machine has.
"""
from __future__ import annotations

import argparse
import fnmatch
import json
import shutil
import statistics
import subprocess
import sys
import tempfile
import wave
from pathlib import Path

import numpy as np

FRAME, HOP = 0.025, 0.005
ROOT = Path(__file__).resolve().parents[2]
VOICE_DIR = ROOT / "public" / "voice"
FFMPEG = ROOT / "node_modules" / "ffmpeg-static" / "ffmpeg"

# A stop may keep this much voicing; a continuant is allowed to be all voice.
SCHWA_BUDGET_MS = 110.0
# LAME's encoder delay at 24 kHz: 1105 samples, the same on every clip.
MP3_PRIMING = 0.046


def decode(path: Path, work: Path) -> tuple[np.ndarray, int]:
    out = work / (path.stem + ".wav")
    subprocess.run(
        [str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", "-i", str(path),
         "-ac", "1", "-ar", "24000", str(out)],
        check=True,
    )
    with wave.open(str(out)) as w:
        rate = w.getframerate()
        a = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768
    return a, rate


def f0(x: np.ndarray, rate: int, lo: int = 70, hi: int = 400, thresh: float = 0.30) -> float:
    x = x - x.mean()
    if np.sqrt((x ** 2).mean()) < 1e-4:
        return 0.0
    c = np.correlate(x, x, "full")[len(x) - 1:]
    if c[0] <= 0:
        return 0.0
    c = c / c[0]
    a, b = int(rate / hi), min(int(rate / lo), len(c) - 1)
    if b <= a:
        return 0.0
    k = a + int(np.argmax(c[a:b]))
    return rate / k if c[k] > thresh else 0.0


def measure(a: np.ndarray, rate: int) -> dict:
    n, h = int(FRAME * rate), int(HOP * rate)
    frames = [a[i:i + n] for i in range(0, max(1, len(a) - n), h)]
    db = np.array([20 * np.log10(max(np.sqrt((f ** 2).mean()), 1e-7)) for f in frames])
    voiced = np.array([f0(f, rate) > 0 for f in frames])
    peak = float(db.max())
    active = np.where(db > peak - 35)[0]
    if not len(active):
        return {"duration": len(a) / rate, "speech": 0.0, "lead": 0.0, "tail": 0.0,
                "peak_db": peak, "voiced_tail": 0.0, "voiced_frac": 0.0}
    lead = float(active[0]) * HOP
    tail = len(a) / rate - (float(active[-1]) * HOP + FRAME)
    # Walk back from the last active frame while it is still periodic.
    run, i = 0.0, int(active[-1])
    while i >= 0 and voiced[i]:
        run += HOP
        i -= 1
    return {
        "duration": round(len(a) / rate, 3),
        "speech": round(len(a) / rate - lead - max(tail, 0.0), 3),
        "lead": round(lead, 3),
        "tail": round(max(tail, 0.0), 3),
        "peak_db": round(peak, 1),
        "voiced_tail": round(run, 3),
        "voiced_frac": round(float(voiced[active].mean()), 2),
    }


def spectrogram(src: Path, dst: Path) -> None:
    dst.parent.mkdir(parents=True, exist_ok=True)
    subprocess.run(
        [str(FFMPEG), "-hide_banner", "-loglevel", "error", "-y", "-i", str(src),
         "-lavfi", "showspectrumpic=s=760x300:mode=combined:color=intensity:scale=log:legend=1",
         str(dst)],
        check=True,
    )


def main() -> int:
    p = argparse.ArgumentParser(description=__doc__,
                                formatter_class=argparse.RawDescriptionHelpFormatter)
    p.add_argument("patterns", nargs="*", default=None,
                   help="clip id globs (default: name/* and sound/*)")
    p.add_argument("--spectrogram", action="store_true")
    p.add_argument("--json", action="store_true")
    args = p.parse_args()

    if not FFMPEG.exists():
        print("ffmpeg-static is missing - run `npm install`", file=sys.stderr)
        return 1
    manifest_path = VOICE_DIR / "manifest.json"
    if not manifest_path.exists():
        print("no manifest - run `npm run voice` first", file=sys.stderr)
        return 1

    manifest = json.loads(manifest_path.read_text())
    patterns = args.patterns or ["name/*", "sound/*"]
    ids = [i for i in sorted(manifest["clips"]) if any(fnmatch.fnmatch(i, g) for g in patterns)]
    if not ids:
        print("no clips matched", file=sys.stderr)
        return 1

    work = Path(tempfile.mkdtemp(prefix="voice-check-"))
    rows = []
    try:
        for clip_id in ids:
            audio, rate = decode(VOICE_DIR / f"{clip_id}.mp3", work)
            row = {"id": clip_id, **measure(audio, rate),
                   "bytes": manifest["clips"][clip_id]["bytes"]}
            rows.append(row)
            if args.spectrogram:
                spectrogram(VOICE_DIR / f"{clip_id}.mp3",
                            ROOT / ".voice-cache" / "spectrograms" / f"{clip_id}.png")
    finally:
        shutil.rmtree(work, ignore_errors=True)

    median_peak = statistics.median(r["peak_db"] for r in rows)
    for row in rows:
        flags = []
        if row["speech"] < 0.12:
            flags.append("SHORT")
        if row["duration"] > 1.2 and row["id"].split("/")[0] in ("name", "sound"):
            flags.append("LONG")
        if row["lead"] > MP3_PRIMING + 0.065:
            flags.append("LEADSIL")
        if row["tail"] > 0.12:
            flags.append("TAILSIL")
        if row["voiced_tail"] * 1000 > SCHWA_BUDGET_MS and row["voiced_frac"] < 0.9:
            flags.append("SCHWA")
        if row["peak_db"] < median_peak - 6:
            flags.append("QUIET")
        row["flags"] = flags

    if args.json:
        print(json.dumps(rows, indent=2))
        return 0

    for row in rows:
        print(
            f"{row['id']:24s} dur={row['duration']:.3f} speech={row['speech']:.3f} "
            f"lead={row['lead']:.3f} tail={row['tail']:.3f} peak={row['peak_db']:6.1f} "
            f"vtail={row['voiced_tail']:.3f} vfrac={row['voiced_frac']:.2f} "
            f"{row['bytes']:>6}B  {' '.join(row['flags'])}"
        )
    bad = [r for r in rows if r["flags"]]
    print(f"\n{len(rows)} clips, {len(bad)} flagged")
    for row in bad:
        print(f"  {row['id']}: {', '.join(row['flags'])}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
