import type { LetterId } from '../data/letters'
import type { Profile } from '../storage/schema'
import { dayIndex } from './memory'
import { letterStatus } from './mastery'
import { cellsOf } from './skills'
import { seedsForRound } from './garden'
import { TUNING } from './tuning'

/**
 * What a round pays.
 *
 * Base stays one to three nuts on accuracy. Bonuses are itemised so the
 * round-end screen can drop each one in with its own icon: a child who cannot
 * read learns what earns what from the pictures.
 *
 * Pure. `now` and `rand` are injected so the simulator stays deterministic.
 */

export type BonusKind = 'star' | 'firstWrite' | 'welcomeBack' | 'newDay' | 'surprise'

export interface NutBonus {
  readonly kind: BonusKind
  readonly nuts: number
  /** The letter behind a star or first-write bonus. */
  readonly letter?: LetterId
}

export interface NutAward {
  readonly base: number
  readonly bonuses: readonly NutBonus[]
  readonly total: number
  /** Letters that went gold during this round, for the celebration beat. */
  readonly newlyMastered: readonly LetterId[]
}

export const BONUS_ICON: Readonly<Record<BonusKind, string>> = {
  star: '⭐',
  firstWrite: '✍️',
  welcomeBack: '👋',
  newDay: '☀️',
  surprise: '🎁',
}

interface RoundFacts {
  readonly correct: number
  readonly items: number
  readonly letters: readonly LetterId[]
}

export function nutsForRound(
  before: Profile,
  after: Profile,
  round: RoundFacts,
  now: number,
  rand: () => number = Math.random,
): NutAward {
  const { bonus } = TUNING.town
  const bonuses: NutBonus[] = []

  // Gold stars earned during this round pay for exactly the friend they unlock.
  const newlyMastered = round.letters.filter(
    (letter) =>
      letterStatus(before, letter, now).stage !== 'mastered' &&
      letterStatus(after, letter, now).stage === 'mastered',
  )
  for (const letter of newlyMastered) {
    bonuses.push({ kind: 'star', nuts: bonus.star, letter })
  }

  // The first unguessable answer on a letter: the channel the app most wants
  // and the child most avoids.
  for (const letter of round.letters) {
    const producedBefore = cellsOf(letter).some((key) => (before.cells[key]?.kp ?? 0) > 0)
    const producedAfter = cellsOf(letter).some((key) => (after.cells[key]?.kp ?? 0) > 0)
    if (!producedBefore && producedAfter) {
      bonuses.push({ kind: 'firstWrite', nuts: bonus.firstWrite, letter })
    }
  }

  const today = dayIndex(now)
  const firstToday = before.lastPlayDay !== today
  if (firstToday && before.lastPlayDay >= 0) {
    const gap = today - before.lastPlayDay
    // A gift for arriving, never a comment on having been away.
    if (gap >= bonus.welcomeBackAfterDays) {
      bonuses.push({ kind: 'welcomeBack', nuts: bonus.welcomeBack })
    }
  }
  if (firstToday) bonuses.push({ kind: 'newDay', nuts: bonus.newDay })

  if (rand() < bonus.surpriseChance) {
    bonuses.push({ kind: 'surprise', nuts: bonus.surprise })
  }

  const base = seedsForRound(round.correct, round.items)
  const raw = base + bonuses.reduce((sum, b) => sum + b.nuts, 0)
  // The very first round can always buy something.
  const total = before.seedsEarned === 0 ? Math.max(TUNING.town.firstRoundFloor, raw) : raw

  return { base, bonuses, total, newlyMastered }
}
