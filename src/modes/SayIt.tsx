import { useEffect, useRef, useState } from 'react'
import { letterInfo } from '../data/letters'
import { useAttempt } from './useAttempt'
import type { ModeProps } from './types'
import { MicButton, type MicState } from '../ui/MicButton'
import { Button } from '../ui/Button'
import { listenOnce, speechRecognitionSupported, type ListenHandle } from '../speech/recognizer'
import { judgeTranscripts } from '../speech/letterAliases'
import { playLetterNote } from '../audio/letterNote'
import { speak, speakLetterName } from '../audio/speak'
import { haptic } from '../audio/haptics'
import { sfx } from '../audio/sfx'
import { cheerSmall } from '../ui/celebrate'
import './modes.css'
import './SayIt.css'

/**
 * See the glyph, say its name out loud.
 *
 * The most valuable exercise in the app: production evidence is the only kind
 * that cannot be faked by tapping, and it is what grows a garden bed to its
 * final stage.
 *
 * Speech recognition on iPad is unreliable with a child's voice, so it is
 * treated as a bonus rather than a requirement. After two failed listens the
 * mode turns into "say it with me", which cannot be failed and still teaches.
 */
export function SayIt({ item, onDone, seq }: ModeProps) {
  const tracker = useAttempt(item, seq, onDone)
  const [mic, setMic] = useState<MicState>('idle')
  const [note, setNote] = useState('')
  const [echoMode, setEchoMode] = useState(!speechRecognitionSupported())
  const handle = useRef<ListenHandle | null>(null)
  const info = letterInfo(item.letter)
  const glyph = item.glyphCase === 'lower' ? info.lower : item.letter

  useEffect(() => {
    setMic('idle')
    setNote('')
    setEchoMode(!speechRecognitionSupported())
    return () => handle.current?.stop()
  }, [seq])

  // The question itself is spoken once, then the microphone waits.
  useEffect(() => {
    const timer = window.setTimeout(() => {
      void speak('What letter is this?')
    }, 300)
    return () => window.clearTimeout(timer)
  }, [seq])

  const succeed = (assistedByEcho: boolean) => {
    playLetterNote(item.letter)
    haptic('success')
    if (!assistedByEcho) cheerSmall()
    void speakLetterName(info.name)
    window.setTimeout(() => tracker.finish(assistedByEcho ? 'almost' : 'right', 1), 900)
  }

  const startListening = () => {
    if (mic === 'listening') {
      handle.current?.stop()
      return
    }
    setNote('')
    setMic('listening')
    const listener = listenOnce({
      maxMs: 5000,
      onListening: () => setMic('listening'),
      onSpeech: () => setMic('hearing'),
    })
    handle.current = listener

    void listener.result.then((outcome) => {
      if (outcome.kind === 'unsupported' || outcome.kind === 'denied') {
        setEchoMode(true)
        setMic('blocked')
        setNote('Микрофон недоступен — скажем вместе')
        return
      }
      if (outcome.kind === 'silence' || outcome.kind === 'error') {
        setMic('idle')
        setNote('Не расслышал. Попробуй ещё разок!')
        tracker.registerMiss(null)
        if (tracker.misses + 1 >= 2) setEchoMode(true)
        return
      }

      setMic('thinking')
      const verdict = judgeTranscripts(item.letter, outcome.transcripts)
      if (verdict.kind === 'match') {
        setMic('idle')
        succeed(false)
        return
      }
      if (verdict.kind === 'other') {
        sfx('wrong')
        setMic('idle')
        setNote(`Услышал «${letterInfo(verdict.heard).name}». Попробуй ещё!`)
        tracker.registerMiss(verdict.heard)
      } else {
        setMic('idle')
        setNote('Не расслышал. Попробуй ещё разок!')
        tracker.registerMiss(null)
      }
      if (tracker.misses + 1 >= 2) setEchoMode(true)
    })
  }

  const echo = () => {
    void speakLetterName(info.name).then(() => {
      window.setTimeout(() => succeed(true), 400)
    })
  }

  return (
    <div className="mode">
      <div className="sayit__ring">
        <span className="sayit__glyph">{glyph}</span>
      </div>

      {echoMode ? (
        <div className="sayit__echo">
          <p className="mode__hint">Скажи вместе со мной</p>
          <Button onPress={echo} tone="mint" size="lg">
            🔁 Повторяем: {info.name}
          </Button>
        </div>
      ) : (
        <>
          <MicButton state={mic} onPress={startListening} />
          <p className="mode__hint">{note}</p>
        </>
      )}
    </div>
  )
}
