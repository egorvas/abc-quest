/**
 * The city: everything that can be bought with coins, and where it stands.
 *
 * Coordinates are in the map's 1200 x 800 viewBox. `unlockAt` is the number
 * of passed levels that puts the item up for sale; `requires` is another
 * item that has to be owned first (the bridge before anything across the
 * river). Prices add up to a little less than the coins the levels pay, so
 * a child who passes everything can buy everything and still have change.
 */

export type BuildingKind = 'building' | 'road' | 'nature' | 'fun' | 'transport' | 'decor'

export interface Building {
  readonly id: string
  readonly name: string
  readonly emoji: string
  readonly price: number
  readonly unlockAt: number
  readonly requires?: string
  readonly kind: BuildingKind
  /** Centre of the plot on the map. */
  readonly x: number
  readonly y: number
  /** Emoji size on the map. */
  readonly size: number
}

const b = (
  id: string,
  name: string,
  emoji: string,
  price: number,
  unlockAt: number,
  kind: BuildingKind,
  x: number,
  y: number,
  size: number,
  requires?: string,
): Building => ({ id, name, emoji, price, unlockAt, kind, x, y, size, requires })

export const BUILDINGS: readonly Building[] = [
  // south-west: homes and small shops
  b('house1', 'a house', '🏠', 3, 0, 'building', 110, 560, 58),
  b('house2', 'a house', '🏡', 3, 1, 'building', 230, 560, 58),
  b('house3', 'a house', '🏠', 3, 3, 'building', 350, 560, 58),
  b('house4', 'a house', '🏡', 3, 5, 'building', 470, 560, 58),
  b('icecream', 'an ice cream stand', '🍦', 4, 2, 'fun', 110, 670, 52),
  b('pizza', 'a pizza place', '🍕', 5, 6, 'fun', 230, 670, 52),
  b('shop', 'a shop', '🏪', 6, 8, 'building', 350, 670, 58),
  b('busstop', 'a bus stop', '🚏', 3, 10, 'transport', 470, 670, 48),
  // roads and lights
  b('road-north', 'the north road', '🛣️', 3, 4, 'road', 576, 320, 0),
  b('road-south', 'the south road', '🛣️', 3, 9, 'road', 576, 620, 0),
  b('lamps', 'street lights', '💡', 6, 14, 'decor', 300, 505, 0),
  // north-west: the town's services
  b('school', 'a school', '🏫', 12, 12, 'building', 140, 360, 72),
  b('hospital', 'a hospital', '🏥', 15, 25, 'building', 280, 360, 72),
  b('firestation', 'a fire station', '🚒', 12, 22, 'building', 420, 360, 64),
  b('library', 'a library', '📚', 8, 17, 'building', 140, 245, 56),
  b('police', 'a police station', '🚓', 8, 20, 'building', 280, 245, 56),
  b('bank', 'a bank', '🏦', 10, 30, 'building', 420, 245, 60),
  b('forest', 'a forest', '🌲', 4, 18, 'nature', 500, 240, 44),
  // north-east: the centre
  b('park', 'a park', '🌳', 6, 11, 'nature', 690, 230, 52),
  b('theatre', 'a theatre', '🎭', 15, 28, 'fun', 830, 230, 60),
  b('museum', 'a dinosaur museum', '🦖', 15, 64, 'fun', 950, 240, 60),
  b('townhall', 'the town hall', '🏛️', 20, 33, 'building', 700, 355, 84),
  b('fountain', 'a fountain', '⛲', 6, 15, 'decor', 830, 365, 58),
  b('circus', 'a circus', '🎪', 18, 36, 'fun', 950, 355, 64),
  // south-east: fun
  b('zoo', 'a zoo', '🦁', 25, 40, 'fun', 700, 570, 62),
  b('ferris', 'a ferris wheel', '🎡', 22, 45, 'fun', 840, 560, 84),
  b('coaster', 'a rollercoaster', '🎢', 18, 50, 'fun', 960, 565, 70),
  b('stadium', 'a stadium', '🏟️', 25, 52, 'fun', 700, 685, 72),
  b('station', 'a train station', '🚉', 18, 58, 'transport', 860, 690, 62),
  b('tram', 'a tram', '🚋', 12, 62, 'transport', 600, 465, 0),
  // hills and sky
  b('castle', 'a castle', '🏰', 32, 118, 'building', 120, 125, 76),
  b('rocket', 'a rocket', '🚀', 40, 138, 'fun', 520, 140, 64),
  b('observatory', 'an observatory', '🔭', 15, 132, 'building', 760, 135, 56),
  b('tvtower', 'a TV tower', '🗼', 22, 68, 'building', 930, 125, 76),
  b('balloons', 'hot air balloons', '🎈', 8, 72, 'decor', 400, 420, 0),
  b('fireworks', 'fireworks', '🎆', 10, 126, 'decor', 700, 60, 0),
  b('farm', 'a farm', '🚜', 8, 76, 'nature', 1120, 745, 50, 'bridge'),
  // across the river
  b('bridge', 'a bridge', '🌉', 10, 80, 'road', 1030, 464, 0),
  b('road-east', 'the east road', '🛣️', 3, 80, 'road', 1130, 464, 0, 'bridge'),
  b('lighthouse', 'a lighthouse', '🚨', 10, 86, 'building', 1130, 235, 0, 'bridge'),
  b('harbour', 'a harbour', '⚓', 18, 92, 'transport', 1120, 340, 52, 'bridge'),
  b('beach', 'a beach', '🏖️', 8, 98, 'fun', 1120, 560, 60, 'bridge'),
  b('yacht', 'a yacht', '🛥️', 8, 100, 'transport', 1040, 300, 0, 'harbour'),
  b('airport', 'an airport', '✈️', 32, 108, 'transport', 1120, 650, 60, 'bridge'),
]

const INDEX: ReadonlyMap<string, Building> = new Map(BUILDINGS.map((item) => [item.id, item]))

export function buildingInfo(id: string): Building {
  const item = INDEX.get(id)
  if (!item) throw new Error(`Unknown building: ${id}`)
  return item
}

export function isBuildingId(value: unknown): value is string {
  return typeof value === 'string' && INDEX.has(value)
}

export const CITY_TOTAL_PRICE = BUILDINGS.reduce((sum, item) => sum + item.price, 0)
