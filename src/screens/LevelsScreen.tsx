import { useEffect, useMemo, useRef } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { LEVEL_COUNT, levelsDone, levelsView, type LevelView } from '../engine/levels'
import { sfx } from '../audio/sfx'
import './LevelsScreen.css'

interface LevelsScreenProps {
  readonly onBack: () => void
  readonly onLevel: (n: number) => void
}

/**
 * The climb, top to bottom: sixty numbered doors in seven bands.
 *
 * A passed door shows its stars and can be reopened for more; the current
 * one glows; the rest are shut. What is behind a door is not written on it:
 * the games change from level to level and the child finds out by opening
 * it. The list scrolls to the current level on open.
 */
export function LevelsScreen({ onBack, onLevel }: LevelsScreenProps) {
  const { profile } = useGame()
  const currentRef = useRef<HTMLButtonElement>(null)
  const tiers = useMemo(() => (profile ? levelsView(profile) : []), [profile])
  const done = profile ? levelsDone(profile) : 0

  useEffect(() => {
    currentRef.current?.scrollIntoView({ block: 'center' })
  }, [])

  if (!profile) return null

  const open = (view: LevelView) => {
    if (view.state === 'locked') {
      sfx('wrong')
      return
    }
    sfx('tap')
    onLevel(view.n)
  }

  return (
    <Screen className="levels">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onBack} ariaLabel="Home">
            🏠
          </Button>
        }
        center={<span className="levels__title">Levels</span>}
        right={
          <span className="levels__progress">
            {done} / {LEVEL_COUNT}
          </span>
        }
      />
      <div className="levels__scroll">
        {tiers.map((band) => (
          <section key={band.tier.id} className={`levels__band ${band.done ? 'levels__band--done' : ''}`}>
            <header className="levels__band-head">
              <span className="levels__band-emoji">{band.tier.emoji}</span>
              <span className="levels__band-title">{band.tier.title}</span>
              <span className="levels__band-range">
                {band.tier.from}–{band.tier.to}
              </span>
            </header>
            <div className="levels__grid">
              {band.levels.map((view) => (
                <button
                  key={view.n}
                  ref={view.state === 'current' ? currentRef : undefined}
                  type="button"
                  className={`levels__door levels__door--${view.state}`}
                  onClick={() => open(view)}
                  aria-label={`Level ${view.n}, ${view.state}`}
                  aria-disabled={view.state === 'locked'}
                >
                  <span className="levels__num">{view.n}</span>
                  {view.state === 'locked' ? <span className="levels__lock">🔒</span> : null}
                  <span className="levels__stars" aria-hidden="true">
                    {[1, 2, 3].map((k) => (
                      <span key={k} className={view.stars >= k ? 'levels__star levels__star--on' : 'levels__star'}>
                        ★
                      </span>
                    ))}
                  </span>
                </button>
              ))}
            </div>
          </section>
        ))}
        <p className="levels__end">
          {done >= LEVEL_COUNT ? '🎉 Every level passed. The whole town is yours!' : '🏙️ Pass every level and the whole town opens.'}
        </p>
      </div>
    </Screen>
  )
}
