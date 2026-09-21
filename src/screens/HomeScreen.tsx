import { useMemo } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { LETTER_IDS } from '../data/letters'
import { allStatuses, masteredCount } from '../engine/mastery'
import { currentLesson, pathProgress } from '../engine/path'
import { UNITS } from '../data/lessons'
import './HomeScreen.css'

interface HomeScreenProps {
  /** Straight into the current lesson on the path. */
  readonly onLearn: (lessonId: string) => void
  readonly onPath: () => void
  readonly onGames: () => void
  readonly onTown: () => void
  readonly onParents: () => void
  readonly onProfiles: () => void
}

export function HomeScreen({
  onLearn,
  onPath,
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
  const lesson = useMemo(() => (profile ? currentLesson(profile) : null), [profile])
  const progress = useMemo(
    () => (profile ? pathProgress(profile) : { done: 0, total: 0 }),
    [profile],
  )

  if (!profile) return null

  const unit = lesson ? UNITS.find((u) => u.id === lesson.unit) : null

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
            <span className="home__stat">🌰 {profile.seeds}</span>
            <Button size="sm" tone="ghost" onPress={onParents} ariaLabel="For grown-ups">
              ⚙️
            </Button>
          </div>
        }
      />

      <div className="home__body">
        <h1 className="home__title">ABC Quest</h1>

        <button type="button" className="home__lesson" onClick={() => lesson ? onLearn(lesson.id) : onPath()}>
          <span className="home__lesson-emoji">{unit?.emoji ?? '🏆'}</span>
          <span className="home__lesson-text">
            <span className="home__lesson-kicker">
              {lesson ? `Next lesson · ${unit?.title ?? ''}` : 'Path complete'}
            </span>
            <span className="home__lesson-title">
              {lesson ? lesson.title : 'Replay any lesson for more stars'}
            </span>
          </span>
          <span className="home__lesson-go">▶︎</span>
        </button>

        <div className="home__bar" aria-label={`${progress.done} of ${progress.total} lessons done`}>
          <span
            className="home__bar-fill"
            style={{ width: `${progress.total ? (100 * progress.done) / progress.total : 0}%` }}
          />
        </div>

        <div className="home__cta">
          <Button onPress={onPath} size="lg" tone="amber">
            🗺️ Path
          </Button>
          <Button onPress={onGames} size="lg" tone="primary">
            🎲 Games
          </Button>
          <Button onPress={onTown} size="lg" tone="mint">
            🏙️ My town
          </Button>
        </div>
      </div>
    </Screen>
  )
}
