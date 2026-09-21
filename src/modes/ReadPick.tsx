import { useMemo, useState } from 'react'
import { wordInfo, type WordEntry } from '../data/words'
import { graphemeInfo } from '../data/phonics'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { playLetterNote } from '../audio/letterNote'
import { sfx, unlockAudio } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speak, speakBlend, speakWord } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './reading.css'
import './FirstSound.css'

const FACES = [
  "'Nunito', sans-serif",
  'Georgia, serif',
  "'Courier New', monospace",
  "'Trebuchet MS', sans-serif",
]

/**
 * Read the word, find its picture.
 *
 * The only mode in the app with no audio prompt, and that is the entire
 * point. Speak the word and it becomes a listening exercise. Silence is what
 * makes this the one screen that answers whether the blending work is
 * landing.
 *
 * Tapping the word is sound-it-out help, not a mistake: each grapheme lights
 * in turn with its sound. The sounds are given; the blend is never given.
 */
export function ReadPick({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const word = wordInfo(item.wordId ?? 'cat')
  const [lit, setLit] = useState<number | null>(null)
  const [soundOuts, setSoundOuts] = useState(0)
  const [dead, setDead] = useState<readonly string[]>([])
  const [locked, setLocked] = useState(false)

  const options: readonly WordEntry[] = useMemo(
    () => shuffle([word, ...(item.wordDistractors ?? []).map((id) => wordInfo(id))]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )
  const face = useMemo(
    () => (item.level === 4 ? FACES[Math.floor(Math.random() * FACES.length)] : undefined),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )

  /** Each grapheme in turn, with its sound. A stop rides on the next vowel. */
  const soundOut = (fast = false) => {
    if (locked) return
    unlockAudio()
    setSoundOuts((n) => n + 1)
    const step = fast ? 260 : 380
    word.units.forEach((unit, index) => {
      window.setTimeout(() => {
        setLit(index)
        const info = graphemeInfo(unit.g, unit.p)
        const next = word.units[index + 1]
        const text =
          info.continuant && info.say
            ? info.say
            : next && graphemeInfo(next.g, next.p).kind === 'vowel'
              ? unit.g + next.g
              : unit.g
        void speak(text, { rate: 0.5 })
      }, index * step)
    })
    window.setTimeout(() => setLit(null), word.units.length * step + 200)
  }

  const pick = (picked: WordEntry) => {
    if (locked || dead.includes(picked.id)) return
    unlockAudio()

    if (picked.id === word.id) {
      setLocked(true)
      playLetterNote(item.letter)
      haptic('success')
      if (!tracker.revealed) cheerSmall()
      void speakWord(word)
      const clean = soundOuts === 0 && tracker.misses === 0 && !tracker.revealed
      window.setTimeout(() => tracker.finish(clean ? 'right' : 'almost', options.length), 1000)
      return
    }

    sfx('wrong')
    haptic('error')
    setDead((list) => [...list, picked.id])
    // A minimal-pair miss names the grapheme that was misread.
    const differing = word.units.findIndex((unit, index) => picked.units[index]?.g !== unit.g)
    const wrongGrapheme = differing >= 0 ? picked.units[differing]?.g : undefined
    tracker.registerMiss(null)
    if (tracker.misses === 0) soundOut()
    else void speakBlend(word)
    void wrongGrapheme
  }

  return (
    <div className="mode">
      <button
        type="button"
        className="word word--read"
        style={face ? { fontFamily: face, letterSpacing: '0.1em' } : undefined}
        onClick={() => soundOut(soundOuts > 0)}
        aria-label="Sound it out"
      >
        {word.units.map((unit, index) => (
          <span key={index} className={`word__unit ${lit === index ? 'word__unit--lit' : ''}`}>
            {unit.g}
          </span>
        ))}
      </button>
      <p className="mode__hint">{tracker.hinting && !locked ? 'Tap the word to hear its sounds' : ''}</p>

      <div className="pics">
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
            disabled={locked || dead.includes(option.id)}
            aria-label={option.text}
          >
            <span className="fsound__emoji">{option.emoji}</span>
          </button>
        ))}
      </div>
    </div>
  )
}
