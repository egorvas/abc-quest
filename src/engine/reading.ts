import type { LetterId } from '../data/letters'
import { isLetterId } from '../data/letters'
import { SOUND_SETS, SHORT_VOWELS, graphemeInfo } from '../data/phonics'
import type { WordEntry, WordId, WordStage } from '../data/words'
import { WORDS, WORD_BY_ID } from '../data/words'
import type { Profile } from '../storage/schema'
import type { Cell } from './memory'
import { NEW_CELL, applyAnswer, recall } from './memory'
import { cellKey, type CellKey } from './skills'
import { TUNING } from './tuning'

/**
 * Words join the letter model without changing it.
 *
 * The unit of memory for a word is (word, reading skill), stored in the same
 * flat cell map as the letters under a `w:` prefix, so nothing about storage
 * or the forgetting curve is new. A single-letter grapheme reuses the letter's
 * own `sound` cell, which means every hour spent in the picture game already
 * counts towards reading.
 *
 * Three relationships between a word and its letters, kept separate on
 * purpose: the letters gate whether a word may appear at all; they give the
 * difficulty prior for a word never met; and credit flows back down to them
 * only where it cannot be whole-word recall - when the child built the word
 * with their own hands, or decoded it for the very first time.
 */

export const READ_SKILL_IDS = ['blend', 'read', 'build'] as const
export type ReadSkillId = (typeof READ_SKILL_IDS)[number]

export const READ_SKILL_LABEL: Readonly<Record<ReadSkillId, string>> = {
  blend: 'Blends sounds',
  read: 'Reads words',
  build: 'Builds words',
}

export function wordCellKey(id: WordId, skill: ReadSkillId): CellKey {
  return `w:${id}|${skill}`
}

/** A single letter's sound is its existing cell; a digraph gets its own. */
export function graphemeCellKey(g: string): CellKey {
  const upper = g.toUpperCase()
  return g.length === 1 && isLetterId(upper) ? cellKey(upper, 'sound', 'upper') : `g:${g}|snd`
}

const cellOf = (profile: Profile, key: CellKey): Cell => profile.cells[key] ?? NEW_CELL

export function graphemeStability(profile: Profile, g: string): number {
  return cellOf(profile, graphemeCellKey(g)).h
}

/* ---- stages ------------------------------------------------------------ */

export type ReadingStage = 'sounds' | 'cvc-cont' | 'cvc' | 'digraph' | 'twosyl'

const STAGE_WORDS: Readonly<Record<ReadingStage, readonly WordStage[]>> = {
  sounds: [],
  'cvc-cont': ['vc', 'cvc-cont'],
  cvc: ['vc', 'cvc-cont', 'cvc', 'cvc-x'],
  digraph: ['vc', 'cvc-cont', 'cvc', 'cvc-x', 'digraph'],
  twosyl: ['vc', 'cvc-cont', 'cvc', 'cvc-x', 'digraph', 'twosyl'],
}

const STAGE_ORDER: readonly ReadingStage[] = ['sounds', 'cvc-cont', 'cvc', 'digraph', 'twosyl']

/** Words the child has settled at a core reading skill, in the given stages. */
function settledWords(profile: Profile, stages: readonly WordStage[]): number {
  return WORDS.filter(
    (word) =>
      stages.includes(word.stage) &&
      (['blend', 'read', 'build'] as const).some(
        (skill) => cellOf(profile, wordCellKey(word.id, skill)).h >= TUNING.reading.wordReadyHalfLifeDays,
      ),
  ).length
}

/**
 * Correct-first-try share over words the child had never seen before. This
 * is the only number that tells blending from memorising word pictures, so
 * every stage exit requires it. Null until there are enough encounters.
 */
export function novelAccuracy(profile: Profile): number | null {
  const entries = profile.reading.novel
  if (entries.length < 8) return null
  return entries.filter((entry) => entry.ok).length / entries.length
}

/**
 * The reading stage is derived from the cells, never stored. Sound set one
 * being ready opens continuant-onset words; each later stage needs enough
 * settled words from the one before and a passing transfer test.
 */
export function readingStage(profile: Profile): ReadingStage {
  const ready = SOUND_SETS[0].filter(
    (g) => graphemeStability(profile, g) >= TUNING.reading.soundReadyHalfLifeDays,
  ).length
  if (ready < 5) return 'sounds'

  const transfer = novelAccuracy(profile)
  const passes = transfer !== null && transfer >= TUNING.reading.novelAccuracy
  if (!passes) return 'cvc-cont'
  if (settledWords(profile, ['cvc-cont']) < 10) return 'cvc-cont'
  if (settledWords(profile, ['cvc', 'cvc-x']) < 14) return 'cvc'
  if (settledWords(profile, ['digraph']) < 10) return 'digraph'
  return 'twosyl'
}

export function stageIndex(stage: ReadingStage): number {
  return STAGE_ORDER.indexOf(stage)
}

/* ---- availability and difficulty --------------------------------------- */

