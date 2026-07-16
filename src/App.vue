<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue-lynx'
import {
  clearTodoTextMeasurementCache,
  measureTodoText,
} from '@busyweek/text-layout-backend'

import './App.css'
import {
  getElementKeyboardHeight,
  type NativeKeyboardEvent,
} from './nativeKeyboard.js'
import { createStarterTimeline } from './starterTimeline.js'
import { loadTimeline, saveTimeline } from './store.js'
import { createTimelineMotionLayout } from './timelineMotion.js'
import {
  TODO_MIN_ROW_HEIGHT,
  rowHeightFromLayoutEvent,
  rowHeightFromTextHeight,
} from './todoTextLayout.js'
import { getVisibleDays } from './timelineView.js'
import {
  commitComposerDraft,
  createComposerDraft,
  type ComposerIntent,
} from './todoComposer.js'
import type { Timeline, Todo } from './types.js'
import {
  getDateDiff,
  getDay,
  getDayType,
  getDiffDate,
  getPickerLabel,
  getTodayDate,
  parseDate,
} from './util.js'
import DatePickerSheet from './components/DatePickerSheet.vue'
import DayPickerSheet from './components/DayPickerSheet.vue'

type AppState = 'LIST' | 'INPUT'
type TodoTextLayoutBinding = {
  key: string
  onLayout: (event: unknown) => void
}

const TODO_WIDTH_FALLBACK = 240

// --- reactive state (ported from the original `data` object) ---------------
const state = ref<AppState>('LIST')
const timeline = ref<Timeline>({})
const showCompleted = ref(true)
const composerIntent = ref<ComposerIntent>({ kind: 'create' })
const composerText = ref('')
const composerDate = ref(getTodayDate())
const composerTitle = computed(() =>
  composerIntent.value.kind === 'edit' ? '编辑事项' : '添加事项',
)
const composerSubmitLabel = computed(() =>
  composerIntent.value.kind === 'edit' ? '保存' : '添加',
)

// cross-platform pickers (built from Lynx primitives — work on web + native)
const dayPickerOpen = ref(false)
const datePickerOpen = ref(false)

// soft-keyboard height (device-independent px), used to lift the composer's
// bottom bar clear of the keyboard on native. The input element event works
// on older iOS hosts; the global event remains as a newer-runtime fallback.
const keyboardHeight = ref(0)

// Pretext gives the background thread an immediate layout prediction. Native
// renderer measurements below remain authoritative for font/bidi/emoji edges.
const todoTextWidth = ref(TODO_WIDTH_FALLBACK)
const correctedTodoHeights = ref<Record<string, number>>({})
const todoTextLayoutRevision = ref(0)
const todoTextEditGenerations = new Map<string, number>()
const todoTextLayoutBindings = new Map<string, TodoTextLayoutBinding>()
const lastTodoLayoutHeights = new Map<string, number>()

// Fast relative-day choices complement (rather than replace) the full day and
// calendar pickers. Fixed choices keep the strip predictable on small screens.
const quickDayOffsets = [0, 1, 2, 3, 4, 5, 6, 7]
const selectedDayOffset = computed(() =>
  getDateDiff(composerDate.value, getTodayDate()),
)

// day-type + weekday label for the currently chosen date
const dayTypeLabel = computed(
  () => `${getDayType(composerDate.value)} ${getDay(composerDate.value)}`,
)
// short "M月D日" for the date field
const prettyDate = computed(() => {
  const { month0, day } = parseDate(composerDate.value)
  return `${month0 + 1}月${day}日`
})

