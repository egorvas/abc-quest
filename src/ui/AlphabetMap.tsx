import type { LetterId } from '../data/letters'
import { LETTERS } from '../data/letters'
import './AlphabetMap.css'

export type LetterStage = 'locked' | 'new' | 'learning' | 'strong' | 'mastered'

interface AlphabetMapProps {
  readonly stages: Readonly<Partial<Record<LetterId, LetterStage>>>
  readonly onPick?: (letter: LetterId) => void
  readonly compact?: boolean
}

const STAGE_LABEL: Record<LetterStage, string> = {
  locked: '',
  new: '·',
  learning: '★',
  strong: '★★',
  mastered: '★★★',
}

/**
 * The whole alphabet as one board. A child who cannot read still sees how many
 * letters have gone gold, which is the entire point of the screen.
 */
export function AlphabetMap({ stages, onPick, compact = false }: AlphabetMapProps) {
  return (
    <div className={`amap ${compact ? 'amap--compact' : ''}`}>
      {LETTERS.map((info) => {
        const stage = stages[info.id] ?? 'locked'
        return (
          <button
            key={info.id}
            type="button"
            className={`amap__cell amap__cell--${stage}`}
            onClick={onPick ? () => onPick(info.id) : undefined}
            disabled={!onPick}
            aria-label={`${info.id} ${stage}`}
          >
            <span className="amap__glyph">{info.id}</span>
            <span className="amap__stars">{STAGE_LABEL[stage]}</span>
          </button>
        )
      })}
    </div>
  )
}
