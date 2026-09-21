/**
 * Static letter data: glyphs, names and the "A is for Apple" association
 * word. The sounds live in phonics.ts, because a sound is not a string that
 * can be spoken on its own: half of them must never be.
 *
 * The association word starts with the letter's first sound. That rules out
 * Giraffe for G and Ice cream for I, both of which teach the wrong sound.
 *
 * Nothing here is user state - it never goes to localStorage.
 */

export type LetterId =
  | 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L' | 'M'
  | 'N' | 'O' | 'P' | 'Q' | 'R' | 'S' | 'T' | 'U' | 'V' | 'W' | 'X' | 'Y' | 'Z'

export interface LetterInfo {
  /** Uppercase glyph, also the stable id of the letter. */
  readonly id: LetterId
  /** Lowercase glyph. */
  readonly lower: string
  /** English name of the letter, as spoken ("bee", "double-u"). */
  readonly name: string
  /** Association word in English. */
  readonly word: string
  /** Emoji illustrating the word. */
  readonly emoji: string
}

export const LETTERS: readonly LetterInfo[] = [
  { id: 'A', lower: 'a', name: 'ay',       word: 'Apple',    emoji: '🍎' },
  { id: 'B', lower: 'b', name: 'bee',      word: 'Ball',       emoji: '⚽' },
  { id: 'C', lower: 'c', name: 'see',      word: 'Cat',     emoji: '🐱' },
  { id: 'D', lower: 'd', name: 'dee',      word: 'Dog',    emoji: '🐶' },
  { id: 'E', lower: 'e', name: 'ee',       word: 'Elephant',      emoji: '🐘' },
  { id: 'F', lower: 'f', name: 'ef',       word: 'Fish',      emoji: '🐟' },
  { id: 'G', lower: 'g', name: 'jee',      word: 'Goat',        emoji: '🐐' },
  { id: 'H', lower: 'h', name: 'aitch',    word: 'House',       emoji: '🏠' },
  { id: 'I', lower: 'i', name: 'eye',      word: 'Insect',    emoji: '🐞' },
  { id: 'J', lower: 'j', name: 'jay',      word: 'Juice',       emoji: '🧃' },
  { id: 'K', lower: 'k', name: 'kay',      word: 'Kite', emoji: '🪁' },
  { id: 'L', lower: 'l', name: 'el',       word: 'Lion',       emoji: '🦁' },
  { id: 'M', lower: 'm', name: 'em',       word: 'Moon',      emoji: '🌙' },
  { id: 'N', lower: 'n', name: 'en',       word: 'Nose',       emoji: '👃' },
  { id: 'O', lower: 'o', name: 'oh',       word: 'Orange',  emoji: '🍊' },
  { id: 'P', lower: 'p', name: 'pee',      word: 'Pizza',     emoji: '🍕' },
  { id: 'Q', lower: 'q', name: 'cue',      word: 'Queen',  emoji: '👑' },
  { id: 'R', lower: 'r', name: 'ar',       word: 'Rainbow',    emoji: '🌈' },
  { id: 'S', lower: 's', name: 'ess',      word: 'Sun',    emoji: '☀️' },
  { id: 'T', lower: 't', name: 'tee',      word: 'Tree',    emoji: '🌳' },
  { id: 'U', lower: 'u', name: 'you',      word: 'Umbrella',      emoji: '☂️' },
  { id: 'V', lower: 'v', name: 'vee',      word: 'Van',    emoji: '🚐' },
  { id: 'W', lower: 'w', name: 'double u', word: 'Watermelon',     emoji: '🍉' },
  { id: 'X', lower: 'x', name: 'ex',       word: 'Fox',      emoji: '🦊' },
  { id: 'Y', lower: 'y', name: 'why',      word: 'Yo-yo',     emoji: '🪀' },
  { id: 'Z', lower: 'z', name: 'zee',      word: 'Zebra',     emoji: '🦓' },
] as const

export const LETTER_IDS: readonly LetterId[] = LETTERS.map((l) => l.id)

const BY_ID: ReadonlyMap<LetterId, LetterInfo> = new Map(
  LETTERS.map((l) => [l.id, l] as const),
)

export function letterInfo(id: LetterId): LetterInfo {
  const info = BY_ID.get(id)
  if (!info) throw new Error(`Unknown letter: ${id}`)
  return info
}

export function isLetterId(value: unknown): value is LetterId {
  return typeof value === 'string' && BY_ID.has(value as LetterId)
}
