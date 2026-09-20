import confetti from 'canvas-confetti'

const KID_COLORS = ['#fbbf24', '#ec4899', '#34d399', '#38bdf8', '#a3e635', '#fb7185']

/** Small burst for a single correct answer. */
export function cheerSmall(): void {
  void confetti({
    particleCount: 34,
    spread: 62,
    startVelocity: 32,
    scalar: 0.9,
    origin: { y: 0.65 },
    colors: KID_COLORS,
    disableForReducedMotion: true,
  })
}

/** Big burst for finishing a session or mastering a letter. */
export function cheerBig(): void {
  const shots = [0, 180, 360]
  for (const delay of shots) {
    window.setTimeout(() => {
      void confetti({
        particleCount: 90,
        spread: 100,
        startVelocity: 46,
        origin: { x: 0.2 + Math.random() * 0.6, y: 0.55 },
        colors: KID_COLORS,
        disableForReducedMotion: true,
      })
    }, delay)
  }
}

/** Star-shaped sparkle, used when a letter turns gold. */
export function cheerStar(): void {
  void confetti({
    particleCount: 50,
    spread: 360,
    startVelocity: 22,
    ticks: 90,
    shapes: ['star'],
    scalar: 1.2,
    origin: { y: 0.45 },
    colors: ['#fbbf24', '#fde047', '#fef3c7'],
    disableForReducedMotion: true,
  })
}
