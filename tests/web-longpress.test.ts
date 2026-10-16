import assert from 'node:assert/strict'
import test from 'node:test'

import {
  createTodoLongPressGesture,
  installTodoLongPress,
} from '../web/todo-longpress.js'

function createFakeClock() {
  let now = 0
  let nextId = 1
  const timers = new Map()

  return {
    setTimer(callback, delay) {
      const id = nextId
      nextId += 1
      timers.set(id, { callback, dueAt: now + delay, id })
      return id
    },
    clearTimer(id) {
      timers.delete(id)
    },
    tick(duration) {
      const endAt = now + duration

      while (true) {
        const next = [...timers.values()]
          .filter((timer) => timer.dueAt <= endAt)
          .sort((left, right) =>
            left.dueAt === right.dueAt
              ? left.id - right.id
              : left.dueAt - right.dueAt,
          )[0]
        if (!next) break

        timers.delete(next.id)
        now = next.dueAt
        next.callback()
      }

      now = endAt
    },
    pendingCount() {
      return timers.size
    },
  }
}

function createHarness() {
  const clock = createFakeClock()
  const firings = []
  const gesture = createTodoLongPressGesture({
    onLongPress(firing) {
      firings.push(firing)
    },
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  })

  return { clock, firings, gesture }
}

test('does not trigger at 499ms and triggers exactly once at 500ms', () => {
  const { clock, firings, gesture } = createHarness()

  gesture.start({ pointerId: 1, target: {}, x: 40, y: 80 })
  clock.tick(499)
  assert.equal(firings.length, 0)

  clock.tick(1)
  assert.equal(firings.length, 1)

  clock.tick(500)
  assert.equal(firings.length, 1)
})

test('firing carries the original target and start coordinates', () => {
  const { clock, firings, gesture } = createHarness()
  const target = { name: 'todo body' }

  gesture.start({ pointerId: 7, target, x: 12, y: 34 })
  clock.tick(500)

  assert.equal(firings.length, 1)
  assert.equal(firings[0].target, target)
  assert.equal(firings[0].pointerId, 7)
  assert.equal(firings[0].x, 12)
  assert.equal(firings[0].y, 34)
})

test('movement farther than 12px cancels, including diagonal movement', () => {
  for (const [x, y] of [
    [12.01, 0],
    [9, 9],
  ]) {
    const { clock, firings, gesture } = createHarness()
    gesture.start({ pointerId: 1, target: {}, x: 0, y: 0 })

    gesture.move({ pointerId: 1, x, y })
    clock.tick(500)

    assert.equal(firings.length, 0)
    assert.equal(clock.pendingCount(), 0)
  }
})

test('movement at or within 12px does not cancel', () => {
  for (const [x, y] of [
    [12, 0],
    [7.2, 9.6],
  ]) {
    const { clock, firings, gesture } = createHarness()
    gesture.start({ pointerId: 1, target: {}, x: 0, y: 0 })

    gesture.move({ pointerId: 1, x, y })
    clock.tick(500)

    assert.equal(firings.length, 1)
  }
})

test('matching pointer up ends the gesture before it fires', () => {
  const { clock, firings, gesture } = createHarness()
  gesture.start({ pointerId: 3, target: {}, x: 0, y: 0 })

  gesture.end(3)
  clock.tick(500)

  assert.equal(firings.length, 0)
  assert.equal(clock.pendingCount(), 0)
})

test('matching pointer cancellation clears the active gesture', () => {
  const { clock, firings, gesture } = createHarness()
  gesture.start({ pointerId: 4, target: {}, x: 0, y: 0 })

  gesture.cancel(4)
  clock.tick(500)

  assert.equal(firings.length, 0)
  assert.equal(clock.pendingCount(), 0)
})

test('general cancellation clears any active gesture', () => {
  const { clock, firings, gesture } = createHarness()
  gesture.start({ pointerId: 5, target: {}, x: 0, y: 0 })

  gesture.cancel()
  clock.tick(500)

  assert.equal(firings.length, 0)
  assert.equal(clock.pendingCount(), 0)
})

