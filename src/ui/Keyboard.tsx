import { useEffect } from 'react'
import type { LetterId } from '../data/letters'
import { isLetterId } from '../data/letters'
import './Keyboard.css'

export type KeyboardLayout = 'abc' | 'qwerty'

const ROWS: Record<KeyboardLayout, readonly string[]> = {
  qwerty: ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'],
  abc: ['ABCDEFGHI', 'JKLMNOPQR', 'STUVWXYZ'],
}

interface KeyboardProps {
  readonly layout?: KeyboardLayout
  readonly onKey: (letter: LetterId) => void
  readonly lowercase?: boolean
  readonly disabled?: boolean
  /** Letters to grey out, e.g. already-used ones. */
  readonly muted?: readonly LetterId[]
  /** Letter to pulse as a hint after repeated failures. */
  readonly hint?: LetterId | null
}

/**
 * In-app keyboard. The iOS system keyboard is avoided on purpose: it covers
 * half the screen, autocorrects, and a 5-year-old cannot dismiss it. A
 * hardware Bluetooth keyboard still works through the key listener below.
 */
export function Keyboard({
  layout = 'abc',
  onKey,
  lowercase = false,
  disabled = false,
  muted = [],
  hint = null,
}: KeyboardProps) {
  useEffect(() => {
    if (disabled) return undefined
    const handler = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      const key = event.key.toUpperCase()
      if (isLetterId(key)) {
        event.preventDefault()
        onKey(key)
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [onKey, disabled])

  const mutedSet = new Set(muted)

  return (
    <div className={`kbd ${disabled ? 'kbd--disabled' : ''}`}>
      {ROWS[layout].map((row) => (
        <div className="kbd__row" key={row}>
          {[...row].map((char) => {
            const letter = char as LetterId
            const classes = [
              'kbd__key',
              mutedSet.has(letter) ? 'kbd__key--muted' : '',
              hint === letter ? 'kbd__key--hint' : '',
            ]
              .filter(Boolean)
              .join(' ')
            return (
              <button
                key={char}
                type="button"
                className={classes}
                disabled={disabled}
                onClick={() => onKey(letter)}
              >
                {lowercase ? char.toLowerCase() : char}
              </button>
            )
          })}
        </div>
      ))}
    </div>
  )
}
