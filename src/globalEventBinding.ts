export type GlobalEventListener = (...args: any[]) => void

// Both native app-service and Web Core's worker provide timer globals, while
// the Lynx TypeScript lib intentionally omits browser/Node timer declarations.
declare function setTimeout(callback: () => void, delay?: number): unknown
declare function clearTimeout(handle: unknown): void

export type GlobalEventEmitterLike = {
  addListener: (eventName: string, listener: GlobalEventListener) => void
  removeListener?: (
    eventName: string,
    listener: GlobalEventListener,
  ) => void
}

type RetryHandle = unknown

export type GlobalEventBindingOptions = {
  resolveEmitter: () => GlobalEventEmitterLike | null
  listeners: ReadonlyArray<readonly [string, GlobalEventListener]>
  scheduleRetry?: (retry: () => void, delayMs: number) => RetryHandle
  cancelRetry?: (handle: RetryHandle) => void
  maxAttempts?: number
}

const DEFAULT_MAX_ATTEMPTS = 24
const RETRY_BASE_DELAY_MS = 16
const RETRY_MAX_DELAY_MS = 250

function defaultScheduleRetry(
  retry: () => void,
  delayMs: number,
): RetryHandle {
  return setTimeout(retry, delayMs)
}

function defaultCancelRetry(handle: RetryHandle): void {
  clearTimeout(handle)
}

/**
 * Subscribes as soon as Lynx exposes GlobalEventEmitter.
 *
 * Web Core evaluates app-service before `nativeApp.setCard()`, so the emitter
 * can legitimately be absent during Vue's mounted hook. A short bounded retry
 * crosses that card-setup boundary without leaving a permanent timer behind on
 * runtimes that do not expose global events.
 */
export function bindGlobalEventListenersWhenReady(
  options: GlobalEventBindingOptions,
): () => void {
  const {
    resolveEmitter,
    listeners,
    scheduleRetry = defaultScheduleRetry,
    cancelRetry = defaultCancelRetry,
    maxAttempts = DEFAULT_MAX_ATTEMPTS,
  } = options

  let attempts = 0
  let stopped = false
  let retryScheduled = false
  let retryHandle: RetryHandle
  let boundEmitter: GlobalEventEmitterLike | null = null
  const boundListenerIndexes = new Set<number>()

  const allListenersBound = () =>
    boundListenerIndexes.size >= listeners.length

  const scheduleNextAttempt = () => {
    if (
      stopped ||
      allListenersBound() ||
      retryScheduled ||
      attempts >= maxAttempts
    ) return

    retryScheduled = true
    try {
      const delayMs = Math.min(
        RETRY_BASE_DELAY_MS * 2 ** Math.max(0, attempts - 1),
        RETRY_MAX_DELAY_MS,
      )
      retryHandle = scheduleRetry(tryBind, delayMs)
    } catch {
      retryScheduled = false
    }
  }

  const tryBind = () => {
    retryScheduled = false
    if (stopped || allListenersBound()) return

    attempts += 1
    if (boundEmitter === null) {
      try {
        boundEmitter = resolveEmitter()
      } catch {
        // Card setup may still be in progress; retry below.
      }
    }

    if (boundEmitter === null) {
      scheduleNextAttempt()
      return
    }

    for (let index = 0; index < listeners.length; index += 1) {
      if (boundListenerIndexes.has(index)) continue
      const [eventName, listener] = listeners[index]
      try {
        boundEmitter.addListener(eventName, listener)
        boundListenerIndexes.add(index)
      } catch {
        // One unsupported host event must not block independent listeners.
      }
    }

    scheduleNextAttempt()
  }

  tryBind()

  return () => {
    if (stopped) return
    stopped = true

    if (retryScheduled) {
      retryScheduled = false
      try {
        cancelRetry(retryHandle)
      } catch {
        // A host-specific timer cancellation failure must not block teardown.
      }
    }

    if (boundEmitter !== null) {
      for (const index of boundListenerIndexes) {
        const [eventName, listener] = listeners[index]
        try {
          boundEmitter.removeListener?.(eventName, listener)
        } catch {
          // Keep removing the remaining independently registered listeners.
        }
      }
      boundListenerIndexes.clear()
      boundEmitter = null
    }
  }
}
