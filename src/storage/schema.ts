import type { LetterId } from '../data/letters'
import type { Cell } from '../engine/memory'
import type { CellKey } from '../engine/skills'

export const SCHEMA_VERSION = 1

/** Which shapes the exercises use. */
export type CaseMode = 'upper' | 'lower' | 'mixed'

/**
 * How many letters are in play at once.
 *
 * 'auto' lets the curriculum introduce them one at a time, which suits a child
 * starting from nothing. A number keeps that many letters active, so a child
 * who already knows most of the alphabet can work on all 26 and have the
 * scheduler pick out the few that are actually weak.
 */
export type LetterPool = 'auto' | number

/** 'auto' picks a level per letter from how settled that letter is. */
export type Difficulty = 'auto' | 1 | 2 | 3

export interface Settings {
  /** Speech recognition modes are hidden when the parent turns this off. */
  readonly micEnabled: boolean
  readonly soundEnabled: boolean
  readonly caseMode: CaseMode
  readonly letterPool: LetterPool
  readonly difficulty: Difficulty
  readonly keyboardLayout: 'abc' | 'qwerty'
  /** Slower speech for a child who is still tuning in to English. */
  readonly speechRate: number
}

export const DEFAULT_SETTINGS: Settings = {
  micEnabled: true,
  soundEnabled: true,
  caseMode: 'mixed',
  letterPool: 'auto',
  difficulty: 'auto',
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
  /** The "which letters do you already know" screen has been answered. */
  readonly placed: boolean
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
    placed: false,
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
      ...newProfile(p.name ?? 'Player', p.avatar ?? '🐣', p.createdAt ?? Date.now()),
      ...p,
      v: SCHEMA_VERSION,
      cells: isRecord(p.cells) ? (p.cells as Record<CellKey, Cell>) : {},
      confusion: isRecord(p.confusion) ? (p.confusion as Record<string, number>) : {},
      introduced: Array.isArray(p.introduced) ? p.introduced : [],
      sessions: Array.isArray(p.sessions) ? p.sessions : [],
      settings: migrateSettings(p.settings),
      placed: p.placed === true,
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

/**
 * Settings gain fields over time. Unknown ones fall back to the default, and
 * the old `lowercaseEnabled` flag becomes the narrower of the case modes.
 */
function migrateSettings(raw: unknown): Settings {
  const stored = isRecord(raw) ? raw : {}
  const legacyUpperOnly =
    stored.caseMode === undefined && stored.lowercaseEnabled === false
  const merged = { ...DEFAULT_SETTINGS, ...stored } as Settings
  return {
    ...merged,
    caseMode: legacyUpperOnly ? 'upper' : normaliseCase(merged.caseMode),
    letterPool: normalisePool(merged.letterPool),
    difficulty: normaliseDifficulty(merged.difficulty),
  }
}

function normaliseCase(value: unknown): CaseMode {
  return value === 'upper' || value === 'lower' || value === 'mixed'
    ? value
    : DEFAULT_SETTINGS.caseMode
}

function normalisePool(value: unknown): LetterPool {
  if (value === 'auto') return 'auto'
  if (typeof value === 'number' && Number.isFinite(value)) {
    return Math.min(26, Math.max(3, Math.round(value)))
  }
  return DEFAULT_SETTINGS.letterPool
}

function normaliseDifficulty(value: unknown): Difficulty {
  return value === 1 || value === 2 || value === 3 || value === 'auto'
    ? value
    : DEFAULT_SETTINGS.difficulty
}
