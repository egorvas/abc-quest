import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import { claimPlaybackSession } from './audio/session'
import { audioNodes } from './audio/sfx'
import { attachAudio } from './audio/voice'
import './styles/base.css'

// Must run before any AudioContext exists, or the ringer switch mutes the app.
claimPlaybackSession()
// The voice plays through the same context the effects unlock on first touch.
attachAudio(audioNodes)

// Pinch zoom is disabled through `touch-action` in the stylesheet, but Safari's
// own gesture events fire regardless, and a child resting a palm on the screen
// triggers them constantly. These listeners must be non-passive: since iOS 11.3
// touch and gesture listeners on window and document default to passive.
document.addEventListener(
  'gesturestart',
  (event) => event.preventDefault(),
  { passive: false },
)
document.addEventListener(
  'gesturechange',
  (event) => event.preventDefault(),
  { passive: false },
)

const root = document.getElementById('root')
if (root) {
  createRoot(root).render(
    <StrictMode>
      <App />
    </StrictMode>,
  )
}
