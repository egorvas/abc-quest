import { useCallback, useEffect, useRef, useState } from 'react'
import './TraceCanvas.css'

export interface TraceScore {
  /** Share of the letter shape the child covered, 0..1. */
  readonly coverage: number
  /** Share of the drawing that landed on the letter, 0..1. */
  readonly precision: number
}

interface TraceCanvasProps {
  readonly glyph: string
  readonly onScore: (score: TraceScore) => void
  /** Bumped by the parent to wipe the drawing. */
  readonly resetKey: number
  readonly disabled?: boolean
}

const PEN_WIDTH = 34
/** How far outside the glyph still counts as "on the line". */
const TOLERANCE = 22

/**
 * Finger tracing without per-letter path data: the target glyph is rasterised
 * into a hidden mask, and the child's strokes are scored against it. Works for
 * any glyph in any font, upper or lower case.
 */
export function TraceCanvas({ glyph, onScore, resetKey, disabled = false }: TraceCanvasProps) {
  const hostRef = useRef<HTMLDivElement>(null)
  const inkRef = useRef<HTMLCanvasElement>(null)
  const maskRef = useRef<HTMLCanvasElement | null>(null)
  const maskDataRef = useRef<Uint8Array | null>(null)
  const drawingRef = useRef(false)
  const lastRef = useRef<{ x: number; y: number } | null>(null)
  const [size, setSize] = useState({ w: 0, h: 0 })

  // Track the host size so the canvas stays crisp on rotation.
  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    const apply = () => {
      const rect = host.getBoundingClientRect()
      setSize({ w: Math.round(rect.width), h: Math.round(rect.height) })
    }
    apply()
    const ro = new ResizeObserver(apply)
    ro.observe(host)
    return () => ro.disconnect()
  }, [])

  /** Rasterise the glyph and build a dilated hit mask. */
  const buildMask = useCallback(() => {
    const { w, h } = size
    if (w === 0 || h === 0) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    const mask = maskRef.current ?? document.createElement('canvas')
    maskRef.current = mask
    mask.width = Math.round(w * dpr)
    mask.height = Math.round(h * dpr)
    const mctx = mask.getContext('2d', { willReadFrequently: true })
    if (!mctx) return
    mctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    mctx.clearRect(0, 0, w, h)
    mctx.fillStyle = '#fff'
    mctx.textAlign = 'center'
    mctx.textBaseline = 'middle'
    const fontSize = Math.min(w, h) * 0.82
    mctx.font = `800 ${fontSize}px 'Baloo 2', 'Nunito', sans-serif`
    mctx.fillText(glyph, w / 2, h / 2)

    const img = mctx.getImageData(0, 0, mask.width, mask.height)
    const px = img.data
    const solid = new Uint8Array(mask.width * mask.height)
    for (let i = 0; i < solid.length; i += 1) {
      solid[i] = px[i * 4 + 3] > 60 ? 1 : 0
    }
    maskDataRef.current = solid
  }, [glyph, size])

  useEffect(() => {
    buildMask()
  }, [buildMask])

  // Clear the ink layer whenever the parent asks for a fresh attempt.
  useEffect(() => {
    const ink = inkRef.current
    if (!ink) return
    const ictx = ink.getContext('2d')
    ictx?.clearRect(0, 0, ink.width, ink.height)
    lastRef.current = null
  }, [resetKey, size])

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    return { x: event.clientX - rect.left, y: event.clientY - rect.top }
  }

  const strokeTo = (x: number, y: number) => {
    const ink = inkRef.current
    if (!ink) return
    const ictx = ink.getContext('2d')
    if (!ictx) return
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    ictx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ictx.lineCap = 'round'
    ictx.lineJoin = 'round'
    ictx.lineWidth = PEN_WIDTH
    ictx.strokeStyle = '#fbbf24'
    const from = lastRef.current ?? { x, y }
    ictx.beginPath()
    ictx.moveTo(from.x, from.y)
    ictx.lineTo(x, y)
    ictx.stroke()
    lastRef.current = { x, y }
  }

  const score = (): TraceScore => {
    const ink = inkRef.current
    const mask = maskRef.current
    const solid = maskDataRef.current
    if (!ink || !mask || !solid) return { coverage: 0, precision: 0 }
    const ictx = ink.getContext('2d', { willReadFrequently: true })
    if (!ictx) return { coverage: 0, precision: 0 }

    const w = ink.width
    const h = ink.height
    const img = ictx.getImageData(0, 0, w, h).data

    // Sample on a grid: full-resolution scanning is needlessly slow on iPad.
    const step = 3
    const radius = Math.max(1, Math.round((TOLERANCE * (w / Math.max(1, size.w))) / step))
    let glyphCells = 0
    let coveredCells = 0
    let inkCells = 0
    let inkOnGlyph = 0

    const nearGlyph = (gx: number, gy: number): boolean => {
      for (let dy = -radius; dy <= radius; dy += 1) {
        const yy = gy + dy * step
        if (yy < 0 || yy >= h) continue
        for (let dx = -radius; dx <= radius; dx += 1) {
          const xx = gx + dx * step
          if (xx < 0 || xx >= w) continue
          if (solid[yy * w + xx] === 1) return true
        }
      }
      return false
    }

    for (let y = 0; y < h; y += step) {
      for (let x = 0; x < w; x += step) {
        const idx = y * w + x
        const isGlyph = solid[idx] === 1
        const isInk = img[idx * 4 + 3] > 40
        if (isGlyph) {
          glyphCells += 1
          // A glyph pixel counts as covered when ink lies within the pen width.
          if (isInk) coveredCells += 1
        }
        if (isInk) {
          inkCells += 1
          if (isGlyph || nearGlyph(x, y)) inkOnGlyph += 1
        }
      }
    }

    return {
      coverage: glyphCells === 0 ? 0 : coveredCells / glyphCells,
      precision: inkCells === 0 ? 0 : inkOnGlyph / inkCells,
    }
  }

  const finish = () => {
    if (!drawingRef.current) return
    drawingRef.current = false
    lastRef.current = null
    onScore(score())
  }

  const dpr = Math.min(window.devicePixelRatio || 1, 2)

  return (
    <div className="trace" ref={hostRef}>
      <div className="trace__ghost" aria-hidden="true">
        {glyph}
      </div>
      <canvas
        ref={inkRef}
        className="trace__ink"
        width={Math.round(size.w * dpr)}
        height={Math.round(size.h * dpr)}
        style={{ width: size.w, height: size.h }}
        onPointerDown={(e) => {
          if (disabled) return
          e.currentTarget.setPointerCapture(e.pointerId)
          drawingRef.current = true
          const p = pointFrom(e)
          lastRef.current = p
          strokeTo(p.x, p.y)
        }}
        onPointerMove={(e) => {
          if (!drawingRef.current || disabled) return
          const p = pointFrom(e)
          strokeTo(p.x, p.y)
        }}
        onPointerUp={finish}
        onPointerCancel={finish}
        onPointerLeave={finish}
      />
    </div>
  )
}