// --- keyboard avoidance (native) -------------------------------------------
// Lynx has no keyboard-height CSS/viewport primitive, so native events update
// an explicit offset. `height` is in device-independent px (the same unit as
// Lynx CSS px), so it maps 1:1 onto paddingBottom.
// https://lynxjs.org/api/elements/built-in/input.html#keyboard-avoidance
function onKeyboardStatus(status: string, height: number) {
  keyboardHeight.value = status === 'on' ? height : 0
}
function onComposerKeyboard(event: NativeKeyboardEvent) {
  keyboardHeight.value = getElementKeyboardHeight(event)
}
let removeKbListener: (() => void) | undefined
function bindKeyboard() {
  // Guarded: on Lynx-for-Web the runtime resizes <lynx-view> to the visual
  // viewport (web/index.html) and does not emit this event, so this no-ops.
  try {
    if (typeof lynx === 'undefined') return
    const emitter = (lynx as any).getJSModule?.('GlobalEventEmitter')
    if (!emitter?.addListener) return
    emitter.addListener('keyboardstatuschanged', onKeyboardStatus)
    removeKbListener = () =>
      emitter.removeListener?.('keyboardstatuschanged', onKeyboardStatus)
  } catch {
    /* GlobalEventEmitter unavailable — web handles avoidance separately */
  }
}

// --- load & persist --------------------------------------------------------
onMounted(async () => {
  bindKeyboard()
  await nextTick()
  measureTodoWidthProbe()
  const stored = await loadTimeline()
  timeline.value = stored ?? createStarterTimeline(getTodayDate())
})

onUnmounted(() => {
  removeKbListener?.()
  lastTodoLayoutHeights.clear()
  clearTodoTextMeasurementCache()
})

watch(timeline, (tl) => saveTimeline(tl), { deep: true })

// --- derived view ----------------------------------------------------------
const visibleDays = computed(() =>
  getVisibleDays(timeline.value, showCompleted.value),
)
const predictedTodoHeights = computed(() => {
  const heights: Record<string, number> = {}

  for (const day of visibleDays.value) {
    for (const todo of day.todos) {
      const measurement = measureTodoText(todo.text, todoTextWidth.value)
      const predictedHeight = rowHeightFromTextHeight(
        measurement?.textHeight ?? 0,
      )
      const correctedHeight = correctedTodoHeights.value[todo.id]

      heights[todo.id] =
        typeof correctedHeight === 'number' &&
        Number.isFinite(correctedHeight)
          ? correctedHeight
          : predictedHeight
    }
  }

  return heights
})
const motionLayout = computed(() =>
  createTimelineMotionLayout(
    visibleDays.value,
    predictedTodoHeights.value,
  ),
)
const dayListStyle = computed(() => ({
  height: `${motionLayout.value.height}px`,
}))

function daySlotStyle(dayKey: string) {
  const offset = motionLayout.value.days[dayKey]?.offset ?? 0
  return { transform: `translateY(${offset}px)` }
}

function dayTodosStyle(dayKey: string) {
  const height = motionLayout.value.days[dayKey]?.todosHeight ?? 0
  return { height: `${height}px` }
}

function todoSlotStyle(dayKey: string, todoId: string) {
  const offset = motionLayout.value.days[dayKey]?.todoOffsets[todoId] ?? 0
  const height = resolveTodoLayoutHeight(dayKey, todoId)
  return {
    height: `${height}px`,
    transform: `translateY(${offset}px)`,
  }
}

function todoRowStyle(dayKey: string, todoId: string) {
  const height = resolveTodoLayoutHeight(dayKey, todoId)
  return { height: `${height}px` }
}

function resolveTodoLayoutHeight(dayKey: string, todoId: string): number {
  const height = motionLayout.value.days[dayKey]?.todoHeights[todoId]

  if (typeof height === 'number' && Number.isFinite(height)) {
    lastTodoLayoutHeights.set(todoId, height)
    return height
  }

  return lastTodoLayoutHeights.get(todoId) ?? TODO_MIN_ROW_HEIGHT
}

const isEmpty = computed(() => visibleDays.value.length === 0)
const hasStoredTodos = computed(() =>
  Object.values(timeline.value).some((day) => day.todos.length > 0),
)
const hasOnlyHiddenCompleted = computed(
  () => !showCompleted.value && hasStoredTodos.value && isEmpty.value,
)
const emptyText = computed(() =>
  hasOnlyHiddenCompleted.value ? '待忙事项都完成了' : '这周还不忙',
)
const emptyHint = computed(() =>
  hasOnlyHiddenCompleted.value
    ? '打开右上角查看已完成'
    : '点右下角 + 添加事项吧',
)

