import { LEVEL_COUNT, TIERS, tierOf, type Tier } from '../data/levels'
import type { Profile } from '../storage/schema'
import { grantWholeCity } from './city'
import { TUNING } from './tuning'

/**
 * Progress through the levels: what is passed, what is next, what it pays.
 *
 * A level is passed when at least half the answers were right first time;
 * below that it stays the current level and asks to be tried again. Stars
 * say how cleanly it went and are never taken away. Passing the last level
 * opens the whole town at once.
 */

export type LevelState = 'done' | 'current' | 'locked'

export interface LevelView {
  readonly n: number
  readonly state: LevelState
  readonly stars: number
}

export interface TierView {
  readonly tier: Tier
  readonly levels: readonly LevelView[]
  readonly done: boolean
}

export function starsOf(profile: Profile, n: number): number {
  return profile.levels[String(n)] ?? 0
}

export function levelsDone(profile: Profile): number {
  return Object.values(profile.levels).filter((stars) => stars > 0).length
}

export function allLevelsDone(profile: Profile): boolean {
  return levelsDone(profile) >= LEVEL_COUNT
}

/** The lowest level not yet passed. Null once the climb is finished. */
export function currentLevel(profile: Profile): number | null {
  for (let n = 1; n <= LEVEL_COUNT; n += 1) {
    if (starsOf(profile, n) === 0) return n
  }
  return null
}

export function isPassed(correct: number, total: number): boolean {
  return total > 0 && correct / total >= TUNING.levels.passShare
}

export function starsFor(correct: number, total: number): number {
  if (!isPassed(correct, total)) return 0
  const share = correct / total
  return share >= TUNING.levels.threeStars ? 3 : share >= TUNING.levels.twoStars ? 2 : 1
}

/** What a pass pays: a full purse the first time, stars or a token after. */
export function coinsForLevel(previousStars: number, stars: number): number {
  const { levels } = TUNING
  if (previousStars === 0) return levels.firstPass + levels.perStar * stars
  const gained = Math.max(0, stars - previousStars)
  return gained > 0 ? levels.perStar * gained : levels.replay
}

export function finishLevel(profile: Profile, n: number, stars: number): Profile {
  if (stars <= 0) return profile
  const previous = starsOf(profile, n)
  const next: Profile = {
    ...profile,
    levels: { ...profile.levels, [String(n)]: Math.max(previous, stars) },
  }
  return allLevelsDone(next) ? grantWholeCity(next) : next
}

/** Parent-side: marks the next `count` levels as passed with one star, no coins. */
export function skipLevels(profile: Profile, count: number): Profile {
  const levels = { ...profile.levels }
  let skipped = 0
  for (let n = 1; n <= LEVEL_COUNT && skipped < count; n += 1) {
    if ((levels[String(n)] ?? 0) > 0) continue
    levels[String(n)] = 1
    skipped += 1
  }
  const next = { ...profile, levels }
  return allLevelsDone(next) ? grantWholeCity(next) : next
}

/** Parent-side: back to level one. The town and the coins are kept. */
export function restartLevels(profile: Profile): Profile {
  return { ...profile, levels: {} }
}

export function levelsView(profile: Profile): readonly TierView[] {
  const current = currentLevel(profile)
  return TIERS.map((tier) => {
    const levels: LevelView[] = []
    for (let n = tier.from; n <= tier.to; n += 1) {
      const stars = starsOf(profile, n)
      levels.push({ n, stars, state: stars > 0 ? 'done' : n === current ? 'current' : 'locked' })
    }
    return { tier, levels, done: levels.every((l) => l.state === 'done') }
  })
}

export function nextLevelAfter(profile: Profile, n: number): number | null {
  for (let m = n + 1; m <= LEVEL_COUNT; m += 1) {
    if (starsOf(profile, m) === 0) return m
  }
  return currentLevel(profile)
}

export { LEVEL_COUNT, tierOf }
