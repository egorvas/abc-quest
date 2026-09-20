import { useMemo, useState } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { Speaker } from './Speaker'
import { letterInSentence } from '../audio/speak'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { playLetterNote } from '../audio/letterNote'
import { sfx } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './Hunt.css'

/**
 * Find every copy of one letter in a field of many.
 *
 * The pedagogy is not in the searching: it is that the target appears in
 * several different typefaces, weights and slants. Recognising "R" as R no
 * matter who wrote it is what recognising a letter actually means.
 */

const FACES = [
  "'Baloo 2', cursive",
  "'Nunito', sans-serif",
  'Georgia, serif',
  "'Courier New', monospace",
  "'Trebuchet MS', sans-serif",
]

interface Cell {
  readonly key: string
  readonly letter: LetterId
  readonly isTarget: boolean
  readonly face: string
  readonly tilt: number
  readonly lower: boolean
  readonly hue: number
}

function buildField(
  target: LetterId,
  fillers: readonly LetterId[],
  size: number,
  targetCount: number,
  level: number,
): readonly Cell[] {
  const faces = FACES.slice(0, level === 1 ? 1 : level === 2 ? 3 : FACES.length)
  const cells: Cell[] = []
  for (let i = 0; i < targetCount; i += 1) {
    cells.push({
      key: `t${i}`,
      letter: target,
      isTarget: true,
      face: faces[i % faces.length],
      tilt: level === 1 ? 0 : (Math.random() - 0.5) * 24,
      lower: level >= 2 && i % 2 === 1,
      hue: Math.floor(Math.random() * 360),
    })
  }
  const pool = fillers.length > 0 ? fillers : [target]
  for (let i = cells.length; i < size; i += 1) {
    cells.push({
      key: `f${i}`,
      letter: pool[i % pool.length],
      isTarget: false,
      face: faces[i % faces.length],
      tilt: level === 1 ? 0 : (Math.random() - 0.5) * 24,
      lower: level >= 2 && i % 3 === 0,
      hue: Math.floor(Math.random() * 360),
    })
  }
  return shuffle(cells)
}

export function Hunt({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const [caught, setCaught] = useState<readonly string[]>([])
  const [faded, setFaded] = useState<readonly string[]>([])
  const [locked, setLocked] = useState(false)

  const size = item.level === 1 ? 12 : item.level === 2 ? 20 : 28
  const targetCount = item.level === 1 ? 3 : item.level === 2 ? 4 : 5

  const field = useMemo(
    () => buildField(item.letter, item.distractors, size, targetCount, item.level),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )
  const totalTargets = field.filter((cell) => cell.isTarget).length

  const handleTap = (cell: Cell) => {
    if (locked || caught.includes(cell.key) || faded.includes(cell.key)) return

    if (!cell.isTarget) {
      // Wrong tile just goes quiet. Nothing explodes, nothing is taken away.
      sfx('wrong')
      setFaded((list) => [...list, cell.key])
      tracker.registerMiss(cell.letter)
      return
    }

    playLetterNote(item.letter)
    haptic('light')
    const next = [...caught, cell.key]
    setCaught(next)
    if (next.length >= totalTargets) {
      setLocked(true)
      cheerSmall()
      window.setTimeout(
        () => tracker.finish(tracker.revealed ? 'almost' : 'right', size),
        700,
      )
    }
  }


  return (
    <div className="mode hunt">
      <div className="hunt__bar">
        <Speaker
          text={`Find all ${letterInSentence(item.letter)}`}
          autoKey={seq}
          emoji="🔍"
          fallback={item.letter}
        />
        <div className="hunt__target">{item.letter}</div>
        <div className="hunt__basket" aria-label={`${caught.length} of ${totalTargets}`}>
          {Array.from({ length: totalTargets }, (_, i) => (
            <span
              key={i}
              className={`hunt__pip ${i < caught.length ? 'hunt__pip--full' : ''}`}
            />
          ))}
        </div>
      </div>

      <div className="hunt__field" data-size={size}>
        {field.map((cell) => {
          const isCaught = caught.includes(cell.key)
          const isFaded = faded.includes(cell.key)
          const glow = tracker.revealed && cell.isTarget && !isCaught
          return (
            <button
              key={cell.key}
              type="button"
              className={[
                'hunt__cell',
                isCaught ? 'hunt__cell--caught' : '',
                isFaded ? 'hunt__cell--faded' : '',
                glow ? 'hunt__cell--glow' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                fontFamily: cell.face,
                transform: `rotate(${cell.tilt}deg)`,
                color: `hsl(${cell.hue} 85% 78%)`,
              }}
              onClick={() => handleTap(cell)}
              disabled={locked || isCaught}
            >
              {cell.lower ? letterInfo(cell.letter).lower : cell.letter}
            </button>
          )
        })}
      </div>
    </div>
  )
}