// --- helpers exposed to the template ---------------------------------------
function isToday(dateStr: string): boolean {
  return dateStr === getTodayDate()
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

function normalizeTodoWidth(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) && value > 0
    ? value
    : null
}

function createTodoTextLayoutToken(
  todoId: string,
  editGeneration: number,
  widthRevision: number,
): string {
  return `${todoId}:${editGeneration}:${widthRevision}`
}

function isCurrentTodoTextLayoutBinding(
  bindings: Map<string, TodoTextLayoutBinding>,
  todoId: string,
  binding: TodoTextLayoutBinding,
): boolean {
  return bindings.get(todoId) === binding
}

function updateTodoTextWidth(width: number) {
  if (!Number.isFinite(width) || width <= 0) return
  if (Math.abs(width - todoTextWidth.value) <= 0.5) return

  todoTextWidth.value = width
  correctedTodoHeights.value = {}
  // Uncapped x-text emits `layout` when connected, but does not observe width
  // changes. Remount only its measurement node so renderer authority returns.
  todoTextLayoutRevision.value += 1
  todoTextLayoutBindings.clear()
}

function refreshTodoTextLayoutAfterEdit(todoId: string) {
  const currentGeneration = todoTextEditGenerations.get(todoId) ?? 0
  todoTextEditGenerations.set(todoId, currentGeneration + 1)
  todoTextLayoutBindings.delete(todoId)
}

function getTodoTextLayoutBinding(todoId: string): TodoTextLayoutBinding {
  const key = createTodoTextLayoutToken(
    todoId,
    todoTextEditGenerations.get(todoId) ?? 0,
    todoTextLayoutRevision.value,
  )
  const currentBinding = todoTextLayoutBindings.get(todoId)
  if (currentBinding?.key === key) return currentBinding

  const binding: TodoTextLayoutBinding = {
    key,
    onLayout: (event) => {
      if (
        !isCurrentTodoTextLayoutBinding(
          todoTextLayoutBindings,
          todoId,
          binding,
        )
      ) return
      onTodoTextLayout(todoId, event)
    },
  }
  todoTextLayoutBindings.set(todoId, binding)
  return binding
}

function onTodoWidthProbeLayout(event: {
  detail?: { width?: unknown; size?: { width?: unknown } }
}) {
  const width =
    normalizeTodoWidth(event.detail?.width) ??
    normalizeTodoWidth(event.detail?.size?.width)
  if (width !== null) updateTodoTextWidth(width)
}

function measureTodoWidthProbe() {
  try {
    if (typeof lynx === 'undefined') return
    ;(lynx as unknown as { createSelectorQuery: () => any })
      .createSelectorQuery()
      .select('#todo-width-probe-body')
      .invoke({
        method: 'boundingClientRect',
        success: (result: {
          width?: unknown
          data?: { width?: unknown }
        }) => {
          const width =
            normalizeTodoWidth(result?.width) ??
            normalizeTodoWidth(result?.data?.width)
          if (width !== null) updateTodoTextWidth(width)
        },
        fail: () => {},
      })
      .exec()
  } catch {
    /* The stable 240px fallback remains when SelectorQuery is unavailable. */
  }
}

function onTodoTextLayout(todoId: string, event: unknown) {
  const height = rowHeightFromLayoutEvent(event)
  if (height === null) return

  const currentHeight = correctedTodoHeights.value[todoId]
  if (
    typeof currentHeight === 'number' &&
    Math.abs(currentHeight - height) <= 0.5
  ) {
    return
  }

  correctedTodoHeights.value = {
    ...correctedTodoHeights.value,
    [todoId]: height,
  }
}

function clearCorrectedTodoHeight(todoId: string) {
  if (!(todoId in correctedTodoHeights.value)) return

  const nextHeights = { ...correctedTodoHeights.value }
  delete nextHeights[todoId]
  correctedTodoHeights.value = nextHeights
}

// --- actions ---------------------------------------------------------------
async function openComposer(intent: ComposerIntent) {
  const draft = createComposerDraft(timeline.value, intent, getTodayDate())
  composerIntent.value = intent
  composerText.value = draft.text
  composerDate.value = draft.date
  dayPickerOpen.value = false
  datePickerOpen.value = false
  keyboardHeight.value = 0
  state.value = 'INPUT'
  await nextTick()
  setComposerValue(composerText.value)
  focusComposer()
}

