import type { Profile, SessionSummary } from '../storage/schema'
import type { Attempt } from '../modes/types'
import type { Cell } from './memory'
import { applyAnswer, NEW_CELL, dayIndex } from './memory'
import { cellKey } from './skills'
import { recordConfusion, decayConfusions } from './confusion'
import { TUNING } from './tuning'
import { applyWordAnswer, wordCellKey } from './reading'
import { autoPassLessons } from './path'
import { WORDS } from '../data/words'
import type { ReadingLevel } from '../storage/schema'
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

  const next: Profile = {
    ...profile,
    cells: { ...profile.cells, [key]: updated },
    confusion,
  }

  // A reading item also carries evidence about the word itself.
  if (item.wordId && attempt.wordSkill) {
    return applyWordAnswer(
      next,
      {
        wordId: item.wordId,
        skill: attempt.wordSkill,
        correct,
        assisted,
        gamma: attempt.gamma,
        weight: attempt.weight,
        focus: item.letter.toLowerCase(),
        placed: attempt.placed,
        wrongGrapheme: attempt.wrongGrapheme,
      },
      now,
    )
  }
  return next
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

  // Naming gets a smaller head start than spotting. "He knows B" almost always
  // means he points at it, not that he says "bee" unprompted, and if naming
  // started out as settled as recognition the engine would stop asking for it.
  const halfHead: Cell = { ...head, h: TUNING.settledHalfLifeDays / 2 }

  const cells = { ...profile.cells }
  for (const letter of known) {
    for (const skill of ['spot', 'name'] as const) {
      for (const glyphCase of ['upper', 'lower'] as const) {
        const key = cellKey(letter, skill, glyphCase)
        // Never overwrite something the child has actually done.
        if ((cells[key]?.n ?? 0) > 0) continue
        cells[key] = skill === 'spot' ? head : halfHead
      }
    }
    // A child who "knows the letter" can sound it out, and the reading track
    // is gated on exactly that, so the sound gets the same start as spotting.
    const soundKey = cellKey(letter, 'sound', 'upper')
    if ((cells[soundKey]?.n ?? 0) === 0) cells[soundKey] = head
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
  /** What the round pays, computed by nutsForRound before the screen shows it. */
  readonly nuts: number
}

/**
 * Closes a round: history, nuts, and the stepping-stone path.
 *
 * The purse and the lifetime total both grow here; only a purchase ever
 * lowers the purse. The path only ever grows too. A missed day is not an
 * event in this app - there is no streak to break, so there is nothing to
 * feel bad about on returning.
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
    seeds: profile.seeds + result.nuts,
    seedsEarned: profile.seedsEarned + result.nuts,
    stones: newDay ? profile.stones + 1 : profile.stones,
    lastPlayDay: today,
    sessions: [summary, ...profile.sessions].slice(0, TUNING.historyLimit),
  }
}

/**
 * The onboarding answers, applied at once: which letters are known and how
 * far the child reads. Reading ability seeds the word cells of the stages the
 * parent vouched for - short of solid, so the words still have to prove
 * themselves - and passes the lessons the child has clearly outgrown.
 */
export function applySurvey(
  profile: Profile,
  known: readonly LetterId[],
  level: ReadingLevel,
  now: number,
): Profile {
  let next = placeKnownLetters(profile, known, now)
  const today = dayIndex(now)
  const stagesByLevel = {
    none: [],
    letters: [],
    words: ['vc', 'cvc-cont', 'cvc', 'cvc-x'],
    syllables: ['vc', 'cvc-cont', 'cvc', 'cvc-x', 'digraph'],
    fluent: ['vc', 'cvc-cont', 'cvc', 'cvc-x', 'digraph', 'twosyl'],
  } as const
  const stages: readonly string[] = stagesByLevel[level]
  const head: Cell = {
    h: TUNING.reading.wordReadyHalfLifeDays,
    t: now,
    n: 2,
    k: 2,
    cc: 2,
    kg: 2,
    kp: 0,
    days: 1,
    lastDay: today,
  }
  const cells = { ...next.cells }
  const seeded: string[] = []
  for (const word of WORDS) {
    if (!stages.includes(word.stage)) continue
    const key = wordCellKey(word.id, 'read')
    if ((cells[key]?.n ?? 0) > 0) continue
    cells[key] = head
    seeded.push(word.id)
  }
  // A vouched-for reader also gets a passing transfer record, so the derived
  // reading stage agrees with the path from the first round.
  const novel =
    seeded.length > 0
      ? seeded.slice(0, 8).map((w) => ({ w, ok: true, at: now }))
      : next.reading.novel
  next = {
    ...next,
    cells,
    readingLevel: level,
    reading: {
      novel,
      wordsIntroduced: [...new Set([...next.reading.wordsIntroduced, ...seeded])],
    },
  }
  return autoPassLessons(next, known, level, now)
}
