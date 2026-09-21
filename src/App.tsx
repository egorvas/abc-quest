import { useEffect, useState } from 'react'
import { GameProvider, useGame } from './state/GameContext'
import { HomeScreen } from './screens/HomeScreen'
import { SessionScreen } from './screens/SessionScreen'
import { TownScreen } from './screens/TownScreen'
import { ParentsScreen } from './screens/ParentsScreen'
import { ProfilesScreen } from './screens/ProfilesScreen'
import { KnownLettersScreen } from './screens/KnownLettersScreen'
import { SurveyScreen } from './screens/SurveyScreen'
import { PathScreen } from './screens/PathScreen'
import { GamesScreen } from './screens/GamesScreen'
import type { ModeId } from './modes/types'
import type { LetterId } from './data/letters'
import type { SlotId } from './storage/schema'
import { unlockAudio } from './audio/sfx'
import { warmUpSpeech } from './audio/speak'
import { claimPlaybackSession, keepScreenAwake, watchAudioSession } from './audio/session'

type Route =
  | { readonly name: 'home' }
  | {
      readonly name: 'session'
      readonly modeIds?: readonly ModeId[]
      readonly focus?: LetterId
      readonly lesson?: string
    }
  | { readonly name: 'path' }
  | { readonly name: 'games' }
  | { readonly name: 'survey' }
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
  // lesson, so the path starts where the child actually is.
  if (!profile.placed && route.name === 'home') {
    return <SurveyScreen onDone={() => setRoute({ name: 'home' })} />
  }

  switch (route.name) {
    case 'session':
      return (
        <SessionScreen
          key={route.lesson ?? route.focus ?? route.modeIds?.join(',') ?? 'mixed'}
          modeIds={route.modeIds}
          focus={route.focus}
          lesson={route.lesson}
          onHome={() => setRoute({ name: 'home' })}
          onTown={(open) => setRoute({ name: 'town', open })}
          onLesson={(lesson) => setRoute({ name: 'session', lesson })}
          onPath={() => setRoute({ name: 'path' })}
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
          onSurvey={() => setRoute({ name: 'survey' })}
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
    case 'survey':
      return (
        <SurveyScreen
          onDone={() => setRoute({ name: 'home' })}
          onCancel={() => setRoute({ name: 'parents' })}
        />
      )
    case 'path':
      return (
        <PathScreen
          onBack={() => setRoute({ name: 'home' })}
          onLesson={(lesson) => setRoute({ name: 'session', lesson })}
        />
      )
    case 'games':
      return (
        <GamesScreen
          onBack={() => setRoute({ name: 'home' })}
          onPlay={() => setRoute({ name: 'session' })}
          onPickMode={(modeId) => setRoute({ name: 'session', modeIds: [modeId] })}
        />
      )
    case 'profiles':
      return <ProfilesScreen onDone={() => setRoute({ name: 'home' })} canCancel />
    default:
      return (
        <HomeScreen
          onLearn={(lesson) => setRoute({ name: 'session', lesson })}
          onPath={() => setRoute({ name: 'path' })}
          onGames={() => setRoute({ name: 'games' })}
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
