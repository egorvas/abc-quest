import type { LetterId } from './letters'
import { LETTER_IDS } from './letters'
import { INTRO_ORDER } from '../engine/curriculum'
import { SOUND_SETS } from './phonics'
import type { WordStage } from './words'
import type { ModeId, Level } from '../modes/types'

/**
 * A hundred and fifty short numbered levels, from the first two letters to
 * expert reading.
 *
 * Each level is one short round with a fixed recipe: which letters, which
 * word stages, which games, how hard. The recipe is derived from the level
 * number with a seeded generator, so it is the same on every device and every
 * replay, but the child is not told what is inside before opening the door.
 * Passing a level opens the next; nothing else does.
 *
 * Seven tiers give the climb its shape, and most of it is reading. Inside a
 * tier the letters rotate, the games change and the difficulty ramps from
 * level to level, so no two levels feel the same.
 */

export const LEVEL_COUNT = 150

export type TierId = 'letters' | 'sounds' | 'blend' | 'words' | 'digraphs' | 'syllables' | 'master'

export interface Tier {
  readonly id: TierId
  readonly title: string
  readonly emoji: string
  readonly from: number
  readonly to: number
}

export const TIERS: readonly Tier[] = [
  { id: 'letters', title: 'Letters', emoji: '🔤', from: 1, to: 20 },
  { id: 'sounds', title: 'Sounds', emoji: '🔊', from: 21, to: 32 },
  { id: 'blend', title: 'Blending', emoji: '🫧', from: 33, to: 56 },
  { id: 'words', title: 'Words', emoji: '📖', from: 57, to: 90 },
  { id: 'digraphs', title: 'Two letters, one sound', emoji: '🔗', from: 91, to: 110 },
  { id: 'syllables', title: 'Syllables', emoji: '👏', from: 111, to: 130 },
  { id: 'master', title: 'Master reader', emoji: '🏆', from: 131, to: 150 },
]

export interface LevelSpec {
  readonly n: number
  readonly tier: TierId
  readonly letters: readonly LetterId[]
  readonly modes: readonly ModeId[]
  readonly wordStages?: readonly WordStage[]
  readonly difficulty: Level
  readonly length: number
  /** Reading levels hand out their words regardless of the memory gates. */
  readonly ungated: boolean
}

export function tierOf(n: number): Tier {
  const tier = TIERS.find((t) => n >= t.from && n <= t.to)
  if (!tier) throw new Error(`No tier for level ${n}`)
  return tier
}

/* ---- a small deterministic generator --------------------------------- */

function mulberry32(seed: number): () => number {
  let a = seed >>> 0
  return () => {
    a = (a + 0x6d2b79f5) >>> 0
    let t = a
    t = Math.imul(t ^ (t >>> 15), t | 1)
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61)
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function pick<T>(rng: () => number, list: readonly T[], count: number): readonly T[] {
  const copy = [...list]
  for (let i = copy.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1))
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy.slice(0, Math.min(count, copy.length))
}

const unique = <T,>(list: readonly T[]): readonly T[] => [...new Set(list)]

/* ---- the recipes ------------------------------------------------------ */

/** Letters known by the end of each letter level, cumulative: one or two new per level. */
const LETTER_STEPS = [2, 3, 4, 5, 7, 8, 9, 11, 12, 13, 15, 16, 17, 19, 20, 21, 23, 24, 25, 26] as const

/** Where a level sits inside its tier, 0 at the first level and 1 at the last. */
function ramp(n: number): number {
  const tier = tierOf(n)
  return tier.to === tier.from ? 1 : (n - tier.from) / (tier.to - tier.from)
}

const RECOGNISE: readonly ModeId[] = ['hearPick', 'chooseIt', 'hunt']
const LETTER_GAMES: readonly ModeId[] = ['hearPick', 'chooseIt', 'hunt', 'pairs', 'typeIt', 'traceIt', 'sayIt']
const SOUND_PARTNERS: readonly ModeId[] = ['hearPick', 'chooseIt', 'hunt', 'pairs']
const BLEND_GAMES: readonly ModeId[] = ['blendIt', 'missingLetter', 'readPick']
const WORD_GAMES: readonly ModeId[] = ['missingLetter', 'readPick', 'buildWord', 'blendIt']
const MASTER_LETTER_GAMES: readonly ModeId[] = [
  'hearPick', 'chooseIt', 'sayIt', 'typeIt', 'hunt', 'pairs', 'traceIt', 'firstSound', 'twinLetters',
]

const BLEND_GROUPS: readonly (readonly LetterId[])[] = [
  ['M', 'S', 'A', 'T'],
  ['F', 'N', 'I', 'P'],
  ['L', 'R', 'O', 'D'],
  ['V', 'Z', 'H', 'W', 'U', 'E'],
]
const BLEND_LETTERS = unique(BLEND_GROUPS.flat())
const DIGRAPH_LETTERS: readonly LetterId[] = ['S', 'H', 'C', 'K', 'N', 'G', 'L', 'T', 'D', 'R', 'F', 'P', 'W', 'B', 'E']
const SYLLABLE_LETTERS: readonly LetterId[] = ['S', 'H', 'L', 'B', 'R', 'M', 'T', 'P', 'C', 'N', 'K', 'D']

