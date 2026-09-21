import type { LetterId } from '../data/letters'
import { letterInfo, isLetterId } from '../data/letters'
import { GRAPHEMES, graphemeDefault, graphemeInfo, type Phoneme } from '../data/phonics'
import { WORD_BY_ID, type WordEntry } from '../data/words'
import {
  isSpeaking as clipIsSpeaking,
  say,
  speakLetterSound,
  stopSpeaking as stopClips,
  unlockVoice,
} from './voice'

/**
 * Everything the app says, by meaning rather than by text.
 *
 * Each call resolves to a prerecorded clip when one exists and to
 * speechSynthesis when it does not, so a new word in words.ts is audible
 * before its audio has been generated. The call sites still pass the sentence
 * they mean; this file is where a sentence becomes a clip id.
 */

/** Natural tempo is 1; the clips are slowed at playback, never at synthesis. */
const CHILD_RATE = 0.9

export function ttsSupported(): boolean {
  return 'speechSynthesis' in window
}

/** Must run inside a user gesture. Safe to call repeatedly. */
export function warmUpSpeech(): void {
  unlockVoice()
}

export function isSpeaking(): boolean {
  return clipIsSpeaking()
}

/** Stops everything, including what was queued. Recognition must never overlap. */
export function stopSpeaking(): void {
  stopClips()
}

export interface SpeakOptions {
  /** Synthesis rate; clips ignore it and play at the child tempo. */
  readonly rate?: number
  readonly pitch?: number
}

const LINE_CLIPS: Readonly<Record<string, string>> = {
  'What letter is this?': 'ask/whatletter',
  'Which one is this?': 'ask/whichone',
  'What word is this?': 'ask/whatword',
  'Try again!': 'hint/tryagain',
  'Nice!': 'praise/nice',
  'Well done!': 'praise/welldone',
  'You did it!': 'praise/youdidit',
  'Great job!': 'praise/great',
  'b has its tummy at the back. d has its tummy at the front.': 'twin/bd',
  'p has its ball on the right. q has its ball on the left.': 'twin/pq',
  'M points down. W points up.': 'twin/mw',
  'G is a C with a little shelf.': 'twin/cg',
  'U is round at the bottom. V is pointy.': 'twin/uv',
  'E has three arms. F has two.': 'twin/ef',
}

const SENTENCE_PATTERNS: readonly (readonly [RegExp, string])[] = [
  [/^Find all the letters?, ([a-z])$/i, 'findall'],
  [/^Find the letter, ([a-z])$/i, 'find'],
  [/^Type the letter, ([a-z])$/i, 'type'],
  [/^Trace the letter, ([a-z])$/i, 'trace'],
  [/^([a-z])\. \1 for .+$/i, 'traced'],
  [/^([a-z]) for .+$/i, 'isfor'],
  [/^([a-z]) and \1\. The same letter$/i, 'same'],
]

/** The clip that says this line, if the inventory has one. */
function clipForText(text: string): string | null {
  const line = LINE_CLIPS[text]
  if (line) return line
  for (const [pattern, id] of SENTENCE_PATTERNS) {
    const match = text.match(pattern)
    if (!match) continue
    const letter = match[1].toUpperCase()
    if (isLetterId(letter)) return `say/${id}/${letter}`
  }
  const sound = GRAPHEMES.find((g) => g.say === text)
  if (sound) return `sound/${sound.clip}`
  const lower = text.toLowerCase()
  if (WORD_BY_ID.has(lower)) return `read/word/${lower}`
  // A bare grapheme is its sound: BlendIt shows "b" and means /b/, not "bee".
  const grapheme = graphemeDefault(lower)
  if (grapheme && lower.length <= 2) return `sound/${grapheme.clip}`
  if (/^[a-z]{2,4}$/.test(lower)) return `read/syl/${lower}`
  return null
}

export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  const clean = text.trim()
  if (!clean) return Promise.resolve()
  const id = clipForText(clean) ?? `text/${clean}`
  return say(id, { rate: CHILD_RATE, fallback: clean, ...(options.rate ? { synthRate: options.rate } : {}) })
}

/** Says a single letter's name: "bee", never the glyph spelled out. */
export function speakLetterName(letter: LetterId): Promise<void> {
  // A bare lowercase character is the one spelling Apple's voices read as a
  // name, so it stays the fallback.
  return say(`name/${letter}`, { rate: CHILD_RATE, fallback: letterInfo(letter).lower })
}

/** A letter inside a sentence needs the carrier phrase to be read as a name. */
export function letterInSentence(letter: LetterId): string {
  return `the letter, ${letterInfo(letter).lower}`
}

/**
 * Says a sound, not a name.
 *
 * The clip of a stop is a /b/ with its vowel cut off. Without a clip, a
 * continuant has an honest respelling ("mmm"); a stop has none - any attempt
 * to voice /b/ alone produces "buh" - so the example word is said instead.
 */
export function speakSound(g: string, context?: string): Promise<void> {
  const info = graphemeDefault(g)
  if (!info) return speak(g)
  const upper = g.toUpperCase()
  if (g.length === 1 && isLetterId(upper)) {
    return speakLetterSound(upper, {
      rate: CHILD_RATE,
      fallback: info.say ?? context ?? info.example,
    })
  }
  return say(`sound/${info.clip}`, { rate: CHILD_RATE, fallback: info.say ?? context ?? info.example })
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
 * The blend, then the word. The clip spans the whole motion in one breath:
 * silence in the middle is the very error being corrected.
 */
export function speakBlend(word: WordEntry): Promise<void> {
  return say(`read/blend/${word.id}`, { rate: CHILD_RATE, fallback: blendText(word) }).then(() =>
    speakWord(word),
  )
}

export function speakWord(word: WordEntry): Promise<void> {
  return say(`read/word/${word.id}`, { rate: CHILD_RATE, fallback: word.text })
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
