import type { LetterId } from './letters'

/**
 * Phonemes, graphemes and the order the sounds are taught in.
 *
 * Static data; never goes to localStorage. Two things here shape the whole
 * reading track:
 *
 *  - A grapheme is `continuant` when it can be held and stretched into the
 *    next sound: "mmmaaan" becomes "man". A stop cannot be produced alone
 *    without a parasitic vowel, and "buh-a-tuh" never becomes "bat". So the
 *    first blending words use continuant onsets only, and a stop is never
 *    voiced on its own by any mode - it is spoken attached to its vowel.
 *  - `say` is the speech-synthesis fallback for a sound. It is null wherever
 *    a fallback would do harm, which is every stop and every vowel the Apple
 *    voices read as a letter name.
 */

export const PHONEMES = [
  'p', 'b', 't', 'd', 'k', 'g', 'f', 'v', 'θ', 'ð', 's', 'z', 'ʃ', 'ʒ',
  'tʃ', 'dʒ', 'm', 'n', 'ŋ', 'l', 'r', 'w', 'j', 'h',
  'æ', 'ɛ', 'ɪ', 'ɑ', 'ʌ', 'ə', 'i', 'u', 'ʊ', 'ɔ',
] as const
export type Phoneme = (typeof PHONEMES)[number]

const PHONEME_SET: ReadonlySet<string> = new Set(PHONEMES)
export function isPhoneme(value: string): value is Phoneme {
  return PHONEME_SET.has(value)
}

export interface GraphemeInfo {
  /** The letters, lowercase, exactly as they appear in the spelling. */
  readonly g: string
  /** What it says. More than one phoneme only for x. */
  readonly p: readonly Phoneme[]
  readonly kind: 'vowel' | 'consonant'
  readonly continuant: boolean
  /** Audio clip key, the primary way the sound is played. */
  readonly clip: string
  /** Speech-synthesis fallback, or null when saying it alone would mislead. */
  readonly say: string | null
  readonly example: string
}

export const GRAPHEMES: readonly GraphemeInfo[] = [
  { g: 'm', p: ['m'], kind: 'consonant', continuant: true, clip: 'm', say: 'mmm', example: 'man' },
  { g: 's', p: ['s'], kind: 'consonant', continuant: true, clip: 's', say: 'sss', example: 'sun' },
  { g: 'f', p: ['f'], kind: 'consonant', continuant: true, clip: 'f', say: 'fff', example: 'fan' },
  { g: 'n', p: ['n'], kind: 'consonant', continuant: true, clip: 'n', say: 'nnn', example: 'net' },
  { g: 'l', p: ['l'], kind: 'consonant', continuant: true, clip: 'l', say: 'lll', example: 'leg' },
  { g: 'r', p: ['r'], kind: 'consonant', continuant: true, clip: 'r', say: 'rrr', example: 'rat' },
  { g: 'v', p: ['v'], kind: 'consonant', continuant: true, clip: 'v', say: 'vvv', example: 'van' },
  { g: 'z', p: ['z'], kind: 'consonant', continuant: true, clip: 'z', say: 'zzz', example: 'zip' },
  { g: 'h', p: ['h'], kind: 'consonant', continuant: true, clip: 'h', say: null, example: 'hat' },
  { g: 'w', p: ['w'], kind: 'consonant', continuant: true, clip: 'w', say: null, example: 'web' },
  { g: 'y', p: ['j'], kind: 'consonant', continuant: true, clip: 'y', say: null, example: 'yes' },
  { g: 'p', p: ['p'], kind: 'consonant', continuant: false, clip: 'p', say: null, example: 'pig' },
  { g: 'b', p: ['b'], kind: 'consonant', continuant: false, clip: 'b', say: null, example: 'bed' },
  { g: 't', p: ['t'], kind: 'consonant', continuant: false, clip: 't', say: null, example: 'ten' },
  { g: 'd', p: ['d'], kind: 'consonant', continuant: false, clip: 'd', say: null, example: 'dog' },
  { g: 'k', p: ['k'], kind: 'consonant', continuant: false, clip: 'k', say: null, example: 'kid' },
  { g: 'c', p: ['k'], kind: 'consonant', continuant: false, clip: 'k', say: null, example: 'cat' },
  { g: 'g', p: ['g'], kind: 'consonant', continuant: false, clip: 'g', say: null, example: 'dog' },
  { g: 'j', p: ['dʒ'], kind: 'consonant', continuant: false, clip: 'j', say: null, example: 'job' },
  { g: 'x', p: ['k', 's'], kind: 'consonant', continuant: false, clip: 'x', say: 'ks', example: 'fox' },
  { g: 'a', p: ['æ'], kind: 'vowel', continuant: true, clip: 'a_short', say: null, example: 'cat' },
  { g: 'e', p: ['ɛ'], kind: 'vowel', continuant: true, clip: 'e_short', say: 'eh', example: 'bed' },
  { g: 'i', p: ['ɪ'], kind: 'vowel', continuant: true, clip: 'i_short', say: 'ih', example: 'pig' },
  { g: 'o', p: ['ɑ'], kind: 'vowel', continuant: true, clip: 'o_short', say: null, example: 'dog' },
  { g: 'u', p: ['ʌ'], kind: 'vowel', continuant: true, clip: 'u_short', say: 'uh', example: 'sun' },
  // Unstressed vowels, the two-syllable stage only.
  { g: 'e', p: ['ə'], kind: 'vowel', continuant: true, clip: 'schwa', say: null, example: 'camel' },
  { g: 'o', p: ['ə'], kind: 'vowel', continuant: true, clip: 'schwa', say: null, example: 'lemon' },
  { g: 'a', p: ['ə'], kind: 'vowel', continuant: true, clip: 'schwa', say: null, example: 'panda' },
  // Consonant digraphs.
  { g: 'ck', p: ['k'], kind: 'consonant', continuant: false, clip: 'k', say: null, example: 'duck' },
  { g: 'sh', p: ['ʃ'], kind: 'consonant', continuant: true, clip: 'sh', say: 'shh', example: 'ship' },
  { g: 'ch', p: ['tʃ'], kind: 'consonant', continuant: false, clip: 'ch', say: null, example: 'chick' },
  { g: 'ng', p: ['ŋ'], kind: 'consonant', continuant: true, clip: 'ng', say: null, example: 'ring' },
  { g: 'th', p: ['θ'], kind: 'consonant', continuant: true, clip: 'th', say: 'thhh', example: 'bath' },
  // Doubled letters: one sound.
  { g: 'll', p: ['l'], kind: 'consonant', continuant: true, clip: 'l', say: 'lll', example: 'bell' },
  { g: 'ss', p: ['s'], kind: 'consonant', continuant: true, clip: 's', say: 'sss', example: 'miss' },
  { g: 'ff', p: ['f'], kind: 'consonant', continuant: true, clip: 'f', say: 'fff', example: 'muffin' },
  { g: 'zz', p: ['z'], kind: 'consonant', continuant: true, clip: 'z', say: 'zzz', example: 'buzz' },
  { g: 'gg', p: ['g'], kind: 'consonant', continuant: false, clip: 'g', say: null, example: 'egg' },
  { g: 'bb', p: ['b'], kind: 'consonant', continuant: false, clip: 'b', say: null, example: 'rabbit' },
  { g: 'tt', p: ['t'], kind: 'consonant', continuant: false, clip: 't', say: null, example: 'mitten' },
  { g: 'nn', p: ['n'], kind: 'consonant', continuant: true, clip: 'n', say: 'nnn', example: 'tennis' },
  { g: 'pp', p: ['p'], kind: 'consonant', continuant: false, clip: 'p', say: null, example: 'puppy' },
]

