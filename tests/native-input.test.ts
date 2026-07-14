import assert from 'node:assert/strict'
import test from 'node:test'

import { syncNativeInputOnMount } from '../src/nativeInput.ts'

test('seeds a newly mounted native input with the current todo before focusing', async () => {
  const calls: unknown[] = []
  const selected = {
    invoke(options: unknown) {
      calls.push(['invoke', options])
      return this
    },
    exec() {
      calls.push(['exec'])
    },
  }

  await syncNativeInputOnMount({
    el: {
      focus() {
        calls.push(['web-focus'])
      },
    },
    id: 'edit-todo-1',
    value: 'existing todo',
    nextTick: async () => {
      calls.push(['nextTick'])
    },
    fail: assert.fail,
    createSelectorQuery: () => ({
      select(selector: string) {
        calls.push(['select', selector])
        return selected
      },
    }),
  })

  assert.deepEqual(calls, [
    ['nextTick'],
    ['select', '#edit-todo-1'],
    [
      'invoke',
      {
        method: 'setValue',
        params: { value: 'existing todo' },
        fail: assert.fail,
      },
    ],
    ['exec'],
    ['web-focus'],
    ['select', '#edit-todo-1'],
    ['invoke', { method: 'focus', fail: assert.fail }],
    ['exec'],
  ])
})
