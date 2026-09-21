import { useEffect, useMemo, useState } from 'react'
import type { LetterId } from '../data/letters'
import { LETTER_IDS, letterInfo } from '../data/letters'
import { LetterTile, glyphOf, type LetterCase } from '../ui/LetterTile'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { sameRhymeFamily } from '../engine/curriculum'
import { playLetterNote } from '../audio/letterNote'
import { sfx, unlockAudio } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speak, speakLetterName } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './reading.css'
import './ChooseIt.css'

/**
 * Minimal-pair training for two letters the child mixes up.
 *
 * Only the two members ever appear, trials are short and dense, the contrast
 * alternates unpredictably, correction is immediate, and the feature that
 * separates them is named once at the start. One item is a streak of
 * micro-trials; a clean streak is what turns a coin flip into evidence.
 *
 * The scheduler only offers this once both letters have an independent
 * trace: contrast before that produces interference, not discrimination.
 */

const FEATURE: Readonly<Partial<Record<string, string>>> = {
  'B|D': 'b has its tummy at the back. d has its tummy at the front.',
  'P|Q': 'p has its ball on the right. q has its ball on the left.',
  'M|W': 'M points down. W points up.',
  'C|G': 'G is a C with a little shelf.',
  'U|V': 'U is round at the bottom. V is pointy.',
  'E|F': 'E has three arms. F has two.',
}

interface Trial {
  readonly kind: 'hear' | 'see'
  readonly target: LetterId
  readonly letterCase: LetterCase
}

export function TwinLetters({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const twin = item.twin ?? item.distractors[0] ?? 'D'
  const pair: readonly LetterId[] = [item.letter, twin]
  const total = item.level === 1 ? 4 : item.level === 4 ? 8 : 6

  const trials: readonly Trial[] = useMemo(
    () =>
      Array.from({ length: total }, (_, i): Trial => ({
        kind: i % 2 === 0 ? 'hear' : 'see',
        target: pair[Math.random() < 0.5 ? 0 : 1],
        letterCase: item.level >= 3 && Math.random() < 0.5 ? 'lower' : item.glyphCase,
      })),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )

  const [phase, setPhase] = useState<'intro' | 'trial' | 'done'>('intro')
  const [index, setIndex] = useState(0)
  const [results, setResults] = useState<readonly boolean[]>([])
  const [missedThis, setMissedThis] = useState(false)
  const [armed, setArmed] = useState<LetterId | null>(null)
  const [cut, setCut] = useState(false)

  const key = [item.letter, twin].sort().join('|')
  const feature = FEATURE[key] ?? 'These two look alike. Look carefully.'

  // The feature, once, then the trials.
  useEffect(() => {
    void speak(feature, { rate: 0.8 })
    const timer = window.setTimeout(() => {
      setPhase('trial')
    }, 2600)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq])

  const current = trials[index]

  useEffect(() => {
    if (phase !== 'trial' || !current) return
    if (current.kind === 'hear') void speakLetterName(current.target)
    else void speak('Which one is this?')
  }, [phase, index, current])

  const advance = (ok: boolean) => {
    const next = [...results, ok]
    setResults(next)
    setMissedThis(false)
    setArmed(null)
    // Three misses in the first four: cut the streak short and end on a gimme.
    const missesSoFar = next.filter((r) => !r).length
    const willCut = !cut && next.length >= 4 && missesSoFar >= 3
    if (willCut) setCut(true)
    const limit = willCut || cut ? Math.min(total, next.length + 1) : total
    if (next.length >= limit) {
      finishStreak(next)
      return
    }
    setIndex((i) => i + 1)
  }

  const finishStreak = (all: readonly boolean[]) => {
    setPhase('done')
    const right = all.filter(Boolean).length
    const need = total === 8 ? 7 : total === 6 ? 5 : 3
    const verdict = cut || tracker.revealed ? 'almost' : right >= need ? 'right' : right >= Math.ceil(total / 2) ? 'almost' : 'miss'
    playLetterNote(item.letter)
    haptic('success')
    if (verdict === 'right') cheerSmall()
    window.setTimeout(() => tracker.finish(verdict, 2), 800)
  }

  const answer = (picked: LetterId) => {
    if (!current || phase !== 'trial') return
    unlockAudio()
    if (picked === current.target) {
      playLetterNote(picked)
      advance(!missedThis)
      return
    }
    sfx('wrong')
    haptic('error')
    tracker.registerMiss(picked)
    setMissedThis(true)
    // The same trial repeats immediately, with the answer glowing.
  }

  // A gimme for the last trial of a cut streak: a letter that looks nothing like it.
  const options: readonly LetterId[] = useMemo(() => {
    if (!current) return pair
    const last = cut && index === results.length && results.length >= 3
    if (!last) return pair
    const far = LETTER_IDS.find(
      (l) => !pair.includes(l) && !sameRhymeFamily(l, current.target),
    )
    return far ? [current.target, far] : pair
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cut, index])

  if (phase === 'intro') {
    return (
      <div className="mode">
        <div className="twins__intro">
          <span className="twins__glyph">{glyphOf(item.letter, item.glyphCase)}</span>
          <span className="twins__glyph twins__glyph--mirror">{glyphOf(twin, item.glyphCase)}</span>
        </div>
        <p className="mode__hint">{feature}</p>
      </div>
    )
  }

  if (!current || phase === 'done') {
    return (
      <div className="mode">
        <div className="twins__pips">
          {results.map((ok, i) => (
            <span key={i} className={`hunt__pip ${ok ? 'hunt__pip--full' : ''}`} />
          ))}
        </div>
        <p className="mode__hint">Well done!</p>
      </div>
    )
  }

  const glow = missedThis

  return (
    <div className="mode">
      <div className="twins__pips" aria-label={`${results.length} of ${total}`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`hunt__pip ${i < results.length ? (results[i] ? 'hunt__pip--full' : '') : ''}`} />
        ))}
      </div>

      {current.kind === 'hear' ? (
        <>
          <p className="mode__hint">Tap the one you heard</p>
          <div className="mode__row">
            {options.map((option) => (
              <LetterTile
                key={option}
                letter={option}
                letterCase={current.letterCase}
                size="lg"
                state={glow && option === current.target ? 'hint' : 'idle'}
                onPress={answer}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <div className="choose__glyph">{glyphOf(current.target, current.letterCase)}</div>
          <p className="mode__hint">{armed ? 'Tap again if that is the one' : 'Listen and choose'}</p>
          <div className="choose__row">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                className={[
                  'choose__opt',
                  armed === option ? 'choose__opt--armed' : '',
                  glow && option === current.target ? 'choose__opt--hint' : '',
                ]
                  .filter(Boolean)
                  .join(' ')}
                onClick={() => {
                  unlockAudio()
                  if (armed === option) {
                    answer(option)
                    return
                  }
                  setArmed(option)
                  void speakLetterName(option)
                }}
                aria-label={`Option ${letterInfo(option).name}`}
              >
                {armed === option ? '✓' : '🔊'}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