async function openCreateComposer() {
  await openComposer({ kind: 'create' })
}

async function openTodoEditor(dayKey: string, todo: Todo) {
  await openComposer({
    kind: 'edit',
    todoId: todo.id,
    sourceDate: dayKey,
  })
}

function closeComposer() {
  dismissKb()
  dayPickerOpen.value = false
  datePickerOpen.value = false
  keyboardHeight.value = 0
  state.value = 'LIST'
}

// keyboard dismiss: blur the textarea (hides the soft keyboard)
const taEl = ref<{ blur?: () => void; focus?: () => void } | null>(null)
function focusComposer() {
  taEl.value?.focus?.()
  try {
    if (typeof lynx !== 'undefined') {
      ;(lynx as unknown as { createSelectorQuery: () => any })
        .createSelectorQuery()
        .select('#addpage-ta')
        .invoke({ method: 'focus', fail: () => {} })
        .exec()
    }
  } catch {
    /* SelectorQuery unavailable — the web focus() call above covers it */
  }
}
function setComposerValue(value: string) {
  try {
    if (typeof lynx !== 'undefined') {
      ;(lynx as unknown as { createSelectorQuery: () => any })
        .createSelectorQuery()
        .select('#addpage-ta')
        // vue-lynx 0.4.0 only updates the native `value` attribute after mount;
        // iOS requires the element UI method for programmatic resets (#203).
        .invoke({ method: 'setValue', params: { value }, fail: () => {} })
        .exec()
    }
  } catch {
    /* SelectorQuery unavailable — web reflects the value attribute directly */
  }
}
function dismissKb() {
  // web: the x-textarea custom element exposes blur()
  taEl.value?.blur?.()
  // native: no DOM blur() — invoke the element's blur UI method via SelectorQuery
  try {
    if (typeof lynx !== 'undefined') {
      ;(lynx as unknown as { createSelectorQuery: () => any })
        .createSelectorQuery()
        .select('#addpage-ta')
        .invoke({ method: 'blur', fail: () => {} })
        .exec()
    }
  } catch {
    /* SelectorQuery unavailable (e.g. web runtime) — the blur() above covers it */
  }
}

// swipe-up-to-close gesture on the add page (it slides down from the top, so
// an upward flick sends it back up). A deliberate, mostly-vertical drag only,
// so tapping the textarea / picking a date never triggers it.
let swipeStartY = 0
let swipeStartX = 0
function onAddTouchStart(e: {
  touches?: { clientX: number; clientY: number }[]
  changedTouches?: { clientX: number; clientY: number }[]
}) {
  const t = e.touches?.[0] ?? e.changedTouches?.[0]
  swipeStartY = t?.clientY ?? 0
  swipeStartX = t?.clientX ?? 0
}
function onAddTouchEnd(e: {
  touches?: { clientX: number; clientY: number }[]
  changedTouches?: { clientX: number; clientY: number }[]
}) {
  const t = e.changedTouches?.[0] ?? e.touches?.[0]
  if (!t) return
  const up = swipeStartY - t.clientY
  const dx = Math.abs(t.clientX - swipeStartX)
  if (up > 80 && up > dx) {
    closeComposer()
  }
}

// open a picker sheet, dismissing the keyboard first so it can't overlap
function openDayPicker() {
  dismissKb()
  dayPickerOpen.value = true
}
function openDatePicker() {
  dismissKb()
  datePickerOpen.value = true
}

function pickQuickDay(offset: number) {
  composerDate.value = getDiffDate(offset)
}

function submitComposer() {
  if (state.value !== 'INPUT') return

  const nextTimeline = commitComposerDraft(
    timeline.value,
    composerIntent.value,
    { text: composerText.value, date: composerDate.value },
    { today: getTodayDate(), idFactory: genId },
  )
  if (composerIntent.value.kind === 'edit') {
    refreshTodoTextLayoutAfterEdit(composerIntent.value.todoId)
    clearCorrectedTodoHeight(composerIntent.value.todoId)
  }
  timeline.value = nextTimeline
  closeComposer()
}

