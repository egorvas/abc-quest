import { useCallback, useEffect, useRef, useState } from 'react'
import type { LetterId } from '../data/letters'
import type { Attempt, SessionItem, Verdict } from './types'
import { MODES } from './registry'
import { TUNING } from '../engine/tuning'
import { sameRhymeFamily } from '../engine/curriculum'

/**
 * The bookkeeping every mode needs: how long the child took, what they got
 * wrong on the way, and when the game should stop letting them struggle.
 *
 * The softness policy lives here so all modes behave the same. First miss is a
 * quiet thunk. Second miss, or a long silence, and the game shows the answer
 * itself and turns the question into "say it with me", which cannot be failed.
 */

export interface AttemptTracker {
  readonly wrongPicks: readonly LetterId[]
  readonly misses: number
  /** Highlight the answer without giving it away yet. */
  readonly hinting: boolean
  /** The game has shown the answer; the item is now assisted. */
  readonly revealed: boolean
  readonly registerMiss: (picked: LetterId | null) => void
  readonly finish: (verdict: Verdict, optionsShown?: number) => Attempt
  /** True when the pick is the right letter in the wrong case or a rhyme twin. */
  readonly verdictFor: (picked: LetterId, pickedCase?: 'upper' | 'lower') => Verdict
}

export function useAttempt(
  item: SessionItem,
  seq: number,
  onDone: (attempt: Attempt) => void,
): AttemptTracker {
  const started = useRef(Date.now())
  const [wrongPicks, setWrongPicks] = useState<readonly LetterId[]>([])
  const [misses, setMisses] = useState(0)
  const [hinting, setHinting] = useState(false)
  const [revealed, setRevealed] = useState(false)
  const settled = useRef(false)

  // A child who stares at the screen is not being taught anything.
  useEffect(() => {
    const hintTimer = window.setTimeout(() => setHinting(true), TUNING.hintAfterIdleMs)
    const revealTimer = window.setTimeout(() => {
      setHinting(true)
      setRevealed(true)
    }, TUNING.revealAfterIdleMs)
    return () => {
      window.clearTimeout(hintTimer)
      window.clearTimeout(revealTimer)
    }
  }, [seq])

  const registerMiss = useCallback((picked: LetterId | null) => {
    setMisses((count) => {
      const next = count + 1
      if (next >= TUNING.missesBeforeReveal) {
        setHinting(true)
        setRevealed(true)
      } else if (next >= TUNING.missesBeforeHint) {
        setHinting(true)
      }
      return next
    })
    if (picked) setWrongPicks((list) => [...list, picked])
  }, [])

  const verdictFor = useCallback(
    (picked: LetterId): Verdict => {
      if (picked === item.letter) return 'right'
      if (sameRhymeFamily(picked, item.letter)) return 'almost'
      return 'miss'
    },
    [item.letter],
  )

  const finish = useCallback(
    (verdict: Verdict, optionsShown?: number): Attempt => {
      const mode = MODES[item.modeId]
      const options = optionsShown ?? mode.options(item.level)
      const attempt: Attempt = {
        item,
        verdict,
        assisted: revealed,
        wrongPicks,
        responseMs: Date.now() - started.current,
        gamma: mode.gamma(item.level, options),
        weight: mode.weight(item.level),
      }
      if (!settled.current) {
        settled.current = true
        onDone(attempt)
      }
      return attempt
    },
    [item, onDone, revealed, wrongPicks],
  )

  return { wrongPicks, misses, hinting, revealed, registerMiss, finish, verdictFor }
}
