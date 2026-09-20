import { useMemo, useState } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { playLetterNote } from '../audio/letterNote'
import { sfx, unlockAudio } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speakLetterName } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './ChooseIt.css'

/**
 * See the glyph, choose its name.
 *
 * The mirror of HearPick and the only cheap way to test "I see it, I know what
 * it is called" without a microphone. Options are speakers, not text, because
 * the child cannot read yet.
 *
 * Listening is free: only a second tap on the same speaker commits an answer.
 */
export function ChooseIt({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const [armed, setArmed] = useState<LetterId | null>(null)
  const [dead, setDead] = useState<readonly LetterId[]>([])
  const [locked, setLocked] = useState(false)

  const options = useMemo(
    () => shuffle([item.letter, ...item.distractors]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )

  const commit = (picked: LetterId) => {
    const verdict = tracker.verdictFor(picked)
    if (verdict === 'right') {
      setLocked(true)
      playLetterNote(item.letter)
      haptic('success')
      if (!tracker.revealed) cheerSmall()
      window.setTimeout(
        () => tracker.finish(tracker.revealed ? 'almost' : 'right', options.length),
        800,
      )
      return
    }
    sfx('wrong')
    haptic('error')
    setDead((list) => [...list, picked])
    setArmed(null)
    tracker.registerMiss(picked)
  }

  const handleTap = (option: LetterId) => {
    if (locked || dead.includes(option)) return
    unlockAudio()
    if (armed === option) {
      commit(option)
      return
    }
    setArmed(option)
    void speakLetterName(option)
  }

  const glyph =
    item.glyphCase === 'lower' ? letterInfo(item.letter).lower : item.letter

  return (
    <div className="mode">
      <div className={`choose__glyph ${locked ? 'choose__glyph--won' : ''}`}>{glyph}</div>
      <p className="mode__hint">
        {tracker.revealed
          ? 'Tap the glowing speaker'
          : armed
            ? 'Tap again if that is the one'
            : 'Listen and choose'}
      </p>
      <div className="choose__row">
        {options.map((option) => {
          const isDead = dead.includes(option)
          const isHint = tracker.revealed && option === item.letter
          return (
            <button
              key={option}
              type="button"
              className={[
                'choose__opt',
                armed === option ? 'choose__opt--armed' : '',
                isDead ? 'choose__opt--dead' : '',
                isHint ? 'choose__opt--hint' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleTap(option)}
              disabled={locked || isDead}
              aria-label={`Option ${letterInfo(option).name}`}
            >
              {armed === option ? '✓' : '🔊'}
            </button>
          )
        })}
      </div>
    </div>
  )
}
