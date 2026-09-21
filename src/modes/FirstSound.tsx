import { useMemo, useState } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { LETTER_SOUNDS } from '../data/phonics'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { playLetterNote } from '../audio/letterNote'
import { sfx, unlockAudio } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speak, speakSound } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import { LetterTile } from '../ui/LetterTile'
import { Speaker } from './Speaker'
import './modes.css'
import './FirstSound.css'

/**
 * The bridge from the letter's name to its sound.
 *
 * This is where a Russian-speaking child has a gap: "bee" is learned in a day,
 * and that it sounds /b/ is never learned at all unless someone shows it. The
 * two directions alternate, letter to picture and picture to letter.
 */
export function FirstSound({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const [dead, setDead] = useState<readonly LetterId[]>([])
  const [locked, setLocked] = useState(false)
  const info = letterInfo(item.letter)
  const sound = LETTER_SOUNDS[item.letter]
  // X never opens a word a child knows: it is asked as an ending.
  const ending = sound.soundWord.position === 'final'

  // Alternate direction per item so neither becomes a reflex.
  const pictureFirst = seq % 2 === 1

  const options = useMemo(
    () => shuffle([item.letter, ...item.distractors]),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [seq],
  )

  const pick = (picked: LetterId) => {
    if (locked || dead.includes(picked)) return
    unlockAudio()

    if (picked === item.letter) {
      setLocked(true)
      playLetterNote(item.letter)
      haptic('success')
      void speak(`${info.lower} for ${info.word}`)
      if (!tracker.revealed) cheerSmall()
      window.setTimeout(
        () => tracker.finish(tracker.revealed ? 'almost' : 'right', options.length),
        1000,
      )
      return
    }

    sfx('wrong')
    haptic('error')
    // The second miss stretches the sound out: "mmm... Moon". A stop has no
    // honest stretched form, so for those the word itself is said slowly.
    if (tracker.misses + 1 >= 2) {
      void speakSound(item.letter.toLowerCase(), info.word)
    }
    setDead((list) => [...list, picked])
    tracker.registerMiss(picked)
  }

  return (
    <div className="mode fsound">
      {pictureFirst ? (
        <>
          <Speaker
            text={ending ? `${info.word}. Which letter does it end with?` : `${info.word}. Which letter?`}
            autoKey={seq}
            emoji="🔊"
            fallback={info.emoji}
          />
          <div className="mode__emoji">{info.emoji}</div>
          <div className="mode__row">
            {options.map((option) => (
              <LetterTile
                key={option}
                letter={option}
                letterCase={item.glyphCase}
                size={options.length >= 5 ? 'sm' : 'md'}
                state={
                  dead.includes(option)
                    ? 'dim'
                    : tracker.revealed && option === item.letter
                      ? 'hint'
                      : 'idle'
                }
                onPress={pick}
                disabled={locked}
              />
            ))}
          </div>
        </>
      ) : (
        <>
          <Speaker
            text={ending ? `${info.lower}. Which one ends with ${info.lower}?` : `${info.lower}. ${info.lower} is for...`}
            autoKey={seq}
            emoji="🔊"
            fallback={item.letter}
          />
          <div className="fsound__glyph">
            {item.glyphCase === 'lower' ? info.lower : item.letter}
          </div>
          <div className="mode__row">
            {options.map((option) => {
              const optionInfo = letterInfo(option)
              return (
                <button
                  key={option}
                  type="button"
                  className={[
                    'fsound__pic',
                    dead.includes(option) ? 'fsound__pic--dead' : '',
                    tracker.revealed && option === item.letter ? 'fsound__pic--hint' : '',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  onClick={() => pick(option)}
                  disabled={locked || dead.includes(option)}
                  aria-label={optionInfo.word}
                >
                  <span className="fsound__emoji">{optionInfo.emoji}</span>
                </button>
              )
            })}
          </div>
        </>
      )}
    </div>
  )
}