function checkTodo(todo: Todo) {
  todo.done = !todo.done
}

function removeTodo(dayKey: string, id: string) {
  const day = timeline.value[dayKey]
  if (!day) return
  todoTextLayoutBindings.delete(id)
  day.todos = day.todos.filter((todo) => todo.id !== id)
  if (day.todos.length === 0) {
    delete timeline.value[dayKey]
  }
}
</script>

<template>
  <view id="app-root" class="app">
    <!-- ===== Pinned header (never scrolls) ===== -->
    <view class="header">
      <view class="app-bar">
        <view class="brand">
          <text class="bw-text logo">BusyWeek!</text>
          <text class="bw-text logo-accent">好忙啊</text>
        </view>
        <view
          class="completed-toggle"
          @tap="showCompleted = !showCompleted"
        >
          <text
            class="bw-text completed-toggle-label"
            :class="{ 'completed-toggle-label--on': showCompleted }"
            >显示已完成</text
          >
          <view
            class="completed-toggle-track"
            :class="{ 'completed-toggle-track--on': showCompleted }"
          >
            <view
              class="completed-toggle-thumb"
              :class="{ 'completed-toggle-thumb--on': showCompleted }"
            />
          </view>
        </view>
      </view>
    </view>

    <!-- ===== Only this list scrolls ===== -->
    <scroll-view
      id="timeline-scroll"
      class="timeline"
      scroll-orientation="vertical"
      :scroll-y="true"
    >
      <view class="timeline-content">
      <!-- Hidden exact-geometry row: its body is the real text column width,
           independent of screen width and responsive timeline sizing. -->
      <view
        class="todo-width-probe"
        accessibility-element="false"
        user-interaction-enabled="false"
      >
        <view class="todo todo--last">
          <view class="checkbox-hit"><view class="checkbox" /></view>
          <view
            id="todo-width-probe-body"
            class="todo-body"
            @layoutchange="onTodoWidthProbeLayout"
          />
          <view class="delete" />
        </view>
      </view>

      <!-- Explicit durations are required by Vue Lynx: the background thread
           cannot read getComputedStyle(). The outer group covers new/empty
           dates; the inner group covers rows within an existing date. -->
      <TransitionGroup
        name="day"
        tag="view"
        class="day-list"
        :style="dayListStyle"
        :duration="{ enter: 320, leave: 220 }"
      >
        <view
          v-for="day in visibleDays"
          :key="day.key"
          class="day-slot"
          :style="daySlotStyle(day.key)"
        >
        <view class="day-group">
          <view class="day-header">
            <view class="day-type-wrap">
              <view v-if="isToday(day.key)" class="today-dot" />
              <text
                class="bw-text day-type"
                :class="{ 'day-type--today': isToday(day.key) }"
                >{{ getDayType(day.key) }}</text
              >
            </view>
            <text class="bw-text day-date">{{ day.key }} · {{ getDay(day.key) }}</text>
          </view>

          <TransitionGroup
            name="todo"
            tag="view"
            class="day-todos"
            :style="dayTodosStyle(day.key)"
            :duration="{ enter: 280, leave: 200 }"
          >
            <view
              v-for="(todo, todoIndex) in day.todos"
              :key="todo.id"
              class="todo-slot"
              :style="todoSlotStyle(day.key, todo.id)"
            >
            <view
              class="todo"
              :style="todoRowStyle(day.key, todo.id)"
              :class="{
                'todo--last': todoIndex === day.todos.length - 1,
              }"
            >
              <view
                class="checkbox-hit"
                @tap.stop="checkTodo(todo)"
              >
                <view
                  class="checkbox"
                  :class="{ 'checkbox--checked': todo.done }"
                >
                  <text
                    class="bw-text checkbox-mark"
                    :class="{ 'checkbox-mark--on': todo.done }"
                    >✓</text
                  >
                </view>
              </view>
              <view
                class="todo-body"
                @longpress.stop="openTodoEditor(day.key, todo)"
              >
                <text
                  class="bw-text todo-text"
                  :key="getTodoTextLayoutBinding(todo.id).key"
                  :class="{ 'todo-text--done': todo.done }"
                  @layout="getTodoTextLayoutBinding(todo.id).onLayout"
                  >{{ todo.text }}</text
                >
              </view>
              <view
                class="delete"
                @tap.stop="removeTodo(day.key, todo.id)"
              >
                <text class="bw-text delete-text">✕</text>
              </view>
            </view>
            </view>
          </TransitionGroup>
        </view>
        </view>
      </TransitionGroup>

      <!-- Keep the empty state after the collapsing list. When the final
           visible day leaves, it follows the animated list height upward
           instead of being inserted above and pushing the card downward. -->
      <view v-if="isEmpty" class="empty">
        <view class="empty-badge"><text class="bw-text empty-badge-text">✓</text></view>
        <text class="bw-text empty-text">{{ emptyText }}</text>
        <text class="bw-text empty-hint">{{ emptyHint }}</text>
      </view>

      <view class="timeline-spacer" />
      </view>
    </scroll-view>

    <!-- ===== Floating action button (list mode) ===== -->
    <view v-if="state === 'LIST'" class="fab" @tap="openCreateComposer">
      <text class="bw-text fab-icon">＋</text>
    </view>

    <!-- ===== Full-screen add page (slides down from the top) =====
         paddingBottom = keyboardHeight lifts the bottom bar above the soft
         keyboard on native (textarea keyboard events); on web the runtime
         resizes <lynx-view> to the visual viewport instead, so this stays 0. -->
    <view
      class="addpage"
      :class="{
        'addpage--open': state === 'INPUT',
        'addpage--keyboard': keyboardHeight > 0,
      }"
      :style="{ paddingBottom: keyboardHeight ? `${keyboardHeight}px` : '' }"
      @touchstart="onAddTouchStart"
      @touchend="onAddTouchEnd"
    >
      <view class="addpage-bar">
        <view class="addpage-back" @tap="closeComposer">
          <text class="bw-text addpage-back-text">‹</text>
        </view>
        <text class="bw-text addpage-title">{{ composerTitle }}</text>
      </view>

      <view class="addpage-input-wrap" @tap="focusComposer">
        <textarea
          id="addpage-ta"
          ref="taEl"
          class="addpage-input"
          v-model="composerText"
          placeholder="又有事情忙啦？"
          @keyboard="onComposerKeyboard"
          @keyboardheightchange="onComposerKeyboard"
        />
      </view>

      <view class="addpage-bottom">
        <scroll-view
          id="quick-days-scroll"
          class="quick-days"
          scroll-orientation="horizontal"
          :scroll-x="true"
        >
          <view
            v-for="offset in quickDayOffsets"
            :key="offset"
            class="quick-day"
            :class="{ 'quick-day--active': selectedDayOffset === offset }"
            @tap="pickQuickDay(offset)"
          >
            <text
              class="bw-text quick-day-text"
              :class="{
                'quick-day-text--active': selectedDayOffset === offset,
              }"
              >{{ getPickerLabel(offset) }}</text
            >
          </view>
        </scroll-view>
        <view class="addpage-row">
          <!-- day-type field → opens the cross-platform day picker sheet -->
          <view class="addpage-field" @tap="openDayPicker">
            <text class="bw-text addpage-field-text">{{ dayTypeLabel }}</text>
            <text class="bw-text addpage-field-caret">▾</text>
          </view>
          <!-- date field → opens the cross-platform calendar sheet -->
          <view class="addpage-field" @tap="openDatePicker">
            <text class="bw-text addpage-field-text">{{ prettyDate }}</text>
            <text class="bw-text addpage-field-caret">📅</text>
          </view>
          <view class="addpage-submit" @tap="submitComposer">
            <text class="bw-text addpage-submit-text">{{ composerSubmitLabel }}</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ===== Cross-platform pickers (Lynx primitives; web + native) ===== -->
    <DayPickerSheet
      :open="dayPickerOpen"
      v-model="composerDate"
      @close="dayPickerOpen = false"
    />
    <DatePickerSheet
      :open="datePickerOpen"
      v-model="composerDate"
      @close="datePickerOpen = false"
    />
  </view>
</template>