/** Keyed on (grapheme, phonemes) because e, o and a each spell two things. */
const GRAPHEME_INDEX: ReadonlyMap<string, GraphemeInfo> = new Map(
  GRAPHEMES.map((info) => [`${info.g}=${info.p.join('+')}`, info] as const),
)

export function graphemeInfo(g: string, p: readonly Phoneme[]): GraphemeInfo {
  const found = GRAPHEME_INDEX.get(`${g}=${p.join('+')}`)
  if (!found) throw new Error(`Unknown grapheme mapping: ${g} -> ${p.join('+')}`)
  return found
}

/** The default reading of a grapheme, for places that have no phoneme context. */
export function graphemeDefault(g: string): GraphemeInfo | null {
  return GRAPHEMES.find((info) => info.g === g) ?? null
}

/**
 * The order sounds are taught in.
 *
 * Not the same as INTRO_ORDER in curriculum.ts, and it must not be: that
 * order fights name-rhyme clusters and Cyrillic false friends, which are
 * problems of shape and name. This one is chosen for blendability - the
 * continuants lead - and for word yield, so a set makes real words the day it
 * is finished.
 */
export const SOUND_SETS: readonly (readonly string[])[] = [
  ['m', 'a', 's', 't', 'p', 'i', 'n'],
  ['f', 'o', 'd', 'g'],
  ['u', 'l', 'h', 'b'],
  ['e', 'r', 'c', 'k'],
  ['v', 'w', 'j', 'y', 'z', 'x'],
  ['ck', 'sh', 'ng', 'ch', 'll', 'ss', 'ff', 'zz', 'gg', 'th'],
]

/**
 * The corrected letter-sound table.
 *
 * The old respellings ("buh", "kuh", "tuh") were eleven schwas: the sound the
 * child was being taught to say is the sound that stops "b-a-t" from ever
 * becoming "bat". A stop is never said alone; `say` is null for it.
 */
export interface LetterSound {
  readonly id: LetterId
  readonly phoneme: readonly Phoneme[]
  /** Synthesis fallback for the isolated sound, or null: never say it alone. */
  readonly say: string | null
  /** The exemplar for the picture game, with where the sound sits in it. */
  readonly soundWord: {
    readonly word: string
    readonly emoji: string
    readonly position: 'initial' | 'medial' | 'final'
  }
}

