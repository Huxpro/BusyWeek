import assert from 'node:assert/strict'
import test from 'node:test'

import {
  TODO_MIN_ROW_HEIGHT,
  TODO_TEXT_LINE_HEIGHT,
  TODO_VERTICAL_CHROME,
  rowHeightFromLayoutEvent,
  rowHeightFromTextHeight,
} from '../src/todoTextLayout.ts'

test('derives todo row height from measured text height without a line cap', () => {
  assert.equal(rowHeightFromTextHeight(20), 52)
  assert.equal(rowHeightFromTextHeight(40), 56)
  assert.equal(rowHeightFromTextHeight(80), 96)
  assert.equal(rowHeightFromTextHeight(160), 176)
})

test('uses the minimum row height for invalid or non-positive text height', () => {
  assert.equal(rowHeightFromTextHeight(Number.NaN), TODO_MIN_ROW_HEIGHT)
  assert.equal(rowHeightFromTextHeight(0), TODO_MIN_ROW_HEIGHT)
  assert.equal(rowHeightFromTextHeight(-1), TODO_MIN_ROW_HEIGHT)
})

test('returns null when a text layout event has no valid line count', () => {
  assert.equal(rowHeightFromLayoutEvent({}), null)
  assert.equal(
    rowHeightFromLayoutEvent({
      detail: { lineCount: Number.NaN, size: { height: 80 } },
    }),
    null,
  )
  assert.equal(
    rowHeightFromLayoutEvent({
      detail: { lineCount: Number.POSITIVE_INFINITY, size: { height: 80 } },
    }),
    null,
  )
  assert.equal(
    rowHeightFromLayoutEvent({
      detail: { lineCount: Number.NEGATIVE_INFINITY, size: { height: 80 } },
    }),
    null,
  )
  assert.equal(
    rowHeightFromLayoutEvent({
      detail: { lineCount: 0, size: { height: 80 } },
    }),
    null,
  )
})

test('uses renderer text height from a valid layout event', () => {
  assert.equal(
    rowHeightFromLayoutEvent({
      detail: {
        lineCount: 4,
        size: { width: 180, height: 80 },
      },
    }),
    96,
  )
})

test('falls back to line count when renderer text height is missing or invalid', () => {
  const expectedHeight =
    4 * TODO_TEXT_LINE_HEIGHT + TODO_VERTICAL_CHROME

  assert.equal(
    rowHeightFromLayoutEvent({ detail: { lineCount: 4 } }),
    expectedHeight,
  )
  assert.equal(
    rowHeightFromLayoutEvent({
      detail: { lineCount: 4, size: { height: Number.NaN } },
    }),
    expectedHeight,
  )
  assert.equal(
    rowHeightFromLayoutEvent({
      detail: { lineCount: 4, size: { height: 0 } },
    }),
    expectedHeight,
  )
})
