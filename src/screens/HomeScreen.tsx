import { useMemo } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { MODE_LIST } from '../modes/registry'
import type { ModeId } from '../modes/types'
import { speechRecognitionSupported } from '../speech/recognizer'
import { LETTER_IDS } from '../data/letters'
import { allStatuses, masteredCount } from '../engine/mastery'
import './HomeScreen.css'

interface HomeScreenProps {
  readonly onPlay: () => void
  readonly onPickMode: (modeId: ModeId) => void
  readonly onTown: () => void
  readonly onParents: () => void
  readonly onProfiles: () => void
}

export function HomeScreen({
  onPlay,
  onPickMode,
  onTown,
  onParents,
  onProfiles,
}: HomeScreenProps) {
  const { profile } = useGame()

  const learned = useMemo(() => {
    if (!profile) return 0
    return masteredCount(allStatuses(profile, LETTER_IDS, Date.now()))
  }, [profile])

  if (!profile) return null

  const micOk = profile.settings.micEnabled && speechRecognitionSupported()
  const modes = MODE_LIST.filter((mode) => micOk || !mode.needsMic)

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

        <div className="home__cta">
          <Button onPress={onPlay} size="lg" tone="primary">
            ▶︎ Play
          </Button>
          <Button onPress={onTown} size="lg" tone="mint">
            🏙️ My town
          </Button>
        </div>

        <p className="home__section">Pick a game</p>
        <div className="home__modes">
          {modes.map((mode) => (
            <button
              key={mode.id}
              type="button"
              className="home__mode"
              onClick={() => onPickMode(mode.id)}
            >
              <span className="home__mode-emoji">{mode.emoji}</span>
              <span className="home__mode-title">{mode.title}</span>
              <span className="home__mode-blurb">{mode.blurb}</span>
            </button>
          ))}
        </div>
      </div>
    </Screen>
  )
}
