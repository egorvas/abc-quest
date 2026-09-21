#!/usr/bin/env python3
"""
Kokoro worker for the voice build.

Reads a JSON job file, writes one 24 kHz mono WAV per job. Never called by
hand: `scripts/generate-voice.ts` drives it and owns the caching.

Three things here are not obvious and were measured, not guessed:

 1. Kokoro grows a breathy vowel tail on very short utterances. "bee" comes out
    as "bee-uh" and a speech recogniser transcribes it as "BA". A plain
    silence trim does not remove it, because the tail is real speech energy at
    about -25 dBFS. `trim` therefore ends the clip at the last frame that is
    either loud or periodic; the tail is neither.

 2. Slowing Kokoro down makes single letters WORSE, not better. At speed 0.9
    "tee" is transcribed "CA" and "ee" as "Me"; at speed 1.0 both are correct.
    Anything that has to be slower for a child is slowed in the app, by
    playbackRate on the buffer source, not here.

 3. A trailing full stop is what tells the model the utterance has ended. Every
    clip gets one, even a bare phoneme.

 4. Kokoro cannot say an isolated consonant. Asked for /f/ it says /f/ and then
    opens into a vowel; the spectrogram shows plain harmonics after the
    frication, and a recogniser transcribes the clip as "Fuehrer". The same
    happens to every consonant, voiced or not. So the vowel is measured and cut
    off: `cut_at_voicing` for a consonant that has no voice of its own, where
    the vowel announces itself by being periodic, and `cut_at_opening` for a
    voiced one, where it announces itself by a jump in 900-3000 Hz energy as
    the mouth opens.

 5. What is left of a continuant is 80-160 ms, which is too brief for a child
    to hear as "mmm". `hold` loops its steady middle with crossfades up to a
    target length. A held consonant is stationary, so a loop is inaudible.
"""
from __future__ import annotations

import argparse
import json
import sys
import wave
from pathlib import Path

import numpy as np

FRAME, HOP = 0.025, 0.005
SPEED = 1.0
VOICE = "af_heart"


# --------------------------------------------------------------------------
# analysis
# --------------------------------------------------------------------------

def _frames(a: np.ndarray, rate: int):
    n, h = int(FRAME * rate), int(HOP * rate)
    return [(i, a[i:i + n]) for i in range(0, max(1, len(a) - n), h)]


def _f0(x: np.ndarray, rate: int, lo: int = 70, hi: int = 400, thresh: float = 0.30) -> float:
    """Autocorrelation pitch. Returns 0.0 when the frame is not periodic."""
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


