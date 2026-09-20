import './MicButton.css'

export type MicState = 'idle' | 'listening' | 'hearing' | 'thinking' | 'blocked'

interface MicButtonProps {
  readonly state: MicState
  readonly onPress: () => void
}

const LABEL: Record<MicState, string> = {
  idle: 'Tap, then say the letter',
  listening: 'Listening...',
  hearing: 'I can hear you!',
  thinking: 'Checking...',
  blocked: 'No microphone',
}

export function MicButton({ state, onPress }: MicButtonProps) {
  const disabled = state === 'blocked' || state === 'thinking'
  return (
    <div className="mic">
      <button
        type="button"
        className={`mic__btn mic__btn--${state}`}
        onClick={disabled ? undefined : onPress}
        disabled={disabled}
        aria-label={LABEL[state]}
      >
        <span className="mic__icon">🎤</span>
        <span className="mic__ring" aria-hidden="true" />
        <span className="mic__ring mic__ring--slow" aria-hidden="true" />
      </button>
      <p className="mic__label">{LABEL[state]}</p>
    </div>
  )
}
