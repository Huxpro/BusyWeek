import type { Timeline, Todo } from './types.js'
// @ts-expect-error Node's direct TypeScript runner requires the on-disk extension.
import { getDateDiff } from './util.ts'

export type ComposerIntent =
  | { kind: 'create' }
  | { kind: 'edit'; todoId: string; sourceDate: string }

export interface ComposerDraft {
  text: string
  date: string
}

export interface CommitOptions {
  today: string
  idFactory: () => string
}

const DEFAULT_TODO_TEXT = '写点啥呀！'

export function createComposerDraft(
  timeline: Timeline,
  intent: ComposerIntent,
  today: string,
): ComposerDraft {
  if (intent.kind === 'create') return { text: '', date: today }

  const original = timeline[intent.sourceDate]?.todos.find(
    (todo) => todo.id === intent.todoId,
  )
  return original
    ? { text: original.text, date: original.date }
    : { text: '', date: today }
}

export function commitComposerDraft(
  timeline: Timeline,
  intent: ComposerIntent,
  draft: ComposerDraft,
  options: CommitOptions,
): Timeline {
  const text = draft.text.trim()

  if (intent.kind === 'create') {
    const targetDay = timeline[draft.date]
    const created: Todo = {
      id: options.idFactory(),
      date: draft.date,
      dayType: getDateDiff(draft.date, options.today),
      done: false,
      text: text || DEFAULT_TODO_TEXT,
    }

    return {
      ...timeline,
      [draft.date]: {
        date: draft.date,
        todos: [...(targetDay?.todos ?? []), created],
      },
    }
  }

  const sourceDay = timeline[intent.sourceDate]
  const sourceIndex =
    sourceDay?.todos.findIndex((todo) => todo.id === intent.todoId) ?? -1
  if (!sourceDay || sourceIndex < 0) return timeline

  const remainingTodos = sourceDay.todos.filter(
    (_, index) => index !== sourceIndex,
  )
  if (!text) {
    const result = { ...timeline }
    if (remainingTodos.length === 0) {
      delete result[intent.sourceDate]
    } else {
      result[intent.sourceDate] = { ...sourceDay, todos: remainingTodos }
    }
    return result
  }

  const updated: Todo = {
    ...sourceDay.todos[sourceIndex],
    text,
    date: draft.date,
    dayType: getDateDiff(draft.date, options.today),
  }

  if (draft.date === intent.sourceDate) {
    const todos = [...sourceDay.todos]
    todos[sourceIndex] = updated
    return {
      ...timeline,
      [intent.sourceDate]: { ...sourceDay, todos },
    }
  }

  const result = { ...timeline }
  if (remainingTodos.length === 0) {
    delete result[intent.sourceDate]
  } else {
    result[intent.sourceDate] = { ...sourceDay, todos: remainingTodos }
  }

  const targetDay = timeline[draft.date]
  result[draft.date] = {
    date: draft.date,
    todos: [...(targetDay?.todos ?? []), updated],
  }
  return result
}
