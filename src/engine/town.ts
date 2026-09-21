import type { LetterId } from '../data/letters'
import { LETTER_IDS } from '../data/letters'
import type { BedStage, ExtraId, Profile, SlotId, Town } from '../storage/schema'
import { EXTRA_IDS } from '../storage/schema'
import { bedFor } from './garden'
import { letterStatus } from './mastery'
import { TUNING } from './tuning'
import { SLOT_IDS, itemAt, itemsOf, type TownItem } from './townItems'

/**
 * Letter Town: the sink for the nuts.
 *
 * Every function here is pure and takes `now`, so the simulator can drive it
 * and the screens can call it once per render. Writes return a new profile,
 * or the very same object when the purchase is refused, so a caller can tell
 * the two apart with `===`.
 */

const SLOT_CODE: Readonly<Record<SlotId, string>> = { front: 'f', back: 'b', friend: 'r' }

export function owns(town: Town, letter: LetterId, slot: SlotId): boolean {
  return (town.lots[letter] ?? '').includes(SLOT_CODE[slot])
}

/**
 * Gate only. Front and back open when the letter has been met in a level,
 * the friend when the letter has its gold star. Says nothing about the purse.
 */
export function isUnlocked(
  profile: Profile,
  letter: LetterId,
  slot: SlotId,
  now: number,
): boolean {
  if (slot === 'friend') return letterStatus(profile, letter, now).stage === 'mastered'
  return profile.introduced.includes(letter)
}

/** Passed levels, counted here so the town needs nothing from the levels module. */
function levelsPassed(profile: Profile): number {
  return Object.values(profile.levels).filter((stars) => stars > 0).length
}

/**
 * The prize for the last level: every lot and every extra, at once. Nothing
 * is charged and the purse is kept, so what is left can still be spent on
 * nothing in particular.
 */
export function grantWholeTown(profile: Profile): Profile {
  const lots = Object.fromEntries(LETTER_IDS.map((letter) => [letter, 'fbr'])) as Town['lots']
  return {
    ...profile,
    introduced: [...LETTER_IDS],
    town: { ...profile.town, lots, extras: [...EXTRA_IDS] },
  }
}

export function canAfford(profile: Profile, item: TownItem): boolean {
  return profile.seeds >= item.price
}

/** Unlocked, unowned and affordable: the exact condition for a live button. */
export function canBuy(
  profile: Profile,
  letter: LetterId,
  slot: SlotId,
  now: number,
): boolean {
  return (
    !owns(profile.town, letter, slot) &&
    isUnlocked(profile, letter, slot, now) &&
    canAfford(profile, itemAt(letter, slot))
  )
}

/** Buys and places in one step. Returns `profile` itself when refused. */
export function buyItem(
  profile: Profile,
  letter: LetterId,
  slot: SlotId,
  now: number,
): Profile {
  if (!canBuy(profile, letter, slot, now)) return profile
  const item = itemAt(letter, slot)
  const lots = {
    ...profile.town.lots,
    [letter]: `${profile.town.lots[letter] ?? ''}${SLOT_CODE[slot]}`,
  }
  return {
    ...profile,
    seeds: profile.seeds - item.price,
    town: { ...profile.town, lots, spent: profile.town.spent + item.price },
  }
}

export function extraUnlocked(profile: Profile, extra: ExtraId): boolean {
  return levelsPassed(profile) >= TUNING.town.extraAt[extra]
}

export function ownsExtra(town: Town, extra: ExtraId): boolean {
  return town.extras.includes(extra)
}

/** Same contract as buyItem for a town-wide extra, gated on levels passed. */
export function buyExtra(profile: Profile, extra: ExtraId): Profile {
  const price = TUNING.town.extraPrice
  if (ownsExtra(profile.town, extra)) return profile
  if (!extraUnlocked(profile, extra)) return profile
  if (profile.seeds < price) return profile
  return {
    ...profile,
    seeds: profile.seeds - price,
    town: {
      ...profile.town,
      extras: [...profile.town.extras, extra],
      spent: profile.town.spent + price,
    },
  }
}

/* ---- views ------------------------------------------------------------ */

