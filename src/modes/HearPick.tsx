import { useEffect, useMemo, useState } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { LetterTile, glyphOf, type LetterCase, type TileState } from '../ui/LetterTile'
import { Speaker } from './Speaker'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { glyphsClash } from '../engine/curriculum'
import { playLetterNote } from '../audio/letterNote'
import { sfx } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speakLetterName, letterInSentence } from '../audio/speak'
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

  // At the harder levels the wrong tiles are a mix of capitals and lowercase,
  // so the child cannot narrow the board down by shape alone. The target keeps
  // the case the scheduler asked for, because that is the cell being tested.
  const caseOf = useMemo(() => {
    const map = new Map<LetterId, LetterCase>()
    const targetGlyph = glyphOf(item.letter, item.glyphCase)
    for (const tile of tiles) {
      if (tile === item.letter || !item.mixedCaseOptions) {
        map.set(tile, item.glyphCase)
        continue
      }
      const wanted: LetterCase = Math.random() < 0.5 ? 'upper' : 'lower'
      // Never let a distractor render as the same shape as the answer: a board
      // with capital I and lowercase l on it has no right answer to find.
      const clashes = glyphsClash(glyphOf(tile, wanted), targetGlyph)
      map.set(tile, clashes ? (wanted === 'upper' ? 'lower' : 'upper') : wanted)
    }
    return map
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq, tiles])

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
      void speakLetterName(item.letter)
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

  const size = tiles.length <= 3 ? 'lg' : tiles.length <= 6 ? 'md' : 'sm'

  return (
    <div className="mode">
      <div className="mode__prompt">
        <Speaker
          text={`Find ${letterInSentence(item.letter)}`}
          autoKey={seq}
          fallback={item.glyphCase === 'lower' ? letterInfo(item.letter).lower : item.letter}
        />
      </div>
      <div className={`mode__grid mode__grid--${tiles.length}`}>
        {tiles.map((tile, index) => (
          <LetterTile
            key={tile}
            letter={tile}
            letterCase={caseOf.get(tile) ?? item.glyphCase}
            size={size}
            tilt={((index % 3) - 1) * 2.5}
            state={states[tile] ?? 'idle'}
            onPress={handlePick}
            disabled={locked}
          />
        ))}
      </div>
      <p className="mode__hint">
        {tracker.revealed ? 'Here it is! Tap the glowing letter' : ''}
      </p>
    </div>
  )
}