test('missing or invalid targets cannot start a gesture', () => {
  for (const target of [undefined, null, 'todo-body', 42]) {
    const { clock, firings, gesture } = createHarness()

    assert.equal(
      gesture.start({ pointerId: 1, target, x: 0, y: 0 }),
      false,
    )
    clock.tick(500)

    assert.equal(firings.length, 0)
    assert.equal(clock.pendingCount(), 0)
  }
})

test('a second pointer cannot steal or replace the active gesture', () => {
  const { clock, firings, gesture } = createHarness()
  const firstTarget = { id: 'first' }

  assert.equal(
    gesture.start({ pointerId: 1, target: firstTarget, x: 10, y: 20 }),
    true,
  )
  assert.equal(
    gesture.start({ pointerId: 2, target: { id: 'second' }, x: 30, y: 40 }),
    false,
  )
  clock.tick(500)

  assert.equal(firings.length, 1)
  assert.equal(firings[0].target, firstTarget)
  assert.equal(firings[0].pointerId, 1)
})

test('events from another pointer do not move, end, or cancel the active pointer', () => {
  const { clock, firings, gesture } = createHarness()
  const target = {}
  gesture.start({ pointerId: 1, target, x: 0, y: 0 })

  gesture.move({ pointerId: 2, x: 100, y: 100 })
  gesture.end(2)
  gesture.cancel(2)
  clock.tick(500)

  assert.equal(firings.length, 1)
  assert.equal(firings[0].target, target)
})

test('a fired gesture cannot fire twice and ending it resets for the next gesture', () => {
  const { clock, firings, gesture } = createHarness()
  const firstTarget = { id: 'first' }
  const secondTarget = { id: 'second' }

  gesture.start({ pointerId: 1, target: firstTarget, x: 0, y: 0 })
  clock.tick(1_000)
  assert.equal(firings.length, 1)

  assert.equal(
    gesture.start({ pointerId: 2, target: secondTarget, x: 5, y: 6 }),
    false,
  )
  gesture.end(1)
  assert.equal(
    gesture.start({ pointerId: 2, target: secondTarget, x: 5, y: 6 }),
    true,
  )
  clock.tick(500)

  assert.equal(firings.length, 2)
  assert.equal(firings[1].target, secondTarget)
})

class FakeEventTarget {
  listeners = new Map<string, Set<(event: any) => void>>()
  additions: { type: string; capture: boolean }[] = []
  removals: { type: string; capture: boolean }[] = []
  addCount = 0
  removeCount = 0

  addEventListener(
    type: string,
    listener: (event: any) => void,
    options?: boolean | { capture?: boolean },
  ) {
    this.addCount += 1
    this.additions.push({
      type,
      capture:
        options === true ||
        (typeof options === 'object' && options?.capture === true),
    })
    const listeners = this.listeners.get(type) ?? new Set()
    listeners.add(listener)
    this.listeners.set(type, listeners)
  }

  removeEventListener(
    type: string,
    listener: (event: any) => void,
    options?: boolean | { capture?: boolean },
  ) {
    this.removeCount += 1
    this.removals.push({
      type,
      capture:
        options === true ||
        (typeof options === 'object' && options?.capture === true),
    })
    this.listeners.get(type)?.delete(listener)
  }

  emit(type: string, event: any = {}) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener.call(this, event)
    }
  }

  listenerCount(type: string) {
    return this.listeners.get(type)?.size ?? 0
  }
}

class FakeWindow extends FakeEventTarget {}

class FakeDocument extends FakeEventTarget {
  defaultView: FakeWindow

  constructor(defaultView: FakeWindow) {
    super()
    this.defaultView = defaultView
  }
}

class FakeElement extends FakeEventTarget {
  ownerDocument: FakeDocument
  classes: Set<string>
  setPointerCaptureCount = 0

  constructor(ownerDocument: FakeDocument, classes: string[] = []) {
    super()
    this.ownerDocument = ownerDocument
    this.classes = new Set(classes)
  }

  matches(selector: string) {
    return selector === '.todo-body' && this.classes.has('todo-body')
  }

  setPointerCapture() {
    this.setPointerCaptureCount += 1
  }
}

