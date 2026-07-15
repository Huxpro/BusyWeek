import type { Timeline, Todo } from './types.js'

export interface VisibleDay {
  key: string
  todos: Todo[]
}

/** Project persisted timeline data without mutating it. */
export function getVisibleDays(
  timeline: Timeline,
  showCompleted: boolean,
): VisibleDay[] {
  return Object.keys(timeline)
    .sort()
    .map((key) => ({
      key,
      todos: timeline[key].todos.filter(
        (todo) => showCompleted || !todo.done,
      ),
    }))
    .filter((day) => day.todos.length > 0)
}