/** Conjunctive gate: one grapheme the child does not know kills the word. */
export function wordUnlocked(profile: Profile, word: WordEntry): boolean {
  return word.units.every(
    (unit) => graphemeStability(profile, unit.g) >= TUNING.reading.soundReadyHalfLifeDays,
  )
}

/** Difficulty estimate from the letters alone. Geometric mean, not product. */
export function wordPrior(profile: Profile, word: WordEntry, now: number): number {
  const recalls = word.units.map((unit) => recall(cellOf(profile, graphemeCellKey(unit.g)), now))
  if (recalls.some((r) => r <= 0)) return 0
  const geo = Math.exp(recalls.reduce((sum, r) => sum + Math.log(r), 0) / recalls.length)
  const n = word.phonemes.length
  const lengthPenalty = n <= 2 ? 1 : n === 3 ? 0.85 : n === 4 ? 0.7 : 0.55
  return geo * lengthPenalty
}

export function wordRecall(
  profile: Profile,
  word: WordEntry,
  skill: ReadSkillId,
  now: number,
): number {
  const cell = cellOf(profile, wordCellKey(word.id, skill))
  const prior = wordPrior(profile, word, now)
  if (cell.n === 0) return prior
  return Math.max(recall(cell, now), TUNING.reading.priorWeight * prior)
}

/** Best recall across the core reading skills, for bucketing. */
export function wordBestRecall(profile: Profile, word: WordEntry, now: number): number {
  return Math.max(...READ_SKILL_IDS.map((skill) => wordRecall(profile, word, skill, now)))
}

export function wordSeen(profile: Profile, word: WordEntry): boolean {
  return READ_SKILL_IDS.some((skill) => cellOf(profile, wordCellKey(word.id, skill)).n > 0)
}

/** How much weak-letter practice a word delivers: the reason words serve letters. */
export function weakLetterYield(profile: Profile, word: WordEntry): number {
  const target = TUNING.reading.soundSolidRequired
  const gaps = word.units.map((unit) => Math.max(0, target - graphemeStability(profile, unit.g)))
  return gaps.reduce((sum, gap) => sum + gap, 0) / (word.units.length * target)
}

export type GapPosition = 'first' | 'last' | 'vowel' | 'any'

/** Index of the focus letter's grapheme unit, honouring the wanted position. */
export function gapIndexFor(word: WordEntry, letter: LetterId, position: GapPosition): number | null {
  const lower = letter.toLowerCase()
  const indexes = word.units
    .map((unit, index) => (unit.g === lower ? index : -1))
    .filter((index) => index >= 0)
  if (indexes.length === 0) return null
  if (position === 'first') return indexes.includes(0) ? 0 : null
  if (position === 'last') {
    const last = word.units.length - 1
    return indexes.includes(last) ? last : null
  }
  if (position === 'vowel') {
    const vowel = indexes.find(
      (index) => graphemeInfo(word.units[index].g, word.units[index].p).kind === 'vowel',
    )
    return vowel ?? null
  }
  return indexes[0]
}

export interface WordQuery {
  readonly letter: LetterId
  readonly position?: GapPosition
  readonly picturesOnly?: boolean
  /** Only words whose onset can be stretched: the first blending stage. */
  readonly continuantOnly?: boolean
}

/**
 * Words available right now that practise a letter, best first.
 *
 * The order is weakest-letter-first: a child weak on g and u gets mug, jug,
 * rug, hug, bug, dig - six contexts for the same letter, which is worth far
 * more than six more taps of the isolated glyph.
 */
export function wordsForLetter(
  profile: Profile,
  now: number,
  query: WordQuery,
): readonly WordEntry[] {
  const stage = readingStage(profile)
  const stages = STAGE_WORDS[stage]
  if (stages.length === 0) return []
  const position = query.position ?? 'any'

  return WORDS.filter((word) => {
    if (!stages.includes(word.stage) || word.needsBlends) return false
    if (query.picturesOnly && word.picture === 'none') return false
    if (query.continuantOnly && !word.continuantOnset) return false
    if (gapIndexFor(word, query.letter, position) === null) return false
    return wordUnlocked(profile, word)
  })
    .map((word) => {
      const p = wordBestRecall(profile, word, now)
      const novelty = wordSeen(profile, word) ? 0 : 0.3
      const score = weakLetterYield(profile, word) - p * 0.8 + novelty + Math.random() * 0.15
      return { word, score }
    })
    .sort((a, b) => b.score - a.score)
    .map((entry) => entry.word)
}

