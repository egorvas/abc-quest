import type { LetterId } from '../data/letters'
import { isLetterId } from '../data/letters'
import { staticPartners } from './curriculum'
import { TUNING } from './tuning'

/**
 * Which letters this particular child mixes up.
 *
 * Static pairs cover the documented ones (b/d, p/q, M/W). On top of that the
 * profile learns from real mistakes, and those learned weights fade, so a
 * misunderstanding from three weeks ago stops shaping today's questions.
 */

export type ConfusionMap = Readonly<Record<string, number>>

function key(target: LetterId, picked: LetterId): string {
  return `${target}>${picked}`
}

export function recordConfusion(
  map: ConfusionMap,
  target: LetterId,
  picked: LetterId,
): ConfusionMap {
  if (target === picked) return map
  const k = key(target, picked)
  return { ...map, [k]: Math.min(5, (map[k] ?? 0) + 1) }
}

/** Called once per session: old mistakes should stop haunting the child. */
export function decayConfusions(map: ConfusionMap): ConfusionMap {
  const next: Record<string, number> = {}
  for (const [k, weight] of Object.entries(map)) {
    const faded = weight * TUNING.confusionDecay
    if (faded >= 0.25) next[k] = faded
  }
  return next
}

export function confusionWeight(
  map: ConfusionMap,
  target: LetterId,
  other: LetterId,
): number {
  const learned = (map[key(target, other)] ?? 0) + (map[key(other, target)] ?? 0)
  const isStatic = staticPartners(target).includes(other)
  return learned + (isStatic ? 1 : 0)
}

/** Everything this child is known to confuse with `letter`, strongest first. */
export function partnersOf(map: ConfusionMap, letter: LetterId): readonly LetterId[] {
  const scores = new Map<LetterId, number>()
  for (const partner of staticPartners(letter)) {
    scores.set(partner, (scores.get(partner) ?? 0) + 1)
  }
  for (const [k, weight] of Object.entries(map)) {
    const [a, b] = k.split('>')
    if (!isLetterId(a) || !isLetterId(b)) continue
    if (a === letter) scores.set(b, (scores.get(b) ?? 0) + weight)
    else if (b === letter) scores.set(a, (scores.get(a) ?? 0) + weight)
  }
  return [...scores.entries()]
    .sort((x, y) => y[1] - x[1])
    .map(([letterId]) => letterId)
}

export interface ContrastDecision {
  /** Safe to put the confusable partner on screen as a distractor. */
  readonly allow: boolean
  /** Must be kept off this screen entirely - contrast would interfere. */
  readonly ban: boolean
}

/**
 * When to deliberately show the letter a child confuses with the target.
 *
 * Contrast only teaches once an independent memory trace exists. Put b next to
 * d while the child is still shaky on b and you get interference, not
 * discrimination - so below the ban threshold the partner is removed from the
 * screen entirely and kept several questions away.
 */
export function contrastDecision(
  targetRecall: number,
  partnerRecall: number,
  targetAttempts: number,
  targetStreak: number,
): ContrastDecision {
  if (targetRecall < TUNING.confusionBanBelow) return { allow: false, ban: true }
  const allow =
    targetRecall >= TUNING.confusionTargetMin &&
    partnerRecall >= TUNING.confusionPartnerMin &&
    targetAttempts >= TUNING.confusionMinAttempts &&
    targetStreak >= TUNING.confusionMinStreak
  return { allow, ban: false }
}