export const LETTER_SOUNDS: Readonly<Record<LetterId, LetterSound>> = {
  A: { id: 'A', phoneme: ['æ'], say: null, soundWord: { word: 'Apple', emoji: '🍎', position: 'initial' } },
  B: { id: 'B', phoneme: ['b'], say: null, soundWord: { word: 'Ball', emoji: '⚽', position: 'initial' } },
  C: { id: 'C', phoneme: ['k'], say: null, soundWord: { word: 'Cat', emoji: '🐱', position: 'initial' } },
  D: { id: 'D', phoneme: ['d'], say: null, soundWord: { word: 'Dog', emoji: '🐶', position: 'initial' } },
  E: { id: 'E', phoneme: ['ɛ'], say: 'eh', soundWord: { word: 'Elephant', emoji: '🐘', position: 'initial' } },
  F: { id: 'F', phoneme: ['f'], say: 'fff', soundWord: { word: 'Fish', emoji: '🐟', position: 'initial' } },
  // Giraffe is /dʒ/, the opposite of what the letter's first job says.
  G: { id: 'G', phoneme: ['g'], say: null, soundWord: { word: 'Goat', emoji: '🐐', position: 'initial' } },
  H: { id: 'H', phoneme: ['h'], say: null, soundWord: { word: 'House', emoji: '🏠', position: 'initial' } },
  // Ice cream is /aɪ/. Insect is the short vowel, and 🐞 reads as a bug.
  I: { id: 'I', phoneme: ['ɪ'], say: 'ih', soundWord: { word: 'Insect', emoji: '🐞', position: 'initial' } },
  J: { id: 'J', phoneme: ['dʒ'], say: null, soundWord: { word: 'Juice', emoji: '🧃', position: 'initial' } },
  K: { id: 'K', phoneme: ['k'], say: null, soundWord: { word: 'Kite', emoji: '🪁', position: 'initial' } },
  L: { id: 'L', phoneme: ['l'], say: 'lll', soundWord: { word: 'Lion', emoji: '🦁', position: 'initial' } },
  M: { id: 'M', phoneme: ['m'], say: 'mmm', soundWord: { word: 'Moon', emoji: '🌙', position: 'initial' } },
  N: { id: 'N', phoneme: ['n'], say: 'nnn', soundWord: { word: 'Nose', emoji: '👃', position: 'initial' } },
  O: { id: 'O', phoneme: ['ɑ'], say: null, soundWord: { word: 'Orange', emoji: '🍊', position: 'initial' } },
  P: { id: 'P', phoneme: ['p'], say: null, soundWord: { word: 'Pizza', emoji: '🍕', position: 'initial' } },
  Q: { id: 'Q', phoneme: ['k', 'w'], say: null, soundWord: { word: 'Queen', emoji: '👑', position: 'initial' } },
  R: { id: 'R', phoneme: ['r'], say: 'rrr', soundWord: { word: 'Rainbow', emoji: '🌈', position: 'initial' } },
  S: { id: 'S', phoneme: ['s'], say: 'sss', soundWord: { word: 'Sun', emoji: '☀️', position: 'initial' } },
  T: { id: 'T', phoneme: ['t'], say: null, soundWord: { word: 'Tree', emoji: '🌳', position: 'initial' } },
  U: { id: 'U', phoneme: ['ʌ'], say: 'uh', soundWord: { word: 'Umbrella', emoji: '☂️', position: 'initial' } },
  V: { id: 'V', phoneme: ['v'], say: 'vvv', soundWord: { word: 'Van', emoji: '🚐', position: 'initial' } },
  W: { id: 'W', phoneme: ['w'], say: null, soundWord: { word: 'Watermelon', emoji: '🍉', position: 'initial' } },
  // X is never an onset in a word a child knows: it is a final-sound letter.
  X: { id: 'X', phoneme: ['k', 's'], say: 'ks', soundWord: { word: 'Fox', emoji: '🦊', position: 'final' } },
  Y: { id: 'Y', phoneme: ['j'], say: null, soundWord: { word: 'Yo-yo', emoji: '🪀', position: 'initial' } },
  Z: { id: 'Z', phoneme: ['z'], say: 'zzz', soundWord: { word: 'Zebra', emoji: '🦓', position: 'initial' } },
}

/** Sound pairs a Russian-speaking child will merge. */
export const L1_SOUND_CONFUSIONS: readonly (readonly [Phoneme, Phoneme])[] = [
  ['æ', 'ɛ'], ['ɪ', 'i'], ['ʌ', 'ɑ'], ['w', 'v'],
  ['θ', 's'], ['θ', 'f'], ['ð', 'z'], ['ð', 'd'], ['ŋ', 'n'], ['h', 'k'],
]

/**
 * Russian devoices word-final obstruents: bed and bet come out the same.
 * Never put such a pair on one screen, and never score the devoiced form as
 * a miss in a microphone mode.
 */
export const FINAL_DEVOICING_PAIRS: readonly (readonly [string, string])[] = [
  ['bed', 'bet'], ['dog', 'dock'], ['pig', 'pick'], ['bag', 'back'], ['bug', 'buck'],
]

/** The short vowels, the fixed option set for a missing-middle-vowel question. */
export const SHORT_VOWELS: readonly LetterId[] = ['A', 'E', 'I', 'O', 'U']
