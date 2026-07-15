/**
 * Persistence layer, ported from the original `store.js`.
 *
 * The web app used `localStorage`, which does not exist on Lynx — Lynx has no
 * browser globals. Instead we use the platform's key-value store exposed
 * through `NativeModules.NativeLocalStorageModule` (NSUserDefaults on iOS /
 * SharedPreferences on Android).
 *
 * That module is host-provided and is not guaranteed to be registered in every
 * runtime (e.g. a bare LynxExplorer), so we gracefully fall back to an
 * in-memory store. The app stays fully functional either way; only persistence
 * across launches depends on the native module being available.
 */

import type { Timeline } from './types.js'

const STORAGE_KEY = 'busyWeek'

// Lynx evaluates application code with NativeModules as a function argument.
// It is therefore available as a lexical global, but is not necessarily copied
// onto globalThis (notably in @lynx-js/web-core's worker runtime).
declare const NativeModules: Record<string, unknown> | undefined

interface NativeLocalStorageModule {
  setStorageItem(key: string, value: string): void
  getStorageItem(key: string, callback: (value: string | null) => void): void
  clearStorage(): void
}

interface BrowserStorage {
  getItem(key: string): string | null
  setItem(key: string, value: string): void
}

function getNativeStorage(): NativeLocalStorageModule | undefined {
  const modules = typeof NativeModules !== 'undefined'
    ? NativeModules
    : (globalThis as { NativeModules?: Record<string, unknown> }).NativeModules
  const storage = modules?.NativeLocalStorageModule as
    | NativeLocalStorageModule
    | undefined
  if (storage && typeof storage.getStorageItem === 'function') {
    return storage
  }
  return undefined
}

function getBrowserStorage(): BrowserStorage | undefined {
  try {
    const storage = (globalThis as { localStorage?: BrowserStorage }).localStorage
    if (
      storage
      && typeof storage.getItem === 'function'
      && typeof storage.setItem === 'function'
    ) {
      return storage
    }
  } catch {
    /* localStorage can throw when browser storage is disabled */
  }
  return undefined
}

// In-memory fallback so the app works even without the native module.
const memory = new Map<string, string>()

function parse(raw: string | null | undefined): Timeline | null {
  if (raw == null) return null

  try {
    const value = JSON.parse(raw) as unknown
    if (!value || typeof value !== 'object' || Array.isArray(value)) return null
    return value as Timeline
  } catch {
    return null
  }
}

/** Load persisted data, or `null` when no valid stored value exists. */
export function loadTimeline(): Promise<Timeline | null> {
  return new Promise((resolve) => {
    const native = getNativeStorage()
    if (native) {
      native.getStorageItem(STORAGE_KEY, (value) => resolve(parse(value)))
      return
    }
    const browser = getBrowserStorage()
    if (browser) {
      try {
        resolve(parse(browser.getItem(STORAGE_KEY)))
        return
      } catch {
        /* fall through to memory when browser storage is unavailable */
      }
    }
    resolve(parse(memory.get(STORAGE_KEY)))
  })
}

/** Persist the timeline. */
export function saveTimeline(timeline: Timeline): void {
  const raw = JSON.stringify(timeline)
  const native = getNativeStorage()
  if (native) {
    native.setStorageItem(STORAGE_KEY, raw)
    return
  }
  const browser = getBrowserStorage()
  if (browser) {
    try {
      browser.setItem(STORAGE_KEY, raw)
      return
    } catch {
      /* fall through to memory when quota/privacy settings reject writes */
    }
  }
  memory.set(STORAGE_KEY, raw)
}
