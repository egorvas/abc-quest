import type { LetterId } from './letters'
import { INTRO_ORDER } from '../engine/curriculum'
import { SOUND_SETS } from './phonics'
import type { WordStage } from './words'
import type { ModeId, Level } from '../modes/types'

/**
 * The path: units of lessons, in order, from the first letters to reading
 * whole words. Each lesson is one round with a fixed set of letters, a fixed
 * set of games and, from the blending unit on, a fixed slice of the word
 * list. The path is the progression; the free-play games are the playground.
 *
 * Static data; a profile stores only the stars earned per lesson id.
 */

export type UnitId = 'letters' | 'sounds' | 'blend' | 'words' | 'digraphs' | 'syllables' | 'read'

export interface Unit {
  readonly id: UnitId
  readonly title: string
  readonly emoji: string
  readonly blurb: string
}

export interface Lesson {
  readonly id: string
  readonly unit: UnitId
  readonly title: string
  /** Focus letters. Words are chosen through them. */
  readonly letters: readonly LetterId[]
  readonly modes: readonly ModeId[]
  /** Word stages allowed, for the reading units. */
  readonly wordStages?: readonly WordStage[]
  /** Fixed difficulty for the lesson; the last unit climbs. */
  readonly level?: Level
  readonly length: number
}

export const UNITS: readonly Unit[] = [
  { id: 'letters', title: 'Letters', emoji: '🔤', blurb: 'Know every letter by sight and name' },
  { id: 'sounds', title: 'Sounds', emoji: '🔊', blurb: 'Every letter makes a sound' },
  { id: 'blend', title: 'Blending', emoji: '🫧', blurb: 'Slide sounds together into words' },
  { id: 'words', title: 'Words', emoji: '📖', blurb: 'Read and build short words' },
  { id: 'digraphs', title: 'Two letters, one sound', emoji: '🔗', blurb: 'sh, ch, ck and friends' },
  { id: 'syllables', title: 'Syllables', emoji: '👏', blurb: 'Longer words, one part at a time' },
  { id: 'read', title: 'Read it all', emoji: '🏆', blurb: 'Everything, faster and harder' },
]

const LETTER_GAMES: readonly ModeId[] = ['hearPick', 'chooseIt', 'typeIt', 'hunt', 'pairs', 'traceIt']
const SOUND_GAMES: readonly ModeId[] = ['firstSound', 'hearPick', 'chooseIt']
const BLEND_GAMES: readonly ModeId[] = ['blendIt', 'missingLetter', 'readPick']
const WORD_GAMES: readonly ModeId[] = ['missingLetter', 'readPick', 'buildWord', 'blendIt']

function chunk<T>(list: readonly T[], size: number): readonly (readonly T[])[] {
  const out: T[][] = []
  for (let i = 0; i < list.length; i += size) out.push([...list.slice(i, i + size)])
  return out
}

const letterLessons: readonly Lesson[] = chunk(INTRO_ORDER, 4).map((group, index) => ({
  id: `letters-${index + 1}`,
  unit: 'letters',
  title: group.join(' '),
  letters: group,
  modes: LETTER_GAMES,
  length: 12,
}))

const soundLessons: readonly Lesson[] = SOUND_SETS.slice(0, 5).map((set, index) => {
  const letters = set.map((g) => g.toUpperCase() as LetterId)
  return {
    id: `sounds-${index + 1}`,
    unit: 'sounds',
    title: set.join(' '),
    letters,
    modes: SOUND_GAMES,
    length: 12,
  }
})

const blendGroups: readonly (readonly LetterId[])[] = [
  ['M', 'S', 'A', 'T'],
  ['F', 'N', 'I', 'P'],
  ['L', 'R', 'O', 'D'],
  ['V', 'Z', 'H', 'W', 'U', 'E'],
]
const blendLessons: readonly Lesson[] = blendGroups.map((letters, index) => ({
  id: `blend-${index + 1}`,
  unit: 'blend',
  title: letters.join(' '),
  letters,
  modes: BLEND_GAMES,
  wordStages: ['vc', 'cvc-cont'],
  length: 10,
}))

const wordGroups: readonly (readonly LetterId[])[] = [
  ['B', 'D', 'A', 'E'],
  ['P', 'T', 'I', 'O'],
  ['C', 'K', 'G', 'U'],
  ['J', 'X', 'B', 'P', 'T', 'D'],
]
const wordLessons: readonly Lesson[] = wordGroups.map((letters, index) => ({
  id: `words-${index + 1}`,
  unit: 'words',
  title: letters.join(' '),
  letters,
  modes: WORD_GAMES,
  wordStages: ['cvc-cont', 'cvc', 'cvc-x'],
  length: 10,
}))

const digraphLessons: readonly Lesson[] = [
  { id: 'digraphs-1', unit: 'digraphs', title: 'ck', letters: ['C', 'K', 'D', 'S', 'R', 'L'], modes: WORD_GAMES, wordStages: ['digraph'], length: 10 },
  { id: 'digraphs-2', unit: 'digraphs', title: 'sh ch', letters: ['S', 'H', 'C', 'F', 'P'], modes: WORD_GAMES, wordStages: ['digraph'], length: 10 },
  { id: 'digraphs-3', unit: 'digraphs', title: 'ng ll th', letters: ['N', 'G', 'L', 'B', 'E', 'W'], modes: WORD_GAMES, wordStages: ['digraph'], length: 10 },
]

const syllableLessons: readonly Lesson[] = [
  { id: 'syllables-1', unit: 'syllables', title: 'Two words in one', letters: ['S', 'H', 'L', 'B'], modes: ['blendIt', 'readPick'], wordStages: ['twosyl'], length: 8 },
  { id: 'syllables-2', unit: 'syllables', title: 'Two parts', letters: ['R', 'B', 'M', 'T', 'H'], modes: ['blendIt', 'readPick', 'buildWord'], wordStages: ['twosyl'], length: 8 },
  { id: 'syllables-3', unit: 'syllables', title: 'Longer words', letters: ['L', 'M', 'P', 'S', 'C'], modes: ['blendIt', 'readPick', 'buildWord'], wordStages: ['twosyl'], length: 8 },
]

const ALL_STAGES: readonly WordStage[] = ['vc', 'cvc-cont', 'cvc', 'cvc-x', 'digraph', 'twosyl']
const readLessons: readonly Lesson[] = ([2, 3, 4] as const).map((level, index) => ({
  id: `read-${index + 1}`,
  unit: 'read',
  title: index === 0 ? 'Warm up' : index === 1 ? 'Faster' : 'Expert',
  letters: [...INTRO_ORDER],
  modes: ['readPick', 'buildWord', 'missingLetter', 'blendIt'],
  wordStages: ALL_STAGES,
  level,
  length: 12,
}))

export const LESSONS: readonly Lesson[] = [
  ...letterLessons,
  ...soundLessons,
  ...blendLessons,
  ...wordLessons,
  ...digraphLessons,
  ...syllableLessons,
  ...readLessons,
]

const LESSON_INDEX: ReadonlyMap<string, Lesson> = new Map(LESSONS.map((l) => [l.id, l]))

export function lessonInfo(id: string): Lesson {
  const lesson = LESSON_INDEX.get(id)
  if (!lesson) throw new Error(`Unknown lesson: ${id}`)
  return lesson
}

export function isLessonId(value: unknown): value is string {
  return typeof value === 'string' && LESSON_INDEX.has(value)
}

export function lessonsOf(unit: UnitId): readonly Lesson[] {
  return LESSONS.filter((lesson) => lesson.unit === unit)
}
