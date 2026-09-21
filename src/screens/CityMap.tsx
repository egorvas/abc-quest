import { useEffect, useMemo, useState } from 'react'
import type { BuildingView } from '../engine/city'
import type { Building } from '../data/city'

interface CityMapProps {
  readonly views: readonly BuildingView[]
  readonly night: boolean
  /** Pops in with a little bounce, right after purchase. */
  readonly justBought: string | null
  /** A tap on something owned: it bounces, and some things react. */
  readonly poke: { readonly id: string; readonly at: number } | null
  readonly onTap: (id: string) => void
}

/* ---- geometry, in viewBox units ---------------------------------------- */

const W = 1200
const H = 800
/** Everything on the map is drawn a little larger than the catalog says. */
const ZOOM = 1.2
const SKY = 170
const ROAD_Y = 440
const ROAD_H = 48
const ROAD_MID = ROAD_Y + ROAD_H / 2
const V_ROAD_X = 554
const V_ROAD_W = 44
const RIVER = 'M 1055 150 C 1035 330, 1000 520, 1010 820'
const RAIL_Y = 772

/** The river's x at a given y, near enough for placing boats and the bridge. */
const BRIDGE_X = 1022

interface Burst {
  readonly id: number
  readonly x: number
  readonly y: number
  readonly hue: number
}

/* ---- small pieces ------------------------------------------------------- */

function Emoji({
  x,
  y,
  size,
  children,
  className,
  flip,
}: {
  readonly x: number
  readonly y: number
  readonly size: number
  readonly children: string
  readonly className?: string
  readonly flip?: boolean
}) {
  return (
    <text
      x={flip ? -x : x}
      y={y}
      fontSize={size * ZOOM}
      textAnchor="middle"
      dominantBaseline="central"
      className={className}
      transform={flip ? 'scale(-1 1)' : undefined}
    >
      {children}
    </text>
  )
}

/** Something that travels along a path forever, fading in and out at the ends. */
function Mover({
  path,
  dur,
  delay = 0,
  emoji,
  size,
  flip,
}: {
  readonly path: string
  readonly dur: number
  readonly delay?: number
  readonly emoji: string
  readonly size: number
  readonly flip?: boolean
}) {
  return (
    <g>
      <Emoji x={0} y={0} size={size} flip={flip}>
        {emoji}
      </Emoji>
      <animateMotion dur={`${dur}s`} begin={`${-delay}s`} repeatCount="indefinite" path={path} />
      <animate
        attributeName="opacity"
        values="0;1;1;1;0"
        keyTimes="0;0.06;0.5;0.94;1"
        dur={`${dur}s`}
        begin={`${-delay}s`}
        repeatCount="indefinite"
      />
    </g>
  )
}

function Sign({ item, state, onTap }: { readonly item: Building; readonly state: BuildingView['state']; readonly onTap: () => void }) {
  const dim = state !== 'forsale'
  const locked = state === 'locked'
  return (
    <g
      className={`sign ${locked ? 'sign--locked' : dim ? 'sign--short' : 'sign--live'}`}
      transform={`translate(${item.x} ${item.y})`}
      onClick={onTap}
      role="button"
      aria-label={`${item.name}, ${state}`}
    >
      <rect x={-40} y={-54} width={80} height={72} rx={14} className="sign__board" />
      <line x1={0} y1={18} x2={0} y2={40} className="sign__post" />
      <text x={0} y={-26} fontSize={36} textAnchor="middle" dominantBaseline="central" className="sign__ghost">
        {locked ? '🔒' : item.emoji}
      </text>
      <text x={0} y={6} fontSize={17} textAnchor="middle" dominantBaseline="central" className="sign__price">
        {locked ? '' : `🪙 ${item.price}`}
      </text>
    </g>
  )
}

/* ---- the map ------------------------------------------------------------- */