def _fade(a: np.ndarray, rate: int, fade_ms: float = 12.0) -> np.ndarray:
    out = a.copy()
    n = min(int(fade_ms / 1000 * rate), len(out) // 2)
    if n > 1:
        out[:n] *= np.linspace(0, 1, n)
        out[-n:] *= np.linspace(1, 0, n)
    return out


def trim(a: np.ndarray, rate: int, floor_db: float = -38.0, tail_db: float = -22.0,
         pad_ms: float = 15.0) -> np.ndarray:
    """Cut silence at both ends and the breathy tail at the end."""
    fr = _frames(a, rate)
    if not fr:
        return a
    db = np.array([20 * np.log10(max(np.sqrt((f ** 2).mean()), 1e-7)) for _, f in fr])
    peak = float(db.max())
    strong = np.where(db > peak + floor_db)[0]
    if not len(strong):
        return a
    start, end = int(strong[0]), int(strong[-1])
    voiced = np.array([_f0(f, rate) > 0 for _, f in fr])
    loud = db > peak + tail_db
    i = end
    while i > start and not (loud[i] or (voiced[i] and db[i] > peak - 32)):
        i -= 1
    end = max(i, start)
    s = max(0, fr[start][0] - int(pad_ms / 1000 * rate))
    e = min(len(a), fr[end][0] + int(FRAME * rate) + int(pad_ms / 1000 * rate))
    return _fade(a[s:e], rate)


def _spectral_profile(a: np.ndarray, rate: int):
    """Per-frame total energy in dB, 900-3000 Hz / 150-900 Hz ratio, and voicing."""
    n, h = int(FRAME * rate), int(HOP * rate)
    window = np.hanning(n)
    freqs = np.fft.rfftfreq(n, 1 / rate)
    low = (freqs >= 150) & (freqs < 900)
    mid = (freqs >= 900) & (freqs < 3000)
    db, ratio, voiced = [], [], []
    for i in range(0, max(1, len(a) - n), h):
        frame = a[i:i + n]
        if len(frame) < n:
            break
        power = np.abs(np.fft.rfft(frame * window)) ** 2
        db.append(10 * np.log10(max(power.sum(), 1e-12)))
        ratio.append(float(power[mid].sum() / max(power[low].sum(), 1e-12)))
        voiced.append(_f0(frame, rate) > 0)
    return np.array(db), np.array(ratio), np.array(voiced)


def _active(db: np.ndarray, floor_db: float = 30.0) -> tuple[int, int]:
    peak = float(db.max())
    idx = np.where(db > peak - floor_db)[0]
    return (int(idx[0]), int(idx[-1])) if len(idx) else (0, len(db) - 1)


def cut_at_voicing(a: np.ndarray, rate: int, keep_ms: float) -> np.ndarray:
    """
    Cut a voiceless consonant where the voice starts.

    Covers the stops - /b/ is asked for as /bə/ and the schwa removed - and the
    voiceless fricatives, where the engine adds a vowel of its own accord.
    `keep_ms` is what survives past the onset: enough that a stop's release is
    audible, too little for a vowel to have any colour.
    """
    db, _, voiced = _spectral_profile(a, rate)
    if not len(db):
        return a
    lo, hi = _active(db)
    peak = float(db.max())
    for i in range(lo, hi + 1):
        if voiced[i] and db[i] > peak - 18 and bool(voiced[i:i + 3].all()):
            end = int(i * HOP * rate) + int(keep_ms / 1000 * rate)
            return _fade(a[:min(len(a), end)], rate, fade_ms=25.0)
    return a


def cut_at_opening(a: np.ndarray, rate: int, keep_ms: float, factor: float = 2.2) -> np.ndarray:
    """
    Cut a voiced consonant where the mouth opens.

    /m/, /l/ and /z/ are periodic from their first frame, so voicing says
    nothing. What does change is the energy above 900 Hz: a nasal or a lateral
    keeps almost none of it, and the vowel that follows is full of it. The
    baseline is the consonant's own first 35 ms.
    """
    db, ratio, _ = _spectral_profile(a, rate)
    if not len(db):
        return a
    lo, hi = _active(db)
    settle = max(3, int(0.035 / HOP))
    base = float(np.median(ratio[lo:lo + settle])) + 1e-6
    for i in range(lo + settle, hi + 1):
        if float(ratio[i:i + 3].mean()) > base * factor:
            end = int(i * HOP * rate) + int(keep_ms / 1000 * rate)
            return _fade(a[:min(len(a), end)], rate, fade_ms=25.0)
    return a


def hold(a: np.ndarray, rate: int, target_ms: float, fade_ms: float = 18.0) -> np.ndarray:
    """
    Stretch a held consonant to `target_ms` by looping its steady middle.

    A sustained /m/ or /s/ does not change while it is held, so repeating a
    slice of it with a crossfade is inaudible - unlike a time-stretch, which
    smears the onset. Anything already long enough is returned untouched.
    """
    target = int(target_ms / 1000 * rate)
    if len(a) >= target:
        return a
    lo, hi = int(len(a) * 0.35), int(len(a) * 0.85)
    loop = a[lo:hi]
    xf = min(int(fade_ms / 1000 * rate), len(loop) // 3)
    if len(loop) < 3 * xf or xf < 2:
        return a
    out = a[:hi].copy()
    ramp = np.linspace(0, 1, xf)
    while len(out) < target:
        tail = out[-xf:] * (1 - ramp) + loop[:xf] * ramp
        out = np.concatenate([out[:-xf], tail, loop[xf:]])
    return _fade(out[:target], rate, fade_ms=fade_ms)


def normalize(a: np.ndarray, target_dbfs: float = -3.0) -> np.ndarray:
    """Peak-normalise. Perceptual loudness is levelled later, by ffmpeg."""
    peak = float(np.max(np.abs(a))) if len(a) else 0.0
    if peak < 1e-6:
        return a
    return a * (10 ** (target_dbfs / 20) / peak)


# --------------------------------------------------------------------------
# synthesis
# --------------------------------------------------------------------------

def build_phonemes(job: dict, tokenizer) -> str:
    """Turn a job's text / phonemes / parts into one IPA string."""
    if "phonemes" in job and job["phonemes"]:
        body = job["phonemes"]
    elif "parts" in job and job["parts"]:
        pieces = []
        for part in job["parts"]:
            if isinstance(part, dict):
                pieces.append(part["ph"])
            elif part in (".", "...", "?", "!", ","):
                pieces.append(part)
            else:
                pieces.append(tokenizer.phonemize(part))
        body = " ".join(pieces).replace(" .", ".").replace(" ,", ",").replace(" ?", "?")
    else:
        body = tokenizer.phonemize(job["text"])
    body = body.strip()
    return body if body.endswith((".", "?", "!")) else body + "."


def write_wav(path: Path, a: np.ndarray, rate: int) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)
    pcm = (np.clip(a, -1.0, 1.0) * 32767).astype(np.int16)
    with wave.open(str(path), "wb") as w:
        w.setnchannels(1)
        w.setsampwidth(2)
        w.setframerate(rate)
        w.writeframes(pcm.tobytes())


def main() -> int:
    p = argparse.ArgumentParser(description="Synthesize voice clips with Kokoro")
    p.add_argument("--jobs", required=True, help="JSON file: [{id, text|phonemes|parts, cut}]")
    p.add_argument("--model", required=True)
    p.add_argument("--voices", required=True)
    p.add_argument("--out", required=True, help="Directory for the raw WAVs")
    p.add_argument("--voice", default=VOICE)
    p.add_argument("--speed", type=float, default=SPEED)
    args = p.parse_args()

    from kokoro_onnx import Kokoro
    from kokoro_onnx.tokenizer import Tokenizer

    jobs = json.loads(Path(args.jobs).read_text(encoding="utf-8"))
    if not jobs:
        print("nothing to synthesize", file=sys.stderr)
        return 0

    kokoro = Kokoro(args.model, args.voices)
    tokenizer = Tokenizer()
    out_dir = Path(args.out)

    report = []
    for n, job in enumerate(jobs, 1):
        phonemes = build_phonemes(job, tokenizer)
        audio, rate = kokoro.create(
            phonemes, voice=args.voice, speed=args.speed, lang="en-us", is_phonemes=True
        )
        audio = np.asarray(audio, dtype=np.float32)
        raw = len(audio) / rate
        audio = trim(audio, rate)
        cut = job.get("cut")
        if cut:
            mode, keep = cut["mode"], float(cut["keep"])
            audio = (cut_at_voicing if mode == "voicing" else cut_at_opening)(audio, rate, keep)
            if cut.get("hold"):
                audio = hold(audio, rate, float(cut["hold"]))
        audio = normalize(audio)
        write_wav(out_dir / f"{job['id']}.wav", audio, rate)
        report.append({"id": job["id"], "phonemes": phonemes,
                       "raw": round(raw, 3), "duration": round(len(audio) / rate, 3)})
        if n % 25 == 0 or n == len(jobs):
            print(f"  synthesized {n}/{len(jobs)}", file=sys.stderr, flush=True)

    print(json.dumps(report))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
