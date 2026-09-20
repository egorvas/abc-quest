import { useState } from 'react'
import { letterInfo } from '../data/letters'
import { TraceCanvas, type TraceScore } from '../ui/TraceCanvas'
import { Button } from '../ui/Button'
import { Speaker } from './Speaker'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { TUNING } from '../engine/tuning'
import { playLetterNote } from '../audio/letterNote'
import { haptic } from '../audio/haptics'
import { speak, letterInSentence } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './TraceIt.css'

/**
 * Write the letter with a finger.
 *
 * Levels 1 and 2 trace a visible outline, which is copying. Level 3 fades the
 * outline away after a second, which makes it real production - the same class
 * of evidence as saying the letter out loud.
 *
 * There is no such thing as failing here. Handwriting is never graded; a messy
 * attempt is still an attempt, and the only button is "try again".
 */
export function TraceIt({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const [attempt, setAttempt] = useState(0)
  const [score, setScore] = useState<TraceScore | null>(null)
  const [locked, setLocked] = useState(false)
  const info = letterInfo(item.letter)
  const glyph = item.glyphCase === 'lower' ? info.lower : item.letter

  const handleScore = (result: TraceScore) => {
    if (locked) return
    setScore(result)
    const good =
      result.coverage >= TUNING.traceCoverage && result.precision >= TUNING.tracePrecision
    const close = result.coverage >= TUNING.traceCoverage * 0.6 && result.precision >= 0.4

    if (!good && !close) return // still drawing, or barely anything on screen

    setLocked(true)
    playLetterNote(item.letter)
    haptic('success')
    void speak(`${info.lower}. ${info.lower} for ${info.word}`)
    if (good) cheerSmall()
    window.setTimeout(() => tracker.finish(good ? 'right' : 'almost', 1), 1100)
  }

  const quality =
    score === null
      ? ''
      : score.coverage >= TUNING.traceCoverage
        ? 'Nice!'
        : 'Follow the letter with your finger'

  return (
    <div className="mode trace-mode">
      <div className="mode__prompt">
        <Speaker text={`Trace ${letterInSentence(item.letter)}`} autoKey={seq} emoji="✏️" fallback={glyph} />
        <p className="mode__hint">{quality}</p>
      </div>

      <TraceCanvas
        glyph={glyph}
        onScore={handleScore}
        resetKey={attempt + seq * 1000}
        disabled={locked}
        showGhost={item.level < 3 || tracker.revealed}
      />

      <div className="mode__row">
        <Button
          tone="ghost"
          size="sm"
          onPress={() => {
            setAttempt((n) => n + 1)
            setScore(null)
          }}
          disabled={locked}
        >
          ↺ Start over
        </Button>
        {/* A child who will not draw today must still be able to move on. */}
        {tracker.revealed ? (
          <Button
            tone="ghost"
            size="sm"
            onPress={() => {
              if (locked) return
              setLocked(true)
              tracker.finish('almost', 1)
            }}
            disabled={locked}
          >
            Next →
          </Button>
        ) : null}
      </div>
    </div>
  )
}
