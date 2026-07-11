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

interface NativeLocalStorageModule {
  setStorageItem(key: string, value: string): void
  getStorageItem(key: string, callback: (value: string | null) => void): void
  clearStorage(): void
}

function getNativeStorage(): NativeLocalStorageModule | undefined {
  const modules = (globalThis as { NativeModules?: Record<string, unknown> })
    .NativeModules
  const storage = modules?.NativeLocalStorageModule as
    | NativeLocalStorageModule
    | undefined
  if (storage && typeof storage.getStorageItem === 'function') {
    return storage
  }
  return undefined
}

// In-memory fallback so the app works even without the native module.
const memory = new Map<string, string>()

function parse(raw: string | null | undefined): Timeline {
  if (!raw) {
    return {}
  }
  try {
    return JSON.parse(raw) as Timeline
  } catch {
    return {}
  }
}

/** Load the persisted timeline. Resolves to `{}` when nothing is stored. */
export function loadTimeline(): Promise<Timeline> {
  return new Promise((resolve) => {
    const native = getNativeStorage()
    if (native) {
      native.getStorageItem(STORAGE_KEY, (value) => resolve(parse(value)))
      return
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
  memory.set(STORAGE_KEY, raw)
}
