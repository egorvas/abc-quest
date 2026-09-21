import type { LetterId } from '../data/letters'
import type { Profile, BedStage } from '../storage/schema'
import { letterStatus } from './mastery'
import { cellKey } from './skills'
import { NEW_CELL } from './memory'
import { TUNING } from './tuning'

/**
 * The alphabet garden: 26 beds along a path from A to Z, each growing the
 * creature whose name starts with that letter.
 *
 * It is the reward layer and the progress map at once. Nothing in it ever
 * wilts, dies or rolls back, which is deliberate: a pet that gets sad when you
 * skip a day is loss aversion pointed at a four-year-old. Growth here is
 * monotonic, so there is nowhere for that to take hold.
 *
 * The top stage cannot be reached by tapping. It needs production evidence -
 * saying the letter or writing it - which is what pushes a child out of the
 * comfortable multiple-choice loop.
 */

export interface Bed {
  readonly letter: LetterId
  readonly stage: BedStage
  readonly emoji: string
  /** What the next stage needs, for the parent screen. */
  readonly nextHint: string
}

const STAGE_GLYPH: Record<BedStage, string> = {
  0: '·',
  1: '🌱',
  2: '🌼',
  3: '🌳',
}

export function bedFor(profile: Profile, letter: LetterId, now: number): Bed {
  const status = letterStatus(profile, letter, now)

  const spot = profile.cells[cellKey(letter, 'spot', 'upper')] ?? NEW_CELL
  const prodUpper = profile.cells[cellKey(letter, 'prod', 'upper')] ?? NEW_CELL
  const nameUpper = profile.cells[cellKey(letter, 'name', 'upper')] ?? NEW_CELL
  const producedEvidence = prodUpper.kp + nameUpper.kp

  let stage: BedStage = 0
  if (spot.k > 0 || nameUpper.k > 0) stage = 1
  if (Math.max(spot.h, nameUpper.h) >= TUNING.flowerAtHalfLifeDays) stage = 2
  if (status.stage === 'mastered' && producedEvidence >= TUNING.masteryCorrectProduced) {
    stage = 3
  }

  const nextHint =
    stage === 3
      ? 'Fully grown'
      : stage === 2
        ? 'Needs the letter said out loud or written'
        : stage === 1
          ? 'Needs confident recognition'
          : 'Not started yet'

  // The word emoji now lives in the town, as the cheapest thing a lot can
  // buy. The garden signals growth only, so a full-grown bed is a tree.
  return { letter, stage, emoji: STAGE_GLYPH[stage], nextHint }
}

export function gardenOf(
  profile: Profile,
  letters: readonly LetterId[],
  now: number,
): readonly Bed[] {
  return letters.map((letter) => bedFor(profile, letter, now))
}

/** Seeds handed out at the end of a round: one to three, never zero. */
export function seedsForRound(correct: number, total: number): number {
  if (total === 0) return TUNING.seedsPerSession.min
  const ratio = correct / total
  if (ratio >= 0.85) return TUNING.seedsPerSession.max
  if (ratio >= 0.6) return 2
  return TUNING.seedsPerSession.min
}
