/**
 * Defensive localStorage wrapper.
 *
 * Every access can throw on iOS: private browsing, full quota, or a disabled
 * storage policy. Nothing in the app may crash because of that, so reads fall
 * back to a default and writes report failure instead of raising.
 */

export type WriteResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly reason: 'quota' | 'unavailable' | 'serialize' }

function backing(): Storage | null {
  try {
    const probe = '__abcq_probe__'
    window.localStorage.setItem(probe, '1')
    window.localStorage.removeItem(probe)
    return window.localStorage
  } catch {
    return null
  }
}

/** In-memory fallback so a session still works when storage is blocked. */
const memory = new Map<string, string>()
let storageAvailable: boolean | null = null

export function isPersistent(): boolean {
  if (storageAvailable === null) storageAvailable = backing() !== null
  return storageAvailable
}

export function readRaw(key: string): string | null {
  if (isPersistent()) {
    try {
      return window.localStorage.getItem(key)
    } catch {
      return memory.get(key) ?? null
    }
  }
  return memory.get(key) ?? null
}

export function writeRaw(key: string, value: string): WriteResult {
  memory.set(key, value)
  if (!isPersistent()) return { ok: false, reason: 'unavailable' }
  try {
    window.localStorage.setItem(key, value)
    return { ok: true }
  } catch (err) {
    const quota =
      err instanceof DOMException &&
      (err.name === 'QuotaExceededError' ||
        err.name === 'NS_ERROR_DOM_QUOTA_REACHED')
    return { ok: false, reason: quota ? 'quota' : 'unavailable' }
  }
}

export function removeRaw(key: string): void {
  memory.delete(key)
  try {
    window.localStorage.removeItem(key)
  } catch {
    /* nothing to do */
  }
}

export function readJson<T>(key: string, fallback: T): T {
  const raw = readRaw(key)
  if (raw === null) return fallback
  try {
    const parsed: unknown = JSON.parse(raw)
    return parsed === null || parsed === undefined ? fallback : (parsed as T)
  } catch {
    // Corrupted entry: keep a copy for debugging, then start clean.
    try {
      window.localStorage.setItem(`${key}__corrupt`, raw.slice(0, 4000))
    } catch {
      /* best effort */
    }
    return fallback
  }
}

export function writeJson(key: string, value: unknown): WriteResult {
  let raw: string
  try {
    raw = JSON.stringify(value)
  } catch {
    return { ok: false, reason: 'serialize' }
  }
  return writeRaw(key, raw)
}
