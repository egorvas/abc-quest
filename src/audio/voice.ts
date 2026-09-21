/**
 * Prerecorded voice clips, played through Web Audio, with speechSynthesis as
 * the fallback for anything that has no clip.
 *
 * Why files instead of speechSynthesis: the device voice sometimes spelled a
 * letter name out instead of saying it, and cannot say an isolated /b/ without
 * a trailing "uh" - the exact habit that stops "b-a-t" from ever becoming
 * "bat". Every line is generated at build time by `npm run voice` (Kokoro,
 * Apache-2.0) and shipped as a small MP3 under public/voice.
 *
 * What WebKit forces on the design:
 *  - The AudioContext in sfx.ts is unlocked on first touch; this module reuses
 *    it rather than opening a second one, which on iOS would need its own
 *    gesture and would compete for the output.
 *  - Playing through an <audio> element poisons the next SpeechRecognition
 *    session, so everything goes through decodeAudioData and a buffer source.
 *  - decodeAudioData on older WebKit does not return a promise; both forms are
 *    handled.
 */

import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { GRAPHEMES, LETTER_SOUNDS } from '../data/phonics'
import type { WordEntry } from '../data/words'

const BASE = `${import.meta.env.BASE_URL}voice/`

interface ClipEntry {
  readonly key: string
  readonly bytes: number
  readonly duration: number | null
}

interface Manifest {
  readonly version: number
  readonly clips: Readonly<Record<string, ClipEntry>>
}

type Nodes = { readonly ctx: AudioContext; readonly master: GainNode } | null

let getNodes: () => Nodes = () => null

/** Wire this module to the context sfx.ts already unlocked. Call once, at boot. */
export function attachAudio(source: () => Nodes): void {
  getNodes = source
}

// ---------------------------------------------------------------------------
// clip ids
// ---------------------------------------------------------------------------

/**
 * Which clip says a letter's sound.
 *
 * Not `sound/<letter>`: c, k and ck are one sound and share one file, and q's
 * /kw/ belongs to no single grapheme. Derived from phonics.ts so it cannot
 * drift from what the build generated.
 */
const LETTER_SOUND_CLIP: Readonly<Record<string, string>> = Object.fromEntries(
  (Object.keys(LETTER_SOUNDS) as LetterId[]).map((L) => {
    const want = LETTER_SOUNDS[L].phoneme.join('+')
    if (want === 'k+w') return [L, 'q']
    const match =
      GRAPHEMES.find((g) => g.g === L.toLowerCase() && g.p.join('+') === want) ??
      GRAPHEMES.find((g) => g.p.join('+') === want)
    return [L, match?.clip ?? L.toLowerCase()]
  }),
)

export type SentenceId =
  | 'find' | 'findall' | 'type' | 'trace'
  | 'isfor' | 'traced' | 'whichletter' | 'isforwhat' | 'same'

// ---------------------------------------------------------------------------
// manifest
// ---------------------------------------------------------------------------

let manifest: Manifest | null = null
let manifestLoad: Promise<Manifest | null> | null = null

/**
 * Fetched once at boot. If it fails - a first visit offline, a half-finished
 * gh-pages push - every call falls through to speechSynthesis and the app still
 * works, just less well. A missing manifest is never an error the child sees.
 */
export function loadManifest(): Promise<Manifest | null> {
  if (manifestLoad) return manifestLoad
  manifestLoad = fetch(`${BASE}manifest.json`)
    .then((r) => (r.ok ? (r.json() as Promise<Manifest>) : null))
    .then((m) => {
      manifest = m
      return m
    })
    .catch(() => null)
  return manifestLoad
}

export function hasClip(id: string): boolean {
  return Boolean(manifest?.clips[id])
}

// ---------------------------------------------------------------------------
// buffer cache
// ---------------------------------------------------------------------------

/** Decoded once, then held for the session. The whole set is a few MB. */
const buffers = new Map<string, AudioBuffer>()
const inFlight = new Map<string, Promise<AudioBuffer | null>>()

function decode(ctx: AudioContext, bytes: ArrayBuffer): Promise<AudioBuffer> {
  // Older WebKit only has the callback form and returns undefined.
  return new Promise((resolve, reject) => {
    const maybe = ctx.decodeAudioData(bytes, resolve, reject)
    if (maybe && typeof maybe.then === 'function') maybe.then(resolve, reject)
  })
}

