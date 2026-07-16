export const TODO_MIN_ROW_HEIGHT = 52
export const TODO_TEXT_LINE_HEIGHT = 20
export const TODO_VERTICAL_CHROME = 16

export function rowHeightFromTextHeight(textHeight: number): number {
  if (!Number.isFinite(textHeight) || textHeight <= 0) {
    return TODO_MIN_ROW_HEIGHT
  }

  return Math.max(
    TODO_MIN_ROW_HEIGHT,
    Math.ceil(textHeight) + TODO_VERTICAL_CHROME,
  )
}

export function rowHeightFromLayoutEvent(event: unknown): number | null {
  const detail = (
    event as {
      detail?: { lineCount?: unknown; size?: { height?: unknown } }
    }
  )?.detail
  const height = detail?.size?.height
  const lineCount = detail?.lineCount

  if (typeof lineCount !== 'number' || lineCount < 1) {
    return null
  }

  if (
    typeof height !== 'number' ||
    !Number.isFinite(height) ||
    height <= 0
  ) {
    return rowHeightFromTextHeight(lineCount * TODO_TEXT_LINE_HEIGHT)
  }

  return rowHeightFromTextHeight(height)
}
