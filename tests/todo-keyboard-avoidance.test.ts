import assert from 'node:assert/strict'
import test from 'node:test'

import {
  calculateTodoKeyboardAvoidance,
  keepTodoEditAboveKeyboard,
} from '../src/todoKeyboardAvoidance.ts'

test('scrolls a covered input just above the keyboard', () => {
  assert.deepEqual(
    calculateTodoKeyboardAvoidance({
      rootBottom: 874,
      viewportBottom: 874,
      inputBottom: 738,
      scrollY: 0,
      keyboardHeight: 308,
    }),
    {
      spacerHeight: 308,
      visibleBottom: 566,
      overlap: 188,
      targetScrollY: 188,
    },
  )
})

test('does not move a todo that is already visible', () => {
  assert.deepEqual(
    calculateTodoKeyboardAvoidance({
      rootBottom: 874,
      viewportBottom: 874,
      inputBottom: 500,
      scrollY: 120,
      keyboardHeight: 308,
    }),
    {
      spacerHeight: 308,
      visibleBottom: 566,
      overlap: 0,
      targetScrollY: null,
    },
  )
})

test('adds overlap to the current absolute scroll position', () => {
  const plan = calculateTodoKeyboardAvoidance({
    rootBottom: 874,
    viewportBottom: 874,
    inputBottom: 610,
    scrollY: 180,
    keyboardHeight: 308,
  })

  assert.equal(plan.overlap, 60)
  assert.equal(plan.targetScrollY, 240)
})

test('subtracts a viewport bottom gap from the keyboard spacer', () => {
  const plan = calculateTodoKeyboardAvoidance({
    rootBottom: 874,
    viewportBottom: 824,
    inputBottom: 600,
    scrollY: 0,
    keyboardHeight: 308,
  })

  assert.equal(plan.spacerHeight, 258)
  assert.equal(plan.visibleBottom, 566)
  assert.equal(plan.targetScrollY, 50)
})

test('invalid or hidden keyboard heights clear avoidance without scrolling', () => {
  for (const keyboardHeight of [0, -1, Number.NaN]) {
    assert.deepEqual(
      calculateTodoKeyboardAvoidance({
        rootBottom: 874,
        viewportBottom: 824,
        inputBottom: 800,
        scrollY: 120,
        keyboardHeight,
      }),
      {
        spacerHeight: 0,
        visibleBottom: 824,
        overlap: 0,
        targetScrollY: null,
      },
    )
  }
})

type InvokeOptions = {
  method: string
  params?: Record<string, unknown>
  success?: (value: unknown) => void
  fail?: (error: unknown) => void
}

function createNativeHarness(options?: {
  inputBottom?: number
  scrollY?: number
  scrollTop?: number
}) {
  const calls: Array<{
    selector: string
    options: InvokeOptions
  }> = []
  const rects: Record<string, unknown> = {
    '#app-root': { bottom: 874 },
    '#timeline-scroll': { bottom: 874 },
    '#edit-todo-1': { bottom: options?.inputBottom ?? 738 },
  }

  return {
    calls,
    createSelectorQuery() {
      let selector = ''
      let invocation: InvokeOptions | undefined

      const query = {
        select(value: string) {
          selector = value
          return query
        },
        invoke(value: InvokeOptions) {
          invocation = value
          calls.push({ selector, options: value })
          return query
        },
        exec() {
          assert.ok(invocation)
          if (invocation.method === 'boundingClientRect') {
            invocation.success?.(rects[selector])
          } else if (invocation.method === 'getScrollInfo') {
            invocation.success?.(
              options?.scrollTop === undefined
                ? { scrollY: options?.scrollY ?? 0 }
                : { scrollTop: options.scrollTop },
            )
          } else if (invocation.method === 'scrollTo') {
            invocation.success?.({})
          } else {
            invocation.fail?.(new Error(`unexpected method ${invocation.method}`))
          }
        },
      }

      return query
    },
  }
}

test('measures transformed screen rects and performs offset-only absolute scrollTo', async () => {
  const harness = createNativeHarness({ scrollY: 40 })
  const spacerHeights: number[] = []
  const ticks: string[] = []

  const plan = await keepTodoEditAboveKeyboard({
    inputId: 'todo-1',
    keyboardHeight: 308,
    createSelectorQuery: harness.createSelectorQuery,
    nextTick: async () => {
      ticks.push('tick')
    },
    onSpacerHeight: (height) => spacerHeights.push(height),
  })

  assert.deepEqual(plan, {
    spacerHeight: 308,
    visibleBottom: 566,
    overlap: 188,
    targetScrollY: 228,
  })
  assert.deepEqual(spacerHeights, [308])
  assert.equal(ticks.length, 2)

  const rectCalls = harness.calls.filter(
    (call) => call.options.method === 'boundingClientRect',
  )
  assert.deepEqual(
    rectCalls.map((call) => call.selector).sort(),
    ['#app-root', '#edit-todo-1', '#timeline-scroll'],
  )
  for (const call of rectCalls) {
    assert.deepEqual(call.options.params, {
      relativeTo: 'screen',
      androidEnableTransformProps: true,
      iosEnableTransformProps: true,
      harmonyEnableTransformProps: true,
    })
    assert.equal(typeof call.options.fail, 'function')
  }

  const getScrollInfo = harness.calls.find(
    (call) => call.options.method === 'getScrollInfo',
  )
  assert.equal(getScrollInfo?.selector, '#timeline-scroll')
  assert.equal(typeof getScrollInfo?.options.fail, 'function')

  const scrollTo = harness.calls.find(
    (call) => call.options.method === 'scrollTo',
  )
  assert.equal(scrollTo?.selector, '#timeline-scroll')
  assert.deepEqual(scrollTo?.options.params, {
    offset: 228,
    smooth: true,
  })
  assert.equal(typeof scrollTo?.options.fail, 'function')
})

test('keeps the spacer but skips scrollTo when the input is already visible', async () => {
  const harness = createNativeHarness({ inputBottom: 500, scrollY: 90 })

  const plan = await keepTodoEditAboveKeyboard({
    inputId: 'todo-1',
    keyboardHeight: 308,
    createSelectorQuery: harness.createSelectorQuery,
    nextTick: async () => {},
    onSpacerHeight: () => {},
  })

  assert.equal(plan?.targetScrollY, null)
  assert.equal(
    harness.calls.some((call) => call.options.method === 'scrollTo'),
    false,
  )
})

test('uses the scrollTop alias when the native scroll backend omits scrollY', async () => {
  const harness = createNativeHarness({ scrollTop: 40 })

  const plan = await keepTodoEditAboveKeyboard({
    inputId: 'todo-1',
    keyboardHeight: 308,
    createSelectorQuery: harness.createSelectorQuery,
    nextTick: async () => {},
    onSpacerHeight: () => {},
  })

  assert.equal(plan?.targetScrollY, 228)
  const scrollTo = harness.calls.find(
    (call) => call.options.method === 'scrollTo',
  )
  assert.deepEqual(scrollTo?.options.params, {
    offset: 228,
    smooth: true,
  })
})

test('cancels before scrolling when focus changes during async layout', async () => {
  const harness = createNativeHarness()
  let current = true

  const plan = await keepTodoEditAboveKeyboard({
    inputId: 'todo-1',
    keyboardHeight: 308,
    createSelectorQuery: harness.createSelectorQuery,
    nextTick: async () => {},
    isCurrent: () => current,
    onSpacerHeight: () => {
      current = false
    },
  })

  assert.equal(plan, null)
  assert.equal(
    harness.calls.some((call) => call.options.method === 'scrollTo'),
    false,
  )
})
