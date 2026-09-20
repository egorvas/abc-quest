/**
 * Procedural sound effects via Web Audio.
 *
 * No audio files: everything is synthesised, so the app stays tiny and works
 * offline. iOS suspends the AudioContext until a user gesture, so `unlock()`
 * must be called from inside a real touch handler before anything will sound.
 */

type SfxName =
  | 'tap'
  | 'correct'
  | 'wrong'
  | 'levelUp'
  | 'star'
  | 'whoosh'
  | 'pop'
  | 'sparkle'

let ctx: AudioContext | null = null
let master: GainNode | null = null
let muted = false

function audioContext(): AudioContext | null {
  if (ctx) return ctx
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext })
      .webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    master = ctx.createGain()
    master.gain.value = 0.35
    master.connect(ctx.destination)
    return ctx
  } catch {
    return null
  }
}

/** Call from a user gesture. Safe to call repeatedly. */
export function unlockAudio(): void {
  const ac = audioContext()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume()
  // A zero-length silent buffer is the classic iOS unlock trick.
  try {
    const buf = ac.createBuffer(1, 1, 22050)
    const src = ac.createBufferSource()
    src.buffer = buf
    src.connect(ac.destination)
    src.start(0)
  } catch {
    /* ignore - unlocking is best effort */
  }
}

export function setMuted(value: boolean): void {
  muted = value
}

export function isMuted(): boolean {
  return muted
}

interface ToneSpec {
  readonly freq: number
  readonly at: number
  readonly dur: number
  readonly type?: OscillatorType
  readonly gain?: number
  readonly slideTo?: number
}

function playTones(spec: readonly ToneSpec[]): void {
  if (muted) return
  const ac = audioContext()
  if (!ac || !master) return
  if (ac.state === 'suspended') void ac.resume()

  const now = ac.currentTime
  for (const tone of spec) {
    const osc = ac.createOscillator()
    const gain = ac.createGain()
    osc.type = tone.type ?? 'sine'
    const start = now + tone.at
    const end = start + tone.dur
    osc.frequency.setValueAtTime(tone.freq, start)
    if (tone.slideTo) {
      osc.frequency.exponentialRampToValueAtTime(Math.max(1, tone.slideTo), end)
    }
    const peak = tone.gain ?? 0.6
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(peak, start + 0.012)
    gain.gain.exponentialRampToValueAtTime(0.0001, end)
    osc.connect(gain)
    gain.connect(master)
    osc.start(start)
    osc.stop(end + 0.02)
  }
}

function noiseBurst(duration: number, gainValue: number): void {
  if (muted) return
  const ac = audioContext()
  if (!ac || !master) return
  const frames = Math.floor(ac.sampleRate * duration)
  const buffer = ac.createBuffer(1, frames, ac.sampleRate)
  const data = buffer.getChannelData(0)
  for (let i = 0; i < frames; i += 1) {
    data[i] = (Math.random() * 2 - 1) * (1 - i / frames)
  }
  const src = ac.createBufferSource()
  src.buffer = buffer
  const filter = ac.createBiquadFilter()
  filter.type = 'bandpass'
  filter.frequency.value = 1400
  const gain = ac.createGain()
  gain.gain.value = gainValue
  src.connect(filter)
  filter.connect(gain)
  gain.connect(master)
  src.start()
}

const RECIPES: Record<SfxName, () => void> = {
  tap: () => playTones([{ freq: 660, at: 0, dur: 0.07, type: 'triangle', gain: 0.35 }]),
  pop: () =>
    playTones([{ freq: 320, at: 0, dur: 0.12, type: 'sine', gain: 0.5, slideTo: 900 }]),
  whoosh: () => noiseBurst(0.22, 0.18),
  correct: () =>
    playTones([
      { freq: 523.25, at: 0, dur: 0.12, type: 'triangle' },
      { freq: 659.25, at: 0.1, dur: 0.12, type: 'triangle' },
      { freq: 783.99, at: 0.2, dur: 0.22, type: 'triangle' },
    ]),
  wrong: () =>
    playTones([
      // Deliberately soft and neutral - not a buzzer, not a scold.
      { freq: 330, at: 0, dur: 0.14, type: 'sine', gain: 0.35 },
      { freq: 262, at: 0.12, dur: 0.18, type: 'sine', gain: 0.3 },
    ]),
  star: () =>
    playTones([
      { freq: 880, at: 0, dur: 0.1, type: 'sine' },
      { freq: 1318.5, at: 0.08, dur: 0.16, type: 'sine' },
    ]),
  sparkle: () =>
    playTones([
      { freq: 1568, at: 0, dur: 0.07, type: 'sine', gain: 0.3 },
      { freq: 2093, at: 0.06, dur: 0.07, type: 'sine', gain: 0.25 },
      { freq: 2637, at: 0.12, dur: 0.1, type: 'sine', gain: 0.2 },
    ]),
  levelUp: () =>
    playTones([
      { freq: 392, at: 0, dur: 0.12, type: 'triangle' },
      { freq: 523.25, at: 0.11, dur: 0.12, type: 'triangle' },
      { freq: 659.25, at: 0.22, dur: 0.12, type: 'triangle' },
      { freq: 783.99, at: 0.33, dur: 0.12, type: 'triangle' },
      { freq: 1046.5, at: 0.44, dur: 0.35, type: 'triangle' },
    ]),
}

export function sfx(name: SfxName): void {
  try {
    RECIPES[name]()
  } catch {
    /* audio must never break gameplay */
  }
}
