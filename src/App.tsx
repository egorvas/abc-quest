import { useEffect, useState } from 'react'
import { GameProvider, useGame } from './state/GameContext'
import { HomeScreen } from './screens/HomeScreen'
import { SessionScreen } from './screens/SessionScreen'
import { GardenScreen } from './screens/GardenScreen'
import { ParentsScreen } from './screens/ParentsScreen'
import { ProfilesScreen } from './screens/ProfilesScreen'
import type { ModeId } from './modes/types'
import { unlockAudio } from './audio/sfx'
import { warmUpSpeech } from './audio/speak'

type Route =
  | { readonly name: 'home' }
  | { readonly name: 'session'; readonly modeIds?: readonly ModeId[] }
  | { readonly name: 'garden' }
  | { readonly name: 'parents' }
  | { readonly name: 'profiles' }

function Router() {
  const { profile } = useGame()
  const [route, setRoute] = useState<Route>({ name: 'home' })

  // iOS only lets audio and speech start from inside a gesture, so the very
  // first touch anywhere unlocks both for the rest of the visit.
  useEffect(() => {
    const unlock = () => {
      unlockAudio()
      warmUpSpeech()
    }
    window.addEventListener('pointerdown', unlock, { once: true })
    return () => window.removeEventListener('pointerdown', unlock)
  }, [])

  if (!profile) {
    return <ProfilesScreen onDone={() => setRoute({ name: 'home' })} canCancel={false} />
  }

  switch (route.name) {
    case 'session':
      return (
        <SessionScreen
          modeIds={route.modeIds}
          onExit={() =>
            setRoute(route.modeIds ? { name: 'home' } : { name: 'garden' })
          }
        />
      )
    case 'garden':
      return <GardenScreen onBack={() => setRoute({ name: 'home' })} />
    case 'parents':
      return <ParentsScreen onBack={() => setRoute({ name: 'home' })} />
    case 'profiles':
      return <ProfilesScreen onDone={() => setRoute({ name: 'home' })} canCancel />
    default:
      return (
        <HomeScreen
          onPlay={() => setRoute({ name: 'session' })}
          onPickMode={(modeId) => setRoute({ name: 'session', modeIds: [modeId] })}
          onGarden={() => setRoute({ name: 'garden' })}
          onParents={() => setRoute({ name: 'parents' })}
          onProfiles={() => setRoute({ name: 'profiles' })}
        />
      )
  }
}

export default function App() {
  return (
    <GameProvider>
      <Router />
    </GameProvider>
  )
}
