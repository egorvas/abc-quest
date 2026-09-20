import type { ReactNode } from 'react'
import './Screen.css'

interface ScreenProps {
  readonly children: ReactNode
  /** Extra class for per-screen background tweaks. */
  readonly className?: string
}

/** Full-viewport layout that respects the iPad safe areas. */
export function Screen({ children, className }: ScreenProps) {
  return <div className={`screen ${className ?? ''}`}>{children}</div>
}

interface TopBarProps {
  readonly left?: ReactNode
  readonly center?: ReactNode
  readonly right?: ReactNode
}

export function TopBar({ left, center, right }: TopBarProps) {
  return (
    <header className="topbar">
      <div className="topbar__side">{left}</div>
      <div className="topbar__center">{center}</div>
      <div className="topbar__side topbar__side--right">{right}</div>
    </header>
  )
}
