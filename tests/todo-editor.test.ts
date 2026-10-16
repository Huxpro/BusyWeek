import assert from 'node:assert/strict'
import test from 'node:test'

import {
  commitComposerDraft,
  createComposerDraft,
} from '../src/todoComposer.ts'
import type { Timeline, Todo } from '../src/types.ts'

const TODAY = '2026-07-16'

function todo(
  values: Pick<Todo, 'id' | 'date' | 'text'> & Partial<Todo>,
): Todo {
  return {
    dayType: 0,
    done: false,
    ...values,
  }
}

function freezeTimeline(timeline: Timeline): Timeline {
  for (const day of Object.values(timeline)) {
    for (const item of day.todos) Object.freeze(item)
    Object.freeze(day.todos)
    Object.freeze(day)
  }
  return Object.freeze(timeline)
}

test('creates an empty composer draft for today', () => {
  assert.deepEqual(createComposerDraft({}, { kind: 'create' }, TODAY), {
    text: '',
    date: TODAY,
  })
})

test('copies an edit into an isolated draft until save', () => {
  const timeline = freezeTimeline({
    '2026-07-17': {
      date: '2026-07-17',
      todos: [
        todo({
          id: 'edit-me',
          date: '2026-07-17',
          text: 'Original text',
        }),
      ],
    },
  })
  const before = JSON.stringify(timeline)

  const draft = createComposerDraft(
    timeline,
    { kind: 'edit', todoId: 'edit-me', sourceDate: '2026-07-17' },
    TODAY,
  )

  assert.deepEqual(draft, { text: 'Original text', date: '2026-07-17' })
  draft.text = 'Unsaved text'
  draft.date = '2026-07-20'
  assert.equal(JSON.stringify(timeline), before)
})

test('falls back to an empty draft for a missing edit target', () => {
  assert.deepEqual(
    createComposerDraft(
      {},
      { kind: 'edit', todoId: 'missing', sourceDate: '2026-07-17' },
      TODAY,
    ),
    { text: '', date: TODAY },
  )
})

test('trims and appends a created Todo without mutating the timeline', () => {
  const timeline = freezeTimeline({
    '2026-07-20': {
      date: '2026-07-20',
      todos: [
        todo({ id: 'existing', date: '2026-07-20', text: 'Already here' }),
      ],
    },
  })
  const before = JSON.stringify(timeline)
  let idCalls = 0

  const result = commitComposerDraft(
    timeline,
    { kind: 'create' },
    { text: '  First line\nSecond line  ', date: '2026-07-20' },
    {
      today: TODAY,
      idFactory: () => {
        idCalls += 1
        return 'new-id'
      },
    },
  )

  assert.equal(idCalls, 1)
  assert.equal(JSON.stringify(timeline), before)
  assert.notStrictEqual(result, timeline)
  assert.deepEqual(result['2026-07-20'].todos, [
    timeline['2026-07-20'].todos[0],
    {
      id: 'new-id',
      date: '2026-07-20',
      dayType: 4,
      done: false,
      text: 'First line\nSecond line',
    },
  ])
})

test('uses the default text when a create draft is blank', () => {
  const result = commitComposerDraft(
    {},
    { kind: 'create' },
    { text: ' \n\t ', date: '2026-07-18' },
    { today: TODAY, idFactory: () => 'default-id' },
  )

  assert.deepEqual(result, {
    '2026-07-18': {
      date: '2026-07-18',
      todos: [
        {
          id: 'default-id',
          date: '2026-07-18',
          dayType: 2,
          done: false,
          text: '写点啥呀！',
        },
      ],
    },
  })
})

