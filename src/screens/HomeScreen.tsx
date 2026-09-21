import { useMemo } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { LETTER_IDS } from '../data/letters'
import { allStatuses, masteredCount } from '../engine/mastery'
import { LEVEL_COUNT, currentLevel, levelsDone, tierOf } from '../engine/levels'
import './HomeScreen.css'

interface HomeScreenProps {
  /** Straight into the current level. */
  readonly onPlay: (n: number) => void
  readonly onLevels: () => void
  readonly onGames: () => void
  readonly onTown: () => void
  readonly onParents: () => void
  readonly onProfiles: () => void
}

export function HomeScreen({
  onPlay,
  onLevels,
  onGames,
  onTown,
  onParents,
  onProfiles,
}: HomeScreenProps) {
  const { profile } = useGame()

  const learned = useMemo(() => {
    if (!profile) return 0
    return masteredCount(allStatuses(profile, LETTER_IDS, Date.now()))
  }, [profile])
  const level = useMemo(() => (profile ? currentLevel(profile) : null), [profile])
  const done = profile ? levelsDone(profile) : 0

  if (!profile) return null

  const tier = level ? tierOf(level) : null

  return (
    <Screen className="home">
      <TopBar
        left={
          <button type="button" className="home__who" onClick={onProfiles}>
            <span className="home__avatar">{profile.avatar}</span>
            <span className="home__name">{profile.name}</span>
          </button>
        }
        right={
          <div className="home__stats">
            <span className="home__stat">⭐ {learned}/26</span>
            <span className="home__stat">🪙 {profile.seeds}</span>
            <Button size="sm" tone="ghost" onPress={onParents} ariaLabel="For grown-ups">
              ⚙️
            </Button>
          </div>
        }
      />

      <div className="home__body">
        <h1 className="home__title">ABC Quest</h1>

        <button
          type="button"
          className="home__lesson"
          onClick={() => (level ? onPlay(level) : onLevels())}
        >
          <span className="home__lesson-emoji">{tier?.emoji ?? '🎉'}</span>
          <span className="home__lesson-text">
            <span className="home__lesson-kicker">{tier ? tier.title : 'All levels passed'}</span>
            <span className="home__lesson-title">{level ? `Level ${level}` : 'Play again'}</span>
          </span>
          <span className="home__lesson-go">▶︎</span>
        </button>

        <div className="home__bar" aria-label={`${done} of ${LEVEL_COUNT} levels passed`}>
          <span className="home__bar-fill" style={{ width: `${(100 * done) / LEVEL_COUNT}%` }} />
        </div>

        <div className="home__cta">
          <Button onPress={onLevels} size="lg" tone="amber">
            🗺️ Levels
          </Button>
          <Button onPress={onTown} size="lg" tone="mint">
            🏙️ My town
          </Button>
          <Button onPress={onGames} size="md" tone="ghost">
            🎲 Practice
          </Button>
        </div>
      </div>
    </Screen>
  )
}
