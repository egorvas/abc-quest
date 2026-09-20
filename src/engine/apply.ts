import type { Profile, SessionSummary } from '../storage/schema'
import type { Attempt } from '../modes/types'
import type { Cell } from './memory'
import { applyAnswer, NEW_CELL, dayIndex } from './memory'
import { cellKey } from './skills'
import { recordConfusion, decayConfusions } from './confusion'
import { TUNING } from './tuning'
import type { LetterId } from '../data/letters'

/**
 * Folds one answer into the profile. Returns a new profile; nothing is
 * mutated, so React state updates stay predictable and history stays sane.
 */
export function applyAttempt(profile: Profile, attempt: Attempt, now: number): Profile {
  const { item } = attempt
  const key = cellKey(item.letter, item.skill, item.glyphCase)
  const cell = profile.cells[key] ?? NEW_CELL

  // An "almost" - the right rhyme family, or the right letter in the wrong
  // case - is not a failure. It counts, at the reduced weight of a hint.
  const correct = attempt.verdict !== 'miss'
  const assisted = attempt.assisted || attempt.verdict === 'almost'

  const updated = applyAnswer(cell, {
    correct,
    assisted,
    weight: attempt.weight,
    gamma: attempt.gamma,
    now,
  })

  let confusion = profile.confusion
  for (const picked of attempt.wrongPicks) {
    confusion = recordConfusion(confusion, item.letter, picked)
  }

  return {
    ...profile,
    cells: { ...profile.cells, [key]: updated },
    confusion,
  }
}

/**
 * Records the answer to "which letters does the child already know".
 *
 * Marked letters get a head start on recognition and naming, enough that the
 * scheduler treats them as easy wins and spends the round on the rest. It is
 * deliberately short of solid: a parent's estimate is not evidence, so the
 * letter still has to prove itself before it can earn a star. Writing and
 * typing are left untouched, because knowing a letter by sight says nothing
 * about producing it.
 *
 * Unmarked letters are introduced as usual and stay at zero.
 */
export function placeKnownLetters(
  profile: Profile,
  known: readonly LetterId[],
  now: number,
): Profile {
  const today = dayIndex(now)
  const head: Cell = {
    h: TUNING.settledHalfLifeDays,
    t: now,
    n: 2,
    k: 2,
    cc: 2,
    kg: 2,
    kp: 0,
    days: 1,
    lastDay: today,
  }

  const cells = { ...profile.cells }
  for (const letter of known) {
    for (const skill of ['spot', 'name'] as const) {
      for (const glyphCase of ['upper', 'lower'] as const) {
        const key = cellKey(letter, skill, glyphCase)
        // Never overwrite something the child has actually done.
        if ((cells[key]?.n ?? 0) > 0) continue
        cells[key] = head
      }
    }
  }

  return {
    ...introduceLetters(profile, known),
    cells,
    placed: true,
  }
}

export function introduceLetters(
  profile: Profile,
  letters: readonly LetterId[],
): Profile {
  if (letters.length === 0) return profile
  const known = new Set(profile.introduced)
  const added = letters.filter((letter) => !known.has(letter))
  if (added.length === 0) return profile
  return { ...profile, introduced: [...profile.introduced, ...added] }
}

export interface RoundResult {
  readonly items: number
  readonly correct: number
  readonly assisted: number
  readonly seconds: number
  readonly letters: readonly LetterId[]
  readonly seeds: number
}

/**
 * Closes a round: history, seeds, and the stepping-stone path.
 *
 * The path only ever grows. A missed day is not an event in this app - there
 * is no streak to break, so there is nothing to feel bad about on returning.
 */
export function finishRound(
  profile: Profile,
  result: RoundResult,
  now: number,
): Profile {
  const summary: SessionSummary = {
    at: now,
    items: result.items,
    correct: result.correct,
    assisted: result.assisted,
    seconds: result.seconds,
    letters: result.letters,
  }
  const today = dayIndex(now)
  const newDay = today !== profile.lastPlayDay

  return {
    ...profile,
    confusion: decayConfusions(profile.confusion),
    seeds: profile.seeds + result.seeds,
    stones: newDay ? profile.stones + 1 : profile.stones,
    lastPlayDay: today,
    sessions: [summary, ...profile.sessions].slice(0, TUNING.historyLimit),
  }
}
