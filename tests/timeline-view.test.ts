import assert from 'node:assert/strict'
import test from 'node:test'

import { getVisibleDays } from '../src/timelineView.ts'
import type { Timeline } from '../src/types.ts'

const timeline: Timeline = {
  '2026-07-14': {
    date: '2026-07-14',
    todos: [
      {
        id: 'active',
        date: '2026-07-14',
        dayType: 0,
        done: false,
        text: 'still busy',
      },
      {
        id: 'done',
        date: '2026-07-14',
        dayType: 0,
        done: true,
        text: 'finished',
      },
    ],
  },
  '2026-07-15': {
    date: '2026-07-15',
    todos: [
      {
        id: 'done-only-day',
        date: '2026-07-15',
        dayType: 1,
        done: true,
        text: 'finished tomorrow',
      },
    ],
  },
}

test('hides completed todos until showCompleted is enabled', () => {
  const pendingOnly = getVisibleDays(timeline, false)
  const withCompleted = getVisibleDays(timeline, true)

  assert.deepEqual(pendingOnly.map((day) => day.key), ['2026-07-14'])
  assert.deepEqual(pendingOnly[0].todos.map((todo) => todo.id), ['active'])
  assert.deepEqual(withCompleted.map((day) => day.key), [
    '2026-07-14',
    '2026-07-15',
  ])
  assert.deepEqual(withCompleted[0].todos.map((todo) => todo.id), [
    'active',
    'done',
  ])
})

test('does not mutate the stored timeline while projecting visible days', () => {
  const before = JSON.stringify(timeline)

  getVisibleDays(timeline, false)

  assert.equal(JSON.stringify(timeline), before)
})
