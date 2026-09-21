import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { graphemeDefault, graphemeInfo, type Phoneme } from '../data/phonics'
import { WORD_BY_ID, type WordEntry } from '../data/words'

/**
 * Text to speech, written around what WebKit actually does rather than what
 * the spec says.
 *
 * The rules that shaped this file:
 *  - iOS arms an autoplay restriction per document; the first `speak()` has to
 *    happen inside a real gesture, and a blocked call returns silently with no
 *    error. Every visit therefore needs a warm-up on first touch.
 *  - Warming up with empty text wedges the queue forever, because the queue
 *    only advances when an utterance reports completion and an empty one never
 *    does. The warm-up says "." at near-zero volume instead.
 *  - `cancel()` followed by `speak()` in the same tick plays the new utterance
 *    but never fires its events, so a short gap is left between the two.
 *  - SSML is read out loud verbatim, so text must never contain angle brackets.
 *  - With no `lang` and no voice, WebKit falls back to the *device* language:
 *    English text in a Russian voice. `lang` is always set.
 */

const PREFERRED_URI_FRAGMENTS = ['en-US.Samantha', 'en-GB.Daniel', 'en-US.Alex']

let preferred: SpeechSynthesisVoice | null = null
let warmed = false
let speakingUntil = 0

function refreshVoices(): void {
  if (!ttsSupported()) return
  const voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return
  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang))
  // Match on voiceURI: names are localised and not stable across devices.
  const byUri = english.find((v) =>
    PREFERRED_URI_FRAGMENTS.some((fragment) => v.voiceURI.includes(fragment)),
  )
  const us = english.find((v) => /^en[-_]US/i.test(v.lang))
  preferred = byUri ?? us ?? english[0] ?? null
}

if ('speechSynthesis' in window) {
  // Safari usually returns the list synchronously, but newer builds moved to an
  // async fetch, so both paths are covered.
  refreshVoices()
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
  if (!preferred) {
    let tries = 0
    const poll = window.setInterval(() => {
      refreshVoices()
      tries += 1
      if (preferred || tries > 12) window.clearInterval(poll)
    }, 150)
  }
}

export function ttsSupported(): boolean {
  return 'speechSynthesis' in window
}

/** Must run inside a user gesture. Safe to call repeatedly. */
export function warmUpSpeech(): void {
  if (warmed || !ttsSupported()) return
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

/** True while an utterance is expected to still be playing. */
export function isSpeaking(): boolean {
  return Date.now() < speakingUntil
}

/** Stops everything. Recognition and synthesis must never overlap on iOS. */
export function stopSpeaking(): void {
  if (!ttsSupported()) return
  try {
    window.speechSynthesis.cancel()
  } catch {
    /* ignore */
  }
  speakingUntil = 0
}

export interface SpeakOptions {
  /** 0.4-0.8 is the comfortable range for a child on iOS. */
  readonly rate?: number
  readonly pitch?: number
}

export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported()) return Promise.resolve()
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
        u.rate = options.rate ?? 0.8
        u.pitch = options.pitch ?? 1.1
        let settled = false
        const done = () => {
          if (settled) return
          settled = true
          speakingUntil = Math.min(speakingUntil, Date.now())
          resolve()
        }
        u.onend = done
        u.onerror = done
        // Safari drops onend often enough that a watchdog is mandatory.
        window.setTimeout(done, estimate)
        synth.speak(u)
      } catch {
        resolve()
      }
    }, 70)
  })
}

/**
 * Says a single letter.
 *
 * A bare lowercase character is read as the letter's name by Apple's voices.
 * Respelled names ("ef", "aitch") are unreliable: the engine sometimes spells
 * them out instead of pronouncing them.
 */
export function speakLetterName(letter: LetterId): Promise<void> {
  return speak(letterInfo(letter).lower, { rate: 0.7, pitch: 1.15 })
}

/** A letter inside a sentence needs the carrier phrase to be read as a name. */
export function letterInSentence(letter: LetterId): string {
  return `the letter, ${letterInfo(letter).lower}`
}

/**
 * Says a sound, not a name.
 *
 * Continuants have an honest respelling ("mmm", "sss"). A stop has none: any
 * attempt to voice /b/ alone produces "buh", and that schwa is exactly the
 * habit that stops "b-a-t" from ever becoming "bat". So a stop is only ever
 * spoken attached to the vowel that follows it in the word, and when there is
 * no word to attach it to, the whole example word is said instead.
 */
export function speakSound(g: string, context?: string): Promise<void> {
  const info = graphemeDefault(g)
  if (!info) return speak(g)
  if (info.say) return speak(info.say, { rate: 0.55, pitch: 1.05 })
  if (context) return speak(context, { rate: 0.6 })
  return speak(info.example, { rate: 0.6 })
}

/** Stretches a word out so the sounds run into each other with no gaps. */
export function blendText(word: WordEntry): string {
  return word.units
    .map((unit) => {
      const info = graphemeInfo(unit.g, unit.p)
      return info.continuant && info.say ? info.say : unit.g
    })
    .join('')
}

/**
 * The blend, as one utterance spanning the whole motion: silence in the
 * middle is the very error being corrected, so it is never two calls.
 */
export function speakBlend(word: WordEntry): Promise<void> {
  return speak(`${blendText(word)}. ${word.text}`, { rate: 0.5 })
}

export function speakWord(word: WordEntry): Promise<void> {
  return speak(word.text, { rate: 0.75 })
}

/**
 * Reads back a spelling the child just produced, even a wrong one: "cot".
 * Hearing that it does not say the word is the lesson.
 */
export function speakSpelling(units: readonly { readonly g: string; readonly p: readonly Phoneme[] }[]): Promise<void> {
  const text = units.map((unit) => unit.g).join('')
  const known = WORD_BY_ID.get(text)
  if (known) return speakWord(known)
  return speak(text, { rate: 0.5 })
}
