/**
 * Thin wrapper over the Web Speech API.
 *
 * Safari only exposes `webkitSpeechRecognition`, refuses to start outside a
 * user gesture, and gets into a wedged state if an instance is reused, so a
 * fresh recogniser is created for every attempt and always torn down.
 */

type RecognitionCtor = new () => SpeechRecognitionLike

interface SpeechRecognitionLike {
  lang: string
  continuous: boolean
  interimResults: boolean
  maxAlternatives: number
  start: () => void
  stop: () => void
  abort: () => void
  onresult: ((event: SpeechRecognitionEventLike) => void) | null
  onerror: ((event: { error: string }) => void) | null
  onend: (() => void) | null
  onaudiostart: (() => void) | null
  onspeechstart: (() => void) | null
}

interface SpeechRecognitionEventLike {
  readonly results: ArrayLike<
    ArrayLike<{ transcript: string; confidence: number }> & { isFinal: boolean }
  >
}

function ctor(): RecognitionCtor | null {
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor
    webkitSpeechRecognition?: RecognitionCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function speechRecognitionSupported(): boolean {
  return ctor() !== null
}

export type ListenOutcome =
  | { readonly kind: 'heard'; readonly transcripts: readonly string[] }
  | { readonly kind: 'silence' }
  | { readonly kind: 'denied' }
  | { readonly kind: 'unsupported' }
  | { readonly kind: 'error'; readonly code: string }

export interface ListenHandle {
  /** Resolves once with the outcome. */
  readonly result: Promise<ListenOutcome>
  /** Stop listening early, e.g. the child tapped the mic again. */
  readonly stop: () => void
}

export interface ListenOptions {
  /** Hard stop, ms. Safari's own timeout is unreliable. */
  readonly maxMs?: number
  readonly lang?: string
  /** Fired when the microphone actually opens, to drive the UI. */
  readonly onListening?: () => void
  /** Fired when speech is first detected. */
  readonly onSpeech?: () => void
}

/**
 * Listens once. Must be called from inside a user gesture on iOS.
 */
export function listenOnce(options: ListenOptions = {}): ListenHandle {
  const Ctor = ctor()
  if (!Ctor) {
    return {
      result: Promise.resolve<ListenOutcome>({ kind: 'unsupported' }),
      stop: () => {},
    }
  }

  let settle: (outcome: ListenOutcome) => void = () => {}
  const result = new Promise<ListenOutcome>((resolve) => {
    settle = resolve
  })

  const rec = new Ctor()
  rec.lang = options.lang ?? 'en-US'
  rec.continuous = false
  rec.interimResults = true
  rec.maxAlternatives = 5

  let done = false
  let best: string[] = []
  let timer = 0

  const finish = (outcome: ListenOutcome) => {
    if (done) return
    done = true
    window.clearTimeout(timer)
    rec.onresult = null
    rec.onerror = null
    rec.onend = null
    try {
      rec.abort()
    } catch {
      /* already stopped */
    }
    settle(outcome)
  }

  rec.onaudiostart = () => options.onListening?.()
  rec.onspeechstart = () => options.onSpeech?.()

  rec.onresult = (event) => {
    const collected: string[] = []
    for (let i = 0; i < event.results.length; i += 1) {
      const alternatives = event.results[i]
      for (let j = 0; j < alternatives.length; j += 1) {
        const text = alternatives[j]?.transcript
        if (text) collected.push(text)
      }
      if (alternatives.isFinal && collected.length > 0) {
        finish({ kind: 'heard', transcripts: collected })
        return
      }
    }
    // Interim results: remember them, a final one may never arrive on Safari.
    if (collected.length > 0) best = collected
  }

  rec.onerror = (event) => {
    if (event.error === 'no-speech') finish({ kind: 'silence' })
    else if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
      finish({ kind: 'denied' })
    } else if (event.error === 'aborted') finish({ kind: 'silence' })
    else finish({ kind: 'error', code: event.error })
  }

  rec.onend = () => {
    if (best.length > 0) finish({ kind: 'heard', transcripts: best })
    else finish({ kind: 'silence' })
  }

  timer = window.setTimeout(() => {
    if (best.length > 0) finish({ kind: 'heard', transcripts: best })
    else {
      try {
        rec.stop()
      } catch {
        finish({ kind: 'silence' })
      }
    }
  }, options.maxMs ?? 4000)

  try {
    rec.start()
  } catch {
    finish({ kind: 'error', code: 'start-failed' })
  }

  return {
    result,
    stop: () => {
      if (best.length > 0) finish({ kind: 'heard', transcripts: best })
      else
        try {
          rec.stop()
        } catch {
          finish({ kind: 'silence' })
        }
    },
  }
}
