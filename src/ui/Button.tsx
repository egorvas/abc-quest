import type { ReactNode } from 'react'
import { sfx, unlockAudio } from '../audio/sfx'
import { haptic } from '../audio/haptics'
import { warmUpSpeech } from '../audio/speak'
import './Button.css'

type Tone = 'primary' | 'ghost' | 'danger' | 'mint' | 'amber'
type Size = 'sm' | 'md' | 'lg'

interface ButtonProps {
  readonly children: ReactNode
  readonly onPress: () => void
  readonly tone?: Tone
  readonly size?: Size
  readonly disabled?: boolean
  readonly wide?: boolean
  readonly ariaLabel?: string
  readonly className?: string
}

/**
 * Every button doubles as an audio unlock point: iOS only lets sound and
 * speech start from inside a gesture handler.
 */
export function Button({
  children,
  onPress,
  tone = 'primary',
  size = 'md',
  disabled = false,
  wide = false,
  ariaLabel,
  className,
}: ButtonProps) {
  const handleClick = () => {
    if (disabled) return
    unlockAudio()
    warmUpSpeech()
    sfx('tap')
    haptic('light')
    onPress()
  }

  return (
    <button
      type="button"
      aria-label={ariaLabel}
      disabled={disabled}
      onClick={handleClick}
      className={[
        'btn',
        `btn--${tone}`,
        `btn--${size}`,
        wide ? 'btn--wide' : '',
        className ?? '',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {children}
    </button>
  )
}
