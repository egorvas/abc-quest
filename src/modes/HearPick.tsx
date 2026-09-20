import { useEffect, useMemo, useState } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { LetterTile, type TileState } from '../ui/LetterTile'
import { Speaker } from './Speaker'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { playLetterNote } from '../audio/letterNote'
import { sfx } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speakLetterName } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'

/**
 * Hear the name, tap the glyph.
 *
 * The backbone of the app: cheapest to build and the most honest direction of
 * the four, because "I hear a name, I find the shape" is what reading will be.
 */
export function HearPick({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const [states, setStates] = useState<Readonly<Record<string, TileState>>>({})
  const [locked, setLocked] = useState(false)

  const tiles = useMemo(
    () => shuffle([item.letter, ...item.distractors]),
    // A fresh arrangement per item, not per render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )

  useEffect(() => {
    setStates({})
    setLocked(false)
  }, [seq])

  // After two misses the board shrinks to two tiles and the answer glows.
  useEffect(() => {
    if (!tracker.revealed) return
    setStates((current) => {
      const next: Record<string, TileState> = { ...current }
      const keep = new Set<LetterId>([item.letter])
      for (const tile of tiles) {
        if (keep.size < 2 && tile !== item.letter && next[tile] !== 'wrong') {
          keep.add(tile)
        }
      }
      for (const tile of tiles) {
        if (!keep.has(tile)) next[tile] = 'dim'
      }
      next[item.letter] = 'hint'
      return next
    })
  }, [tracker.revealed, tiles, item.letter])

  const handlePick = (picked: LetterId) => {
    if (locked || states[picked] === 'dim') return
    const verdict = tracker.verdictFor(picked)

    if (verdict === 'right') {
      setLocked(true)
      setStates((current) => ({ ...current, [picked]: 'correct' }))
      playLetterNote(item.letter)
      haptic('success')
      void speakLetterName(letterInfo(item.letter).name)
      if (!tracker.revealed) cheerSmall()
      window.setTimeout(() => tracker.finish(tracker.revealed ? 'almost' : 'right', tiles.length), 900)
      return
    }

    // A wrong tap never shouts. The tile sinks, the question stays.
    sfx('wrong')
    haptic('error')
    setStates((current) => ({ ...current, [picked]: 'wrong' }))
    window.setTimeout(
      () => setStates((current) => ({ ...current, [picked]: 'dim' })),
      500,
    )
    tracker.registerMiss(picked)
  }

  const columns = tiles.length <= 2 ? 2 : tiles.length <= 4 ? 4 : 6
  const size = tiles.length <= 3 ? 'lg' : 'md'

  return (
    <div className="mode">
      <div className="mode__prompt">
        <Speaker
          text={`Find the letter ${letterInfo(item.letter).name}`}
          autoKey={seq}
          fallback={item.glyphCase === 'lower' ? letterInfo(item.letter).lower : item.letter}
        />
      </div>
      <div className={`mode__grid mode__grid--${columns}`}>
        {tiles.map((tile, index) => (
          <LetterTile
            key={tile}
            letter={tile}
            letterCase={item.glyphCase}
            size={size}
            tilt={((index % 3) - 1) * 2.5}
            state={states[tile] ?? 'idle'}
            onPress={handlePick}
            disabled={locked}
          />
        ))}
      </div>
      <p className="mode__hint">
        {tracker.revealed ? 'Вот она! Нажми на светящуюся букву' : ''}
      </p>
    </div>
  )
}
