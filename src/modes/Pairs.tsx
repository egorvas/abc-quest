import { useEffect, useMemo, useRef, useState } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { playLetterNote } from '../audio/letterNote'
import { sfx, unlockAudio } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speak, speakLetterName } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './Pairs.css'

/**
 * Match uppercase to lowercase.
 *
 * The only exercise that teaches the genuinely hard idea that A and a are one
 * letter despite looking like two. No dragging: a four-year-old's aim is fine
 * for tapping and terrible for dragging.
 */

interface Card {
  readonly key: string
  readonly letter: LetterId
  readonly lower: boolean
}

export function Pairs({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const [open, setOpen] = useState<readonly string[]>([])
  const [matched, setMatched] = useState<readonly LetterId[]>([])
  const [busy, setBusy] = useState(false)
  const cleanMatch = useRef(true)

  const pairCount = item.level === 1 ? 4 : item.level === 2 ? 5 : 6
  const letters = useMemo(() => {
    const pool = [item.letter, ...item.distractors]
    return pool.slice(0, pairCount)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq])

  const cards = useMemo(
    () =>
      shuffle(
        letters.flatMap((letter): Card[] => [
          { key: `${letter}U`, letter, lower: false },
          { key: `${letter}L`, letter, lower: true },
        ]),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )

  useEffect(() => {
    setOpen([])
    setMatched([])
    setBusy(false)
    cleanMatch.current = true
  }, [seq])

  const handleFlip = (card: Card) => {
    if (busy || open.includes(card.key) || matched.includes(card.letter)) return
    unlockAudio()

    const next = [...open, card.key]
    setOpen(next)
    // Level 3 keeps quiet: matching by shape alone is the harder skill.
    if (item.level < 3) void speakLetterName(letterInfo(card.letter).name)

    if (next.length < 2) return

    const [firstKey, secondKey] = next
    const first = cards.find((c) => c.key === firstKey)
    const second = cards.find((c) => c.key === secondKey)
    setBusy(true)

    if (first && second && first.letter === second.letter) {
      playLetterNote(first.letter)
      haptic('success')
      void speak(`${first.letter} and ${letterInfo(first.letter).lower} — the same letter`)
      const nextMatched = [...matched, first.letter]
      window.setTimeout(() => {
        setMatched(nextMatched)
        setOpen([])
        setBusy(false)
        if (nextMatched.length >= letters.length) {
          cheerSmall()
          window.setTimeout(
            () =>
              tracker.finish(
                cleanMatch.current && !tracker.revealed ? 'right' : 'almost',
                pairCount * 2,
              ),
            700,
          )
        }
      }, 650)
      return
    }

    // A mismatch is a working-memory slip, not a failure to know the letter.
    // It closes quietly: no buzzer, no red.
    sfx('tap')
    if (first?.letter === item.letter || second?.letter === item.letter) {
      cleanMatch.current = false
      if (first && second) {
        tracker.registerMiss(first.letter === item.letter ? second.letter : first.letter)
      }
    }
    window.setTimeout(() => {
      setOpen([])
      setBusy(false)
    }, 1100)
  }

  return (
    <div className="mode pairs">
      <p className="mode__hint">Найди большую и маленькую букву</p>
      <div className={`pairs__grid pairs__grid--${pairCount}`}>
        {cards.map((card) => {
          const isOpen = open.includes(card.key)
          const isMatched = matched.includes(card.letter)
          return (
            <button
              key={card.key}
              type="button"
              className={[
                'pairs__card',
                isOpen ? 'pairs__card--open' : '',
                isMatched ? 'pairs__card--matched' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => handleFlip(card)}
              disabled={isMatched}
              aria-label={isOpen || isMatched ? letterInfo(card.letter).name : 'Закрытая карточка'}
            >
              <span className="pairs__face">
                {isOpen || isMatched
                  ? card.lower
                    ? letterInfo(card.letter).lower
                    : card.letter
                  : '★'}
              </span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
