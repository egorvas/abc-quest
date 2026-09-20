/**
 * Vibration feedback. iOS Safari does not implement the Vibration API, so this
 * is a no-op there; it still helps on Android tablets and keeps call sites
 * free of feature checks.
 */

type Pattern = 'light' | 'success' | 'error'

const PATTERNS: Record<Pattern, number | readonly number[]> = {
  light: 12,
  success: [18, 40, 18],
  error: [30, 60, 30],
}

export function haptic(pattern: Pattern): void {
  try {
    navigator.vibrate?.(PATTERNS[pattern] as number | number[])
  } catch {
    /* ignore */
  }
}
