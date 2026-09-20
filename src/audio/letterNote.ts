import type { LetterId } from '../data/letters'
import { LETTER_IDS } from '../data/letters'

/**
 * Every letter has its own note, pitched by its position in the alphabet:
 * A low, Z high.
 *
 * This is the per-answer reward. Confetti on every single answer stops meaning
 * anything after forty answers; a note that is always the same for the same
 * letter quietly teaches the alphabet as a scale, and after a week a child
 * guesses that a "high" letter is near the end before seeing it.
 */

// A pentatonic run: any two notes sound fine together, so a wrong-order
// sequence never sounds like a mistake.
const PENTATONIC = [0, 2, 4, 7, 9]
const BASE_HZ = 196 // G3

function semitonesFor(index: number): number {
  const octave = Math.floor(index / PENTATONIC.length)
  return PENTATONIC[index % PENTATONIC.length] + octave * 12
}

export function letterFrequency(letter: LetterId): number {
  const index = LETTER_IDS.indexOf(letter)
  const safeIndex = index < 0 ? 0 : index
  return BASE_HZ * Math.pow(2, semitonesFor(safeIndex) / 12)
}

let ctx: AudioContext | null = null

function context(): AudioContext | null {
  if (ctx) return ctx
  const Ctor =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!Ctor) return null
  try {
    ctx = new Ctor()
    return ctx
  } catch {
    return null
  }
}

/** Plays the letter's note as a short bell-like triad. */
export function playLetterNote(letter: LetterId, muted = false): void {
  if (muted) return
  const ac = context()
  if (!ac) return
  if (ac.state === 'suspended') void ac.resume()

  const root = letterFrequency(letter)
  const now = ac.currentTime
  const voices = [
    { ratio: 1, gain: 0.32, dur: 0.5 },
    { ratio: 1.5, gain: 0.16, dur: 0.42 },
    { ratio: 2, gain: 0.1, dur: 0.36 },
  ]
  try {
    for (const voice of voices) {
      const osc = ac.createOscillator()
      const gain = ac.createGain()
      osc.type = 'triangle'
      osc.frequency.value = root * voice.ratio
      gain.gain.setValueAtTime(0.0001, now)
      gain.gain.exponentialRampToValueAtTime(voice.gain, now + 0.015)
      gain.gain.exponentialRampToValueAtTime(0.0001, now + voice.dur)
      osc.connect(gain)
      gain.connect(ac.destination)
      osc.start(now)
      osc.stop(now + voice.dur + 0.05)
    }
  } catch {
    /* sound must never break gameplay */
  }
}
