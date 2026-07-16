export function createTodoLongPressGesture({
  onLongPress,
  setTimer = (callback, delay) => globalThis.setTimeout(callback, delay),
  clearTimer = (timer) => globalThis.clearTimeout(timer),
  delayMs = 500,
  tolerancePx = 12,
} = {}) {
  if (typeof onLongPress !== 'function') {
    throw new TypeError('onLongPress must be a function')
  }

  let active = null

  function clearActive() {
    if (!active) return
    if (active.timer !== null) clearTimer(active.timer)
    active = null
  }

  function start({ pointerId, target, x, y } = {}) {
    if (active) return false
    if (
      !Number.isFinite(pointerId) ||
      (typeof target !== 'object' && typeof target !== 'function') ||
      target === null ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return false
    }

    const gesture = {
      pointerId,
      target,
      x,
      y,
      timer: null,
      fired: false,
    }
    active = gesture
    gesture.timer = setTimer(() => {
      if (active !== gesture || gesture.fired) return
      gesture.timer = null
      gesture.fired = true
      onLongPress({ pointerId, target, x, y })
    }, delayMs)
    return true
  }

  function move({ pointerId, x, y } = {}) {
    if (
      !active ||
      active.fired ||
      pointerId !== active.pointerId ||
      !Number.isFinite(x) ||
      !Number.isFinite(y)
    ) {
      return
    }

    const deltaX = x - active.x
    const deltaY = y - active.y
    if (deltaX * deltaX + deltaY * deltaY > tolerancePx * tolerancePx) {
      clearActive()
    }
  }

  function end(pointerId) {
    if (active && pointerId === active.pointerId) clearActive()
  }

  function cancel(pointerId) {
    if (active && (pointerId === undefined || pointerId === active.pointerId)) {
      clearActive()
    }
  }

  return { start, move, end, cancel }
}

const installedRoots = new WeakMap()

function findTodoBody(event) {
  let path
  try {
    if (typeof event?.composedPath !== 'function') return null
    path = event.composedPath()
  } catch {
    return null
  }

  if (!Array.isArray(path)) return null
  for (const target of path) {
    try {
      if (
        typeof target?.matches === 'function' &&
        target.matches('.todo-body')
      ) {
        return target
      }
    } catch {
      // Ignore non-Element path entries and unsupported selector matching.
    }
  }
  return null
}

export function installTodoLongPress(root, testOptions = {}) {
  if (
    (typeof root !== 'object' && typeof root !== 'function') ||
    root === null ||
    typeof root.addEventListener !== 'function' ||
    typeof root.removeEventListener !== 'function'
  ) {
    throw new TypeError('root must be an EventTarget')
  }

  const existingCleanup = installedRoots.get(root)
  if (existingCleanup) return existingCleanup

  const ownerDocument = root.ownerDocument
  const ownerWindow = ownerDocument?.defaultView
  const options = testOptions ?? {}

  function dispatchLongPress({ target, x, y }) {
    try {
      const targetDocument = target.ownerDocument ?? ownerDocument
      const CustomEventConstructor = targetDocument?.defaultView?.CustomEvent
      if (
        typeof CustomEventConstructor !== 'function' ||
        typeof target.dispatchEvent !== 'function'
      ) {
        return
      }

      target.dispatchEvent(
        new CustomEventConstructor('longpress', {
          detail: { clientX: x, clientY: y },
          bubbles: false,
          composed: false,
          cancelable: true,
        }),
      )
    } catch {
      // A host without realm-safe CustomEvent support cannot synthesize it.
    }
  }

  const gesture = createTodoLongPressGesture({
    onLongPress: dispatchLongPress,
    setTimer: options.setTimer,
    clearTimer: options.clearTimer,
  })

  function onPointerDown(event) {
    if (event.isPrimary !== true || event.button !== 0) return
    const target = findTodoBody(event)
    if (!target) return

    gesture.start({
      pointerId: event.pointerId,
      target,
      x: event.clientX,
      y: event.clientY,
    })
  }

  function onPointerMove(event) {
    gesture.move({
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    })
  }

  function onPointerUp(event) {
    gesture.end(event.pointerId)
  }

  function onPointerCancellation(event) {
    gesture.cancel(event.pointerId)
  }

  function cancelActiveGesture() {
    gesture.cancel()
  }

  function onContextMenu(event) {
    if (findTodoBody(event)) event.preventDefault()
  }

  const rootListeners = [
    ['pointerdown', onPointerDown],
    ['pointermove', onPointerMove],
    ['pointerup', onPointerUp],
    ['pointercancel', onPointerCancellation],
    ['lostpointercapture', onPointerCancellation],
    ['scroll', cancelActiveGesture],
    ['contextmenu', onContextMenu],
  ]

  for (const [type, listener] of rootListeners) {
    root.addEventListener(type, listener, true)
  }
  ownerDocument?.addEventListener?.('visibilitychange', cancelActiveGesture)
  ownerWindow?.addEventListener?.('blur', cancelActiveGesture)

  let cleanedUp = false
  function cleanup() {
    if (cleanedUp) return
    cleanedUp = true
    gesture.cancel()

    for (const [type, listener] of rootListeners) {
      root.removeEventListener(type, listener, true)
    }
    ownerDocument?.removeEventListener?.(
      'visibilitychange',
      cancelActiveGesture,
    )
    ownerWindow?.removeEventListener?.('blur', cancelActiveGesture)
    if (installedRoots.get(root) === cleanup) installedRoots.delete(root)
  }

  installedRoots.set(root, cleanup)
  return cleanup
}
