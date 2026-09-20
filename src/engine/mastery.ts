import type { LetterId } from '../data/letters'
import type { Cell } from './memory'
import { NEW_CELL, isSolid, recall } from './memory'
import { CORE_SKILLS, cellKey, coreCellsOf, cellsOf } from './skills'
import { TUNING } from './tuning'
import type { Profile } from '../storage/schema'
import { partnersOf } from './confusion'

/**
 * When a letter earns its gold star.
 *
 * A one-in-four tap is right a quarter of the time by accident, so tapping
 * alone can never finish a letter. Five gates have to hold at once.
 */

export type LetterStage = 'locked' | 'new' | 'learning' | 'strong' | 'mastered'

export interface LetterStatus {
  readonly letter: LetterId
  readonly stage: LetterStage
  /** Average recall across the core cells, 0..1. */
  readonly recall: number
  /** Gold star earned but gone stale - the garden asks for a polish. */
  readonly dusty: boolean
  readonly gates: {
    readonly breadth: boolean
    readonly antiGuess: boolean
    readonly durability: boolean
    readonly freshness: boolean
    readonly contrast: boolean
  }
}

function cellOf(profile: Profile, key: string): Cell {
  return profile.cells[key] ?? NEW_CELL
}

export function letterStatus(
  profile: Profile,
  letter: LetterId,
  now: number,
): LetterStatus {
  const introduced = profile.introduced.includes(letter)
  const core = coreCellsOf(letter).map((key) => cellOf(profile, key))
  const all = cellsOf(letter).map((key) => cellOf(profile, key))
  const attempted = all.filter((cell) => cell.n > 0)

  const avgRecall =
    core.length === 0 ? 0 : core.reduce((sum, c) => sum + recall(c, now), 0) / core.length

  // Gate 1 - breadth: every core channel has a solid trace, not just tapping.
  // Recognition has to hold for both shapes, because telling "B" from "b" is
  // the point. Naming and writing count once the child can do them for either
  // shape: writing a lowercase g is a motor skill, not knowledge of the letter.
  const breadth =
    CORE_SKILLS.every((skill) => {
      const cases = [
        cellOf(profile, cellKey(letter, skill, 'upper')),
        cellOf(profile, cellKey(letter, skill, 'lower')),
      ]
      return skill === 'spot' ? cases.every(isSolid) : cases.some(isSolid)
    })

  // Gate 2 - anti-guess: enough evidence that cannot be luck.
  const guessable = all.reduce((sum, c) => sum + c.kg, 0)
  const produced = all.reduce((sum, c) => sum + c.kp, 0)
  const antiGuess =
    guessable >= TUNING.masteryCorrectGuessable &&
    produced >= TUNING.masteryCorrectProduced

  // Gate 3 - durability: knowing it on two different days, not one lucky run.
  const durability =
    Math.max(0, ...all.map((c) => c.days)) >= TUNING.masteryDistinctDays

  // Gate 4 - freshness: it still holds right now.
  const freshness = avgRecall >= TUNING.masteryFreshness

  // Gate 5 - contrast: beaten at least once next to the letter it looks like.
  const partners = partnersOf(profile.confusion, letter)
  const contrast =
    partners.length === 0 ||
    core.some((c) => c.cc >= TUNING.confusionMinStreak && isSolid(c))

  const mastered = breadth && antiGuess && durability && contrast
  const gates = { breadth, antiGuess, durability, freshness, contrast }

  let stage: LetterStage = 'locked'
  if (mastered) stage = 'mastered'
  else if (!introduced && attempted.length === 0) stage = 'locked'
  else if (attempted.length === 0) stage = 'new'
  else if (avgRecall >= TUNING.easyAbove) stage = 'strong'
  else stage = 'learning'

  return {
    letter,
    stage,
    recall: avgRecall,
    // The star is never taken back: it only dulls and asks to be polished.
    dusty: mastered && !freshness,
    gates,
  }
}

export function allStatuses(
  profile: Profile,
  letters: readonly LetterId[],
  now: number,
): readonly LetterStatus[] {
  return letters.map((letter) => letterStatus(profile, letter, now))
}

export function masteredCount(statuses: readonly LetterStatus[]): number {
  return statuses.filter((s) => s.stage === 'mastered').length
}

/**
 * How settled a letter is, in days of half-life, averaged over the channels
 * the child has actually practised.
 *
 * Pacing uses this rather than momentary recall. Recall always looks low at the
 * start of a session, because a night has passed; stability does not, so the
 * curriculum keeps moving instead of stalling on the same six letters.
 */
export function letterStability(profile: Profile, letter: LetterId): number {
  const cells = coreCellsOf(letter)
    .map((key) => cellOf(profile, key))
    .filter((cell) => cell.n > 0)
  if (cells.length === 0) return 0
  return cells.reduce((sum, cell) => sum + cell.h, 0) / cells.length
}
