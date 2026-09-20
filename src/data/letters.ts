/**
 * Static letter data: glyphs, the "A is for Apple" association word and
 * the phonetic sound of each letter.
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
  /** Primary phonetic sound, used by the "sound" prompt ("buh", "kuh"). */
  readonly sound: string
  /** Association word in English. */
  readonly word: string
  /** Same word in Russian, for the parent-facing screens. */
  readonly wordRu: string
  /** Emoji illustrating the word. */
  readonly emoji: string
}

export const LETTERS: readonly LetterInfo[] = [
  { id: 'A', lower: 'a', name: 'ay',       sound: 'a',   word: 'Apple',      wordRu: 'яблоко',    emoji: '🍎' },
  { id: 'B', lower: 'b', name: 'bee',      sound: 'buh', word: 'Ball',       wordRu: 'мяч',       emoji: '⚽' },
  { id: 'C', lower: 'c', name: 'see',      sound: 'kuh', word: 'Cat',        wordRu: 'кошка',     emoji: '🐱' },
  { id: 'D', lower: 'd', name: 'dee',      sound: 'duh', word: 'Dog',        wordRu: 'собака',    emoji: '🐶' },
  { id: 'E', lower: 'e', name: 'ee',       sound: 'eh',  word: 'Elephant',   wordRu: 'слон',      emoji: '🐘' },
  { id: 'F', lower: 'f', name: 'ef',       sound: 'fff', word: 'Fish',       wordRu: 'рыба',      emoji: '🐟' },
  { id: 'G', lower: 'g', name: 'jee',      sound: 'guh', word: 'Giraffe',    wordRu: 'жираф',     emoji: '🦒' },
  { id: 'H', lower: 'h', name: 'aitch',    sound: 'huh', word: 'House',      wordRu: 'дом',       emoji: '🏠' },
  { id: 'I', lower: 'i', name: 'eye',      sound: 'ih',  word: 'Ice cream',  wordRu: 'мороженое', emoji: '🍦' },
  { id: 'J', lower: 'j', name: 'jay',      sound: 'juh', word: 'Juice',      wordRu: 'сок',       emoji: '🧃' },
  { id: 'K', lower: 'k', name: 'kay',      sound: 'kuh', word: 'Kite',       wordRu: 'воздушный змей', emoji: '🪁' },
  { id: 'L', lower: 'l', name: 'el',       sound: 'lll', word: 'Lion',       wordRu: 'лев',       emoji: '🦁' },
  { id: 'M', lower: 'm', name: 'em',       sound: 'mmm', word: 'Moon',       wordRu: 'луна',      emoji: '🌙' },
  { id: 'N', lower: 'n', name: 'en',       sound: 'nnn', word: 'Nose',       wordRu: 'нос',       emoji: '👃' },
  { id: 'O', lower: 'o', name: 'oh',       sound: 'o',   word: 'Orange',     wordRu: 'апельсин',  emoji: '🍊' },
  { id: 'P', lower: 'p', name: 'pee',      sound: 'puh', word: 'Pizza',      wordRu: 'пицца',     emoji: '🍕' },
  { id: 'Q', lower: 'q', name: 'cue',      sound: 'kwuh', word: 'Queen',     wordRu: 'королева',  emoji: '👑' },
  { id: 'R', lower: 'r', name: 'ar',       sound: 'rrr', word: 'Rainbow',    wordRu: 'радуга',    emoji: '🌈' },
  { id: 'S', lower: 's', name: 'ess',      sound: 'sss', word: 'Sun',        wordRu: 'солнце',    emoji: '☀️' },
  { id: 'T', lower: 't', name: 'tee',      sound: 'tuh', word: 'Tree',       wordRu: 'дерево',    emoji: '🌳' },
  { id: 'U', lower: 'u', name: 'you',      sound: 'uh',  word: 'Umbrella',   wordRu: 'зонт',      emoji: '☂️' },
  { id: 'V', lower: 'v', name: 'vee',      sound: 'vvv', word: 'Van',        wordRu: 'фургон',    emoji: '🚐' },
  { id: 'W', lower: 'w', name: 'double u', sound: 'wuh', word: 'Watermelon', wordRu: 'арбуз',     emoji: '🍉' },
  { id: 'X', lower: 'x', name: 'ex',       sound: 'ks',  word: 'Fox',        wordRu: 'лиса',      emoji: '🦊' },
  { id: 'Y', lower: 'y', name: 'why',      sound: 'yuh', word: 'Yo-yo',      wordRu: 'йо-йо',     emoji: '🪀' },
  { id: 'Z', lower: 'z', name: 'zee',      sound: 'zzz', word: 'Zebra',      wordRu: 'зебра',     emoji: '🦓' },
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