/** Wrong-answer words for a picture choice: minimal pairs first. */
export function wordDistractorsFor(
  target: WordEntry,
  count: number,
  pool: readonly WordEntry[],
  prefer: 'onset' | 'vowel' | 'none',
): readonly WordId[] {
  const candidates = pool.filter(
    (word) => word.id !== target.id && word.picture !== 'none' && word.emoji !== target.emoji,
  )
  const sharesOnset = (word: WordEntry) => word.units[0]?.g === target.units[0]?.g
  const sharesRime = (word: WordEntry) =>
    word.units.length === target.units.length &&
    word.units.slice(1).map((u) => u.g).join('') === target.units.slice(1).map((u) => u.g).join('')
  const vowelPair = (word: WordEntry) =>
    word.units.length === target.units.length &&
    word.units[0]?.g === target.units[0]?.g &&
    word.units[word.units.length - 1]?.g === target.units[target.units.length - 1]?.g
  const shuffled = [...candidates].sort(() => Math.random() - 0.5)
  const ordered =
    prefer === 'none'
      ? shuffled.filter((word) => !sharesOnset(word) && !sharesRime(word))
      : prefer === 'onset'
        ? [...shuffled.filter(sharesOnset), ...shuffled.filter((w) => !sharesOnset(w))]
        : [...shuffled.filter(vowelPair), ...shuffled.filter(sharesOnset), ...shuffled]
  const result: WordId[] = []
  for (const word of [...ordered, ...shuffled]) {
    if (result.length >= count) break
    if (!result.includes(word.id)) result.push(word.id)
  }
  return result
}

/** A word that differs from the target in exactly one grapheme, if any. */
export function minimalPair(target: WordEntry, index: number): WordEntry | null {
  const prefix = target.units.slice(0, index).map((u) => u.g).join('')
  const suffix = target.units.slice(index + 1).map((u) => u.g).join('')
  const match = WORDS.find(
    (word) =>
      word.id !== target.id &&
      word.units.length === target.units.length &&
      word.units.slice(0, index).map((u) => u.g).join('') === prefix &&
      word.units.slice(index + 1).map((u) => u.g).join('') === suffix,
  )
  return match ?? null
}

/** The fixed option set for a missing vowel: the other short vowels. */
export function vowelOptions(target: LetterId, count: number): readonly LetterId[] {
  return SHORT_VOWELS.filter((v) => v !== target)
    .sort(() => Math.random() - 0.5)
    .slice(0, count)
}

/* ---- memory writes ------------------------------------------------------ */

export interface WordAnswer {
  readonly wordId: WordId
  readonly skill: ReadSkillId
  readonly correct: boolean
  readonly assisted: boolean
  readonly gamma: number
  readonly weight: number
  /** The focus grapheme, already credited through its own letter cell. */
  readonly focus: string
  readonly placed?: readonly string[]
  readonly wrongGrapheme?: string
}

/**
 * One answer on a word. Credit flows down to the graphemes only where it
 * cannot be whole-word recall, and a miss never lapses a letter unless the
 * mode can prove which one it was.
 */
export function applyWordAnswer(profile: Profile, answer: WordAnswer, now: number): Profile {
  const word = WORD_BY_ID.get(answer.wordId)
  if (!word) return profile
  const key = wordCellKey(word.id, answer.skill)
  const before = cellOf(profile, key)
  const firstEver = !wordSeen(profile, word)

  const cells: Record<CellKey, Cell> = { ...profile.cells }
  cells[key] = applyAnswer(before, {
    correct: answer.correct,
    assisted: answer.assisted,
    weight: answer.weight,
    gamma: answer.gamma,
    now,
  })

  const factor =
    answer.skill === 'build'
      ? TUNING.reading.buildCreditFactor
      : firstEver
        ? TUNING.reading.novelCreditFactor
        : 0

  if (answer.correct && !answer.assisted && factor > 0) {
    const graphemes = answer.placed ?? word.units.map((unit) => unit.g)
    for (const g of graphemes) {
      if (g === answer.focus) continue
      const gk = graphemeCellKey(g)
      cells[gk] = applyAnswer(cellOf(profile, gk), {
        correct: true,
        assisted: false,
        weight: answer.weight * factor,
        gamma: answer.gamma,
        now,
      })
    }
  }

  if (!answer.correct && answer.wrongGrapheme && answer.wrongGrapheme !== answer.focus) {
    const gk = graphemeCellKey(answer.wrongGrapheme)
    cells[gk] = applyAnswer(cellOf(profile, gk), {
      correct: false,
      assisted: false,
      weight: answer.weight,
      gamma: answer.gamma,
      now,
    })
  }

  const novel = firstEver
    ? [
        { w: word.id, ok: answer.correct && !answer.assisted, at: now },
        ...profile.reading.novel,
      ].slice(0, TUNING.reading.novelWindow)
    : profile.reading.novel

  return {
    ...profile,
    cells,
    reading: {
      novel,
      wordsIntroduced: firstEver
        ? [...profile.reading.wordsIntroduced, word.id]
        : profile.reading.wordsIntroduced,
    },
  }
}

/** Parent-screen summary of the reading track. */
export interface ReadingSummary {
  readonly stage: ReadingStage
  readonly wordsMet: number
  readonly wordsSettled: number
  readonly transfer: number | null
  readonly soundsReady: number
}

export function readingSummary(profile: Profile): ReadingSummary {
  const stage = readingStage(profile)
  return {
    stage,
    wordsMet: profile.reading.wordsIntroduced.length,
    wordsSettled: settledWords(profile, STAGE_WORDS.twosyl),
    transfer: novelAccuracy(profile),
    soundsReady: SOUND_SETS.flat().filter(
      (g) => graphemeStability(profile, g) >= TUNING.reading.soundReadyHalfLifeDays,
    ).length,
  }
}