export function CityMap({ views, night, justBought, poke, onTap }: CityMapProps) {
  const byId = useMemo(() => new Map(views.map((v) => [v.item.id, v])), [views])
  const has = (id: string) => byId.get(id)?.state === 'owned'
  const [bursts, setBursts] = useState<readonly Burst[]>([])
  const [launching, setLaunching] = useState(false)

  // Fireworks: a burst on every tap, and on their own at night.
  const fireworks = has('fireworks')
  useEffect(() => {
    if (!fireworks || !night) return undefined
    const timer = window.setInterval(() => fire(), 2600)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fireworks, night])

  const fire = () => {
    const burst: Burst = {
      id: Date.now() + Math.random(),
      x: 520 + Math.random() * 400,
      y: 40 + Math.random() * 90,
      hue: Math.floor(Math.random() * 360),
    }
    setBursts((current) => [...current.slice(-5), burst])
    window.setTimeout(() => setBursts((current) => current.filter((b) => b.id !== burst.id)), 1600)
  }

  useEffect(() => {
    if (!poke) return undefined
    if (poke.id === 'fireworks') fire()
    if (poke.id === 'rocket') {
      setLaunching(true)
      const timer = window.setTimeout(() => setLaunching(false), 3600)
      return () => window.clearTimeout(timer)
    }
    return undefined
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [poke])

  const plotClass = (id: string) =>
    ['plot', justBought === id ? 'plot--pop' : '', poke?.id === id ? 'plot--bounce' : ''].join(' ')

  const stars = useMemo(
    () => Array.from({ length: 40 }, (_, i) => ({ x: (i * 173) % W, y: (i * 61) % (SKY - 30) + 8, d: (i % 5) * 0.6 })),
    [],
  )

  const bridge = has('bridge')
  const roadEnd = bridge ? W + 60 : BRIDGE_X - 60
  const mainRoad = `M -60 ${ROAD_MID} L ${roadEnd} ${ROAD_MID}`
  const mainRoadBack = `M ${roadEnd} ${ROAD_MID - 14} L -60 ${ROAD_MID - 14}`

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className={`map ${night ? 'map--night' : ''}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-label="Your city"
    >
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#0b0a2e' : '#60a5fa'} />
          <stop offset="1" stopColor={night ? '#2a1f63' : '#bfdbfe'} />
        </linearGradient>
        <linearGradient id="ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={night ? '#14532d' : '#4ade80'} />
          <stop offset="1" stopColor={night ? '#052e16' : '#16a34a'} />
        </linearGradient>
        <radialGradient id="glow">
          <stop offset="0" stopColor="#fde68a" stopOpacity="0.55" />
          <stop offset="1" stopColor="#fde68a" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* sky */}
      <rect x={0} y={0} width={W} height={SKY + 40} fill="url(#sky)" />
      {night ? (
        <g className="stars">
          {stars.map((s, i) => (
            <circle key={i} cx={s.x} cy={s.y} r={i % 3 === 0 ? 2.2 : 1.4} fill="#fff" className="star" style={{ animationDelay: `${s.d}s` }} />
          ))}
          <Emoji x={1080} y={60} size={54}>🌙</Emoji>
        </g>
      ) : (
        <Emoji x={1080} y={62} size={64} className="sun">☀️</Emoji>
      )}
      <g className="clouds">
        <Emoji x={0} y={50} size={56} className="cloud cloud--1">☁️</Emoji>
        <Emoji x={0} y={110} size={44} className="cloud cloud--2">☁️</Emoji>
        <Emoji x={0} y={80} size={66} className="cloud cloud--3">☁️</Emoji>
      </g>
      {!night ? (
        <g className="birds">
          <Emoji x={0} y={0} size={18} className="bird bird--1">🐦</Emoji>
          <Emoji x={0} y={0} size={14} className="bird bird--2">🐦</Emoji>
        </g>
      ) : null}

      {/* far hills */}
      <path d="M 0 200 Q 120 90 240 200 T 480 200 T 720 200 T 960 200 T 1200 200 V 260 H 0 Z" fill={night ? '#166534' : '#22c55e'} opacity="0.9" />
      <path d="M 20 205 L 120 70 L 220 205 Z" fill={night ? '#1e3a8a' : '#94a3b8'} />
      <path d="M 95 105 L 120 70 L 145 105 Z" fill="#fff" />
      <path d="M 840 205 Q 930 95 1020 205 Z" fill={night ? '#14532d' : '#4ade80'} />
      <path d="M 440 205 Q 520 120 600 205 Z" fill={night ? '#14532d' : '#4ade80'} />
      <path d="M 690 205 Q 760 125 830 205 Z" fill={night ? '#14532d' : '#4ade80'} />

      {/* ground */}
      <rect x={0} y={SKY + 30} width={W} height={H - SKY - 30} fill="url(#ground)" />

      {/* river */}
      <path d={RIVER} stroke={night ? '#1e40af' : '#38bdf8'} strokeWidth={70} fill="none" strokeLinecap="round" />
      <path d={RIVER} stroke={night ? '#60a5fa' : '#e0f2fe'} strokeWidth={8} fill="none" strokeDasharray="26 70" strokeLinecap="round" className="river-flow" opacity="0.5" />

      {/* rails and train */}
      {has('station') ? (
        <g>
          <line x1={-20} y1={RAIL_Y} x2={975} y2={RAIL_Y} stroke="#78716c" strokeWidth={10} />
          <line x1={-20} y1={RAIL_Y} x2={975} y2={RAIL_Y} stroke="#e7e5e4" strokeWidth={3} strokeDasharray="6 14" />
          <Mover path={`M -140 ${RAIL_Y - 14} L 1000 ${RAIL_Y - 14}`} dur={22} emoji="🚃🚃🚂" size={38} flip />
        </g>
      ) : null}

      {/* roads */}
      <rect x={-20} y={ROAD_Y - 8} width={BRIDGE_X - 40} height={ROAD_H + 16} fill="#e2e8f0" opacity={0.7} />
      <rect x={-20} y={ROAD_Y} width={BRIDGE_X - 40} height={ROAD_H} fill="#475569" />
      <line x1={-20} y1={ROAD_MID} x2={BRIDGE_X - 60} y2={ROAD_MID} stroke="#fde68a" strokeWidth={3} strokeDasharray="24 18" />
      {bridge ? (
        <g>
          <rect x={BRIDGE_X - 60} y={ROAD_Y - 6} width={120} height={ROAD_H + 12} rx={6} fill="#92400e" />
          <rect x={BRIDGE_X - 60} y={ROAD_Y} width={120} height={ROAD_H} fill="#57534e" />
          <line x1={BRIDGE_X - 60} y1={ROAD_Y - 10} x2={BRIDGE_X + 60} y2={ROAD_Y - 10} stroke="#f59e0b" strokeWidth={6} />
          <line x1={BRIDGE_X - 60} y1={ROAD_Y + ROAD_H + 10} x2={BRIDGE_X + 60} y2={ROAD_Y + ROAD_H + 10} stroke="#f59e0b" strokeWidth={6} />
        </g>
      ) : (
        <Emoji x={BRIDGE_X - 70} y={ROAD_MID} size={30}>🚧</Emoji>
      )}
      {has('road-east') ? (
        <g>
          <rect x={BRIDGE_X + 60} y={ROAD_Y} width={W - BRIDGE_X} height={ROAD_H} fill="#475569" />
          <line x1={BRIDGE_X + 60} y1={ROAD_MID} x2={W + 20} y2={ROAD_MID} stroke="#fde68a" strokeWidth={3} strokeDasharray="24 18" />
        </g>
      ) : null}
      {has('road-north') ? (
        <g>
          <rect x={V_ROAD_X} y={205} width={V_ROAD_W} height={ROAD_Y - 205} fill="#475569" />
          <line x1={V_ROAD_X + V_ROAD_W / 2} y1={210} x2={V_ROAD_X + V_ROAD_W / 2} y2={ROAD_Y} stroke="#fde68a" strokeWidth={3} strokeDasharray="24 18" />
        </g>
      ) : null}
      {has('road-south') ? (
        <g>
          <rect x={V_ROAD_X} y={ROAD_Y + ROAD_H} width={V_ROAD_W} height={RAIL_Y - 30 - ROAD_Y - ROAD_H} fill="#475569" />
          <line x1={V_ROAD_X + V_ROAD_W / 2} y1={ROAD_Y + ROAD_H} x2={V_ROAD_X + V_ROAD_W / 2} y2={RAIL_Y - 30} stroke="#fde68a" strokeWidth={3} strokeDasharray="24 18" />
        </g>
      ) : null}
      {has('lamps')
        ? [120, 330, 640, 860].map((x) => (
            <g key={x} className="lamp">
              <line x1={x} y1={ROAD_Y + ROAD_H + 8} x2={x} y2={ROAD_Y + ROAD_H + 34} stroke="#334155" strokeWidth={4} />
              <circle cx={x} cy={ROAD_Y + ROAD_H + 8} r={6} fill={night ? '#fde68a' : '#cbd5e1'} />
              {night ? <circle cx={x} cy={ROAD_Y + ROAD_H + 8} r={40} fill="url(#glow)" /> : null}
            </g>
          ))
        : null}

      {/* traffic */}
      <Mover path={mainRoad} dur={18} emoji="🚗" size={34} flip />
      <Mover path={mainRoadBack} dur={24} delay={9} emoji="🚕" size={34} />
      {has('busstop') ? <Mover path={mainRoad} dur={30} delay={14} emoji="🚌" size={38} flip /> : null}
      {has('tram') ? <Mover path={`M -60 ${ROAD_MID + 2} L ${roadEnd} ${ROAD_MID + 2}`} dur={34} delay={5} emoji="🚋" size={40} flip /> : null}
      {has('road-north') ? <Mover path={`M ${V_ROAD_X + 14} 190 L ${V_ROAD_X + 14} ${ROAD_Y + 10}`} dur={12} emoji="🚙" size={30} /> : null}
      {has('road-south') ? <Mover path={`M ${V_ROAD_X + 30} ${RAIL_Y - 30} L ${V_ROAD_X + 30} ${ROAD_Y + 30}`} dur={14} delay={6} emoji="🚐" size={30} /> : null}
      {has('firestation') ? <Mover path={mainRoadBack} dur={20} delay={3} emoji="🚒" size={36} /> : null}
      {has('police') ? <Mover path={mainRoad} dur={16} delay={11} emoji="🚓" size={34} flip /> : null}
      {has('house1') ? <Mover path={`M 40 ${ROAD_Y + ROAD_H + 22} L 540 ${ROAD_Y + ROAD_H + 22}`} dur={40} emoji="🚶" size={26} flip /> : null}
      {has('park') ? <Mover path={`M 540 ${ROAD_Y - 22} L 60 ${ROAD_Y - 22}`} dur={44} delay={10} emoji="🚶‍♀️🐕" size={24} /> : null}

      {/* water traffic */}
      {has('harbour') ? <Mover path={RIVER} dur={26} emoji="⛵" size={38} /> : null}
      {has('yacht') ? <Mover path={RIVER} dur={30} delay={15} emoji="🛥️" size={40} /> : null}
      {has('lighthouse') ? (
        <g transform="translate(1130 250)">
          <rect x={-14} y={-60} width={28} height={80} rx={4} fill="#fff" />
          <rect x={-14} y={-40} width={28} height={12} fill="#ef4444" />
          <rect x={-14} y={-10} width={28} height={12} fill="#ef4444" />
          <rect x={-18} y={-70} width={36} height={12} rx={3} fill="#1f2937" />
          <circle cx={0} cy={-64} r={5} fill="#fde68a" />
          <path d="M 0 -64 L 140 -104 L 140 -24 Z" fill="#fde68a" opacity={night ? 0.5 : 0.18} className="beam" />
        </g>
      ) : null}

      {/* air traffic */}
      {has('airport') ? (
        <g>
          <rect x={1060} y={690} width={130} height={16} rx={4} fill="#475569" />
          <Mover path="M 1120 690 Q 900 380 300 40 T -200 20" dur={16} emoji="✈️" size={40} />
        </g>
      ) : null}
      {has('hospital') ? <Emoji x={360} y={300} size={36} className="hover">🚁</Emoji> : null}
      {has('balloons') ? (
        <g>
          <Emoji x={300} y={420} size={40} className="balloon balloon--1">🎈</Emoji>
          <Emoji x={430} y={440} size={34} className="balloon balloon--2">🎈</Emoji>
          <Emoji x={560} y={400} size={46} className="balloon balloon--3">🎈</Emoji>
        </g>
      ) : null}

      {/* buildings */}
      {views.map(({ item, state }) => {
        if (state !== 'owned') {
          if (item.id === 'lighthouse' || item.id === 'yacht') {
            return <Sign key={item.id} item={{ ...item, y: item.id === 'yacht' ? 300 : 235 }} state={state} onTap={() => onTap(item.id)} />
          }
          return <Sign key={item.id} item={item} state={state} onTap={() => onTap(item.id)} />
        }
        if (item.size === 0) {
          // Roads, lights, balloons: the map draws them elsewhere; the tap target stays.
          if (item.id === 'fireworks' || item.id === 'rocket' || item.id === 'tram') {
            /* rendered below */
          }
          if (item.id !== 'fireworks') return null
        }
        return (
          <g
            key={item.id}
            className={plotClass(item.id)}
            transform={`translate(${item.x} ${item.y})`}
            onClick={() => onTap(item.id)}
            role="button"
            aria-label={item.name}
          >
            {night && item.kind === 'building' ? <circle cx={0} cy={item.size * 0.1} r={item.size * 0.8} fill="url(#glow)" /> : null}
            <ellipse cx={0} cy={item.size * 0.48} rx={item.size * 0.5} ry={item.size * 0.12} fill="#000" opacity={0.18} />
            <Plot item={item} launching={launching} />
          </g>
        )
      })}

      {/* fireworks */}
      {bursts.map((burst) => (
        <g key={burst.id} className="burst" transform={`translate(${burst.x} ${burst.y})`}>
          {Array.from({ length: 12 }, (_, i) => (
            <line
              key={i}
              x1={0}
              y1={0}
              x2={Math.cos((i / 12) * Math.PI * 2) * 60}
              y2={Math.sin((i / 12) * Math.PI * 2) * 60}
              stroke={`hsl(${burst.hue} 90% 65%)`}
              strokeWidth={4}
              strokeLinecap="round"
            />
          ))}
        </g>
      ))}
    </svg>
  )
}

/** What an owned plot looks like: mostly the emoji, sometimes a little scene. */
function Plot({ item, launching }: { readonly item: Building; readonly launching: boolean }) {
  switch (item.id) {
    case 'zoo':
      return (
        <g>
          <rect x={-80} y={-40} width={160} height={90} rx={14} fill="#a16207" opacity={0.25} stroke="#a16207" strokeWidth={4} strokeDasharray="10 8" />
          <Emoji x={-45} y={0} size={44} className="animal animal--1">🦁</Emoji>
          <Emoji x={8} y={-2} size={48} className="animal animal--2">🐘</Emoji>
          <Emoji x={58} y={-6} size={44} className="animal animal--3">🦒</Emoji>
          <Emoji x={-60} y={38} size={22}>🌴</Emoji>
          <Emoji x={70} y={38} size={22}>🌴</Emoji>
        </g>
      )
    case 'park':
      return (
        <g>
          <Emoji x={-42} y={0} size={48} className="sway">🌳</Emoji>
          <Emoji x={4} y={10} size={40}>🛝</Emoji>
          <Emoji x={48} y={-4} size={48} className="sway sway--late">🌳</Emoji>
        </g>
      )
    case 'forest':
      return (
        <g>
          <Emoji x={-34} y={-10} size={42} className="sway">🌲</Emoji>
          <Emoji x={0} y={10} size={44} className="sway sway--late">🌳</Emoji>
          <Emoji x={34} y={-8} size={40} className="sway">🌲</Emoji>
        </g>
      )
    case 'farm':
      return (
        <g>
          <Emoji x={-30} y={-20} size={30}>🐄</Emoji>
          <Emoji x={20} y={-24} size={26}>🐑</Emoji>
          <Emoji x={0} y={14} size={40} className="tractor">🚜</Emoji>
        </g>
      )
    case 'fountain':
      return (
        <g>
          <Emoji x={0} y={0} size={item.size}>⛲</Emoji>
          {[0, 1, 2].map((i) => (
            <circle key={i} cx={-10 + i * 10} cy={-20} r={3} fill="#bae6fd" className={`drop drop--${i}`} />
          ))}
        </g>
      )
    case 'ferris':
      return <Emoji x={0} y={0} size={item.size} className="spin">🎡</Emoji>
    case 'rocket':
      return (
        <g>
          <rect x={-30} y={26} width={60} height={10} rx={3} fill="#64748b" />
          <g className={launching ? 'rocket rocket--launch' : 'rocket'}>
            <Emoji x={0} y={0} size={item.size}>🚀</Emoji>
            {launching ? <Emoji x={0} y={40} size={40} className="flame">🔥</Emoji> : null}
          </g>
        </g>
      )
    case 'fireworks':
      return <Emoji x={0} y={0} size={44} className="twinkle">🎆</Emoji>
    case 'house1':
    case 'house2':
    case 'house3':
    case 'house4':
      return (
        <g>
          <Emoji x={0} y={0} size={item.size}>{item.emoji}</Emoji>
          <circle cx={14} cy={-30} r={5} fill="#e5e7eb" className="smoke smoke--1" />
          <circle cx={14} cy={-30} r={4} fill="#e5e7eb" className="smoke smoke--2" />
        </g>
      )
    case 'stadium':
      return (
        <g>
          <Emoji x={0} y={0} size={item.size}>🏟️</Emoji>
          <Emoji x={30} y={-30} size={22} className="bounce-ball">⚽</Emoji>
        </g>
      )
    case 'beach':
      return (
        <g>
          <Emoji x={0} y={0} size={item.size}>🏖️</Emoji>
          <Emoji x={-30} y={20} size={22} className="hover">🏄</Emoji>
        </g>
      )
    case 'circus':
      return (
        <g>
          <Emoji x={0} y={0} size={item.size}>🎪</Emoji>
          <Emoji x={34} y={22} size={24} className="hover">🤹</Emoji>
        </g>
      )
    case 'harbour':
      return <Emoji x={0} y={0} size={item.size}>⚓</Emoji>
    default:
      return <Emoji x={0} y={0} size={item.size}>{item.emoji}</Emoji>
  }
}
