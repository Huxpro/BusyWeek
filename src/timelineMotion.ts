import type { VisibleDay } from './timelineView.js'
// @ts-expect-error Node's direct TypeScript runner requires the on-disk extension.
import { TODO_MIN_ROW_HEIGHT } from './todoTextLayout.ts'

export const TODO_ROW_HEIGHT = TODO_MIN_ROW_HEIGHT
export const DAY_HEADER_HEIGHT = 42
export const DAY_GAP = 10

export interface DayMotionLayout {
  offset: number
  expanded: boolean
  expandedTodosHeight: number
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
  expandedDayKey: string | null | undefined = undefined,
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

    const expanded = expandedDayKey === undefined || day.key === expandedDayKey
    const expandedTodosHeight = todosHeight
    todosHeight = expanded ? expandedTodosHeight : 0

    days[day.key] = {
      offset,
      expanded,
      expandedTodosHeight,
      todosHeight,
      todoOffsets,
      todoHeights,
    }
    offset += DAY_GAP + DAY_HEADER_HEIGHT + todosHeight
  }

  return { height: offset, days }
}

/** Keep the content at the current viewport position when layout changes above it. */
export function getAnchoredScrollTop(
  scrollTop: number,
  before: TimelineMotionLayout,
  after: TimelineMotionLayout,
): number {
  if (!Number.isFinite(scrollTop) || scrollTop <= 0) return 0

  let delta = 0
  for (const [key, previousDay] of Object.entries(before.days)) {
    if (previousDay.offset + DAY_HEADER_HEIGHT > scrollTop) continue
    const nextDay = after.days[key]
    if (!nextDay) continue
    delta += nextDay.todosHeight - previousDay.todosHeight
  }

  return Math.max(0, scrollTop + delta)
}
