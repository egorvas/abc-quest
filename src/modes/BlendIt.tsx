import { useEffect, useMemo, useRef, useState } from 'react'
import { wordInfo, type WordEntry } from '../data/words'
import { graphemeInfo } from '../data/phonics'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { playLetterNote } from '../audio/letterNote'
import { sfx, unlockAudio } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speak, speakBlend, speakWord, stopSpeaking } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './reading.css'
import './FirstSound.css'

/**
 * Push two parts into one word.
 *
 * The animation is the teaching device, not decoration. Two pills on a rail
 * slide together over half a second while one continuous utterance runs the
 * sounds into each other, and at contact the facing corners lose their
 * radius so two pills become one. If the parts met in silence the motion
 * would teach nothing, so the audio always spans it.
 *
 * Levels 1-2 join an onset and a rime. Level 3 up blends sound by sound,
 * "ca" then "cat", which is the form that transfers to words never seen.
 */

interface Part {
  readonly text: string
  /** Say it as a held sound (continuant) or as plain text. */
  readonly say: string
}

function partsFor(word: WordEntry, successive: boolean): readonly Part[] {
  const sayUnit = (g: string, p: WordEntry['units'][number]['p']) => {
    const info = graphemeInfo(g, p)
    return info.continuant && info.say ? info.say : g
  }
  if (!successive || word.units.length <= 2) {
    const [first, ...rest] = word.units
    return [
      { text: first.g, say: sayUnit(first.g, first.p) },
      { text: rest.map((u) => u.g).join(''), say: rest.map((u) => u.g).join('') },
    ]
  }
  return word.units.map((unit) => ({ text: unit.g, say: sayUnit(unit.g, unit.p) }))
}

export function BlendIt({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const word = wordInfo(item.wordId ?? 'man')
  const successive = item.level >= 3
  const [parts, setParts] = useState<readonly Part[]>(() => partsFor(word, successive))
  const [joining, setJoining] = useState(false)
  const [pulse, setPulse] = useState<number | null>(null)
  const [blended, setBlended] = useState(false)
  const [dead, setDead] = useState<readonly string[]>([])
  const [locked, setLocked] = useState(false)
  const replays = useRef(0)

  const options: readonly WordEntry[] = useMemo(
    () => shuffle([word, ...(item.wordDistractors ?? []).map((id) => wordInfo(id))]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )

  // Hearing the parts: this is the state the child is already stuck in.
  useEffect(() => {
    if (item.level === 4) return undefined
    const timers = parts.slice(0, 2).map((part, index) =>
      window.setTimeout(() => {
        setPulse(index)
        void speak(part.say, { rate: 0.55 })
        window.setTimeout(() => setPulse(null), 260)
      }, 280 + index * 420),
    )
    return () => timers.forEach((t) => window.clearTimeout(t))
    // Only on mount: the parts change as they join.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq])

  const replay = (index: number) => {
    if (joining || locked) return
    unlockAudio()
    replays.current += 1
    setPulse(index)
    void speak(parts[index].say, { rate: 0.55 })
    window.setTimeout(() => setPulse(null), 260)
  }

  const join = () => {
    if (joining || locked || parts.length < 2) return
    unlockAudio()
    stopSpeaking()
    setJoining(true)
    const [left, right, ...rest] = parts
    const merged: Part = { text: left.text + right.text, say: left.text + right.text }
    const last = rest.length === 0
    // One utterance spanning the whole motion.
    void speak(last ? `${left.say}${right.say}. ${word.text}` : `${left.say}${right.say}`, {
      rate: 0.5,
    })
    window.setTimeout(() => {
      sfx('pop')
      haptic('light')
    }, 520)
    window.setTimeout(() => {
      setParts([merged, ...rest])
      setJoining(false)
      if (last) setBlended(true)
    }, 700)
  }

  const pick = (picked: WordEntry) => {
    if (locked || !blended || dead.includes(picked.id)) return
    if (picked.id === word.id) {
      setLocked(true)
      playLetterNote(item.letter)
      haptic('success')
      if (!tracker.revealed) cheerSmall()
      void speakWord(word)
      const firstWrong = dead[0] ? wordInfo(dead[0]) : null
      const sharesSomething =
        firstWrong !== null &&
        firstWrong.units.some((unit, index) => word.units[index]?.g === unit.g)
      const verdict = tracker.revealed
        ? 'almost'
        : dead.length === 0 && replays.current <= 2
          ? 'right'
          : sharesSomething || dead.length === 0
            ? 'almost'
            : 'miss'
      window.setTimeout(() => tracker.finish(verdict, options.length), 900)
      return
    }
    sfx('wrong')
    haptic('error')
    setDead((list) => [...list, picked.id])
    tracker.registerMiss(null)
    // The blend replays by itself: the cards spring apart and re-join once.
    void speakBlend(word)
  }

  const canJoin = parts.length >= 2 && !joining && !locked

  return (
    <div className="mode">
      <div className={`rail ${joining ? 'rail--joining' : ''}`} style={{ ['--shift' as string]: '38px' }}>
        {parts.map((part, index) => (
          <span key={`${part.text}-${index}`} style={{ display: 'contents' }}>
            {index > 0 ? (
              <button
                type="button"
                className={`rail__join ${index === 1 && canJoin ? '' : 'rail__join--gone'}`}
                onClick={join}
                aria-label="Slide together"
                disabled={!canJoin || index !== 1}
              >
                ➜⬅
              </button>
            ) : null}
            <button
              type="button"
              className={[
                'card',
                index === 0 ? 'card--left' : index === 1 ? 'card--right' : '',
                pulse === index ? 'card--pulse' : '',
                blended ? 'card--joined' : '',
              ]
                .filter(Boolean)
                .join(' ')}
              onClick={() => replay(index)}
              aria-label={part.text}
            >
              {part.text}
            </button>
          </span>
        ))}
      </div>
      <p className="mode__hint">
        {blended
          ? 'Which picture is it?'
          : tracker.hinting
            ? 'Tap the arrows to slide the parts together'
            : ''}
      </p>

      <div className={`pics ${blended ? '' : 'pics--waiting'}`}>
        {options.map((option) => (
          <button
            key={option.id}
            type="button"
            className={[
              'fsound__pic',
              dead.includes(option.id) ? 'fsound__pic--dead' : '',
              tracker.revealed && option.id === word.id ? 'fsound__pic--hint' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            onClick={() => pick(option)}
            disabled={locked || !blended || dead.includes(option.id)}
            aria-label={option.text}
          >
            <span className="fsound__emoji">{option.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