export interface LotSlotView {
  readonly item: TownItem
  readonly owned: boolean
  readonly unlocked: boolean
  readonly affordable: boolean
  /** Nuts still missing. Zero when owned or affordable. */
  readonly shortBy: number
  /** The milestone that opens a locked slot, for the sheet's icon. */
  readonly gateIcon: '⭐' | '🔤' | null
}

export interface LotView {
  readonly letter: LetterId
  readonly plant: BedStage
  /** Mastered: the letter balloon flies over this lot. */
  readonly gold: boolean
  readonly slots: readonly LotSlotView[]
  /** Everything that can be bought here has been. */
  readonly complete: boolean
}

export function lotView(profile: Profile, letter: LetterId, now: number): LotView {
  const bed = bedFor(profile, letter, now)
  const gold = letterStatus(profile, letter, now).stage === 'mastered'
  const slots = itemsOf(letter).map((item): LotSlotView => {
    const owned = owns(profile.town, letter, item.slot)
    const unlocked = isUnlocked(profile, letter, item.slot, now)
    const affordable = canAfford(profile, item)
    return {
      item,
      owned,
      unlocked,
      affordable,
      shortBy: owned || affordable ? 0 : item.price - profile.seeds,
      gateIcon: unlocked ? null : item.slot === 'friend' ? '⭐' : '🔤',
    }
  })
  return {
    letter,
    plant: bed.stage,
    gold,
    slots,
    complete: slots.every((slot) => slot.owned),
  }
}

/** All 26 lots in alphabet order: the town screen's only data call. */
export function townView(profile: Profile, now: number): readonly LotView[] {
  return LETTER_IDS.map((letter) => lotView(profile, letter, now))
}

export interface ExtraView {
  readonly id: ExtraId
  readonly price: number
  readonly owned: boolean
  readonly unlocked: boolean
  /** Levels still to pass before it opens. */
  readonly levelsToGo: number
}

export function extrasFor(profile: Profile): readonly ExtraView[] {
  return EXTRA_IDS.map((id) => ({
    id,
    price: TUNING.town.extraPrice,
    owned: ownsExtra(profile.town, id),
    unlocked: extraUnlocked(profile, id),
    levelsToGo: Math.max(0, TUNING.town.extraAt[id] - levelsPassed(profile)),
  }))
}

/**
 * Where the round-end "Spend" button jumps: the cheapest buyable slot, ties
 * broken towards the letter the child is weakest on. Null when nothing is
 * buyable right now.
 */
export function nextPurchase(
  profile: Profile,
  now: number,
): { readonly letter: LetterId; readonly slot: SlotId } | null {
  let best: { letter: LetterId; slot: SlotId; price: number; recall: number } | null = null
  for (const letter of LETTER_IDS) {
    for (const slot of SLOT_IDS) {
      if (!canBuy(profile, letter, slot, now)) continue
      const price = itemAt(letter, slot).price
      const recall = letterStatus(profile, letter, now).recall
      if (!best || price < best.price || (price === best.price && recall < best.recall)) {
        best = { letter, slot, price, recall }
      }
    }
  }
  return best ? { letter: best.letter, slot: best.slot } : null
}

/**
 * The one lot that breathes on the town screen: the weakest introduced
 * letter that still has something locked or unbought. One lot, no label -
 * a child who notices it is drawn in, a child who does not is told nothing.
 */
export function suggestedLot(profile: Profile, now: number): LetterId | null {
  let best: { letter: LetterId; recall: number } | null = null
  for (const letter of profile.introduced) {
    const view = lotView(profile, letter, now)
    if (view.complete) continue
    const recall = letterStatus(profile, letter, now).recall
    if (!best || recall < best.recall) best = { letter, recall }
  }
  return best?.letter ?? null
}

/** Parent-side only: the child never sees a completion count. */
export function townCompletion(town: Town): { readonly owned: number; readonly total: number } {
  const owned = Object.values(town.lots).reduce((sum, packed) => sum + (packed?.length ?? 0), 0)
  return { owned, total: LETTER_IDS.length * SLOT_IDS.length }
}
