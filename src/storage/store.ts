import { readJson, writeJson, isPersistent } from './safeStorage'
import type { Profile, Store } from './schema'
import { BACKUP_KEY, STORE_KEY, emptyStore, migrate } from './schema'

/**
 * Persistence for the whole app.
 *
 * Two copies are kept: iOS Safari can evict site data after about a week of
 * not opening the page, and a half-written record is worse than an old one.
 * The backup is written first, so a failed main write still leaves a readable
 * previous state.
 */

export function loadStore(): Store {
  const primary = migrate(readJson<unknown>(STORE_KEY, null))
  if (primary.profiles.length > 0) return primary
  const backup = migrate(readJson<unknown>(BACKUP_KEY, null))
  return backup.profiles.length > 0 ? backup : emptyStore()
}

export function saveStore(store: Store): boolean {
  writeJson(BACKUP_KEY, store)
  const result = writeJson(STORE_KEY, store)
  return result.ok
}

export function upsertProfile(store: Store, profile: Profile): Store {
  const exists = store.profiles.some((p) => p.id === profile.id)
  return {
    ...store,
    profiles: exists
      ? store.profiles.map((p) => (p.id === profile.id ? profile : p))
      : [...store.profiles, profile],
    activeId: store.activeId ?? profile.id,
  }
}

export function removeProfile(store: Store, id: string): Store {
  const profiles = store.profiles.filter((p) => p.id !== id)
  return {
    ...store,
    profiles,
    activeId: store.activeId === id ? (profiles[0]?.id ?? null) : store.activeId,
  }
}

export function activeProfile(store: Store): Profile | null {
  return store.profiles.find((p) => p.id === store.activeId) ?? null
}

/** Rough size of the saved state, for the parent screen. */
export function storeSizeBytes(store: Store): number {
  try {
    return new Blob([JSON.stringify(store)]).size
  } catch {
    return 0
  }
}

export function storageIsPersistent(): boolean {
  return isPersistent()
}

/**
 * Asks the browser to keep this origin's data. Safari mostly ignores it, which
 * is why the parent screen also offers a file export.
 */
export async function requestPersistence(): Promise<boolean> {
  try {
    return (await navigator.storage?.persist?.()) ?? false
  } catch {
    return false
  }
}
