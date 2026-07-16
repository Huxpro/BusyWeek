import type { VisibleDay } from './timelineView.js'
// @ts-expect-error Node's direct TypeScript runner requires the on-disk extension.
import { TODO_MIN_ROW_HEIGHT } from './todoTextLayout.ts'

export const TODO_ROW_HEIGHT = TODO_MIN_ROW_HEIGHT
export const DAY_HEADER_HEIGHT = 42
export const DAY_GAP = 10

export interface DayMotionLayout {
  offset: number
  todosHeight: number
  todoOffsets: Record<string, number>
  todoHeights: Record<string, number>
}

export interface TimelineMotionLayout {
  height: number
  days: Record<string, DayMotionLayout>
}

export function createTimelineMotionLayout(
  visibleDays: VisibleDay[],
  rowHeights: Readonly<Record<string, number>> = {},
): TimelineMotionLayout {
  const days: Record<string, DayMotionLayout> = {}
  let offset = 0

  for (const day of visibleDays) {
    const todoOffsets: Record<string, number> = {}
    const todoHeights: Record<string, number> = {}
    let todosHeight = 0

    for (const todo of day.todos) {
      const suppliedHeight = rowHeights[todo.id]
      const resolvedHeight = Number.isFinite(suppliedHeight)
        ? Math.max(TODO_MIN_ROW_HEIGHT, suppliedHeight)
        : TODO_MIN_ROW_HEIGHT

      todoOffsets[todo.id] = todosHeight
      todoHeights[todo.id] = resolvedHeight
      todosHeight += resolvedHeight
    }

    days[day.key] = { offset, todosHeight, todoOffsets, todoHeights }
    offset += DAY_GAP + DAY_HEADER_HEIGHT + todosHeight
  }

  return { height: offset, days }
}
