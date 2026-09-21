import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { MODE_LIST } from '../modes/registry'
import type { ModeId } from '../modes/types'
import { speechRecognitionSupported } from '../speech/recognizer'
import { availableModes } from '../engine/scheduler'
import './HomeScreen.css'

interface GamesScreenProps {
  readonly onBack: () => void
  readonly onPlay: () => void
  readonly onPickMode: (modeId: ModeId) => void
}

/**
 * Free play: one game, or the mixed round. This is the playground next to
 * the path; the scheduler still picks the letters and words the child needs,
 * it just does so inside the game the child asked for.
 */
export function GamesScreen({ onBack, onPlay, onPickMode }: GamesScreenProps) {
  const { profile } = useGame()
  if (!profile) return null

  const micOk = profile.settings.micEnabled && speechRecognitionSupported()
  const open = new Set(
    availableModes(profile, {
      micAvailable: micOk,
      caseMode: profile.settings.caseMode,
      letterPool: profile.settings.letterPool,
      difficulty: profile.settings.difficulty,
    }),
  )
  const modes = MODE_LIST.filter((mode) => micOk || !mode.needsMic)

  return (
    <Screen className="home">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onBack} ariaLabel="Home">
            🏠
          </Button>
        }
        center={<span className="home__name">Games</span>}
        right={<span className="home__stat">🌰 {profile.seeds}</span>}
      />
      <div className="home__body">
        <div className="home__cta">
          <Button onPress={onPlay} size="lg" tone="primary">
            🎲 Mixed round
          </Button>
        </div>
        <p className="home__section">Pick a game</p>
        <div className="home__modes">
          {modes.map((mode) => {
            const locked = !open.has(mode.id)
            return (
              <button
                key={mode.id}
                type="button"
                className={`home__mode ${locked ? 'home__mode--locked' : ''}`}
                onClick={() => (locked ? undefined : onPickMode(mode.id))}
                aria-disabled={locked}
              >
                <span className="home__mode-emoji">{locked ? '🔒' : mode.emoji}</span>
                <span className="home__mode-title">{mode.title}</span>
                <span className="home__mode-blurb">
                  {locked ? 'Opens after the first sounds' : mode.blurb}
                </span>
              </button>
            )
          })}
        </div>
      </div>
    </Screen>
  )
}
