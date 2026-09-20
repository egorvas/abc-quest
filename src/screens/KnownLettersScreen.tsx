import { useMemo, useState } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { LETTERS, type LetterId } from '../data/letters'
import { letterStatus } from '../engine/mastery'
import { speakLetterName } from '../audio/speak'
import { playLetterNote } from '../audio/letterNote'
import './KnownLettersScreen.css'

interface KnownLettersScreenProps {
  readonly onDone: () => void
  readonly onSkip: () => void
  /** First run has nothing to go back to. */
  readonly firstRun: boolean
}

/**
 * "Which letters does the child already know?"
 *
 * Without this, a child who knows twenty letters spends weeks being taught
 * them again one per session before the app ever reaches the six they actually
 * need. Marked letters start as easy wins, so the very first round is already
 * aimed at the gaps.
 *
 * A parent's estimate is not proof, so the head start stops short of solid:
 * the letter still has to hold up in the game before it can earn a star.
 */
export function KnownLettersScreen({ onDone, onSkip, firstRun }: KnownLettersScreenProps) {
  const { profile, placeKnown } = useGame()
  const now = Date.now()

  const alreadyStrong = useMemo(() => {
    if (!profile) return new Set<LetterId>()
    return new Set(
      LETTERS.map((info) => info.id).filter((id) => {
        const stage = letterStatus(profile, id, now).stage
        return stage === 'strong' || stage === 'mastered'
      }),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profile])

  const [known, setKnown] = useState<ReadonlySet<LetterId>>(alreadyStrong)

  if (!profile) return null

  const toggle = (letter: LetterId) => {
    playLetterNote(letter)
    void speakLetterName(letter)
    setKnown((current) => {
      const next = new Set(current)
      if (next.has(letter)) next.delete(letter)
      else next.add(letter)
      return next
    })
  }

  const setAll = (value: boolean) => {
    setKnown(value ? new Set(LETTERS.map((info) => info.id)) : new Set())
  }

  return (
    <Screen className="known">
      <TopBar
        left={
          firstRun ? null : (
            <Button size="sm" tone="ghost" onPress={onSkip}>
              ← Back
            </Button>
          )
        }
        center={<span className="known__title">Which letters are known already?</span>}
        right={<span className="known__count">{known.size} / 26</span>}
      />

      <p className="known__lead">
        Tick the letters the child already recognises. Those become easy wins,
        so the very first round goes straight to the rest. You can change this
        here at any time.
      </p>

      <div className="known__grid">
        {LETTERS.map((info) => (
          <button
            key={info.id}
            type="button"
            className={`known__cell ${known.has(info.id) ? 'known__cell--on' : ''}`}
            onClick={() => toggle(info.id)}
            aria-pressed={known.has(info.id)}
            aria-label={`${info.id} ${info.lower}`}
          >
            <span className="known__glyph">
              {info.id}
              <em>{info.lower}</em>
            </span>
            <span className="known__tick">{known.has(info.id) ? '✓' : ''}</span>
          </button>
        ))}
      </div>

      <div className="known__actions">
        <Button tone="ghost" size="sm" onPress={() => setAll(true)}>
          All
        </Button>
        <Button tone="ghost" size="sm" onPress={() => setAll(false)}>
          None
        </Button>
        <Button
          tone="mint"
          size="lg"
          onPress={() => {
            placeKnown([...known])
            onDone()
          }}
        >
          Done
        </Button>
      </div>
      <p className="known__hint">
        {known.size === 0
          ? 'Tick nothing and we start from the very beginning'
          : `Learning the other ${26 - known.size}, checking the ticked ones`}
      </p>
    </Screen>
  )
}
