import {
  clearCache as clearPretextCache,
  layout,
  layoutNextLine,
  prepare,
  prepareWithSegments,
  type LayoutCursor,
  type PreparedTextWithSegments,
  type PreparedText,
} from '@chenglou/pretext'

export interface TodoTextMeasurement {
  lineCount: number
  textHeight: number
}

// XTextTruncation's Web `layout` event currently contains a Proxy in detail,
// which cannot cross Web Core's MessagePort boundary. Canvas/Pretext is the
// Web authority until that upstream event payload becomes structured-cloneable.
export const supportsRendererLayoutCorrection = false

type TextMeasurementGlobals = {
  OffscreenCanvas?: unknown
  Intl?: {
    Segmenter?: unknown
  }
}

const PLATFORM_FONT =
  '15px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "PingFang SC", "Hiragino Sans GB", "Microsoft YaHei", "Noto Sans CJK SC", "WenQuanYi Micro Hei", sans-serif'
const WHITE_SPACE = 'pre-wrap' as const
const LINE_HEIGHT = 20

const preparedTextCache = new Map<string, PreparedText>()
const dancerPreparedCache = new Map<string, PreparedTextWithSegments>()

function supportsTextMeasurement(): boolean {
  const globals = globalThis as unknown as TextMeasurementGlobals
  return (
    typeof globals.OffscreenCanvas === 'function' &&
    typeof globals.Intl?.Segmenter === 'function'
  )
}

function createPreparationKey(text: string): string {
  return JSON.stringify([text, PLATFORM_FONT, WHITE_SPACE])
}

export function measureTodoText(
  text: string,
  width: number,
): TodoTextMeasurement | null {
  if (typeof text !== 'string' || text.length === 0) return null
  if (!Number.isFinite(width) || width <= 0) return null
  if (!supportsTextMeasurement()) return null

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
    // Browser capability changes must not make cache cleanup crash rendering.
  }
}

export interface DancerCopyLine { text: string; width: number }
export interface DancerCopyBand { left: DancerCopyLine | null; right: DancerCopyLine | null }
export function layoutDancerCopy(text: string, intervals: readonly { left: number; right: number }[], width: number): DancerCopyBand[] {
  if (!supportsTextMeasurement() || !text || width <= 0) return []
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
