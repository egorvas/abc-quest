import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App'
import './styles/base.css'

// Two-finger pinch and double-tap zoom make a touch game unplayable when a
// child rests a palm on the screen. The viewport meta stops most of it; Safari
// still needs these.
document.addEventListener(
  'gesturestart',
  (event) => event.preventDefault(),
  { passive: false },
)
let lastTouch = 0
document.addEventListener(
  'touchend',
  (event) => {
    const now = Date.now()
    if (now - lastTouch < 300) event.preventDefault()
    lastTouch = now
  },
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
