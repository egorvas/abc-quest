import type { LetterId } from '../data/letters'
import { letterInfo } from '../data/letters'
import './LetterTile.css'

export type TileState = 'idle' | 'correct' | 'wrong' | 'hint' | 'dim'
export type LetterCase = 'upper' | 'lower'

interface LetterTileProps {
  readonly letter: LetterId
  readonly letterCase?: LetterCase
  readonly state?: TileState
  readonly onPress?: (letter: LetterId) => void
  readonly size?: 'sm' | 'md' | 'lg' | 'xl'
  /** Rotation in degrees, to break up the grid and make it feel hand-made. */
  readonly tilt?: number
  readonly disabled?: boolean
}

export function glyphOf(letter: LetterId, letterCase: LetterCase): string {
  return letterCase === 'lower' ? letterInfo(letter).lower : letter
}

export function LetterTile({
  letter,
  letterCase = 'upper',
  state = 'idle',
  onPress,
  size = 'md',
  tilt = 0,
  disabled = false,
}: LetterTileProps) {
  const interactive = Boolean(onPress) && !disabled
  return (
    <button
      type="button"
      className={`tile tile--${size} tile--${state} ${interactive ? '' : 'tile--static'}`}
      style={{ ['--tilt' as string]: `${tilt}deg` }}
      disabled={!interactive}
      aria-label={letterInfo(letter).name}
      onClick={interactive ? () => onPress?.(letter) : undefined}
    >
      <span className="tile__glyph">{glyphOf(letter, letterCase)}</span>
    </button>
  )
}
