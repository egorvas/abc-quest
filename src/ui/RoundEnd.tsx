import { useEffect, useState } from 'react'
import type { LetterId } from '../data/letters'
import type { SlotId } from '../storage/schema'
import { BONUS_ICON, type NutAward } from '../engine/nuts'
import { Screen } from './Screen'
import { Button } from './Button'
import { cheerBig, cheerStar } from './celebrate'
import { sfx } from '../audio/sfx'
import { speak } from '../audio/speak'
import { playLetterNote } from '../audio/letterNote'
import './RoundEnd.css'

interface RoundEndProps {
  readonly award: NutAward
  readonly correct: number
  readonly total: number
  /** The purse after the award has been added. */
  readonly purse: number
  readonly spendTarget: { readonly letter: LetterId; readonly slot: SlotId } | null
  readonly onAgain: () => void
  readonly onHome: () => void
  readonly onTown: (open?: { readonly letter: LetterId; readonly slot: SlotId }) => void
}

/**
 * The moment between finishing a round and spending.
 *
 * In order: the gold star if a letter earned one during the round (the
 * largest payoff the engine computes, and until now thrown away), then the
 * praise, then the nuts dropping in one by one with the icon of whatever
 * earned them, then a button that is one tap from buying something.
 */
export function RoundEnd({
  award,
  correct,
  total,
  purse,
  spendTarget,
  onAgain,
  onHome,
  onTown,
}: RoundEndProps) {
  const [goldIndex, setGoldIndex] = useState(0)
  const gold = award.newlyMastered[goldIndex] ?? null
  const [shown, setShown] = useState(0)

  const drops = [
    ...Array.from({ length: award.base }, () => ({ icon: '🌰', label: '' })),
    ...award.bonuses.map((bonus) => ({
      icon: BONUS_ICON[bonus.kind],
      label: `+${bonus.nuts}`,
    })),
  ]

  useEffect(() => {
    if (gold) {
      cheerStar()
      sfx('star')
      playLetterNote(gold)
      void speak(`${gold}! You got ${gold}!`)
      return undefined
    }
    cheerBig()
    sfx('levelUp')
    setShown(0)
    const timer = window.setInterval(() => {
      setShown((n) => {
        if (n + 1 >= drops.length) window.clearInterval(timer)
        if (n < drops.length) sfx('pop')
        return Math.min(drops.length, n + 1)
      })
    }, 220)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gold])

  if (gold) {
    return (
      <Screen className="session session--done">
        <button
          type="button"
          className="gold"
          onClick={() => setGoldIndex((i) => i + 1)}
          aria-label={`You got ${gold}`}
        >
          <span className="gold__glyph">{gold}</span>
          <span className="gold__star">⭐</span>
          <span className="gold__hint">Tap to continue</span>
        </button>
      </Screen>
    )
  }

  const visible = drops.slice(0, shown)
  const collapsed = drops.length > 12

  return (
    <Screen className="session session--done">
      <div className="done">
        <div className="done__badge">🌟</div>
        <h1 className="done__title">Well done!</h1>
        <p className="done__line">
          Right first time: {correct} of {total}
        </p>

        <div className="done__nuts">
          {collapsed ? (
            <span className="done__nut done__nut--sum">🌰 ×{award.total}</span>
          ) : (
            visible.map((drop, i) => (
              <span key={i} className="done__nut">
                {drop.icon}
                {drop.label ? <em>{drop.label}</em> : null}
              </span>
            ))
          )}
        </div>
        <p className="done__purse">🌰 {purse}</p>

        <div className="done__actions">
          {spendTarget ? (
            <Button size="lg" tone="amber" onPress={() => onTown(spendTarget)}>
              🛒 Spend 🌰 {purse}
            </Button>
          ) : (
            <Button size="lg" tone="mint" onPress={() => onTown()}>
              🏙️ My town
            </Button>
          )}
          <Button size="lg" tone="primary" onPress={onAgain}>
            ▶︎ Again
          </Button>
          <Button size="md" tone="ghost" onPress={onHome}>
            🏠 Home
          </Button>
        </div>
      </div>
    </Screen>
  )
}
