import { useEffect, useState } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { Keyboard, type KeyboardLayout } from '../ui/Keyboard'
import { Speaker } from './Speaker'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { playLetterNote } from '../audio/letterNote'
import { sfx } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speakLetterName } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './TypeIt.css'

const ABC_ROWS = ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ']

/** Keys physically next to each other: a slip of the finger, not of memory. */
function isNeighbourKey(a: LetterId, b: LetterId): boolean {
  for (const row of ABC_ROWS) {
    const ia = row.indexOf(a)
    const ib = row.indexOf(b)
    if (ia >= 0 && ib >= 0 && Math.abs(ia - ib) === 1) return true
  }
  return false
}

/**
 * Hear the name, find the key.
 *
 * Twenty-six options make this real retrieval rather than a choice between
 * three, and it is the only exercise that transfers to a real keyboard.
 */
export function TypeIt({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const [typed, setTyped] = useState<LetterId | null>(null)
  const [locked, setLocked] = useState(false)
  const info = letterInfo(item.letter)
  const layout: KeyboardLayout = item.level === 3 ? 'qwerty' : 'abc'
  const lowercase = item.glyphCase === 'lower'

  useEffect(() => {
    setTyped(null)
    setLocked(false)
  }, [seq])

  const handleKey = (key: LetterId) => {
    if (locked) return
    setTyped(key)

    if (key === item.letter) {
      setLocked(true)
      playLetterNote(item.letter)
      haptic('success')
      void speakLetterName(info.name)
      if (!tracker.revealed) cheerSmall()
      window.setTimeout(
        () => tracker.finish(tracker.revealed ? 'almost' : 'right', 26),
        850,
      )
      return
    }

    sfx('wrong')
    haptic('error')
    // A neighbouring key is a motor slip: retry without recording a mistake.
    if (!isNeighbourKey(key, item.letter)) tracker.registerMiss(key)
    window.setTimeout(() => setTyped(null), 450)
  }

  const slotGlyph = typed
    ? lowercase
      ? letterInfo(typed).lower
      : typed
    : item.level === 1 || tracker.revealed
      ? lowercase
        ? info.lower
        : item.letter
      : '?'

  return (
    <div className="mode type">
      <div className="mode__prompt">
        <Speaker
          text={`Type the letter ${info.name}`}
          autoKey={seq}
          emoji="🔊"
          fallback={lowercase ? info.lower : item.letter}
        />
        <div
          className={[
            'type__slot',
            typed === item.letter ? 'type__slot--ok' : '',
            typed && typed !== item.letter ? 'type__slot--no' : '',
            !typed && (item.level === 1 || tracker.revealed) ? 'type__slot--ghost' : '',
          ]
            .filter(Boolean)
            .join(' ')}
        >
          {slotGlyph}
        </div>
      </div>

      <Keyboard
        layout={layout}
        lowercase={lowercase}
        onKey={handleKey}
        disabled={locked}
        hint={tracker.hinting ? item.letter : null}
      />
    </div>
  )
}