function fetchClip(id: string): Promise<AudioBuffer | null> {
  const cached = buffers.get(id)
  if (cached) return Promise.resolve(cached)
  const pending = inFlight.get(id)
  if (pending) return pending

  const nodes = getNodes()
  if (!nodes || !manifest?.clips[id]) return Promise.resolve(null)

  const job = fetch(`${BASE}${encodeURI(id)}.mp3`)
    .then((r) => (r.ok ? r.arrayBuffer() : Promise.reject(new Error(String(r.status)))))
    .then((bytes) => decode(nodes.ctx, bytes))
    .then((buffer) => {
      buffers.set(id, buffer)
      return buffer
    })
    .catch(() => null)
    .finally(() => {
      inFlight.delete(id)
    })

  inFlight.set(id, job)
  return job
}

/**
 * Warms the clips a round is about to need.
 *
 * Called from SessionScreen once the round's letters are chosen. Fetching is
 * deliberately serial: forty parallel requests on a weak connection delay the
 * very first prompt, and the first prompt is the one that matters.
 */
export async function preload(ids: readonly string[]): Promise<void> {
  await loadManifest()
  for (const id of ids) {
    if (!hasClip(id) || buffers.has(id)) continue
    await fetchClip(id)
  }
}

/** Everything a round on these letters can ask for. */
export function roundClipIds(letters: readonly LetterId[]): readonly string[] {
  const shared = ['ask/whatletter', 'hint/tryagain', 'praise/nice']
  const perLetter = letters.flatMap((L) => [
    `name/${L}`,
    `sound/${LETTER_SOUND_CLIP[L]}`,
    `word/${L}`,
    `say/find/${L}`,
    `say/isfor/${L}`,
  ])
  return [...perLetter, ...shared]
}

// ---------------------------------------------------------------------------
// the queue
// ---------------------------------------------------------------------------

/**
 * One line at a time, always.
 *
 * Two clips overlapping is not a cosmetic problem. In SayIt the prompt must be
 * finished and silent before the microphone opens, or iOS recognition returns
 * an empty result; a clip queued to start 200 ms later is just as fatal as one
 * already playing. `stopSpeaking` therefore empties the queue as well as
 * killing the current source.
 */
interface QueueItem {
  readonly play: () => Promise<void>
  readonly resolve: () => void
}

let queue: readonly QueueItem[] = []
let current: AudioBufferSourceNode | null = null
let draining = false
let speakingUntil = 0
let generation = 0

function drain(): void {
  if (draining) return
  const [next, ...rest] = queue
  if (!next) return
  queue = rest
  draining = true
  void next.play().finally(() => {
    draining = false
    next.resolve()
    drain()
  })
}

function enqueue(play: () => Promise<void>): Promise<void> {
  return new Promise<void>((resolve) => {
    queue = [...queue, { play, resolve }]
    drain()
  })
}

/**
 * LAME's encoder delay, in seconds, measured on the generated clips.
 *
 * Every MP3 starts with the encoder's priming samples. It is exactly 1105
 * samples at 24 kHz - 46.0 ms, identical on every clip in the set - and no
 * decoder strips it, because the build passes `-write_xing 0` and so ships no
 * gapless header. Deterministic silence is better than silence some browsers
 * remove and others do not, and 46 ms is simply skipped at playback.
 */
const MP3_PRIMING = 0.046

function playBuffer(buffer: AudioBuffer, rate: number): Promise<void> {
  const nodes = getNodes()
  if (!nodes) return Promise.resolve()
  const { ctx, master } = nodes
  if (ctx.state === 'suspended') void ctx.resume()

  const mine = ++generation
  return new Promise<void>((resolve) => {
    let settled = false
    const done = () => {
      if (settled) return
      settled = true
      if (generation === mine) {
        current = null
        speakingUntil = 0
      }
      resolve()
    }

    try {
      const source = ctx.createBufferSource()
      source.buffer = buffer
      // playbackRate is how a line is slowed for a child. The clips are
      // generated at natural tempo because slowing the MODEL down made single
      // letters worse, not better; slowing the PLAYBACK is a different thing
      // and is safe down to about 0.8.
      source.playbackRate.value = rate
      const gain = ctx.createGain()
      // Voice goes through the same master gain as the effects, so the mute
      // switch covers it, but louder: a prompt must win over a chime.
      gain.gain.value = 1.6
      source.connect(gain)
      gain.connect(master)
      source.onended = done
      current = source
      const ms = ((buffer.duration - MP3_PRIMING) / rate) * 1000
      speakingUntil = Date.now() + ms + 120
      // Start past the encoder's priming samples, so the clip begins the
      // instant it is asked for.
      source.start(0, MP3_PRIMING)
      // onended is dropped often enough on WebKit that a watchdog is mandatory.
      window.setTimeout(done, ms + 350)
    } catch {
      done()
    }
  })
}

