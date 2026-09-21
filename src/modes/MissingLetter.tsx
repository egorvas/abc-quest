import { useMemo, useState } from 'react'
import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import { graphemeInfo } from '../data/phonics'
import { wordInfo } from '../data/words'
import { LetterTile } from '../ui/LetterTile'
import { Keyboard } from '../ui/Keyboard'
import { Speaker } from './Speaker'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { shuffle } from '../engine/scheduler'
import { vowelOptions } from '../engine/reading'
import { playLetterNote } from '../audio/letterNote'
import { sfx } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { speakBlend, speakSpelling } from '../audio/speak'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './reading.css'

/**
 * One letter fell out of the word.
 *
 * The picture is always there: without it "c_t" has three answers and the
 * question is unfair. The gap is a letter-shaped hole the exact width of the
 * missing glyph, so the word does not reflow when the letter lands and the
 * child feels that the letter belongs in that spot.
 *
 * A wrong letter is the teaching moment. It lands, and the app reads the word
 * as the child has just written it - "cot" - then the letter drops back out.
 * Nothing turns red. Hearing that it does not say the word is the lesson.
 */
export function MissingLetter({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const word = wordInfo(item.wordId ?? 'cat')
  const gap = item.gapIndex ?? 0
  const target = word.units[gap]
  const isVowel = graphemeInfo(target.g, target.p).kind === 'vowel'
  const [tried, setTried] = useState<LetterId | null>(null)
  const [dead, setDead] = useState<readonly LetterId[]>([])
  const [locked, setLocked] = useState(false)

  const options = useMemo(() => {
    const count = Math.max(2, Math.min(item.distractors.length + 1, item.level === 1 ? 3 : 4))
    // The middle vowel gets the other short vowels, never a random field:
    // the vowel contrast is precisely what is being taught.
    const wrong = isVowel
      ? vowelOptions(item.letter, count - 1)
      : item.distractors.slice(0, count - 1)
    return shuffle([item.letter, ...wrong])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [seq])

  const answer = (picked: LetterId) => {
    if (locked || dead.includes(picked)) return
    setTried(picked)

    if (picked === item.letter) {
      setLocked(true)
      playLetterNote(item.letter)
      haptic('success')
      if (!tracker.revealed) cheerSmall()
      void speakBlend(word)
      window.setTimeout(
        () =>
          tracker.finish(
            tracker.revealed ? 'almost' : tracker.misses > 0 ? 'almost' : 'right',
            item.level === 4 ? 26 : options.length,
          ),
        1400,
      )
      return
    }

    // Read it back as written, then let the letter fall out.
    sfx('wrong')
    haptic('error')
    const units = word.units.map((unit, index) =>
      index === gap ? { g: picked.toLowerCase(), p: unit.p } : unit,
    )
    void speakSpelling(units)
    tracker.registerMiss(picked)
    window.setTimeout(() => {
      setTried(null)
      setDead((list) => [...list, picked])
    }, 900)
  }

  // Words are read in lowercase, the way they are printed; only the expert
  // level ever asks for a capital in the gap.
  const upper = item.level === 4 && item.glyphCase === 'upper'
  const glyph = (unit: { readonly g: string }) => (upper ? unit.g.toUpperCase() : unit.g)

  return (
    <div className="mode">
      <div className="mode__prompt">
        <Speaker text={word.text} autoKey={seq} emoji="🔊" fallback={word.emoji ?? '?'} />
        <span className="mode__emoji">{word.emoji}</span>
      </div>

      <div className="word" aria-label={word.text}>
        {word.units.map((unit, index) =>
          index === gap ? (
            <span
              key={index}
              className={`word__gap ${locked ? 'word__gap--filled' : ''}`}
              aria-label="Missing letter"
            >
              <span className="word__gap-ghost" aria-hidden="true">
                {glyph(unit)}
              </span>
              {tried ? (
                <span
                  className={`word__gap-fill ${tried === item.letter ? '' : 'word__gap-fill--wrong'}`}
                >
                  {upper ? tried : letterInfo(tried).lower}
                </span>
              ) : null}
            </span>
          ) : (
            <span key={index} className="word__unit">
              {glyph(unit)}
            </span>
          ),
        )}
      </div>

      {item.level === 4 ? (
        <Keyboard
          layout="qwerty"
          lowercase={!upper}
          onKey={answer}
          disabled={locked}
          hint={tracker.hinting ? item.letter : null}
        />
      ) : (
        <div className="mode__row">
          {options.map((option) => (
            <LetterTile
              key={option}
              letter={option}
              letterCase={upper ? 'upper' : 'lower'}
              size="md"
              state={
                dead.includes(option)
                  ? 'dim'
                  : tracker.revealed && option === item.letter
                    ? 'hint'
                    : 'idle'
              }
              onPress={answer}
              disabled={locked || tried !== null}
            />
          ))}
        </div>
      )}
    </div>
  )
}
