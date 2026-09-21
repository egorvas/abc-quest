import { useCallback, useEffect, useMemo, useState } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { BuySheet } from '../ui/BuySheet'
import { CityMap } from './CityMap'
import { buildingView, cityView, type BuildingView } from '../engine/city'
import { buildingInfo, isBuildingId } from '../data/city'
import { sfx } from '../audio/sfx'
import { speak } from '../audio/speak'
import { cheerBig } from '../ui/celebrate'
import './CityScreen.css'

interface CityScreenProps {
  /** A building to open the buy sheet on, from the round-end Spend button. */
  readonly open?: string
  readonly onBack: () => void
  readonly onPlay: () => void
}

function isNightNow(): boolean {
  const hour = new Date().getHours()
  return hour < 7 || hour >= 20
}

/**
 * What is for sale, as a shelf under the map: the next few things the coins
 * can buy, brightest first, then what is nearly affordable, then a peek at
 * what later levels open. Tapping a card is the same as tapping its sign.
 */
function Shelf({ views, onPick }: { readonly views: readonly BuildingView[]; readonly onPick: (id: string) => void }) {
  const order: Record<BuildingView['state'], number> = { forsale: 0, short: 1, locked: 2, owned: 3 }
  const cards = views
    .filter((view) => view.state !== 'owned')
    .sort((a, b) => order[a.state] - order[b.state] || a.item.price - b.item.price)
    .slice(0, 14)
  if (cards.length === 0) {
    return <p className="shelf shelf--done">🎉 The whole city is built!</p>
  }
  return (
    <div className="shelf" role="list" aria-label="For sale">
      {cards.map((view) => (
        <button
          key={view.item.id}
          type="button"
          role="listitem"
          className={`shelf__card shelf__card--${view.state}`}
          onClick={() => onPick(view.item.id)}
          aria-label={`${view.item.name}, ${view.state}`}
        >
          <span className="shelf__emoji">{view.state === 'locked' ? '🔒' : view.item.emoji}</span>
          <span className="shelf__price">
            {view.state === 'locked' ? `${view.levelsToGo || '🔗'}${view.levelsToGo ? ' lv' : ''}` : `🪙 ${view.item.price}`}
          </span>
        </button>
      ))}
    </div>
  )
}

/**
 * The city: the map the coins build.
 *
 * Owned things live - cars drive, boats sail, the wheel turns, smoke rises.
 * Things for sale stand on the map as signs with a price, so the child sees
 * what the next coins will become without reading a word. Tapping anything
 * owned bounces it and says its name; tapping a sign opens the sheet.
 */
export function CityScreen({ open, onBack, onPlay }: CityScreenProps) {
  const { profile, buy } = useGame()
  const [sheet, setSheet] = useState<string | null>(open && isBuildingId(open) ? open : null)
  const [night, setNight] = useState(isNightNow)
  const [justBought, setJustBought] = useState<string | null>(null)
  const [poke, setPoke] = useState<{ id: string; at: number } | null>(null)

  const views = useMemo(() => (profile ? cityView(profile) : []), [profile])
  const owned = useMemo(() => new Set(profile?.city.buildings ?? []), [profile])

  useEffect(() => {
    if (!justBought) return undefined
    const timer = window.setTimeout(() => setJustBought(null), 1200)
    return () => window.clearTimeout(timer)
  }, [justBought])

  const tap = useCallback(
    (id: string) => {
      if (owned.has(id)) {
        sfx('pop')
        setPoke({ id, at: Date.now() })
        void speak(buildingInfo(id).name)
        return
      }
      sfx('tap')
      setSheet(id)
    },
    [owned],
  )

  if (!profile) return null

  const sheetView: BuildingView | null = sheet ? buildingView(profile, buildingInfo(sheet)) : null

  const confirmBuy = (id: string) => {
    buy(id)
    setSheet(null)
    setJustBought(id)
    sfx('levelUp')
    cheerBig()
    void speak(`${buildingInfo(id).name}!`)
  }

  return (
    <Screen className="city">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onBack} ariaLabel="Home">
            🏠
          </Button>
        }
        center={
          <Button size="sm" tone="ghost" onPress={() => setNight((v) => !v)} ariaLabel="Day or night">
            {night ? '🌙' : '🌞'}
          </Button>
        }
        right={
          <div className="city__purse">
            <span className="city__pill">🪙 {profile.seeds}</span>
            <span className="city__pill city__pill--dim">
              🏗️ {profile.city.buildings.length}/{views.length}
            </span>
          </div>
        }
      />
      <div className="city__map">
        <CityMap views={views} night={night} justBought={justBought} poke={poke} onTap={tap} />
      </div>
      <Shelf views={views} onPick={(id) => tap(id)} />
      <div className="city__spacer" />
      {sheetView ? (
        <BuySheet
          view={sheetView}
          purse={profile.seeds}
          onBuy={() => confirmBuy(sheetView.item.id)}
          onPlay={onPlay}
          onClose={() => setSheet(null)}
        />
      ) : null}
    </Screen>
  )
}
