import type { BuildingView } from '../engine/city'
import { Button } from './Button'
import './Sheet.css'
import './BuySheet.css'

interface BuySheetProps {
  readonly view: BuildingView
  readonly purse: number
  readonly onBuy: () => void
  readonly onPlay: () => void
  readonly onClose: () => void
}

/**
 * One building, one decision. A child who cannot read sees the picture, the
 * coins it costs and a button that is either lit or not; the words are for
 * the parent leaning over.
 */
export function BuySheet({ view, purse, onBuy, onPlay, onClose }: BuySheetProps) {
  const { item, state } = view
  return (
    <div className="sheet" role="dialog" aria-label={item.name}>
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label="Close" />
      <div className="sheet__panel buy">
        <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="buy__hero">
          <span className={`buy__emoji ${state === 'locked' ? 'buy__emoji--dim' : ''}`}>
            {item.emoji === '🛣️' ? '🛣️' : item.emoji}
          </span>
          <span className="buy__name">{item.name}</span>
          <span className="buy__price">🪙 {item.price}</span>
        </div>
        {state === 'owned' ? (
          <p className="buy__note">✓ Already in your city</p>
        ) : state === 'locked' ? (
          <p className="buy__note">
            🚧{' '}
            {view.levelsToGo > 0
              ? `Opens after ${view.levelsToGo} more ${view.levelsToGo === 1 ? 'level' : 'levels'}`
              : `Build ${item.requires === 'bridge' ? 'the bridge' : 'the harbour'} first`}
          </p>
        ) : state === 'short' ? (
          <p className="buy__note">
            Need 🪙 {view.shortBy} more · you have 🪙 {purse}
          </p>
        ) : (
          <p className="buy__note">You have 🪙 {purse}</p>
        )}
        <div className="buy__actions">
          {state === 'forsale' ? (
            <Button size="lg" tone="amber" onPress={onBuy}>
              🛒 Buy for 🪙 {item.price}
            </Button>
          ) : state === 'short' || state === 'locked' ? (
            <Button size="lg" tone="primary" onPress={onPlay}>
              ▶︎ Play a level
            </Button>
          ) : null}
        </div>
      </div>
    </div>
  )
}