test('moves an edit by stable id and appends it to the target day', () => {
  const timeline = freezeTimeline({
    '2026-07-16': {
      date: '2026-07-16',
      todos: [
        todo({
          id: 'stable-id',
          date: '2026-07-16',
          dayType: 0,
          done: true,
          text: 'Before move',
        }),
      ],
    },
    '2026-07-18': {
      date: '2026-07-18',
      todos: [
        todo({ id: 'target-first', date: '2026-07-18', text: 'Target first' }),
      ],
    },
  })
  const before = JSON.stringify(timeline)

  const result = commitComposerDraft(
    timeline,
    { kind: 'edit', todoId: 'stable-id', sourceDate: '2026-07-16' },
    { text: '  After move  ', date: '2026-07-18' },
    { today: TODAY, idFactory: () => 'unused' },
  )

  assert.equal(JSON.stringify(timeline), before)
  assert.equal('2026-07-16' in result, false)
  assert.deepEqual(
    result['2026-07-18'].todos.map((item) => item.id),
    ['target-first', 'stable-id'],
  )
  assert.deepEqual(result['2026-07-18'].todos[1], {
    id: 'stable-id',
    date: '2026-07-18',
    dayType: 2,
    done: true,
    text: 'After move',
  })
})

test('keeps a same-date edit at its original position', () => {
  const timeline = freezeTimeline({
    '2026-07-17': {
      date: '2026-07-17',
      todos: [
        todo({ id: 'before', date: '2026-07-17', text: 'Before' }),
        todo({
          id: 'edit-me',
          date: '2026-07-17',
          dayType: 99,
          done: true,
          text: 'Old text',
        }),
        todo({ id: 'after', date: '2026-07-17', text: 'After' }),
      ],
    },
  })

  const result = commitComposerDraft(
    timeline,
    { kind: 'edit', todoId: 'edit-me', sourceDate: '2026-07-17' },
    { text: '  Updated text  ', date: '2026-07-17' },
    { today: TODAY, idFactory: () => 'unused' },
  )

  assert.deepEqual(
    result['2026-07-17'].todos.map((item) => item.id),
    ['before', 'edit-me', 'after'],
  )
  assert.deepEqual(result['2026-07-17'].todos[1], {
    id: 'edit-me',
    date: '2026-07-17',
    dayType: 1,
    done: true,
    text: 'Updated text',
  })
  assert.equal(timeline['2026-07-17'].todos[1].text, 'Old text')
})

test('returns the original timeline when the edit target is missing', () => {
  const timeline = freezeTimeline({
    '2026-07-17': {
      date: '2026-07-17',
      todos: [todo({ id: 'present', date: '2026-07-17', text: 'Present' })],
    },
  })
  let idCalls = 0

  const result = commitComposerDraft(
    timeline,
    { kind: 'edit', todoId: 'missing', sourceDate: '2026-07-17' },
    { text: 'Replacement', date: '2026-07-18' },
    {
      today: TODAY,
      idFactory: () => {
        idCalls += 1
        return 'unused'
      },
    },
  )

  assert.strictEqual(result, timeline)
  assert.equal(idCalls, 0)
})

test('deletes a Todo for a blank edit and removes its empty source day', () => {
  const timeline = freezeTimeline({
    '2026-07-17': {
      date: '2026-07-17',
      todos: [todo({ id: 'delete-me', date: '2026-07-17', text: 'Delete me' })],
    },
  })
  const before = JSON.stringify(timeline)

  const result = commitComposerDraft(
    timeline,
    { kind: 'edit', todoId: 'delete-me', sourceDate: '2026-07-17' },
    { text: '  \n ', date: '2026-07-20' },
    { today: TODAY, idFactory: () => 'unused' },
  )

  assert.deepEqual(result, {})
  assert.equal(JSON.stringify(timeline), before)
})

test('cancel leaves the serialized timeline unchanged by never committing', () => {
  const timeline = freezeTimeline({
    '2026-07-17': {
      date: '2026-07-17',
      todos: [todo({ id: 'cancel-me', date: '2026-07-17', text: 'Keep me' })],
    },
  })
  const before = JSON.stringify(timeline)
  const draft = createComposerDraft(
    timeline,
    { kind: 'edit', todoId: 'cancel-me', sourceDate: '2026-07-17' },
    TODAY,
  )

  draft.text = 'Discard this change'
  draft.date = '2026-07-20'
  // Cancel closes the composer without calling commitComposerDraft.

  assert.equal(JSON.stringify(timeline), before)
})
