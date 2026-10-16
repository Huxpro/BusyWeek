import assert from 'node:assert/strict'
import test from 'node:test'

import {
  bindGlobalEventListenersWhenReady,
  type GlobalEventEmitterLike,
} from '../src/globalEventBinding.ts'

type ScheduledTask = {
  cancelled: boolean
  run: () => void
}

function createManualScheduler() {
  const tasks: ScheduledTask[] = []

  return {
    tasks,
    schedule(run: () => void): ScheduledTask {
      const task = { cancelled: false, run }
      tasks.push(task)
      return task
    },
    cancel(task: unknown) {
      ;(task as ScheduledTask).cancelled = true
    },
  }
}

test('global-event binding retries after the Web card installs its emitter', () => {
  const scheduler = createManualScheduler()
  const calls: string[] = []
  const listener = () => {}
  let emitter: GlobalEventEmitterLike | null = null

  const readyEmitter: GlobalEventEmitterLike = {
    addListener(eventName, candidate) {
      assert.equal(candidate, listener)
      calls.push(`add:${eventName}`)
    },
    removeListener(eventName, candidate) {
      assert.equal(candidate, listener)
      calls.push(`remove:${eventName}`)
    },
  }

  const dispose = bindGlobalEventListenersWhenReady({
    resolveEmitter: () => emitter,
    listeners: [['busyweekTodoLongPress', listener]],
    scheduleRetry: scheduler.schedule,
    cancelRetry: scheduler.cancel,
  })

  assert.deepEqual(calls, [])
  assert.equal(scheduler.tasks.length, 1)

  emitter = readyEmitter
  scheduler.tasks[0].run()
  scheduler.tasks[0].run()

  assert.deepEqual(calls, ['add:busyweekTodoLongPress'])

  dispose()
  dispose()

  assert.deepEqual(calls, [
    'add:busyweekTodoLongPress',
    'remove:busyweekTodoLongPress',
  ])
})

test('disposing before card setup cancels retry and prevents late binding', () => {
  const scheduler = createManualScheduler()
  const calls: string[] = []
  const listener = () => {}
  let emitter: GlobalEventEmitterLike | null = null

  const dispose = bindGlobalEventListenersWhenReady({
    resolveEmitter: () => emitter,
    listeners: [['keyboardstatuschanged', listener]],
    scheduleRetry: scheduler.schedule,
    cancelRetry: scheduler.cancel,
  })

  const pending = scheduler.tasks[0]
  dispose()

  assert.equal(pending.cancelled, true)

  emitter = {
    addListener(eventName) {
      calls.push(`add:${eventName}`)
    },
  }
  pending.run()

  assert.deepEqual(calls, [])
})

test('an immediately available native emitter binds without scheduling', () => {
  const scheduler = createManualScheduler()
  const calls: string[] = []
  const listener = () => {}

  const dispose = bindGlobalEventListenersWhenReady({
    resolveEmitter: () => ({
      addListener(eventName) {
        calls.push(`add:${eventName}`)
      },
      removeListener(eventName) {
        calls.push(`remove:${eventName}`)
      },
    }),
    listeners: [['keyboardstatuschanged', listener]],
    scheduleRetry: scheduler.schedule,
    cancelRetry: scheduler.cancel,
  })

  assert.deepEqual(calls, ['add:keyboardstatuschanged'])
  assert.equal(scheduler.tasks.length, 0)

  dispose()
  assert.deepEqual(calls, [
    'add:keyboardstatuschanged',
    'remove:keyboardstatuschanged',
  ])
})

test('binding stops retrying after the bounded attempt count', () => {
  const scheduler = createManualScheduler()

  bindGlobalEventListenersWhenReady({
    resolveEmitter: () => null,
    listeners: [['unavailable', () => {}]],
    scheduleRetry: scheduler.schedule,
    cancelRetry: scheduler.cancel,
    maxAttempts: 3,
  })

  assert.equal(scheduler.tasks.length, 1)
  scheduler.tasks[0].run()
  assert.equal(scheduler.tasks.length, 2)
  scheduler.tasks[1].run()

  // maxAttempts includes the immediate attempt, hence only two retries.
  assert.equal(scheduler.tasks.length, 2)
})

test('default retries span asynchronous Web card setup instead of one tight task burst', () => {
  const tasks: ScheduledTask[] = []
  const delays: number[] = []
  let resolveCalls = 0
  let addCalls = 0

  const dispose = bindGlobalEventListenersWhenReady({
    resolveEmitter: () => {
      resolveCalls += 1
      return resolveCalls >= 10
        ? { addListener: () => { addCalls += 1 } }
        : null
    },
    listeners: [['busyweekTodoLongPress', () => {}]],
    scheduleRetry(run, delay = 0) {
      const task = { cancelled: false, run }
      tasks.push(task)
      delays.push(delay)
      return task
    },
    cancelRetry(task) {
      ;(task as ScheduledTask).cancelled = true
    },
  })

  for (let index = 0; index < 9; index += 1) {
    assert.ok(tasks[index], `expected retry task ${index + 1}`)
    tasks[index].run()
  }

  assert.equal(resolveCalls, 10)
  assert.equal(addCalls, 1)
  assert.equal(tasks.length, 9)
  assert.ok(delays.every((delay) => delay >= 16))

  dispose()
})

test('one unsupported global event cannot block other listeners', () => {
  const scheduler = createManualScheduler()
  const calls: string[] = []
  const keyboardListener = () => {}
  const todoListener = () => {}

  const dispose = bindGlobalEventListenersWhenReady({
    resolveEmitter: () => ({
      addListener(eventName) {
        calls.push(`add:${eventName}`)
        if (eventName === 'keyboardstatuschanged') {
          throw new TypeError('LynxSetModule unavailable')
        }
      },
      removeListener(eventName) {
        calls.push(`remove:${eventName}`)
      },
    }),
    listeners: [
      ['keyboardstatuschanged', keyboardListener],
      ['busyweekTodoLongPress', todoListener],
    ],
    scheduleRetry: scheduler.schedule,
    cancelRetry: scheduler.cancel,
    maxAttempts: 2,
  })

  assert.deepEqual(calls, [
    'add:keyboardstatuschanged',
    'add:busyweekTodoLongPress',
  ])
  assert.equal(scheduler.tasks.length, 1)

  scheduler.tasks[0].run()
  assert.deepEqual(calls, [
    'add:keyboardstatuschanged',
    'add:busyweekTodoLongPress',
    'add:keyboardstatuschanged',
  ])

  dispose()
  assert.deepEqual(calls, [
    'add:keyboardstatuschanged',
    'add:busyweekTodoLongPress',
    'add:keyboardstatuschanged',
    'remove:busyweekTodoLongPress',
  ])
})