function createInstallerHarness() {
  const clock = createFakeClock()
  const windowTarget = new FakeWindow()
  const documentTarget = new FakeDocument(windowTarget)
  const root = new FakeElement(documentTarget)
  const todoBody = new FakeElement(documentTarget, ['todo-body'])
  const child = new FakeElement(documentTarget)
  const outside = new FakeElement(documentTarget)
  const longPresses: unknown[] = []
  function onLongPress(firing: unknown) {
    longPresses.push(firing)
  }
  const timerOptions = {
    setTimer: clock.setTimer,
    clearTimer: clock.clearTimer,
  }

  function pointerEvent(overrides: Record<string, unknown> = {}) {
    return {
      pointerId: 1,
      isPrimary: true,
      button: 0,
      clientX: 30,
      clientY: 40,
      composedPath: () => [child, todoBody, root],
      defaultPrevented: false,
      preventDefault() {
        this.defaultPrevented = true
      },
      ...overrides,
    }
  }

  function start(overrides: Record<string, unknown> = {}) {
    const event = pointerEvent(overrides)
    root.emit('pointerdown', event)
    return event
  }

  return {
    child,
    clock,
    documentTarget,
    longPresses,
    onLongPress,
    outside,
    pointerEvent,
    root,
    start,
    timerOptions,
    todoBody,
    windowTarget,
  }
}

test('installer calls its host callback exactly once at 500ms with the original todo body', () => {
  const harness = createInstallerHarness()
  const cleanup = installTodoLongPress(
    harness.root,
    harness.onLongPress,
    harness.timerOptions,
  )

  const pointerDown = harness.start({ clientX: 17, clientY: 29 })
  harness.clock.tick(499)
  assert.equal(harness.longPresses.length, 0)

  harness.clock.tick(1)
  assert.deepEqual(harness.longPresses, [
    {
      pointerId: 1,
      target: harness.todoBody,
      x: 17,
      y: 29,
    },
  ])
  assert.equal(pointerDown.defaultPrevented, false)
  assert.equal(harness.todoBody.setPointerCaptureCount, 0)
  assert.equal(harness.root.setPointerCaptureCount, 0)
  assert.ok(harness.root.additions.every(({ capture }) => capture))

  harness.clock.tick(500)
  assert.equal(harness.longPresses.length, 1)
  cleanup()
})

test('installer ignores paths without a todo body, non-primary pointers, and nonzero buttons', () => {
  const cases = [
    { composedPath: (harness) => [harness.outside, harness.root] },
    { isPrimary: () => false },
    { button: () => 2 },
  ]

  for (const configure of cases) {
    const harness = createInstallerHarness()
    const cleanup = installTodoLongPress(
      harness.root,
      harness.onLongPress,
      harness.timerOptions,
    )
    const overrides = Object.fromEntries(
      Object.entries(configure).map(([key, value]) => [key, value(harness)]),
    )

    harness.start(overrides)
    assert.equal(harness.clock.pendingCount(), 0)
    harness.clock.tick(500)
    assert.equal(harness.longPresses.length, 0)
    cleanup()
  }
})

test('installer safely ignores missing, invalid, or throwing composed paths', () => {
  const harness = createInstallerHarness()
  const cleanup = installTodoLongPress(
    harness.root,
    harness.onLongPress,
    harness.timerOptions,
  )
  const events = [
    { ...harness.pointerEvent(), composedPath: undefined },
    { ...harness.pointerEvent(), composedPath: () => null },
    {
      ...harness.pointerEvent(),
      composedPath() {
        throw new Error('unavailable path')
      },
    },
  ]

  for (const event of events) harness.root.emit('pointerdown', event)
  assert.equal(harness.clock.pendingCount(), 0)
  cleanup()
})

