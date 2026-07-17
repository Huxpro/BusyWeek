import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DAY_GAP,
  DAY_HEADER_HEIGHT,
  createTimelineMotionLayout,
} from '../src/timelineMotion.ts'
import { TODO_MIN_ROW_HEIGHT } from '../src/todoTextLayout.ts'
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

test('positions mixed-height todos and day cards using cumulative offsets', () => {
  const layout = createTimelineMotionLayout([
    day('2026-07-15', ['a', 'b', 'c']),
    day('2026-07-16', ['d']),
  ], {
    a: 52,
    b: 96,
    c: 72,
  })

  assert.equal(layout.days['2026-07-15'].offset, 0)
  assert.equal(layout.days['2026-07-15'].todoOffsets.a, 0)
  assert.equal(layout.days['2026-07-15'].todoOffsets.b, 52)
  assert.equal(layout.days['2026-07-15'].todoOffsets.c, 148)
  assert.deepEqual(layout.days['2026-07-15'].todoHeights, {
    a: 52,
    b: 96,
    c: 72,
  })
  assert.equal(layout.days['2026-07-15'].todosHeight, 220)
  assert.equal(
    layout.days['2026-07-16'].offset,
    DAY_GAP + DAY_HEADER_HEIGHT + 220,
  )
  assert.equal(
    layout.height,
    2 * DAY_GAP + 2 * DAY_HEADER_HEIGHT + 220 + TODO_MIN_ROW_HEIGHT,
  )
})

test('retained todos and later day cards move by the removed variable row height', () => {
  const before = createTimelineMotionLayout([
    day('2026-07-15', ['a', 'b', 'c']),
    day('2026-07-16', ['d']),
  ], {
    a: 52,
    b: 96,
    c: 72,
  })
  const after = createTimelineMotionLayout([
    day('2026-07-15', ['a', 'c']),
    day('2026-07-16', ['d']),
  ], {
    a: 52,
    b: 96,
    c: 72,
  })

  assert.equal(
    before.days['2026-07-15'].todoOffsets.c -
      after.days['2026-07-15'].todoOffsets.c,
    96,
  )
  assert.equal(
    before.days['2026-07-16'].offset - after.days['2026-07-16'].offset,
    96,
  )
  assert.equal(before.height - after.height, 96)
})

test('sanitizes missing and invalid row heights to the minimum', () => {
  const layout = createTimelineMotionLayout(
    [
      day('2026-07-15', [
        'missing',
        'infinite',
        'zero',
        'nan',
        'negative',
        'small',
      ]),
    ],
    {
      infinite: Number.POSITIVE_INFINITY,
      zero: 0,
      nan: Number.NaN,
      negative: -12,
      small: TODO_MIN_ROW_HEIGHT - 1,
    },
  )

  const dayLayout = layout.days['2026-07-15']
  assert.deepEqual(dayLayout.todoHeights, {
    missing: TODO_MIN_ROW_HEIGHT,
    infinite: TODO_MIN_ROW_HEIGHT,
    zero: TODO_MIN_ROW_HEIGHT,
    nan: TODO_MIN_ROW_HEIGHT,
    negative: TODO_MIN_ROW_HEIGHT,
    small: TODO_MIN_ROW_HEIGHT,
  })
  assert.deepEqual(dayLayout.todoOffsets, {
    missing: 0,
    infinite: 52,
    zero: 104,
    nan: 156,
    negative: 208,
    small: 260,
  })
  assert.equal(dayLayout.todosHeight, 6 * TODO_MIN_ROW_HEIGHT)
})
