import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useGame } from '../state/GameContext'
import { buildSession } from '../engine/scheduler'
import type { Attempt, ModeId, SessionItem } from '../modes/types'
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
import { RoundEnd } from '../ui/RoundEnd'
import { nutsForRound, type NutAward } from '../engine/nuts'
import { nextPurchase } from '../engine/town'
import { TUNING } from '../engine/tuning'
import type { LetterId } from '../data/letters'
import type { Profile, SlotId } from '../storage/schema'
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
  /** A letter the child chose to practise from its lot in the town. */
  readonly focus?: LetterId
  readonly onHome: () => void
  readonly onTown: (open?: { readonly letter: LetterId; readonly slot: SlotId }) => void
}

/**
 * Runs one round.
 *
 * Two rules are enforced here rather than in the planner, because they depend
 * on what actually happens: a mistake is always followed by something the
 * child can do, and the round never ends on a failure.
 */
export function SessionScreen({ modeIds, focus, onHome, onTown }: SessionScreenProps) {
  const { profile, recordAttempt, introduce, closeRound } = useGame()
  const [queue, setQueue] = useState<readonly SessionItem[]>([])
  const [index, setIndex] = useState(0)
  const [marks, setMarks] = useState<readonly StepMark[]>([])
  const [award, setAward] = useState<NutAward | null>(null)
  const stats = useRef({ correct: 0, assisted: 0, letters: new Set<LetterId>() })
  const startedAt = useRef(Date.now())
  // The profile as it was when the round began: the star and first-write
  // bonuses are a before/after comparison, kept out of the memory model.
  const before = useRef<Profile | null>(null)
  const latest = useRef<Profile | null>(profile)
  latest.current = profile

  const startRound = useCallback(() => {
    if (!profile) return
    const plan = buildSession(profile, Date.now(), {
      modeIds,
      focus,
      micAvailable: profile.settings.micEnabled && speechRecognitionSupported(),
      caseMode: profile.settings.caseMode,
      letterPool: profile.settings.letterPool,
      difficulty: profile.settings.difficulty,
      length: TUNING.sessionLength,
    })
    setQueue(plan.items)
    setMarks(plan.items.map((_, i) => (i === 0 ? 'current' : 'pending')))
    setIndex(0)
    setAward(null)
    stats.current = { correct: 0, assisted: 0, letters: new Set() }
    startedAt.current = Date.now()
    before.current = profile
    if (plan.introduced.length > 0) introduce(plan.introduced)
    // The plan is a snapshot: rebuilding mid-round would change the questions
    // under the child's finger.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    startRound()
  }, [startRound])

  const finish = useCallback(() => {
    const after = latest.current
    const start = before.current
    if (!after || !start) return
    const now = Date.now()
    const facts = {
      items: queue.length,
      correct: stats.current.correct,
      letters: [...stats.current.letters],
    }
    const earned = nutsForRound(start, after, facts, now)
    setAward(earned)
    closeRound({
      items: facts.items,
      correct: facts.correct,
      assisted: stats.current.assisted,
      seconds: Math.round((now - startedAt.current) / 1000),
      letters: facts.letters,
      nuts: earned.total,
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

  if (award) {
    // The purse has already been updated by closeRound by the time this renders.
    const target = nextPurchase(profile, Date.now())
    return (
      <RoundEnd
        award={award}
        correct={stats.current.correct}
        total={queue.length}
        purse={profile.seeds}
        spendTarget={target}
        onAgain={startRound}
        onHome={onHome}
        onTown={onTown}
      />
    )
  }

  if (!item || !Renderer) {
    return (
      <Screen className="session">
        <TopBar left={<Button size="sm" tone="ghost" onPress={onHome}>🏠</Button>} />
        <div className="session__empty">
          <p>Getting things ready...</p>
        </div>
      </Screen>
    )
  }

  return (
    <Screen className="session">
      <TopBar
        left={
          <Button size="sm" tone="ghost" onPress={onHome} ariaLabel="Home">
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
