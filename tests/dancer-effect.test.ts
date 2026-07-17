import assert from 'node:assert/strict'
import test from 'node:test'

import {
  DANCER_FRAME_COUNT,
  createLongPressArbiter,
  dancerFrameAt,
  dancerProfile,
  spriteTransform,
} from '../src/dancerEffect.ts'

test('frame selection follows 12fps cadence and wraps', () => {
  assert.equal(dancerFrameAt(0), 0)
  assert.equal(dancerFrameAt(84), 1)
  assert.equal(dancerFrameAt((1000 / 12) * DANCER_FRAME_COUNT), 0)
  assert.equal(dancerFrameAt(999, true), 0)
})

test('sprite transform maps every frame into the 4x4 sheet', () => {
  assert.equal(spriteTransform(0), 'translate(0%, 0%)')
  assert.equal(spriteTransform(5), 'translate(-25%, -25%)')
  assert.equal(spriteTransform(15), 'translate(-75%, -75%)')
})

test('exclusion intervals remain ordered and within the copy column', () => {
  for (let frame = 0; frame < DANCER_FRAME_COUNT; frame += 1) {
    for (const interval of dancerProfile(frame)) {
      assert.ok(interval.left > 0 && interval.left < interval.right)
      assert.ok(interval.right < 1)
    }
  }
})

test('long-press arbitration cancels short touches and fires once after winning', async () => {
  let wins = 0
  const arbiter = createLongPressArbiter(() => { wins += 1 }, 15)
  arbiter.start()
  arbiter.cancel()
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(wins, 0)
  arbiter.start()
  await new Promise((resolve) => setTimeout(resolve, 20))
  assert.equal(wins, 1)
  assert.equal(arbiter.cancel(), true)
  arbiter.dispose()
})
