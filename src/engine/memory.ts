import { DAY_MS, TUNING } from './tuning'

/**
 * The forgetting model.
 *
 * Calendar-day scheduling (Anki, Leitner) does not survive contact with a
 * five-year-old: they do not come back on day three because an algorithm said
 * so, and a Leitner box promotes on a single lucky one-in-four guess. Instead
 * each cell carries a half-life, recall probability decays continuously, and
 * the scheduler just picks whatever is weakest right now.
 *
 * The important part is the surprise term. Growth is multiplied by (1 - p):
 * being right about something you were shown twenty seconds ago proves
 * nothing, so the easy wins that keep a child happy cannot inflate mastery.
 */

export interface Cell {
  /** Half-life in days. Zero means never practised. */
  readonly h: number
  /** Epoch ms of the last answer. */
  readonly t: number
  /** Attempts. */
  readonly n: number
  /** Correct answers. */
  readonly k: number
  /** Current run of correct answers. */
  readonly cc: number
  /** Correct answers on guessable exercises (gamma > producedGuessRate). */
  readonly kg: number
  /** Correct answers on exercises that cannot be guessed. */
  readonly kp: number
  /** Distinct calendar days with at least one correct answer, capped small. */
  readonly days: number
  /** Day index of the last correct answer, to count distinct days. */
  readonly lastDay: number
}

export const NEW_CELL: Cell = {
  h: 0,
  t: 0,
  n: 0,
  k: 0,
  cc: 0,
  kg: 0,
  kp: 0,
  days: 0,
  lastDay: -1,
}

export function dayIndex(now: number): number {
  return Math.floor(now / DAY_MS)
}

/** Probability the child would get this cell right at `now`. */
export function recall(cell: Cell, now: number): number {
  if (cell.n === 0 || cell.h <= 0) return 0
  const elapsedDays = Math.max(0, (now - cell.t) / DAY_MS)
  return Math.pow(2, -elapsedDays / cell.h)
}

export function isSolid(cell: Cell): boolean {
  return cell.h >= TUNING.solidHalfLifeDays
}

export interface AnswerInput {
  readonly correct: boolean
  /** The game had to show the answer before the child got it. */
  readonly assisted: boolean
  /** Evidence weight of the channel: recognition 1.0 ... production 2.2. */
  readonly weight: number
  /** Probability of being right by luck in this exercise. */
  readonly gamma: number
  readonly now: number
}

/**
 * Applies one answer and returns a new cell. Nothing is mutated.
 */
export function applyAnswer(cell: Cell, input: AnswerInput): Cell {
  const { now } = input
  const p = recall(cell, now)
  const today = dayIndex(now)

  if (!input.correct) {
    return {
      ...cell,
      h: Math.max(TUNING.minHalfLifeDays, cell.h * TUNING.lapse),
      t: now,
      n: cell.n + 1,
      cc: 0,
    }
  }

  const base = Math.max(cell.h, TUNING.seedHalfLifeDays)
  const effort = input.assisted ? TUNING.assistedFactor : 1
  // Surprise term: the less likely the child was to recall it, the more the
  // success is worth.
  const growth = 1 + TUNING.gain * input.weight * (1 - input.gamma) * (1 - p) * effort
  const h = Math.min(TUNING.maxHalfLifeDays, base * growth)

  const guessable = input.gamma > TUNING.producedGuessRate
  const newDay = today !== cell.lastDay

  return {
    h,
    t: now,
    n: cell.n + 1,
    k: cell.k + 1,
    cc: input.assisted ? cell.cc : cell.cc + 1,
    kg: guessable ? cell.kg + 1 : cell.kg,
    kp: guessable || input.assisted ? cell.kp : cell.kp + 1,
    days: newDay ? Math.min(99, cell.days + 1) : cell.days,
    lastDay: today,
  }
}

/** Average recall over a set of cells, used for letter-level views. */
export function averageRecall(
  cells: readonly Cell[],
  now: number,
): number {
  if (cells.length === 0) return 0
  let total = 0
  for (const cell of cells) total += recall(cell, now)
  return total / cells.length
}
