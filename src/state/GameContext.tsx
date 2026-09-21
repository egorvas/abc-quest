import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import type { Profile, Settings, Store } from '../storage/schema'
import { buyBuilding } from '../engine/city'
import { newProfile } from '../storage/schema'
import {
  activeProfile,
  loadStore,
  removeProfile,
  saveStore,
  upsertProfile,
} from '../storage/store'
import type { Attempt } from '../modes/types'
import {
  applyAttempt,
  finishRound,
  introduceLetters,
  placeKnownLetters,
  type RoundResult,
} from '../engine/apply'
import { finishLevel, restartLevels, skipLevels } from '../engine/levels'
import type { LetterId } from '../data/letters'
import { setMuted } from '../audio/sfx'

interface GameValue {
  readonly store: Store
  readonly profile: Profile | null
  readonly saveFailed: boolean
  readonly createProfile: (name: string, avatar: string) => void
  readonly selectProfile: (id: string) => void
  readonly deleteProfile: (id: string) => void
  readonly updateSettings: (patch: Partial<Settings>) => void
  readonly recordAttempt: (attempt: Attempt) => void
  readonly introduce: (letters: readonly LetterId[]) => void
  /** Answer to "which letters does the child already know". */
  readonly placeKnown: (letters: readonly LetterId[]) => void
  /** A level was passed; stars only ever go up, the last one opens the town. */
  readonly passLevel: (n: number, stars: number) => void
  /** Parent-side: skip ahead, or start the climb over. */
  readonly skipLevels: (count: number) => void
  readonly restartLevels: () => void
  readonly closeRound: (result: RoundResult) => void
  /** Buys and places a city building. A refused purchase changes nothing. */
  readonly buy: (id: string) => void
  readonly importStore: (store: Store) => void
}

const GameContext = createContext<GameValue | null>(null)

export function GameProvider({ children }: { readonly children: ReactNode }) {
  const [store, setStore] = useState<Store>(() => loadStore())
  const [saveFailed, setSaveFailed] = useState(false)
  // Writes are debounced: a session fires an update per answer, and localStorage
  // on iPad is synchronous enough to stutter an animation.
  const pending = useRef<number | null>(null)

  useEffect(() => {
    if (pending.current !== null) window.clearTimeout(pending.current)
    pending.current = window.setTimeout(() => {
      const ok = saveStore(store)
      setSaveFailed(!ok)
    }, 250)
    return () => {
      if (pending.current !== null) window.clearTimeout(pending.current)
    }
  }, [store])

  // Flush immediately when the page is backgrounded: iOS may never come back.
  useEffect(() => {
    const flush = () => {
      if (document.visibilityState === 'hidden') saveStore(store)
    }
    document.addEventListener('visibilitychange', flush)
    window.addEventListener('pagehide', flush)
    return () => {
      document.removeEventListener('visibilitychange', flush)
      window.removeEventListener('pagehide', flush)
    }
  }, [store])

  const profile = useMemo(() => activeProfile(store), [store])

  useEffect(() => {
    setMuted(profile ? !profile.settings.soundEnabled : false)
  }, [profile])

  const patchProfile = useCallback(
    (fn: (current: Profile) => Profile) => {
      setStore((current) => {
        const target = activeProfile(current)
        if (!target) return current
        return upsertProfile(current, fn(target))
      })
    },
    [],
  )

  const value: GameValue = useMemo(
    () => ({
      store,
      profile,
      saveFailed,
      createProfile: (name, avatar) => {
        setStore((current) => {
          const created = newProfile(name.trim() || 'Player', avatar, Date.now())
          return { ...upsertProfile(current, created), activeId: created.id }
        })
      },
      selectProfile: (id) => setStore((current) => ({ ...current, activeId: id })),
      deleteProfile: (id) => setStore((current) => removeProfile(current, id)),
      updateSettings: (patch) =>
        patchProfile((current) => ({
          ...current,
          settings: { ...current.settings, ...patch },
        })),
      recordAttempt: (attempt) =>
        patchProfile((current) => applyAttempt(current, attempt, Date.now())),
      introduce: (letters) =>
        patchProfile((current) => introduceLetters(current, letters)),
      placeKnown: (letters) =>
        patchProfile((current) => placeKnownLetters(current, letters, Date.now())),
      passLevel: (n, stars) => patchProfile((current) => finishLevel(current, n, stars)),
      skipLevels: (count) => patchProfile((current) => skipLevels(current, count)),
      restartLevels: () => patchProfile((current) => restartLevels(current)),
      closeRound: (result) =>
        patchProfile((current) => finishRound(current, result, Date.now())),
      buy: (id) => patchProfile((current) => buyBuilding(current, id)),
      importStore: (next) => setStore(next),
    }),
    [store, profile, saveFailed, patchProfile],
  )

  return <GameContext.Provider value={value}>{children}</GameContext.Provider>
}

export function useGame(): GameValue {
  const value = useContext(GameContext)
  if (!value) throw new Error('useGame must be used inside GameProvider')
  return value
}
