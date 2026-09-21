import { BUILDINGS, buildingInfo, type Building } from '../data/city'
import type { Profile } from '../storage/schema'

/**
 * The city: the sink for the coins.
 *
 * Every function here is pure. Writes return a new profile, or the very same
 * object when the purchase is refused, so a caller can tell the two apart
 * with `===`. Nothing is ever lost, sold or moved.
 */

export function owns(profile: Profile, id: string): boolean {
  return profile.city.buildings.includes(id)
}

function levelsPassed(profile: Profile): number {
  return Object.values(profile.levels).filter((stars) => stars > 0).length
}

/** Gate only: enough levels passed, and whatever it stands on already built. */
export function isUnlocked(profile: Profile, item: Building): boolean {
  if (levelsPassed(profile) < item.unlockAt) return false
  return item.requires ? owns(profile, item.requires) : true
}

export function canBuy(profile: Profile, id: string): boolean {
  const item = buildingInfo(id)
  return !owns(profile, id) && isUnlocked(profile, item) && profile.seeds >= item.price
}

/** Buys and places in one step. Returns `profile` itself when refused. */
export function buyBuilding(profile: Profile, id: string): Profile {
  if (!canBuy(profile, id)) return profile
  const item = buildingInfo(id)
  return {
    ...profile,
    seeds: profile.seeds - item.price,
    city: {
      buildings: [...profile.city.buildings, id],
      spent: profile.city.spent + item.price,
    },
  }
}

/** The prize for the last level: everything, at once, for free. */
export function grantWholeCity(profile: Profile): Profile {
  return {
    ...profile,
    city: { ...profile.city, buildings: BUILDINGS.map((item) => item.id) },
  }
}

export type BuildingState = 'owned' | 'forsale' | 'short' | 'locked'

export interface BuildingView {
  readonly item: Building
  readonly state: BuildingState
  /** Coins still missing when for sale but unaffordable. */
  readonly shortBy: number
  /** Levels still to pass when locked by progress. */
  readonly levelsToGo: number
}

export function buildingView(profile: Profile, item: Building): BuildingView {
  const owned = owns(profile, item.id)
  const unlocked = isUnlocked(profile, item)
  const affordable = profile.seeds >= item.price
  const state: BuildingState = owned ? 'owned' : !unlocked ? 'locked' : affordable ? 'forsale' : 'short'
  return {
    item,
    state,
    shortBy: state === 'short' ? item.price - profile.seeds : 0,
    levelsToGo: Math.max(0, item.unlockAt - levelsPassed(profile)),
  }
}

export function cityView(profile: Profile): readonly BuildingView[] {
  return BUILDINGS.map((item) => buildingView(profile, item))
}

/** The cheapest thing that can be bought right now, for the round-end button. */
export function nextPurchase(profile: Profile): string | null {
  let best: Building | null = null
  for (const item of BUILDINGS) {
    if (!canBuy(profile, item.id)) continue
    if (!best || item.price < best.price) best = item
  }
  return best?.id ?? null
}

export function cityCompletion(profile: Profile): { readonly owned: number; readonly total: number } {
  return { owned: profile.city.buildings.length, total: BUILDINGS.length }
}