// ---------------------------------------------------------------------------
// speechSynthesis fallback
// ---------------------------------------------------------------------------

const PREFERRED_URI_FRAGMENTS = ['en-US.Samantha', 'en-GB.Daniel', 'en-US.Alex']
let preferred: SpeechSynthesisVoice | null = null
let warmed = false

function refreshVoices(): void {
  if (!('speechSynthesis' in window)) return
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang))
  preferred =
    english.find((v) => PREFERRED_URI_FRAGMENTS.some((f) => v.voiceURI.includes(f))) ??
    english.find((v) => /^en[-_]US/i.test(v.lang)) ??
    english[0] ??
    null
}

if ('speechSynthesis' in window) {
  refreshVoices()
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
}

function synthesize(text: string, rate: number): Promise<void> {
  if (!('speechSynthesis' in window)) return Promise.resolve()
  // Angle brackets would be read out character by character.
  const clean = text.replace(/[<>]/g, ' ').trim()
  if (!clean) return Promise.resolve()

  const synth = window.speechSynthesis
  try {
    synth.cancel()
  } catch {
    /* ignore */
  }
  const estimate = 500 + clean.length * 110
  speakingUntil = Date.now() + estimate

  return new Promise<void>((resolve) => {
    // The gap is what makes onend fire at all after a cancel().
    window.setTimeout(() => {
      try {
        const u = new SpeechSynthesisUtterance(clean)
        u.lang = preferred?.lang ?? 'en-US'
        if (preferred) u.voice = preferred
        u.rate = rate
        u.pitch = 1.1
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          speakingUntil = 0
          resolve()
        }
        u.onend = done
        u.onerror = done
        window.setTimeout(done, estimate)
        synth.speak(u)
      } catch {
        resolve()
      }
    }, 70)
  })
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------

export interface SayOptions {
  /** 1 is the generated tempo. 0.85 is a comfortable slow-down for a child. */
  readonly rate?: number
  /** Spoken by speechSynthesis when no clip exists. Null means say nothing. */
  readonly fallback?: string | null
  /** Synthesis rate for the fallback; defaults to a child-friendly 0.8. */
  readonly synthRate?: number
}

export function voiceSupported(): boolean {
  return Boolean(manifest) || 'speechSynthesis' in window
}

/** True while a clip or an utterance is expected to still be sounding. */
export function isSpeaking(): boolean {
  return Date.now() < speakingUntil
}

/** Silence everything and forget what was queued. Called before the mic opens. */
export function stopSpeaking(): void {
  generation += 1
  queue = []
  try {
    current?.stop()
  } catch {
    /* already ended */
  }
  current = null
  speakingUntil = 0
  if ('speechSynthesis' in window) {
    try {
      window.speechSynthesis.cancel()
    } catch {
      /* ignore */
    }
  }
}

/**
 * Must run inside a user gesture, next to unlockAudio() in sfx.ts.
 *
 * Unlocking the AudioContext is sfx.ts's job. What is left here is the one-off
 * warm-up of speechSynthesis, still needed because the fallback path has to be
 * usable later without a gesture of its own. Warming up with empty text wedges
 * the WebKit queue forever, so it says "." at near-zero volume.
 */
export function unlockVoice(): void {
  void loadManifest()
  if (warmed || !('speechSynthesis' in window)) return
  warmed = true
  try {
    const u = new SpeechSynthesisUtterance('.')
    u.lang = 'en-US'
    u.volume = 0.01
    u.rate = 2
    window.speechSynthesis.speak(u)
    refreshVoices()
  } catch {
    /* best effort */
  }
}

/**
 * Says a clip by id, resolving when it has finished.
 *
 * Nothing overlaps: the call waits its turn. A missing clip falls back to
 * speechSynthesis, which is what makes it safe to add a word to words.ts before
 * its audio has been generated.
 */
