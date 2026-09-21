import { useEffect } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import type { LotView } from '../engine/town'
import type { SlotId } from '../storage/schema'
import { Button } from './Button'
import { LetterTile } from './LetterTile'
import { itemGlyph } from './LotCard'
import { playLetterNote } from '../audio/letterNote'
import { speak, speakLetterName } from '../audio/speak'
import './LotSheet.css'

interface LotSheetProps {
  readonly lot: LotView
  readonly onBuy: (letter: LetterId, slot: SlotId) => void
  readonly onPlay: (letter: LetterId) => void
  readonly onClose: () => void
  /** Row to pulse when the sheet was opened from the round-end Spend button. */
  readonly highlight?: SlotId | null
}

/**
 * The shop is the lot you are standing in.
 *
 * A non-reading child cannot navigate a catalogue of seventy-eight items, and
 * a separate shop would divorce "buy" from "where it goes". Three rows in
 * price order, which is also gate order, so the cheapest thing is always the
 * one that is always open. One tap on a price is the purchase.
 */
export function LotSheet({ lot, onBuy, onPlay, onClose, highlight }: LotSheetProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const info = letterInfo(lot.letter)
  const sayLetter = () => {
    playLetterNote(lot.letter)
    void speakLetterName(lot.letter)
  }

  return (
    <div className="sheet" role="dialog" aria-label={`Lot ${lot.letter}`}>
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label="Close" />
      <div className="sheet__panel">
        <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
          ✕
        </button>

        <div className="sheet__head">
          <LetterTile letter={lot.letter} size="md" onPress={sayLetter} />
          <LetterTile letter={lot.letter} letterCase="lower" size="md" onPress={sayLetter} />
          <span className="sheet__word">
            {info.emoji} {info.word}
          </span>
        </div>

        <div className="sheet__rows">
          {lot.slots.map((slot) => {
            const { item } = slot
            const pulse = highlight === item.slot && !slot.owned
            return (
              <div key={item.slot} className={`sheet__row ${pulse ? 'sheet__row--pulse' : ''}`}>
                <button
                  type="button"
                  className={`sheet__glyph ${slot.owned ? '' : 'sheet__glyph--dim'}`}
                  onClick={() => {
                    if (slot.owned) void speak(`${lot.letter} is for ${item.word}`)
                  }}
                  aria-label={item.word}
                >
                  {itemGlyph(item, 56, true)}
                </button>
                <span className="sheet__name">{item.word}</span>
                <span className="sheet__control">
                  {slot.owned ? (
                    <span className="sheet__owned">✓</span>
                  ) : !slot.unlocked ? (
                    <span className="sheet__locked" aria-label="Locked">
                      🚧 {slot.gateIcon}
                    </span>
                  ) : slot.affordable ? (
                    <Button tone="amber" onPress={() => onBuy(lot.letter, item.slot)}>
                      🪙 {item.price}
                    </Button>
                  ) : (
                    <span className="sheet__short">
                      <Button tone="amber" onPress={() => {}} disabled>
                        🪙 {item.price}
                      </Button>
                      <span className="sheet__ghosts" aria-label={`${slot.shortBy} more`}>
                        {Array.from({ length: Math.min(slot.shortBy, 7) }, (_, i) => (
                          <span key={i}>🪙</span>
                        ))}
                      </span>
                    </span>
                  )}
                </span>
              </div>
            )
          })}
        </div>

        <div className="sheet__foot">
          <Button size="lg" tone="primary" onPress={() => onPlay(lot.letter)} wide>
            ▶︎ Play {lot.letter}
          </Button>
        </div>
      </div>
    </div>
  )
}
