import type { Profile, SessionSummary } from '../storage/schema'
import type { Attempt } from '../modes/types'
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
