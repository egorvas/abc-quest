import type { TownSvg } from '../engine/townItems'
import { LETTER_IDS } from '../data/letters'
import { playLetterNote } from '../audio/letterNote'

/**
 * The three town items no emoji can draw. Each is a few shapes, sized by the
 * parent through `font-size` like an emoji would be, so the lot card can treat
 * all its items the same way.
 */

interface TownGlyphProps {
  readonly kind: TownSvg
  readonly size: number
}

const QUILT_COLOURS = ['#fbbf24', '#ec4899', '#38bdf8', '#a3e635']

function Quilt({ size }: { readonly size: number }) {
  const cell = size / 4
  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-label="Quilt">
      {Array.from({ length: 16 }, (_, i) => {
        const x = (i % 4) * cell
        const y = Math.floor(i / 4) * cell
        const colour = QUILT_COLOURS[(i + Math.floor(i / 4)) % QUILT_COLOURS.length]
        return (
          <rect
            key={i}
            x={x + 1}
            y={y + 1}
            width={cell - 2}
            height={cell - 2}
            rx={cell * 0.18}
            fill={colour}
          />
        )
      })}
      <rect
        x="1"
        y="1"
        width={size - 2}
        height={size - 2}
        rx={size * 0.08}
        fill="none"
        stroke="rgba(0,0,0,0.35)"
        strokeWidth="2"
      />
    </svg>
  )
}

const BAR_COLOURS = ['#fb7185', '#fbbf24', '#a3e635', '#38bdf8', '#a78bfa']

/** Five bars that play real letter notes when tapped. */
function Xylophone({ size }: { readonly size: number }) {
  const barWidth = size / 6
  const gap = barWidth * 0.25
  return (
    <svg width={size} height={size * 0.8} viewBox={`0 0 ${size} ${size * 0.8}`} aria-label="Xylophone">
      <rect x="0" y={size * 0.62} width={size} height={size * 0.1} rx="3" fill="#8b5a2b" />
      {BAR_COLOURS.map((colour, i) => {
        const height = size * (0.62 - i * 0.07)
        const x = i * (barWidth + gap) + gap
        const letter = LETTER_IDS[[0, 4, 8, 12, 16][i]]
        return (
          <rect
            key={colour}
            x={x}
            y={size * 0.62 - height}
            width={barWidth}
            height={height}
            rx={barWidth * 0.3}
            fill={colour}
            stroke="rgba(0,0,0,0.25)"
            strokeWidth="1.5"
            style={{ cursor: 'pointer' }}
            onClick={(event) => {
              event.stopPropagation()
              playLetterNote(letter)
            }}
          />
        )
      })}
    </svg>
  )
}

function ZooGate({ size }: { readonly size: number }) {
  const w = size
  const h = size * 0.9
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-label="Zoo gate">
      <rect x={w * 0.08} y={h * 0.3} width={w * 0.12} height={h * 0.7} fill="#7c4a03" />
      <rect x={w * 0.8} y={h * 0.3} width={w * 0.12} height={h * 0.7} fill="#7c4a03" />
      <path
        d={`M ${w * 0.08} ${h * 0.4} A ${w * 0.42} ${h * 0.4} 0 0 1 ${w * 0.92} ${h * 0.4} L ${w * 0.92} ${h * 0.52} L ${w * 0.08} ${h * 0.52} Z`}
        fill="#fbbf24"
        stroke="#7c4a03"
        strokeWidth="2"
      />
      {[0.32, 0.44, 0.56, 0.68].map((fx) => (
        <rect key={fx} x={w * fx} y={h * 0.52} width={w * 0.04} height={h * 0.48} fill="#7c4a03" />
      ))}
      <text
        x={w / 2}
        y={h * 0.36}
        textAnchor="middle"
        fontFamily="'Baloo 2', 'Nunito', sans-serif"
        fontWeight="800"
        fontSize={h * 0.2}
        fill="#3b2606"
      >
        ZOO
      </text>
    </svg>
  )
}

export function TownGlyph({ kind, size }: TownGlyphProps) {
  if (kind === 'quilt') return <Quilt size={size} />
  if (kind === 'xylophone') return <Xylophone size={size} />
  return <ZooGate size={size} />
}