test('installer cancels pending long press for every matching pointer and lifecycle signal', () => {
  const cancellations = [
    ['movement beyond 12px', (harness) =>
      harness.root.emit(
        'pointermove',
        harness.pointerEvent({ clientX: 43, clientY: 40 }),
      )],
    ['pointer up', (harness) =>
      harness.root.emit('pointerup', harness.pointerEvent())],
    ['pointer cancel', (harness) =>
      harness.root.emit('pointercancel', harness.pointerEvent())],
    ['lost pointer capture', (harness) =>
      harness.root.emit('lostpointercapture', harness.pointerEvent())],
    ['root scroll', (harness) =>
      harness.root.emit('scroll', { target: harness.root })],
    ['descendant scroll', (harness) =>
      harness.root.emit('scroll', { target: harness.child })],
    ['document visibility change', (harness) =>
      harness.documentTarget.emit('visibilitychange')],
    ['window blur', (harness) => harness.windowTarget.emit('blur')],
  ] as const

  for (const [name, cancel] of cancellations) {
    const harness = createInstallerHarness()
    const cleanup = installTodoLongPress(
      harness.root,
      harness.onLongPress,
      harness.timerOptions,
    )
    const pointerDown = harness.start()
    assert.equal(pointerDown.defaultPrevented, false, name)
    assert.equal(harness.clock.pendingCount(), 1, name)

    cancel(harness)
    harness.clock.tick(500)

    assert.equal(harness.clock.pendingCount(), 0, name)
    assert.equal(harness.longPresses.length, 0, name)
    cleanup()
  }
})

test('installer does not prevent pointer movement while tracking a long press', () => {
  const harness = createInstallerHarness()
  const cleanup = installTodoLongPress(
    harness.root,
    harness.onLongPress,
    harness.timerOptions,
  )
  harness.start()
  const move = harness.pointerEvent({ clientX: 35, clientY: 45 })

  harness.root.emit('pointermove', move)

  assert.equal(move.defaultPrevented, false)
  assert.equal(harness.clock.pendingCount(), 1)
  cleanup()
})

test('installer prevents contextmenu only when its composed path contains a todo body', () => {
  const harness = createInstallerHarness()
  const cleanup = installTodoLongPress(
    harness.root,
    harness.onLongPress,
    harness.timerOptions,
  )
  const onTodo = harness.pointerEvent()
  const outside = harness.pointerEvent({
    composedPath: () => [harness.outside, harness.root],
  })

  harness.root.emit('contextmenu', onTodo)
  harness.root.emit('contextmenu', outside)

  assert.equal(onTodo.defaultPrevented, true)
  assert.equal(outside.defaultPrevented, false)
  cleanup()
})

test('installer guards duplicate roots and cleanup is idempotent before reinstall', () => {
  const harness = createInstallerHarness()
  const firstCleanup = installTodoLongPress(
    harness.root,
    harness.onLongPress,
    harness.timerOptions,
  )
  const listenerCounts = {
    root: harness.root.addCount,
    document: harness.documentTarget.addCount,
    window: harness.windowTarget.addCount,
  }
  harness.start()

  const duplicateCleanup = installTodoLongPress(
    harness.root,
    harness.onLongPress,
    harness.timerOptions,
  )
  assert.equal(duplicateCleanup, firstCleanup)
  assert.deepEqual(
    {
      root: harness.root.addCount,
      document: harness.documentTarget.addCount,
      window: harness.windowTarget.addCount,
    },
    listenerCounts,
  )

  firstCleanup()
  firstCleanup()
  assert.equal(harness.clock.pendingCount(), 0)
  assert.deepEqual(harness.root.removals, harness.root.additions)
  assert.equal(harness.root.listenerCount('pointerdown'), 0)
  assert.equal(harness.documentTarget.listenerCount('visibilitychange'), 0)
  assert.equal(harness.windowTarget.listenerCount('blur'), 0)

  const reinstalledCleanup = installTodoLongPress(
    harness.root,
    harness.onLongPress,
    harness.timerOptions,
  )
  assert.notEqual(reinstalledCleanup, firstCleanup)
  assert.equal(harness.root.listenerCount('pointerdown'), 1)
  assert.equal(harness.documentTarget.listenerCount('visibilitychange'), 1)
  assert.equal(harness.windowTarget.listenerCount('blur'), 1)
  harness.start()
  harness.clock.tick(500)
  assert.equal(harness.longPresses.length, 1)
  reinstalledCleanup()
})

test('installer requires an explicit host callback', () => {
  const harness = createInstallerHarness()

  assert.throws(
    () => installTodoLongPress(harness.root, undefined as any),
    /onLongPress must be a function/,
  )
})
