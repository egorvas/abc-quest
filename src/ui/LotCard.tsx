import type { LotSlotView, LotView } from '../engine/town'
import type { TownItem } from '../engine/townItems'
import { TownGlyph } from './townSvg'
import './LotCard.css'

const PLANT: Record<number, string> = { 0: '', 1: '🌱', 2: '🌼', 3: '🌳' }

interface LotCardProps {
  readonly lot: LotView
  readonly onOpen: (letter: LotView['letter']) => void
  /** The one lot on the street that breathes. */
  readonly calls: boolean
  readonly night: boolean
  readonly balloons: boolean
  /** Slot that has just been bought, for the landing animation. */
  readonly justBought?: TownItem['slot'] | null
}

/**
 * Emoji scale with the card through CSS; only the SVG items need a number,
 * because an SVG has no font size to inherit.
 */
export function itemGlyph(item: TownItem, size: number, fixed = false) {
  if (item.svg) return <TownGlyph kind={item.svg} size={size} />
  return (
    <span className="lot__emoji" style={fixed ? { fontSize: size } : undefined}>
      {item.glyph}
    </span>
  )
}

function SlotView({ slot, size, justBought }: {
  readonly slot: LotSlotView
  readonly size: number
  readonly justBought: boolean
}) {
  if (slot.owned) {
    return (
      <span className={`lot__item ${justBought ? 'lot__item--landing' : ''}`}>
        {itemGlyph(slot.item, size)}
      </span>
    )
  }
  return (
    <span className={`lot__ghost ${slot.unlocked && slot.affordable ? 'lot__ghost--live' : ''}`}>
      {slot.unlocked ? `🌰 ${slot.item.price}` : '🚧'}
    </span>
  )
}

/**
 * One lot on the street. Six layers back to front: sky, the back item, the
 * plant, the front item, the friend, the balloon. Positions are fixed, which
 * is what makes emoji of wildly different weight look composed together.
 */
export function LotCard({ lot, onOpen, calls, night, balloons, justBought }: LotCardProps) {
  const [front, back, friend] = lot.slots
  return (
    <button
      type="button"
      className={[
        'lot',
        calls ? 'lot--calls' : '',
        night ? 'lot--night' : '',
        lot.complete ? 'lot--complete' : '',
      ]
        .filter(Boolean)
        .join(' ')}
      onClick={() => onOpen(lot.letter)}
      aria-label={`Lot ${lot.letter}`}
    >
      <span className="lot__ground">
        <span className="lot__pave">{lot.letter}</span>
      </span>
      <span className="lot__slot lot__slot--back">
        <SlotView slot={back} size={64} justBought={justBought === 'back'} />
      </span>
      {lot.plant > 0 ? <span className="lot__plant">{PLANT[lot.plant]}</span> : null}
      <span className="lot__slot lot__slot--front">
        <SlotView slot={front} size={48} justBought={justBought === 'front'} />
      </span>
      <span className="lot__slot lot__slot--friend">
        <SlotView slot={friend} size={42} justBought={justBought === 'friend'} />
      </span>
      {lot.gold ? (
        <span className={`lot__balloon ${balloons ? 'lot__balloon--rising' : ''}`}>
          <span className="lot__balloon-letter">{lot.letter}</span>🎈
        </span>
      ) : null}
    </button>
  )
}
