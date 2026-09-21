import { isLetterId, type LetterId } from '../data/letters'
import type { WordId } from '../data/words'
import type { Cell } from '../engine/memory'
import type { CellKey } from '../engine/skills'

export const SCHEMA_VERSION = 2

/** The three purchasable positions in a Letter Town lot. */
export type SlotId = 'front' | 'back' | 'friend'
export type ExtraId = 'clouds' | 'sky' | 'tram' | 'night' | 'balloons' | 'fireworks'
export const EXTRA_IDS: readonly ExtraId[] = [
  'clouds', 'sky', 'tram', 'night', 'balloons', 'fireworks',
]

/**
 * Everything the child has bought in the town. Nothing here can ever be
 * removed: a slot goes from absent to present and there is no other
 * transition. No coordinates either - the slot is the position.
 */
export interface Town {
  /** Bought slots packed per lot, "A" -> "fbr" (front, back, f-r-iend). */
  readonly lots: Readonly<Partial<Record<LetterId, string>>>
  readonly extras: readonly ExtraId[]
  /** Nuts spent ever. Only grows; the purse is what was earned minus this. */
  readonly spent: number
}

export const EMPTY_TOWN: Town = { lots: {}, extras: [], spent: 0 }

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
export type Difficulty = 'auto' | 1 | 2 | 3 | 4

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
  /** The spendable purse. Goes down when the child buys something. */
  readonly seeds: number
  /** Nuts earned over the profile's whole life. Only ever grows. */
  readonly seedsEarned: number
  readonly town: Town
  /** Stepping stones on the path. Only ever grows - missing a day costs none. */
  readonly stones: number
  readonly lastPlayDay: number
  readonly sessions: readonly SessionSummary[]
  readonly settings: Settings
  /** The "which letters do you already know" screen has been answered. */
  readonly placed: boolean
  readonly reading: ReadingState
  /** Stars earned per lesson id on the path, 1 to 3. Never taken away. */
  readonly path: Readonly<Record<string, number>>
  /** What the parent said the child could read when the profile was made. */
  readonly readingLevel: ReadingLevel
}

/** The onboarding answer about reading. Drives where the path starts. */
export type ReadingLevel = 'none' | 'letters' | 'words' | 'syllables' | 'fluent'
export const READING_LEVELS: readonly ReadingLevel[] = ['none', 'letters', 'words', 'syllables', 'fluent']

/**
 * One first-ever encounter with a word: was it decoded unaided?
 *
 * This is the only record that tells blending apart from memorising word
 * pictures. Every word cell going solid proves nothing on its own; accuracy
 * on words never seen before is the whole test.
 */
export interface NovelEntry {
  readonly w: WordId
  readonly ok: boolean
  readonly at: number
}

export interface ReadingState {
  /** Newest first, capped at TUNING.reading.novelWindow. */
  readonly novel: readonly NovelEntry[]
  readonly wordsIntroduced: readonly WordId[]
}

export const EMPTY_READING: ReadingState = { novel: [], wordsIntroduced: [] }

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
    seedsEarned: 0,
    town: EMPTY_TOWN,
    stones: 0,
    lastPlayDay: -1,
    sessions: [],
    settings: DEFAULT_SETTINGS,
    placed: false,
    reading: EMPTY_READING,
    path: {},
    readingLevel: 'none',
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
      seeds: numberOr(p.seeds, 0),
      // Everything a v1 profile earned is by definition still unspent.
      seedsEarned: numberOr(p.seedsEarned, numberOr(p.seeds, 0)),
      town: migrateTown(p.town),
      reading: migrateReading(p.reading),
      path: migratePath(p.path),
      readingLevel: READING_LEVELS.includes(p.readingLevel as ReadingLevel)
        ? (p.readingLevel as ReadingLevel)
        : 'none',
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

function numberOr(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) && value >= 0
    ? Math.round(value)
    : fallback
}

/**
 * The town screen indexes into `lots` on every render, so a corrupted town
 * must come out of storage as a valid one, with anything unknown dropped.
 */
function migrateTown(raw: unknown): Town {
  if (!isRecord(raw)) return EMPTY_TOWN
  const lots: Record<string, string> = {}
  const rawLots = isRecord(raw.lots) ? raw.lots : {}
  for (const [key, value] of Object.entries(rawLots)) {
    if (!isLetterId(key) || typeof value !== 'string') continue
    const slots = [...new Set([...value])].filter((c) => 'fbr'.includes(c)).join('')
    if (slots) lots[key] = slots
  }
  const extras = (Array.isArray(raw.extras) ? raw.extras : []).filter(
    (value): value is ExtraId => EXTRA_IDS.includes(value as ExtraId),
  )
  return { lots, extras: [...new Set(extras)], spent: numberOr(raw.spent, 0) }
}

function migratePath(raw: unknown): Readonly<Record<string, number>> {
  if (!isRecord(raw)) return {}
  const out: Record<string, number> = {}
  for (const [key, value] of Object.entries(raw)) {
    if (typeof value === 'number' && value >= 1 && value <= 3) out[key] = Math.round(value)
  }
  return out
}

function migrateReading(raw: unknown): ReadingState {
  if (!isRecord(raw)) return EMPTY_READING
  const novel = (Array.isArray(raw.novel) ? raw.novel : [])
    .filter(
      (entry): entry is NovelEntry =>
        isRecord(entry) && typeof entry.w === 'string' && typeof entry.ok === 'boolean',
    )
    .slice(0, 48)
  const wordsIntroduced = (Array.isArray(raw.wordsIntroduced) ? raw.wordsIntroduced : []).filter(
    (value): value is WordId => typeof value === 'string',
  )
  return { novel, wordsIntroduced: [...new Set(wordsIntroduced)] }
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
  return value === 1 || value === 2 || value === 3 || value === 4 || value === 'auto'
    ? value
    : DEFAULT_SETTINGS.difficulty
}
