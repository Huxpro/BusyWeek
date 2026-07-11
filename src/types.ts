/**
 * BusyWeek data model.
 *
 * The timeline is a map keyed by a `yyyy-mm-dd` date string. Each entry holds
 * the todos due on that day. This mirrors the original web app's structure so
 * persisted data stays forward-compatible.
 *
 *   Timeline  { "2026-06-23": DayObject, ... }
 *   DayObject { date, todos: [Todo] }
 *   Todo      { id, date, dayType, done, text }
 */

export interface Todo {
  /** Stable id, used as the v-for key. */
  id: string
  /** Deadline as a `yyyy-mm-dd` string. */
  date: string
  /** Relative day offset selected when the todo was created (0 = today …). */
  dayType: number
  /** Whether the todo is completed. */
  done: boolean
  /** Todo content. */
  text: string
}

export interface DayObject {
  date: string
  todos: Todo[]
}

export type Timeline = Record<string, DayObject>

/** The three list filters from the original app. */
export type Filter = 'all' | 'active' | 'done'
