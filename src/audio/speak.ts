/**
 * Text-to-speech for the English prompts.
 *
 * iOS Safari loads voices asynchronously and refuses to speak before a user
 * gesture, so the module warms up on the first tap and picks an English voice
 * once the list arrives.
 */

let voices: SpeechSynthesisVoice[] = []
let preferred: SpeechSynthesisVoice | null = null
let warmed = false

const PREFERRED_NAMES = [
  'Samantha', // iOS/macOS en-US default, very clear
  'Karen',
  'Daniel',
  'Google US English',
  'Microsoft Aria Online (Natural) - English (United States)',
]

function refreshVoices(): void {
  if (!('speechSynthesis' in window)) return
  voices = window.speechSynthesis.getVoices()
  if (voices.length === 0) return

  const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang))
  const byName = english.find((v) => PREFERRED_NAMES.includes(v.name))
  const us = english.find((v) => /^en[-_]US/i.test(v.lang))
  preferred = byName ?? us ?? english[0] ?? null
}

if ('speechSynthesis' in window) {
  refreshVoices()
  window.speechSynthesis.addEventListener('voiceschanged', refreshVoices)
}

export function ttsSupported(): boolean {
  return 'speechSynthesis' in window
}

/** Must run inside a user gesture; unlocks speech on iOS. */
export function warmUpSpeech(): void {
  if (warmed || !ttsSupported()) return
  warmed = true
  try {
    const u = new SpeechSynthesisUtterance(' ')
    u.volume = 0
    window.speechSynthesis.speak(u)
    refreshVoices()
  } catch {
    /* best effort */
  }
}

export interface SpeakOptions {
  readonly rate?: number
  readonly pitch?: number
  /** Cancel anything currently being spoken. Default true. */
  readonly interrupt?: boolean
}

export function speak(text: string, options: SpeakOptions = {}): Promise<void> {
  if (!ttsSupported()) return Promise.resolve()
  const synth = window.speechSynthesis
  if (options.interrupt !== false) synth.cancel()

  return new Promise<void>((resolve) => {
    try {
      const u = new SpeechSynthesisUtterance(text)
      u.lang = preferred?.lang ?? 'en-US'
      if (preferred) u.voice = preferred
      u.rate = options.rate ?? 0.85 // slower than default: a child is listening
      u.pitch = options.pitch ?? 1.1
      let settled = false
      const done = () => {
        if (settled) return
        settled = true
        resolve()
      }
      u.onend = done
      u.onerror = done
      // Safari sometimes drops onend entirely; never leave a caller hanging.
      window.setTimeout(done, 400 + text.length * 120)
      synth.speak(u)
    } catch {
      resolve()
    }
  })
}

/** Speaks a letter name clearly, e.g. "A" -> "ay". */
export function speakLetterName(name: string): Promise<void> {
  return speak(name, { rate: 0.75, pitch: 1.15 })
}
