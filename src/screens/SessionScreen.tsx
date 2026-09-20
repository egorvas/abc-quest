import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../state/GameContext'
import { buildSession } from '../engine/scheduler'
import type { Attempt, Level, ModeId, SessionItem } from '../modes/types'
import { speechRecognitionSupported } from '../speech/recognizer'
import { HearPick } from '../modes/HearPick'
import { ChooseIt } from '../modes/ChooseIt'
import { SayIt } from '../modes/SayIt'
import { TypeIt } from '../modes/TypeIt'
import { Hunt } from '../modes/Hunt'
import { Pairs } from '../modes/Pairs'
import { TraceIt } from '../modes/TraceIt'
import { FirstSound } from '../modes/FirstSound'
import { Screen, TopBar } from '../ui/Screen'
import { Button } from '../ui/Button'
import { SessionProgress, type StepMark } from '../ui/SessionProgress'
import { seedsForRound } from '../engine/garden'
import { cheerBig } from '../ui/celebrate'
import { sfx } from '../audio/sfx'
import { TUNING } from '../engine/tuning'
import type { LetterId } from '../data/letters'
import './SessionScreen.css'

const RENDERERS = {
  hearPick: HearPick,
  chooseIt: ChooseIt,
  sayIt: SayIt,
  typeIt: TypeIt,
  hunt: Hunt,
  pairs: Pairs,
  traceIt: TraceIt,
  firstSound: FirstSound,
} as const

interface SessionScreenProps {
  /** Empty means the mixed adventure across all modes. */
  readonly modeIds?: readonly ModeId[]
  readonly level?: Level
  readonly onExit: () => void
}

/**
 * Runs one round.
 *
 * Two rules are enforced here rather than in the planner, because they depend
 * on what actually happens: a mistake is always followed by something the
 * child can do, and the round never ends on a failure.
 */
export function SessionScreen({ modeIds, level = 1, onExit }: SessionScreenProps) {
  const { profile, recordAttempt, introduce, closeRound } = useGame()
  const [queue, setQueue] = useState<readonly SessionItem[]>([])
  const [index, setIndex] = useState(0)
  const [marks, setMarks] = useState<readonly StepMark[]>([])
  const [done, setDone] = useState(false)
  const stats = useRef({ correct: 0, assisted: 0, letters: new Set<LetterId>() })
  const startedAt = useRef(Date.now())
  const [seeds, setSeeds] = useState(0)

  const startRound = useCallback(() => {
    if (!profile) return
    const plan = buildSession(profile, Date.now(), {
      modeIds,
      level,
      micAvailable: profile.settings.micEnabled && speechRecognitionSupported(),
      lowercaseEnabled: profile.settings.lowercaseEnabled,
      length: TUNING.sessionLength,
    })
    setQueue(plan.items)
    setMarks(plan.items.map((_, i) => (i === 0 ? 'current' : 'pending')))
    setIndex(0)
    setDone(false)
    stats.current = { correct: 0, assisted: 0, letters: new Set() }
    startedAt.current = Date.now()
    if (plan.introduced.length > 0) introduce(plan.introduced)
    // The plan is a snapshot: rebuilding mid-round would change the questions
    // under the child's finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    startRound()
  }, [startRound])

  const finish = useCallback(() => {
    const total = queue.length
    const correct = stats.current.correct
    const earned = seedsForRound(correct, total)
    setSeeds(earned)
    setDone(true)
    cheerBig()
    sfx('levelUp')
    closeRound({
      items: total,
      correct,
      assisted: stats.current.assisted,
      seconds: Math.round((Date.now() - startedAt.current) / 1000),
      letters: [...stats.current.letters],
      seeds: earned,
    })
  }, [queue.length, closeRound])

  const handleAttempt = useCallback(
    (attempt: Attempt) => {
      recordAttempt(attempt)
      stats.current.letters.add(attempt.item.letter)
      // "Almost" and assisted answers still teach, but the score a parent
      // reads should mean what it says: unaided, first time.
      if (attempt.verdict === 'right' && !attempt.assisted) stats.current.correct += 1
      if (attempt.assisted) stats.current.assisted += 1

      setMarks((current) =>
        current.map((mark, i) =>
          i === index
            ? attempt.verdict === 'right'
              ? 'good'
              : 'retry'
            : i === index + 1
              ? 'current'
              : mark,
        ),
      )

      setQueue((current) => {
        // After a struggle, hand the child something they can definitely do.
        if (attempt.verdict === 'right' && !attempt.assisted) return current
        const next = current[index + 1]
        if (!next || next.reason === 'easy') return current
        const swapAt = current.findIndex((entry, i) => i > index + 1 && entry.reason === 'easy')
        if (swapAt < 0) return current
        const copy = [...current]
        copy[index + 1] = current[swapAt]
        copy[swapAt] = next
        return copy
      })

      window.setTimeout(() => {
        if (index + 1 >= queue.length) finish()
        else setIndex(index + 1)
      }, 250)
    },
    [index, queue.length, recordAttempt, finish],
  )

  const item = queue[index]
  const Renderer = item ? RENDERERS[item.modeId] : null

  const title = useMemo(() => {
    if (!item) return ''
    return `${index + 1} / ${queue.length}`
  }, [item, index, queue.length])

  if (!profile) return null

  if (done) {
    return (
      <Screen className="session session--done">
        <div className="done">
          <div className="done__badge">🌟</div>
          <h1 className="done__title">Молодец!</h1>
          <p className="done__line">
            Правильно: {stats.current.correct} из {queue.length}
          </p>
          <div className="done__seeds">
            {Array.from({ length: seeds }, (_, i) => (
              <span key={i} className="done__seed">🌰</span>
            ))}
          </div>
          <p className="done__hint">Семена отправились в сад</p>
          <div className="done__actions">
            <Button onPress={startRound} size="lg" tone="primary">
              ▶︎ Ещё раз
            </Button>
            <Button onPress={onExit} size="lg" tone="mint">
              В сад 🌱
            </Button>
          </div>
        </div>
      </Screen>
    )
  }

  if (!item || !Renderer) {
    return (
      <Screen className="session">
        <TopBar left={<Button size="sm" tone="ghost" onPress={onExit}>🏠</Button>} />
        <div className="session__empty">
          <p>Готовим задания...</p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen className="session">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onExit} ariaLabel="Домой">
            🏠
          </Button>
        }
        center={<SessionProgress marks={marks} />}
        right={<span className="session__count">{title}</span>}
      />
      {/* Keyed by position: every question gets a brand-new component, so no
          mode has to remember to reset its own state between items. */}
      <Renderer key={index} item={item} onDone={handleAttempt} seq={index} />
    </Screen>
  )
}
