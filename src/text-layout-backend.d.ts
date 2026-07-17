declare module '@busyweek/text-layout-backend' {
  export interface TodoTextMeasurement {
    lineCount: number
    textHeight: number
  }
  export interface DancerCopyLine { text: string; width: number }
  export interface DancerCopyBand { left: DancerCopyLine | null; right: DancerCopyLine | null }

  export const supportsRendererLayoutCorrection: boolean

  export function measureTodoText(
    text: string,
    width: number,
  ): TodoTextMeasurement | null

  export function clearTodoTextMeasurementCache(): void
  export function layoutDancerCopy(text: string, intervals: readonly { left: number; right: number }[], width: number): DancerCopyBand[]
}

declare namespace lynx {
  function getTextInfo(
    text: string,
    options: {
      fontSize: string
      fontFamily?: string
    },
  ): {
    width: number
  }
}
