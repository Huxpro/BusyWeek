import type { Timeline } from './types.js'

const STARTER_TODO_TEXTS = [
  '右上角可显示或隐藏已完成',
  '点击文字编辑事项',
  '点击圆圈完成事项',
] as const

/** Create the instructional timeline shown only when no stored value exists. */
export function createStarterTimeline(date: string): Timeline {
  return {
    [date]: {
      date,
      todos: STARTER_TODO_TEXTS.map((text, index) => ({
        id: `starter-${index + 1}`,
        date,
        dayType: 0,
        done: false,
        text,
      })),
    },
  }
}
