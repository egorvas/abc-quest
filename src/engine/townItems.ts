import type { LetterId } from '../data/letters'
import { LETTER_IDS, letterInfo } from '../data/letters'
import type { SlotId } from '../storage/schema'
import { TUNING } from './tuning'

/**
 * The Letter Town catalogue: 26 lots, three things to buy in each.
 *
 * Every item is a word that starts with the lot's letter, so the collection
 * is the alphabet in disguise. The front item is the app's own "A is for"
 * word, straight from the letter data, which means buying it reinforces the
 * same vocabulary the picture game teaches. Back and friend are the table
 * below. Three entries are drawn as inline SVG because no emoji exists.
 *
 * The friend slot is defined by behaviour - it bobs - not by biology, which
 * is how V gets a violin and Z gets a lightning bolt without cheating.
 */

export type TownSvg = 'quilt' | 'xylophone' | 'zooGate'

export interface TownItem {
  readonly letter: LetterId
  readonly slot: SlotId
  readonly word: string
  /** Emoji, or '' when `svg` is set. */
  readonly glyph: string
  readonly svg?: TownSvg
  readonly price: number
}

interface Row {
  readonly back: readonly [string, string, TownSvg?]
  readonly friend: readonly [string, string, TownSvg?]
}

const ROWS: Readonly<Record<LetterId, Row>> = {
  A: { back: ['🏟️', 'Arena'], friend: ['🐜', 'Ant'] },
  B: { back: ['🌉', 'Bridge'], friend: ['🐻', 'Bear'] },
  C: { back: ['🏰', 'Castle'], friend: ['🐄', 'Cow'] },
  D: { back: ['🚪', 'Door'], friend: ['🐬', 'Dolphin'] },
  E: { back: ['🚂', 'Engine'], friend: ['🦅', 'Eagle'] },
  F: { back: ['🏭', 'Factory'], friend: ['🐸', 'Frog'] },
  G: { back: ['⛩️', 'Gate'], friend: ['🐐', 'Goat'] },
  H: { back: ['🏥', 'Hospital'], friend: ['🐴', 'Horse'] },
  I: { back: ['🛖', 'Igloo'], friend: ['🦎', 'Iguana'] },
  J: { back: ['🛩️', 'Jet'], friend: ['🪼', 'Jellyfish'] },
  K: { back: ['🏪', 'Kiosk'], friend: ['🦘', 'Kangaroo'] },
  L: { back: ['🏛️', 'Library'], friend: ['🐆', 'Leopard'] },
  M: { back: ['⛰️', 'Mountain'], friend: ['🐵', 'Monkey'] },
  N: { back: ['🥅', 'Net'], friend: ['🪺', 'Nest'] },
  O: { back: ['🏢', 'Office'], friend: ['🐙', 'Octopus'] },
  P: { back: ['🏤', 'Post office'], friend: ['🐧', 'Penguin'] },
  Q: { back: ['', 'Quilt', 'quilt'], friend: ['🦆', 'Quack'] },
  R: { back: ['🚀', 'Rocket'], friend: ['🐰', 'Rabbit'] },
  S: { back: ['🏫', 'School'], friend: ['🐍', 'Snake'] },
  T: { back: ['🗼', 'Tower'], friend: ['🐯', 'Tiger'] },
  U: { back: ['🛸', 'UFO'], friend: ['🦄', 'Unicorn'] },
  V: { back: ['🌋', 'Volcano'], friend: ['🎻', 'Violin'] },
  W: { back: ['🌊', 'Wave'], friend: ['🐳', 'Whale'] },
  X: { back: ['🩻', 'X-ray'], friend: ['', 'Xylophone', 'xylophone'] },
  Y: { back: ['⛵', 'Yacht'], friend: ['🐃', 'Yak'] },
  Z: { back: ['', 'Zoo gate', 'zooGate'], friend: ['⚡', 'Zap'] },
}

export const SLOT_IDS: readonly SlotId[] = ['front', 'back', 'friend']

function build(letter: LetterId, slot: SlotId): TownItem {
  const price = TUNING.town.price[slot]
  if (slot === 'front') {
    const info = letterInfo(letter)
    return { letter, slot, word: info.word, glyph: info.emoji, price }
  }
  const [glyph, word, svg] = ROWS[letter][slot]
  return svg
    ? { letter, slot, word, glyph, svg, price }
    : { letter, slot, word, glyph, price }
}

/** All 78 items, A..Z then front/back/friend. */
export const TOWN_ITEMS: readonly TownItem[] = LETTER_IDS.flatMap((letter) =>
  SLOT_IDS.map((slot) => build(letter, slot)),
)

const INDEX: ReadonlyMap<string, TownItem> = new Map(
  TOWN_ITEMS.map((item) => [`${item.letter}|${item.slot}`, item]),
)

/** The three items of one lot, front first. */
export function itemsOf(letter: LetterId): readonly TownItem[] {
  return SLOT_IDS.map((slot) => itemAt(letter, slot))
}

/** One lot's slot. Static data, so an unknown pair is a programming error. */
export function itemAt(letter: LetterId, slot: SlotId): TownItem {
  const item = INDEX.get(`${letter}|${slot}`)
  if (!item) throw new Error(`No town item for ${letter} ${slot}`)
  return item
}