function lettersLevel(n: number, rng: () => number): LevelSpec {
  const index = n - 1
  const upTo = LETTER_STEPS[index]
  const before = index === 0 ? 0 : LETTER_STEPS[index - 1]
  const fresh = INTRO_ORDER.slice(before, upTo)
  const review = pick(rng, INTRO_ORDER.slice(0, before), 2)
  const t = ramp(n)
  const pool = n <= 3 ? RECOGNISE : LETTER_GAMES
  const modes = pick(rng, pool, n <= 6 ? 2 : 3)
  return {
    n,
    tier: 'letters',
    letters: [...fresh, ...review],
    modes: unique([...modes, 'hearPick']),
    difficulty: t < 0.3 ? 1 : t < 0.7 ? 2 : 3,
    length: n <= 6 ? 6 : 8,
    ungated: false,
  }
}

function soundsLevel(n: number, rng: () => number): LevelSpec {
  const index = n - tierOf(n).from
  // Each sound set twice, then mixed sets of everything.
  const set = index < 10 ? SOUND_SETS[index % 5] : pick(rng, SOUND_SETS.slice(0, 5).flat(), 6)
  const letters = set.map((g) => g.toUpperCase()).filter((g): g is LetterId => LETTER_IDS.includes(g as LetterId))
  return {
    n,
    tier: 'sounds',
    letters,
    modes: ['firstSound', ...pick(rng, SOUND_PARTNERS, 1)],
    difficulty: ramp(n) < 0.5 ? 2 : 3,
    length: 8,
    ungated: false,
  }
}

function blendLevel(n: number, rng: () => number): LevelSpec {
  const index = n - tierOf(n).from
  const t = ramp(n)
  const group = BLEND_GROUPS[index % BLEND_GROUPS.length]
  const letters = unique([...group, ...pick(rng, BLEND_LETTERS, 2)])
  const early = t < 0.5
  return {
    n,
    tier: 'blend',
    letters,
    modes: early ? pick(rng, BLEND_GAMES, 2) : pick(rng, WORD_GAMES, t < 0.8 ? 2 : 3),
    wordStages: early ? ['vc', 'cvc-cont'] : ['vc', 'cvc-cont', 'cvc'],
    difficulty: t < 0.35 ? 2 : 3,
    length: t < 0.5 ? 6 : 8,
    ungated: true,
  }
}

function wordsLevel(n: number, rng: () => number): LevelSpec {
  const t = ramp(n)
  return {
    n,
    tier: 'words',
    letters: pick(rng, INTRO_ORDER, 6),
    modes: pick(rng, WORD_GAMES, t < 0.5 ? 2 : 3),
    wordStages: t < 0.3 ? ['cvc-cont', 'cvc'] : ['cvc-cont', 'cvc', 'cvc-x'],
    difficulty: t < 0.25 ? 2 : t < 0.8 ? 3 : 4,
    length: t < 0.5 ? 6 : 8,
    ungated: true,
  }
}

function digraphsLevel(n: number, rng: () => number): LevelSpec {
  const t = ramp(n)
  return {
    n,
    tier: 'digraphs',
    letters: pick(rng, DIGRAPH_LETTERS, 6),
    modes: pick(rng, WORD_GAMES, t < 0.5 ? 2 : 3),
    wordStages: t < 0.5 ? ['digraph'] : ['cvc', 'cvc-x', 'digraph'],
    difficulty: t < 0.7 ? 3 : 4,
    length: t < 0.5 ? 6 : 8,
    ungated: true,
  }
}

function syllablesLevel(n: number, rng: () => number): LevelSpec {
  const t = ramp(n)
  return {
    n,
    tier: 'syllables',
    letters: pick(rng, SYLLABLE_LETTERS, 6),
    modes: pick(rng, ['blendIt', 'readPick', 'buildWord', 'missingLetter'] as const, t < 0.5 ? 2 : 3),
    wordStages: t < 0.5 ? ['twosyl'] : ['digraph', 'twosyl'],
    difficulty: t < 0.5 ? 3 : 4,
    length: t < 0.5 ? 6 : 8,
    ungated: true,
  }
}

function masterLevel(n: number, rng: () => number): LevelSpec {
  return {
    n,
    tier: 'master',
    letters: [...INTRO_ORDER],
    // Always half words: a master level that never reads is not one.
    modes: [...pick(rng, WORD_GAMES, 2), ...pick(rng, MASTER_LETTER_GAMES, 2)],
    wordStages: ['vc', 'cvc-cont', 'cvc', 'cvc-x', 'digraph', 'twosyl'],
    difficulty: 4,
    length: 8,
    ungated: true,
  }
}

const BUILDERS: Readonly<Record<TierId, (n: number, rng: () => number) => LevelSpec>> = {
  letters: lettersLevel,
  sounds: soundsLevel,
  blend: blendLevel,
  words: wordsLevel,
  digraphs: digraphsLevel,
  syllables: syllablesLevel,
  master: masterLevel,
}

const cache = new Map<number, LevelSpec>()

export function levelSpec(n: number): LevelSpec {
  if (!Number.isInteger(n) || n < 1 || n > LEVEL_COUNT) throw new Error(`No level ${n}`)
  const cached = cache.get(n)
  if (cached) return cached
  const spec = BUILDERS[tierOf(n).id](n, mulberry32(n * 7919 + 17))
  cache.set(n, spec)
  return spec
}
