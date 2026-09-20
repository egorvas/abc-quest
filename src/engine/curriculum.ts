import type { LetterId } from '../data/letters'

/**
 * The order letters are introduced in, and the two traps that order has to
 * dodge for a Russian-speaking child.
 *
 * Trap one: English letter names rhyme in clusters. Two members of the same
 * cluster introduced close together reliably fuse into mush and then get
 * confused for years.
 *
 * Trap two: false friends. This child has already seen B, C, H, P, X and Y
 * and knows a different sound for each of them. Those are not "just letters",
 * they are a conflict, so they come late and get extra repetitions.
 */

export const RHYME_FAMILIES: Readonly<Record<string, readonly LetterId[]>> = {
  // "bee, see, dee, ee, jee, pee, tee, vee, zee"
  ee: ['B', 'C', 'D', 'E', 'G', 'P', 'T', 'V', 'Z'],
  // "ef, el, em, en, ess, ex"
  eh: ['F', 'L', 'M', 'N', 'S', 'X'],
  // "ay, aitch, jay, kay"
  ay: ['A', 'H', 'J', 'K'],
}

const FAMILY_OF: ReadonlyMap<LetterId, string> = (() => {
  const map = new Map<LetterId, string>()
  for (const [family, letters] of Object.entries(RHYME_FAMILIES)) {
    for (const letter of letters) map.set(letter, family)
  }
  return map
})()

export function rhymeFamily(letter: LetterId): string | null {
  return FAMILY_OF.get(letter) ?? null
}

export function sameRhymeFamily(a: LetterId, b: LetterId): boolean {
  const fa = FAMILY_OF.get(a)
  return fa !== undefined && fa === FAMILY_OF.get(b)
}

/** Latin glyphs a Russian-speaking child already reads as something else. */
export const FALSE_FRIENDS: readonly LetterId[] = ['B', 'C', 'H', 'P', 'X', 'Y']

export function isFalseFriend(letter: LetterId): boolean {
  return FALSE_FRIENDS.includes(letter)
}

/**
 * Introduction order.
 *
 * No two neighbours share a rhyme family, the six false friends all sit in the
 * last third, and the opening run mixes letters whose lowercase looks like the
 * uppercase (O o, S s, U u) with letters where it does not (D d, I i, R r).
 */
export const INTRO_ORDER: readonly LetterId[] = [
  'S', 'O', 'D', 'I', 'M', 'R', 'T', 'U', 'L', 'A', 'G', 'N', 'E',
  'W', 'F', 'K', 'Z', 'Y', 'X', 'B', 'J', 'C', 'Q', 'V', 'H', 'P',
]

/**
 * Shapes children mix up. Static pairs are the well-documented ones; the
 * profile also learns its own from actual mistakes.
 */
export const STATIC_CONFUSIONS: readonly (readonly [LetterId, LetterId])[] = [
  ['B', 'D'], ['P', 'Q'], ['B', 'P'], ['D', 'Q'],
  ['M', 'N'], ['U', 'V'], ['N', 'U'],
  ['I', 'J'], ['I', 'L'], ['J', 'L'],
  ['E', 'F'], ['C', 'G'], ['O', 'Q'], ['M', 'W'],
  ['V', 'W'], ['G', 'Q'],
]

const CONFUSION_INDEX: ReadonlyMap<LetterId, readonly LetterId[]> = (() => {
  const map = new Map<LetterId, LetterId[]>()
  for (const [a, b] of STATIC_CONFUSIONS) {
    map.set(a, [...(map.get(a) ?? []), b])
    map.set(b, [...(map.get(b) ?? []), a])
  }
  return map
})()

export function staticPartners(letter: LetterId): readonly LetterId[] {
  return CONFUSION_INDEX.get(letter) ?? []
}

/**
 * Glyphs that render as the same shape in a sans-serif face.
 *
 * Capital I and lowercase l are the same vertical bar in most fonts, so
 * putting them on one screen is not a hard question, it is an unanswerable
 * one. Mixing cases on a board has to avoid producing this pair.
 */
const IDENTICAL_SHAPES: readonly (readonly [string, string])[] = [['I', 'l']]

export function glyphsClash(a: string, b: string): boolean {
  if (a === b) return true
  return IDENTICAL_SHAPES.some(
    ([x, y]) => (a === x && b === y) || (a === y && b === x),
  )
}

/** Extra drilling multiplier for letters that fight the child's first alphabet. */
export function repetitionMultiplier(letter: LetterId): number {
  return isFalseFriend(letter) ? 1.5 : 1
}
