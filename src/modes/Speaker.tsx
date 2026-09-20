import { useEffect, useRef, useState } from 'react'
import { speak, ttsSupported } from '../audio/speak'
import { unlockAudio } from '../audio/sfx'

interface SpeakerProps {
  /** English text to say, e.g. "Find the letter B". */
  readonly text: string
  /** Replayed automatically whenever this changes. */
  readonly autoKey: string | number
  readonly emoji?: string
  /** Shown instead of the icon when speech is unavailable. */
  readonly fallback?: string
  readonly rate?: number
}

/**
 * The audio prompt. Tapping replays it, which is never counted as a mistake -
 * a child listening again is a child concentrating.
 *
 * If the device has no speech synthesis the prompt degrades to showing the
 * answer text, so the mode stays playable instead of becoming impossible.
 */
export function Speaker({ text, autoKey, emoji = '👂', fallback, rate }: SpeakerProps) {
  const [playing, setPlaying] = useState(false)
  const lastKey = useRef<string | number | null>(null)

  const say = () => {
    unlockAudio()
    setPlaying(true)
    void speak(text, { rate }).finally(() => setPlaying(false))
  }

  useEffect(() => {
    if (lastKey.current === autoKey) return
    lastKey.current = autoKey
    // A small delay lets the previous screen's animation finish first.
    const timer = window.setTimeout(say, 280)
    return () => window.clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [autoKey, text])

  if (!ttsSupported()) {
    return (
      <div className="mode__speaker" aria-label={text}>
        <span style={{ fontSize: 38 }}>{fallback ?? emoji}</span>
      </div>
    )
  }

  return (
    <button
      type="button"
      className={`mode__speaker ${playing ? 'mode__speaker--playing' : ''}`}
      onClick={say}
      aria-label={text}
    >
      <span>{emoji}</span>
    </button>
  )
}
