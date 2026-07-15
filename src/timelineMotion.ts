import type { VisibleDay } from './timelineView.js'

export const TODO_ROW_HEIGHT = 52
export const DAY_HEADER_HEIGHT = 42
export const DAY_GAP = 10

export interface DayMotionLayout {
  offset: number
  todosHeight: number
  todoOffsets: Record<string, number>
}

export interface TimelineMotionLayout {
  height: number
  days: Record<string, DayMotionLayout>
}

export function createTimelineMotionLayout(
  visibleDays: VisibleDay[],
): TimelineMotionLayout {
  const days: Record<string, DayMotionLayout> = {}
  let offset = 0

  for (const day of visibleDays) {
    const todoOffsets: Record<string, number> = {}
    day.todos.forEach((todo, index) => {
      todoOffsets[todo.id] = index * TODO_ROW_HEIGHT
    })

    const todosHeight = day.todos.length * TODO_ROW_HEIGHT
    days[day.key] = { offset, todosHeight, todoOffsets }
    offset += DAY_GAP + DAY_HEADER_HEIGHT + todosHeight
  }

  return { height: offset, days }
}
