import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { LotCard } from '../ui/LotCard'
import { LotSheet } from '../ui/LotSheet'
import { ExtrasSheet } from '../ui/ExtrasSheet'
import type { LetterId } from '../data/letters'
import type { SlotId } from '../storage/schema'
import { ownsExtra, suggestedLot, townView } from '../engine/town'
import { itemAt } from '../engine/townItems'
import { speak } from '../audio/speak'
import { sfx } from '../audio/sfx'
import { cheerBig, cheerSmall, cheerStar } from '../ui/celebrate'
import './TownScreen.css'

interface TownScreenProps {
  readonly onBack: () => void
  readonly onPlayLetter: (letter: LetterId) => void
  /** Open this lot's sheet on arrival, from the round-end Spend button. */
  readonly open?: { readonly letter: LetterId; readonly slot: SlotId } | null
}

/**
 * Letter Town: twenty-six lots on one street, A to Z, one per letter.
 *
 * It is the sink for the nuts and the collection at once. Every item is a
 * word that starts with the lot's letter, two of the three slots are gated on
 * that letter's progress, and an empty lot is a letter to practise - which is
 * how the town pulls the child back into playing without a word of nagging.
 * Nothing here can ever be lost.
 */
export function TownScreen({ onBack, onPlayLetter, open }: TownScreenProps) {
  const { profile, buy, buyExtra } = useGame()
  const [openLot, setOpenLot] = useState<LetterId | null>(open?.letter ?? null)
  const [highlight, setHighlight] = useState<SlotId | null>(open?.slot ?? null)
  const [extrasOpen, setExtrasOpen] = useState(false)
  const [justBought, setJustBought] = useState<{ letter: LetterId; slot: SlotId } | null>(null)
  const [nightOn, setNightOn] = useState(false)
  const streetRef = useRef<HTMLDivElement>(null)
  const now = Date.now()

  const lots = useMemo(
    () => (profile ? townView(profile, now) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile],
  )
  const calls = useMemo(
    () => (profile ? suggestedLot(profile, now) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile],
  )

  // Arriving from the round end: scroll the chosen lot into view.
  useEffect(() => {
    if (!open) return
    const node = streetRef.current?.querySelector<HTMLElement>(`[data-lot="${open.letter}"]`)
    node?.scrollIntoView({ block: 'center', inline: 'center' })
  }, [open])

  const handleBuy = useCallback(
    (letter: LetterId, slot: SlotId) => {
      buy(letter, slot)
      const item = itemAt(letter, slot)
      sfx('pop')
      setJustBought({ letter, slot })
      setHighlight(null)
      if (slot === 'friend') cheerStar()
      else cheerSmall()
      void speak(`${letter} is for ${item.word}`)
      window.setTimeout(() => setJustBought(null), 900)
    },
    [buy],
  )

  if (!profile) return null

  const has = (id: Parameters<typeof ownsExtra>[1]) => ownsExtra(profile.town, id)
  const night = has('night') && nightOn
  // The sky extra follows the real clock: dawn, day, dusk.
  const hour = new Date(now).getHours()
  const skyClass = !has('sky')
    ? ''
    : hour < 8
      ? 'town--dawn'
      : hour < 18
        ? 'town--day'
        : 'town--dusk'
  const current = openLot ? lots.find((lot) => lot.letter === openLot) ?? null : null

  return (
    <Screen className={`town ${night ? 'town--night' : ''} ${skyClass}`}>
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onBack} ariaLabel="Back">
            ← Home
          </Button>
        }
        center={
          has('night') ? (
            <Button size="sm" tone="ghost" onPress={() => setNightOn((v) => !v)}>
              {nightOn ? '🌙' : '🌞'}
            </Button>
          ) : null
        }
        right={
          <div className="town__purse">
            <span className="town__pill">🪙 {profile.seeds}</span>
            <span className="town__pill town__pill--dim">🏆 {profile.seedsEarned}</span>
            <Button size="sm" tone="ghost" onPress={() => setExtrasOpen(true)} ariaLabel="Town extras">
              🎪
            </Button>
          </div>
        }
      />

      <div
        className="town__street"
        ref={streetRef}
        onClick={(event) => {
          // Fireworks on the sky, once bought. Lots handle their own taps.
          if (has('fireworks') && event.target === event.currentTarget) cheerBig()
        }}
      >
        {has('clouds') ? (
          <div className="town__clouds" aria-hidden="true">
            <span>☁️</span>
            <span>☁️</span>
            <span>☁️</span>
          </div>
        ) : null}
        {has('tram') ? (
          <div className="town__tram" aria-hidden="true">
            🚃
          </div>
        ) : null}
        {lots.map((lot) => (
          <div key={lot.letter} data-lot={lot.letter} className="town__cell">
            <LotCard
              lot={lot}
              onOpen={(letter) => {
                setHighlight(null)
                setOpenLot(letter)
              }}
              calls={calls === lot.letter && openLot === null}
              night={night}
              balloons={has('balloons')}
              justBought={justBought?.letter === lot.letter ? justBought.slot : null}
            />
          </div>
        ))}
      </div>

      {current ? (
        <LotSheet
          lot={current}
          highlight={highlight}
          onBuy={handleBuy}
          onPlay={onPlayLetter}
          onClose={() => setOpenLot(null)}
        />
      ) : null}

      {extrasOpen ? (
        <ExtrasSheet
          profile={profile}
          onBuy={(extra) => {
            buyExtra(extra)
            sfx('pop')
            cheerSmall()
            setExtrasOpen(false)
          }}
          onClose={() => setExtrasOpen(false)}
        />
      ) : null}
    </Screen>
  )
}
