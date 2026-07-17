import {
  clearCache as clearPretextCache,
  layout,
  layoutNextLine,
  prepare,
  prepareWithSegments,
  type LayoutCursor,
  type PreparedTextWithSegments,
  type PreparedText,
} from 'lynx-pretext'

export interface TodoTextMeasurement {
  lineCount: number
  textHeight: number
}

export const supportsRendererLayoutCorrection = true

const PLATFORM_FONT = '15px sans-serif'
// Lynx text preserves explicit line feeds from the composer. Predict those
// hard breaks up front; the renderer `layout` event still corrects glyph edges.
const WHITE_SPACE = 'pre-wrap' as const
const LINE_HEIGHT = 20

const preparedTextCache = new Map<string, PreparedText>()
const dancerPreparedCache = new Map<string, PreparedTextWithSegments>()

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
  dancerPreparedCache.clear()

  try {
    clearPretextCache()
  } catch {
    // A missing native text capability must not make cache cleanup crash UI work.
  }
}

export interface DancerCopyLine { text: string; width: number }
export interface DancerCopyBand { left: DancerCopyLine | null; right: DancerCopyLine | null }
export function layoutDancerCopy(text: string, intervals: readonly { left: number; right: number }[], width: number): DancerCopyBand[] {
  if (!text || width <= 0) return []
  try {
    let prepared = dancerPreparedCache.get(text)
    if (!prepared) {
      prepared = prepareWithSegments(text, PLATFORM_FONT, { whiteSpace: WHITE_SPACE })
      dancerPreparedCache.set(text, prepared)
    }
    let cursor: LayoutCursor = { segmentIndex: 0, graphemeIndex: 0 }
    const bands: DancerCopyBand[] = []
    for (const interval of intervals) {
      const left = layoutNextLine(prepared, cursor, Math.max(1, interval.left * width))
      if (!left) break
      cursor = left.end
      const right = layoutNextLine(prepared, cursor, Math.max(1, (1 - interval.right) * width))
      if (right) cursor = right.end
      bands.push({ left: { text: left.text, width: left.width }, right: right ? { text: right.text, width: right.width } : null })
    }
    return bands
  } catch { return [] }
}
