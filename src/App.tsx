import { useEffect, useState } from 'react'
import { GameProvider, useGame } from './state/GameContext'
import { HomeScreen } from './screens/HomeScreen'
import { SessionScreen } from './screens/SessionScreen'
import { TownScreen } from './screens/TownScreen'
import { ParentsScreen } from './screens/ParentsScreen'
import { ProfilesScreen } from './screens/ProfilesScreen'
import { KnownLettersScreen } from './screens/KnownLettersScreen'
import type { ModeId } from './modes/types'
import type { LetterId } from './data/letters'
import type { SlotId } from './storage/schema'
import { unlockAudio } from './audio/sfx'
import { warmUpSpeech } from './audio/speak'
import { claimPlaybackSession, keepScreenAwake, watchAudioSession } from './audio/session'

type Route =
  | { readonly name: 'home' }
  | { readonly name: 'session'; readonly modeIds?: readonly ModeId[]; readonly focus?: LetterId }
  | { readonly name: 'town'; readonly open?: { readonly letter: LetterId; readonly slot: SlotId } }
  | { readonly name: 'parents' }
  | { readonly name: 'profiles' }
  | { readonly name: 'known' }

function Router() {
  const { profile } = useGame()
  const [route, setRoute] = useState<Route>({ name: 'home' })

  // iOS only lets audio and speech start from inside a gesture, and the
  // restriction is re-armed on every page load, so the first completed tap
  // unlocks both for the rest of the visit. It listens for the end of the
  // gesture, not the start: that is what WebKit counts as activation.
  useEffect(() => {
    const unlock = () => {
      claimPlaybackSession()
      unlockAudio()
      warmUpSpeech()
      void keepScreenAwake()
    }
    window.addEventListener('touchend', unlock, { once: true })
    window.addEventListener('click', unlock, { once: true })
    const stopWatching = watchAudioSession()
    return () => {
      window.removeEventListener('touchend', unlock)
      window.removeEventListener('click', unlock)
      stopWatching()
    }
  }, [])

  if (!profile) {
    return <ProfilesScreen onDone={() => setRoute({ name: 'home' })} canCancel={false} />
  }

  // A brand-new profile is asked what the child already knows before the first
  // round, so the very first questions are aimed at the actual gaps.
  if (!profile.placed && route.name === 'home') {
    return (
      <KnownLettersScreen
        firstRun
        onDone={() => setRoute({ name: 'home' })}
        onSkip={() => setRoute({ name: 'home' })}
      />
    )
  }

  switch (route.name) {
    case 'session':
      return (
        <SessionScreen
          modeIds={route.modeIds}
          focus={route.focus}
          onHome={() => setRoute({ name: 'home' })}
          onTown={(open) => setRoute({ name: 'town', open })}
        />
      )
    case 'town':
      return (
        <TownScreen
          open={route.open}
          onBack={() => setRoute({ name: 'home' })}
          onPlayLetter={(letter) => setRoute({ name: 'session', focus: letter })}
        />
      )
    case 'parents':
      return (
        <ParentsScreen
          onBack={() => setRoute({ name: 'home' })}
          onEditKnown={() => setRoute({ name: 'known' })}
        />
      )
    case 'known':
      return (
        <KnownLettersScreen
          firstRun={false}
          onDone={() => setRoute({ name: 'home' })}
          onSkip={() => setRoute({ name: 'parents' })}
        />
      )
    case 'profiles':
      return <ProfilesScreen onDone={() => setRoute({ name: 'home' })} canCancel />
    default:
      return (
        <HomeScreen
          onPlay={() => setRoute({ name: 'session' })}
          onPickMode={(modeId) => setRoute({ name: 'session', modeIds: [modeId] })}
          onTown={() => setRoute({ name: 'town' })}
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
