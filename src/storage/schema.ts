import type { LetterId } from '../data/letters'
import type { Cell } from '../engine/memory'
import type { CellKey } from '../engine/skills'

export const SCHEMA_VERSION = 1

export interface Settings {
  /** Speech recognition modes are hidden when the parent turns this off. */
  readonly micEnabled: boolean
  readonly soundEnabled: boolean
  /** Lowercase glyphs start appearing once the parent allows it. */
  readonly lowercaseEnabled: boolean
  readonly keyboardLayout: 'abc' | 'qwerty'
  /** Slower speech for a child who is still tuning in to English. */
  readonly speechRate: number
}

export const DEFAULT_SETTINGS: Settings = {
  micEnabled: true,
  soundEnabled: true,
  lowercaseEnabled: true,
  keyboardLayout: 'abc',
  speechRate: 0.8,
}

export interface SessionSummary {
  readonly at: number
  readonly items: number
  readonly correct: number
  readonly assisted: number
  readonly seconds: number
  readonly letters: readonly LetterId[]
}

/** Garden bed growth: the collectible meta-layer, and the progress map. */
export type BedStage = 0 | 1 | 2 | 3

export interface Profile {
  readonly v: typeof SCHEMA_VERSION
  readonly id: string
  readonly name: string
  /** Emoji shown instead of a photo. */
  readonly avatar: string
  readonly createdAt: number
  /** Sparse: only cells the child has actually answered. */
  readonly cells: Readonly<Record<CellKey, Cell>>
  /** Learned confusions, keyed "TARGET>PICKED", decaying each session. */
  readonly confusion: Readonly<Record<string, number>>
  /** Letters the curriculum has introduced, in introduction order. */
  readonly introduced: readonly LetterId[]
  readonly seeds: number
  /** Stepping stones on the path. Only ever grows - missing a day costs none. */
  readonly stones: number
  readonly lastPlayDay: number
  readonly sessions: readonly SessionSummary[]
  readonly settings: Settings
}

export interface Store {
  readonly v: typeof SCHEMA_VERSION
  readonly profiles: readonly Profile[]
  readonly activeId: string | null
}

export const STORE_KEY = 'abcq:store'
export const BACKUP_KEY = 'abcq:store:bak'

export function emptyStore(): Store {
  return { v: SCHEMA_VERSION, profiles: [], activeId: null }
}

export function newProfile(name: string, avatar: string, now: number): Profile {
  return {
    v: SCHEMA_VERSION,
    id: `p${now.toString(36)}${Math.floor(Math.random() * 1e4).toString(36)}`,
    name,
    avatar,
    createdAt: now,
    cells: {},
    confusion: {},
    introduced: [],
    seeds: 0,
    stones: 0,
    lastPlayDay: -1,
    sessions: [],
    settings: DEFAULT_SETTINGS,
  }
}

/**
 * Coerces whatever came out of localStorage into a valid store.
 *
 * Anything unexpected is dropped rather than trusted: a corrupted profile must
 * never be able to crash the app a child is holding.
 */
export function migrate(raw: unknown): Store {
  if (typeof raw !== 'object' || raw === null) return emptyStore()
  const candidate = raw as Partial<Store>
  if (!Array.isArray(candidate.profiles)) return emptyStore()

  const profiles = candidate.profiles
    .filter((p): p is Profile => typeof p === 'object' && p !== null && typeof p.id === 'string')
    .map((p): Profile => ({
      ...newProfile(p.name ?? 'Игрок', p.avatar ?? '🐣', p.createdAt ?? Date.now()),
      ...p,
      v: SCHEMA_VERSION,
      cells: isRecord(p.cells) ? (p.cells as Record<CellKey, Cell>) : {},
      confusion: isRecord(p.confusion) ? (p.confusion as Record<string, number>) : {},
      introduced: Array.isArray(p.introduced) ? p.introduced : [],
      sessions: Array.isArray(p.sessions) ? p.sessions : [],
      settings: { ...DEFAULT_SETTINGS, ...(isRecord(p.settings) ? p.settings : {}) },
    }))

  const activeId =
    typeof candidate.activeId === 'string' &&
    profiles.some((p) => p.id === candidate.activeId)
      ? candidate.activeId
      : (profiles[0]?.id ?? null)

  return { v: SCHEMA_VERSION, profiles, activeId }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}
