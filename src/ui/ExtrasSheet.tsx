import type { ExtraId, Profile } from '../storage/schema'
import { extrasFor } from '../engine/town'
import { Button } from './Button'
import './LotSheet.css'

const EXTRA_LABEL: Readonly<Record<ExtraId, { readonly glyph: string; readonly word: string }>> = {
  clouds: { glyph: '☁️', word: 'Clouds' },
  sky: { glyph: '🌅', word: 'Sky' },
  tram: { glyph: '🚃', word: 'Tram' },
  night: { glyph: '🌃', word: 'Night' },
  balloons: { glyph: '🎈', word: 'Balloons' },
  fireworks: { glyph: '🎆', word: 'Fireworks' },
}

interface ExtrasSheetProps {
  readonly profile: Profile
  readonly onBuy: (extra: ExtraId) => void
  readonly onClose: () => void
}

/**
 * Six town-wide upgrades, gated on days played rather than on letters. A
 * child who comes back for weeks deserves something that is gated on coming
 * back, and the stepping-stone path already counts that.
 */
export function ExtrasSheet({ profile, onBuy, onClose }: ExtrasSheetProps) {
  const extras = extrasFor(profile)
  return (
    <div className="sheet" role="dialog" aria-label="Town extras">
      <button type="button" className="sheet__scrim" onClick={onClose} aria-label="Close" />
      <div className="sheet__panel">
        <button type="button" className="sheet__close" onClick={onClose} aria-label="Close">
          ✕
        </button>
        <div className="sheet__head">
          <span className="sheet__word">🎪 For the whole town</span>
        </div>
        <div className="sheet__rows">
          {extras.map((extra) => {
            const label = EXTRA_LABEL[extra.id]
            const affordable = profile.seeds >= extra.price
            return (
              <div key={extra.id} className="sheet__row">
                <span className={`sheet__glyph ${extra.owned ? '' : 'sheet__glyph--dim'}`}>
                  <span style={{ fontSize: 48, lineHeight: 1 }}>{label.glyph}</span>
                </span>
                <span className="sheet__name">{label.word}</span>
                <span className="sheet__control">
                  {extra.owned ? (
                    <span className="sheet__owned">✓</span>
                  ) : !extra.unlocked ? (
                    <span className="sheet__ghosts" aria-label={`${extra.daysToGo} more days`}>
                      {Array.from({ length: Math.min(extra.daysToGo, 8) }, (_, i) => (
                        <span key={i}>▫️</span>
                      ))}
                    </span>
                  ) : (
                    <Button tone="amber" onPress={() => onBuy(extra.id)} disabled={!affordable}>
                      🌰 {extra.price}
                    </Button>
                  )}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
