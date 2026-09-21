import { useMemo, useState } from 'react'
import type { LetterId } from '../data/letters'
import { isLetterId } from '../data/letters'
import { graphemeInfo } from '../data/phonics'
import { wordInfo } from '../data/words'
import { LetterTile } from '../ui/LetterTile'
import { Keyboard } from '../ui/Keyboard'
import { Speaker } from './Speaker'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { playLetterNote } from '../audio/letterNote'
import { sfx } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { blendText, speak, speakWord } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './reading.css'

/**
 * Hear a word, tap its letters in order.
 *
 * Slots always fill left to right, so there is never a "which slot did you
 * mean" and never a drag target. On landing the app speaks that grapheme's
 * sound, not its name: that is the line between a phonics exercise and a
 * spelling exercise. Level 4 swaps the bank for the whole keyboard, which
 * turns the mode into dictation - the one reading exercise that cannot be
 * guessed and so can move a letter towards its star.
 */
export function BuildWord({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const word = wordInfo(item.wordId ?? 'sun')
  const [filled, setFilled] = useState(0)
  const [flash, setFlash] = useState(false)
  const [wrong, setWrong] = useState(0)
  const [used, setUsed] = useState<readonly number[]>([])
  const [closed, setClosed] = useState(false)

  interface BankTile {
    readonly key: number
    readonly g: string
  }

  const bank: readonly BankTile[] = useMemo(() => {
    const own = word.units.map((unit) => unit.g)
    const decoyCount = item.level === 1 ? 0 : item.level === 2 ? 2 : 4
    const decoys = item.distractors
      .map((letter) => letter.toLowerCase())
      .filter((g) => !own.includes(g))
      .slice(0, decoyCount)
    return shuffle([...own, ...decoys]).map((g, key) => ({ key, g }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq])

  const sayUnit = (index: number) => {
    const unit = word.units[index]
    const info = graphemeInfo(unit.g, unit.p)
    const next = word.units[index + 1]
    const text =
      info.continuant && info.say
        ? info.say
        : next && graphemeInfo(next.g, next.p).kind === 'vowel'
          ? unit.g + next.g
          : unit.g
    void speak(text, { rate: 0.55 })
  }

  const place = (g: string, key?: number) => {
    if (closed) return
    const wanted = word.units[filled]
    if (!wanted) return

    if (g === wanted.g) {
      const next = filled + 1
      setFilled(next)
      if (key !== undefined) setUsed((list) => [...list, key])
      if (next >= word.units.length) {
        setClosed(true)
        playLetterNote(item.letter)
        haptic('success')
        if (!tracker.revealed) cheerSmall()
        void speakWord(word)
        const verdict = tracker.revealed ? 'almost' : wrong === 0 ? 'right' : wrong === 1 ? 'almost' : 'miss'
        window.setTimeout(
          () =>
            tracker.finish(verdict, item.level === 4 ? 26 : bank.length, {
              wordSkill: 'build',
              placed: word.units.map((unit) => unit.g),
            }),
          1100,
        )
      } else {
        sayUnit(filled)
      }
      return
    }

    sfx('wrong')
    haptic('error')
    setWrong((n) => n + 1)
    setFlash(true)
    window.setTimeout(() => setFlash(false), 450)
    const upper = g.toUpperCase()
    tracker.registerMiss(isLetterId(upper) ? upper : null)
    // The sound still needed is re-spoken.
    sayUnit(filled)
  }

  const showGhost = item.level === 1 || tracker.revealed
  // Words are built in lowercase, the way they are printed.
  const upper = item.level === 4 && item.glyphCase === 'upper'
  const glyph = (g: string) => (upper ? g.toUpperCase() : g)
  const nextLetter: LetterId | null = (() => {
    const g = word.units[filled]?.g.toUpperCase() ?? ''
    return isLetterId(g) ? g : null
  })()

  return (
    <div className="mode">
      <div className="mode__prompt">
        <Speaker
          text={`${word.text}. ${blendText(word)}`}
          autoKey={seq}
          emoji="🔊"
          fallback={word.emoji ?? word.text}
        />
        {word.emoji ? <span className="mode__emoji">{word.emoji}</span> : null}
      </div>

      <div className={`slots ${closed ? 'slots--closed' : ''}`}>
        {word.units.map((unit, index) => (
          <span
            key={index}
            className={[
              'slot',
              index < filled ? 'slot--filled' : '',
              index === filled && flash ? 'slot--flash' : '',
              index >= filled && showGhost ? 'slot--ghost' : '',
            ]
              .filter(Boolean)
              .join(' ')}
          >
            {index < filled || showGhost ? glyph(unit.g) : ''}
          </span>
        ))}
      </div>

      {item.level === 4 ? (
        <Keyboard
          layout="qwerty"
          lowercase={!upper}
          onKey={(letter) => place(letter.toLowerCase())}
          disabled={closed}
          hint={tracker.hinting ? nextLetter : null}
        />
      ) : (
        <div className="bank">
          {bank.map((tile) => {
            const upper = tile.g.toUpperCase()
            const isUsed = used.includes(tile.key)
            const isHint = tracker.hinting && tile.g === word.units[filled]?.g && !isUsed
            if (isLetterId(upper)) {
              return (
                <LetterTile
                  key={tile.key}
                  letter={upper}
                  letterCase={upper ? 'upper' : 'lower'}
                  size="sm"
                  state={isUsed ? 'dim' : isHint ? 'hint' : 'idle'}
                  onPress={() => place(tile.g, tile.key)}
                  disabled={closed || isUsed}
                />
              )
            }
            // A digraph is one tile.
            return (
              <button
                key={tile.key}
                type="button"
                className={`tile tile--sm ${isUsed ? 'tile--dim' : isHint ? 'tile--hint' : ''}`}
                onClick={() => place(tile.g, tile.key)}
                disabled={closed || isUsed}
                aria-label={tile.g}
              >
                <span className="tile__glyph">{glyph(tile.g)}</span>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
