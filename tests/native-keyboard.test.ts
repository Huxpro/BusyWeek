import assert from 'node:assert/strict'
import { existsSync } from 'node:fs'
import test from 'node:test'

const moduleUrl = new URL('../src/nativeKeyboard.ts', import.meta.url)

test('reads the legacy native textarea keyboard event', async () => {
  assert.equal(
    existsSync(moduleUrl),
    true,
    'the native element keyboard adapter must exist',
  )

  const { getElementKeyboardHeight } = await import(moduleUrl.href)

  assert.equal(
    getElementKeyboardHeight({
      detail: { show: true, keyboardHeight: 291, safeAreaBottom: 34 },
    }),
    291,
  )
  assert.equal(
    getElementKeyboardHeight({
      detail: { show: false, keyboardHeight: 291, safeAreaBottom: 34 },
    }),
    0,
  )
})

test('also accepts the newer keyboardheightchange element payload', async () => {
  assert.equal(
    existsSync(moduleUrl),
    true,
    'the native element keyboard adapter must exist',
  )

  const { getElementKeyboardHeight } = await import(moduleUrl.href)

  assert.equal(getElementKeyboardHeight({ detail: { height: 276 } }), 276)
  assert.equal(getElementKeyboardHeight({ detail: { height: -1 } }), 0)
  assert.equal(getElementKeyboardHeight({}), 0)
})