export function say(id: string, options: SayOptions = {}): Promise<void> {
  const rate = options.rate ?? 1
  return enqueue(async () => {
    await loadManifest()
    const buffer = hasClip(id) ? await fetchClip(id) : null
    if (buffer) {
      await playBuffer(buffer, rate)
      return
    }
    if (options.fallback) await synthesize(options.fallback, options.synthRate ?? 0.8)
  })
}

/** Free text. Only ever reaches the fallback; nothing generates arbitrary text. */
export function speak(text: string, options: SayOptions = {}): Promise<void> {
  return say(`text/${text}`, { ...options, fallback: options.fallback ?? text })
}

/** The letter's name: "bee", never the glyph spelled out. */
export function speakLetterName(letter: LetterId, options: SayOptions = {}): Promise<void> {
  return say(`name/${letter}`, { fallback: letterInfo(letter).name, ...options })
}

/**
 * The letter's phonic sound: a held /f/, or a /b/ whose schwa has been cut off.
 *
 * `fallback` is null on purpose for a stop. speechSynthesis cannot say /b/
 * without "uh", and teaching "buh" is worse than teaching nothing: saying the
 * example word instead is what speakSound already does today.
 */
export function speakLetterSound(letter: LetterId, options: SayOptions = {}): Promise<void> {
  return say(`sound/${LETTER_SOUND_CLIP[letter]}`, {
    fallback: LETTER_SOUNDS[letter].say,
    ...options,
  })
}

/** A grapheme's sound by its phonics.ts clip key: 'm', 'sh', 'a_short'. */
export function speakSoundClip(clip: string, options: SayOptions = {}): Promise<void> {
  return say(`sound/${clip}`, { fallback: null, ...options })
}

/** The association word on its own. */
export function speakAssociationWord(letter: LetterId): Promise<void> {
  return say(`word/${letter}`, { fallback: letterInfo(letter).word })
}

/**
 * A full prompt sentence: sentence('find', 'B') -> "Find the letter, B."
 *
 * Whole sentences are generated rather than glued from a carrier plus a letter
 * clip, because a join in the middle of a phrase is audible, and a five-year-old
 * hears it as two separate instructions.
 */
export function sentence(id: SentenceId, letter: LetterId): Promise<void> {
  return say(`say/${id}/${letter}`, { fallback: FALLBACK_TEXT[id](letter) })
}

export function speakWord(word: WordEntry, options: SayOptions = {}): Promise<void> {
  return say(`read/word/${word.id}`, { fallback: word.text, ...options })
}

/** The word stretched into one continuous sound, then said whole. */
export function speakBlend(word: WordEntry): Promise<void> {
  return say(`read/blend/${word.id}`, { fallback: null }).then(() =>
    speakWord(word, { rate: 0.9 }),
  )
}

/** A syllable or rime: 'at', 'ock', 'ell'. */
export function speakSyllable(syllable: string): Promise<void> {
  return say(`read/syl/${syllable}`, { fallback: null })
}

/** Only ever reached when a clip is missing; keep in step with inventory.ts. */
const FALLBACK_TEXT: Readonly<Record<SentenceId, (letter: LetterId) => string>> = {
  find: (l) => `Find the letter, ${letterInfo(l).name}`,
  findall: (l) => `Find all the letters, ${letterInfo(l).name}`,
  type: (l) => `Type the letter, ${letterInfo(l).name}`,
  trace: (l) => `Trace the letter, ${letterInfo(l).name}`,
  isfor: (l) => `${letterInfo(l).name}. ${letterInfo(l).name} is for ${letterInfo(l).word}`,
  traced: (l) => `${letterInfo(l).name}. ${letterInfo(l).name} for ${letterInfo(l).word}`,
  whichletter: (l) => `${letterInfo(l).word}. Which letter?`,
  isforwhat: (l) => `${letterInfo(l).name}. ${letterInfo(l).name} is for...`,
  same: (l) => `${letterInfo(l).name} and ${letterInfo(l).name}. The same letter`,
}

/**
 * "mmm... Moon" - the line FirstSound plays after a second miss.
 *
 * Two clips, not one recording, and that is on purpose: a stop's schwa is cut
 * by trimming the end of its clip, so /b/ can only stay a /b/ while it is the
 * whole clip. The pause between the sound and the word is what the child needs
 * to hear anyway.
 */
export function speakSoundWord(letter: LetterId): Promise<void> {
  return speakLetterSound(letter).then(() => speakAssociationWord(letter))
}
