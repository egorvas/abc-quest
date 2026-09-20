import { useMemo, useState } from 'react'
import { useGame } from '../state/GameContext'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { LETTER_IDS, letterInfo, type LetterId } from '../data/letters'
import { gardenOf } from '../engine/garden'
import { letterStatus } from '../engine/mastery'
import { speakLetterName, speak } from '../audio/speak'
import { playLetterNote } from '../audio/letterNote'
import './GardenScreen.css'

interface GardenScreenProps {
  readonly onBack: () => void
}

/**
 * The garden is both the collection and the progress map.
 *
 * Twenty-six beds along a path. Nothing here ever wilts: a bed that has grown
 * stays grown, so being away for two weeks costs the child nothing. A gold
 * star that has gone stale only asks to be polished.
 */
export function GardenScreen({ onBack }: GardenScreenProps) {
  const { profile } = useGame()
  const [picked, setPicked] = useState<LetterId | null>(null)
  const now = Date.now()

  const beds = useMemo(
    () => (profile ? gardenOf(profile, LETTER_IDS, now) : []),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [profile],
  )

  if (!profile) return null

  const grown = beds.filter((bed) => bed.stage >= 2).length
  const trees = beds.filter((bed) => bed.stage === 3).length

  const handlePick = (letter: LetterId) => {
    setPicked(letter)
    const info = letterInfo(letter)
    playLetterNote(letter)
    const status = letterStatus(profile, letter, now)
    if (status.stage === 'locked') void speakLetterName(letter)
    else void speak(`${info.lower} for ${info.word}`)
  }

  return (
    <Screen className="garden">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onBack} ariaLabel="Назад">
            ← Домой
          </Button>
        }
        center={<span className="garden__score">🌼 {grown} · 🌳 {trees}</span>}
        right={<span className="garden__seeds">🌰 {profile.seeds}</span>}
      />

      <div className="garden__path">
        {beds.map((bed) => {
          const status = letterStatus(profile, bed.letter, now)
          return (
            <button
              key={bed.letter}
              type="button"
              className={[
                'garden__bed',
                `garden__bed--s${bed.stage}`,
                status.stage === 'mastered' ? 'garden__bed--gold' : '',
                status.dusty ? 'garden__bed--dusty' : '',
                picked === bed.letter ? 'garden__bed--picked' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handlePick(bed.letter)}
            >
              <span className="garden__plant">{bed.emoji}</span>
              <span className="garden__letter">{bed.letter}</span>
            </button>
          )
        })}
      </div>

      <div className="garden__detail">
        {picked ? (
          <>
            <span className="garden__detail-letter">
              {picked}
              {letterInfo(picked).lower}
            </span>
            <span className="garden__detail-word">
              {letterInfo(picked).emoji} {letterInfo(picked).word} — {letterInfo(picked).wordRu}
            </span>
            <span className="garden__detail-hint">
              {beds.find((b) => b.letter === picked)?.nextHint}
            </span>
          </>
        ) : (
          <span className="garden__detail-hint">Нажми на грядку, чтобы послушать букву</span>
        )}
      </div>
    </Screen>
  )
}
