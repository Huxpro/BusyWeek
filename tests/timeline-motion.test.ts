import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DAY_GAP,
  DAY_HEADER_HEIGHT,
  TODO_ROW_HEIGHT,
  createTimelineMotionLayout,
} from '../src/timelineMotion.ts'
import type { VisibleDay } from '../src/timelineView.ts'

function day(key: string, ids: string[]): VisibleDay {
  return {
    key,
    todos: ids.map((id) => ({
      id,
      text: id,
      done: false,
      date: key,
      dayType: 0,
    })),
  }
}

test('positions todos and day cards using fixed Clear-style slots', () => {
  const layout = createTimelineMotionLayout([
    day('2026-07-15', ['a', 'b']),
    day('2026-07-16', ['c']),
  ])

  assert.equal(layout.days['2026-07-15'].offset, 0)
  assert.equal(layout.days['2026-07-15'].todoOffsets.a, 0)
  assert.equal(layout.days['2026-07-15'].todoOffsets.b, TODO_ROW_HEIGHT)
  assert.equal(layout.days['2026-07-15'].todosHeight, 2 * TODO_ROW_HEIGHT)
  assert.equal(
    layout.days['2026-07-16'].offset,
    DAY_GAP + DAY_HEADER_HEIGHT + 2 * TODO_ROW_HEIGHT,
  )
  assert.equal(
    layout.height,
    2 * DAY_GAP + 2 * DAY_HEADER_HEIGHT + 3 * TODO_ROW_HEIGHT,
  )
})

test('retained todos and later day cards move by the removed row height', () => {
  const before = createTimelineMotionLayout([
    day('2026-07-15', ['a', 'b']),
    day('2026-07-16', ['c']),
  ])
  const after = createTimelineMotionLayout([
    day('2026-07-15', ['b']),
    day('2026-07-16', ['c']),
  ])

  assert.equal(
    before.days['2026-07-15'].todoOffsets.b -
      after.days['2026-07-15'].todoOffsets.b,
    TODO_ROW_HEIGHT,
  )
  assert.equal(
    before.days['2026-07-16'].offset - after.days['2026-07-16'].offset,
    TODO_ROW_HEIGHT,
  )
  assert.equal(before.height - after.height, TODO_ROW_HEIGHT)
})
