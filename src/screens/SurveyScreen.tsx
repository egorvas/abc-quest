import { useState } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { KnownLettersScreen } from './KnownLettersScreen'
import type { LetterId } from '../data/letters'
import type { ReadingLevel } from '../storage/schema'
import './SurveyScreen.css'

interface SurveyScreenProps {
  readonly onDone: () => void
  /** Off on the very first run, when there is nowhere to go back to. */
  readonly onCancel?: () => void
}

interface LevelCard {
  readonly id: ReadingLevel
  readonly emoji: string
  readonly title: string
  readonly blurb: string
}

const LEVELS: readonly LevelCard[] = [
  { id: 'none', emoji: '🌱', title: 'Not yet', blurb: 'Still learning the letters' },
  { id: 'letters', emoji: '🔡', title: 'Letter by letter', blurb: 'Names the letters, cannot join them into a word' },
  { id: 'words', emoji: '📖', title: 'Short words', blurb: 'Reads cat, sun, map with some effort' },
  { id: 'syllables', emoji: '🧩', title: 'Longer words', blurb: 'Reads ship, duck, and words in parts: rab-bit' },
  { id: 'fluent', emoji: '🏆', title: 'Reads sentences', blurb: 'Reads a short sentence on their own' },
]

/**
 * Two questions before the first lesson: which letters, and how much reading.
 *
 * The answers decide where the path starts. A child who knows twenty letters
 * and reads "cat" should not spend a week on A B C, and one who cannot blend
 * should not be handed a two-syllable word. Nothing here is a test of the
 * child: it is the parent's estimate, and every lesson it skips can be
 * replayed from the path at any time.
 */
export function SurveyScreen({ onDone, onCancel }: SurveyScreenProps) {
  const { profile, survey } = useGame()
  const [step, setStep] = useState<'letters' | 'reading'>('letters')
  const [known, setKnown] = useState<readonly LetterId[]>([])
  const [level, setLevel] = useState<ReadingLevel>(profile?.readingLevel ?? 'none')

  if (!profile) return null

  if (step === 'letters') {
    return (
      <KnownLettersScreen
        firstRun={!onCancel}
        commit={false}
        doneLabel="Next →"
        onDone={(letters) => {
          setKnown(letters)
          setStep('reading')
        }}
        onSkip={onCancel ?? (() => undefined)}
      />
    )
  }

  return (
    <Screen className="survey">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={() => setStep('letters')}>
            ← Back
          </Button>
        }
        center={<span className="survey__title">How does the child read?</span>}
        right={<span className="survey__step">2 / 2</span>}
      />
      <p className="survey__lead">
        Pick the closest. This only chooses where the path starts; every lesson
        stays open to replay, and the settings screen can redo this later.
      </p>
      <div className="survey__levels">
        {LEVELS.map((card) => (
          <button
            key={card.id}
            type="button"
            className={`survey__level ${level === card.id ? 'survey__level--on' : ''}`}
            onClick={() => setLevel(card.id)}
            aria-pressed={level === card.id}
          >
            <span className="survey__emoji">{card.emoji}</span>
            <span className="survey__name">{card.title}</span>
            <span className="survey__blurb">{card.blurb}</span>
          </button>
        ))}
      </div>
      <div className="survey__actions">
        <Button
          tone="mint"
          size="lg"
          onPress={() => {
            survey(known, level)
            onDone()
          }}
        >
          Start the path ▶︎
        </Button>
      </div>
    </Screen>
  )
}
