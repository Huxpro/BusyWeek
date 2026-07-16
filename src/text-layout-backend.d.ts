declare module '@busyweek/text-layout-backend' {
  export interface TodoTextMeasurement {
    lineCount: number
    textHeight: number
  }

  export function measureTodoText(
    text: string,
    width: number,
  ): TodoTextMeasurement | null

  export function clearTodoTextMeasurementCache(): void
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
