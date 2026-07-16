import {
  clearCache as clearPretextCache,
  layout,
  prepare,
  type PreparedText,
} from 'lynx-pretext'

export interface TodoTextMeasurement {
  lineCount: number
  textHeight: number
}

const PLATFORM_FONT = '15px sans-serif'
const WHITE_SPACE = 'pre-wrap' as const
const LINE_HEIGHT = 20

const preparedTextCache = new Map<string, PreparedText>()

function createPreparationKey(text: string): string {
  return JSON.stringify([text, PLATFORM_FONT, WHITE_SPACE])
}

export function measureTodoText(
  text: string,
  width: number,
): TodoTextMeasurement | null {
  if (typeof text !== 'string' || text.length === 0) return null
  if (!Number.isFinite(width) || width <= 0) return null

  try {
    const preparationKey = createPreparationKey(text)
    let prepared = preparedTextCache.get(preparationKey)

    if (prepared === undefined) {
      prepared = prepare(text, PLATFORM_FONT, { whiteSpace: WHITE_SPACE })
      preparedTextCache.set(preparationKey, prepared)
    }

    const result = layout(prepared, width, LINE_HEIGHT)
    if (
      !Number.isFinite(result.lineCount) ||
      result.lineCount <= 0 ||
      !Number.isFinite(result.height) ||
      result.height <= 0
    ) {
      return null
    }

    return {
      lineCount: result.lineCount,
      textHeight: result.height,
    }
  } catch {
    return null
  }
}

export function clearTodoTextMeasurementCache(): void {
  preparedTextCache.clear()

  try {
    clearPretextCache()
  } catch {
    // A missing native text capability must not make cache cleanup crash UI work.
  }
}
