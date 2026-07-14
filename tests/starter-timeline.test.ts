import assert from 'node:assert/strict'
import test from 'node:test'

import { createStarterTimeline } from '../src/starterTimeline.ts'

test('creates three pending instructional todos for the supplied date', () => {
  const timeline = createStarterTimeline('2026-07-14')
  const todos = timeline['2026-07-14'].todos

  assert.deepEqual(todos.map((todo) => todo.text), [
    '打开右上角查看已完成',
    '点击文字编辑事项',
    '点击圆圈完成事项',
  ])
  assert.ok(todos.every((todo) => todo.date === '2026-07-14'))
  assert.ok(todos.every((todo) => todo.dayType === 0))
  assert.ok(todos.every((todo) => todo.done === false))
})

test('returns fresh starter objects so callers cannot share mutations', () => {
  const first = createStarterTimeline('2026-07-14')
  const second = createStarterTimeline('2026-07-14')

  first['2026-07-14'].todos[0].done = true

  assert.notStrictEqual(first, second)
  assert.equal(second['2026-07-14'].todos[0].done, false)
})
