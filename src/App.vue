<script setup lang="ts">
import {
  computed,
  nextTick,
  onMounted,
  onUnmounted,
  ref,
  watch,
} from 'vue-lynx'

import './App.css'
import { syncNativeInputOnMount } from './nativeInput.js'
import { createStarterTimeline } from './starterTimeline.js'
import { loadTimeline, saveTimeline } from './store.js'
import { getVisibleDays } from './timelineView.js'
import type { Timeline, Todo } from './types.js'
import { getDateDiff, getDay, getDayType, getTodayDate, parseDate } from './util.js'
import DatePickerSheet from './components/DatePickerSheet.vue'
import DayPickerSheet from './components/DayPickerSheet.vue'

type AppState = 'LIST' | 'INPUT'

// --- reactive state (ported from the original `data` object) ---------------
const state = ref<AppState>('LIST')
const timeline = ref<Timeline>({})
const showCompleted = ref(false)
const editingId = ref<string | null>(null)

// the "new todo" being composed on the add page
const newTodoText = ref('')
const newTodoDate = ref(getTodayDate())

// cross-platform pickers (built from Lynx primitives — work on web + native)
const dayPickerOpen = ref(false)
const datePickerOpen = ref(false)

// soft-keyboard height (device-independent px), used to lift the composer's
// bottom bar clear of the keyboard on native. Driven by Lynx's global
// `keyboardstatuschanged` event.
const keyboardHeight = ref(0)

// day-type + weekday label for the currently chosen date
const dayTypeLabel = computed(
  () => `${getDayType(newTodoDate.value)} ${getDay(newTodoDate.value)}`,
)
// short "M月D日" for the date field
const prettyDate = computed(() => {
  const { month0, day } = parseDate(newTodoDate.value)
  return `${month0 + 1}月${day}日`
})

// --- keyboard avoidance (native) -------------------------------------------
// Lynx has no keyboard-height CSS/viewport primitive, so the documented
// approach is to listen for the `keyboardstatuschanged` global event and
// offset the view yourself. `height` is in device-independent px (same unit
// as Lynx CSS px), so it maps 1:1 onto paddingBottom.
// https://lynxjs.org/api/elements/built-in/input.html#keyboard-avoidance
function onKeyboardStatus(status: string, height: number) {
  keyboardHeight.value = status === 'on' ? height : 0
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
  const stored = await loadTimeline()
  timeline.value = stored ?? createStarterTimeline(getTodayDate())
})

onUnmounted(() => removeKbListener?.())

watch(timeline, (tl) => saveTimeline(tl), { deep: true })

// --- derived view ----------------------------------------------------------
const visibleDays = computed(() =>
  getVisibleDays(timeline.value, showCompleted.value),
)

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

// --- actions ---------------------------------------------------------------
async function openInput() {
  newTodoText.value = ''
  newTodoDate.value = getTodayDate()
  state.value = 'INPUT'
  await nextTick()
  setComposerValue(newTodoText.value)
  focusComposer()
}
function closeInput() {
  state.value = 'LIST'
}
function toggleInput() {
  if (state.value === 'LIST') openInput()
  else closeInput()
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
        .invoke({ method: 'blur' })
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
    dismissKb()
    closeInput()
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

function addTodo() {
  dismissKb()
  const date = newTodoDate.value
  const dayType = getDateDiff(date, getTodayDate())
  const text = newTodoText.value.trim() || '写点啥呀！'

  const tl = timeline.value
  if (!tl[date]) {
    tl[date] = { date, todos: [] }
  }
  tl[date].todos.push({ id: genId(), date, dayType, done: false, text })
  closeInput()
}

function checkTodo(todo: Todo) {
  todo.done = !todo.done
}

// tap a todo's text → swap to the edit <input>; v-focus (below) focuses it
// on mount so it edits in a single tap.
function startEdit(todo: Todo) {
  editingId.value = todo.id
}

// Seed and focus the edit input after it exists in the native tree. vue-lynx
// 0.4.0 only pushes the mounted `value` attribute, which iOS ignores once the
// control is live, so setValue must run before focus (vue-lynx #203).
const vFocus = {
  mounted(
    el: { focus?: () => void },
    binding: { value?: { id?: string; value?: string } },
  ) {
    const id = binding.value?.id
    if (!id) return

    void syncNativeInputOnMount({
      el,
      id,
      value: binding.value?.value ?? '',
      nextTick,
      createSelectorQuery:
        typeof lynx === 'undefined'
          ? undefined
          : () =>
              (lynx as unknown as { createSelectorQuery: () => any })
                .createSelectorQuery(),
    }).catch(() => {
      /* ignore — falls back to tapping the field again */
    })
  },
}

function finishEdit(dayKey: string, todo: Todo) {
  if (editingId.value !== todo.id) return
  editingId.value = null
  todo.text = todo.text.trim()
  if (!todo.text) {
    removeTodo(dayKey, todo.id)
  }
}

function removeTodo(dayKey: string, id: string) {
  const day = timeline.value[dayKey]
  if (!day) return
  day.todos = day.todos.filter((todo) => todo.id !== id)
  if (day.todos.length === 0) {
    delete timeline.value[dayKey]
  }
}
</script>

<template>
  <view class="app">
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
    <scroll-view class="timeline" scroll-orientation="vertical">
      <view v-if="isEmpty" class="empty">
        <view class="empty-badge"><text class="bw-text empty-badge-text">✓</text></view>
        <text class="bw-text empty-text">{{ emptyText }}</text>
        <text class="bw-text empty-hint">{{ emptyHint }}</text>
      </view>

      <!-- Explicit durations are required by Vue Lynx: the background thread
           cannot read getComputedStyle(). The outer group covers new/empty
           dates; the inner group covers rows within an existing date. -->
      <TransitionGroup
        name="day"
        tag="view"
        class="day-list"
        :duration="{ enter: 320, leave: 220 }"
      >
        <view v-for="day in visibleDays" :key="day.key" class="day-group">
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
            :duration="{ enter: 280, leave: 200 }"
          >
            <view
              v-for="todo in day.todos"
              :key="todo.id"
              class="todo"
              :class="{ 'todo--editing': editingId === todo.id }"
            >
              <view
                class="checkbox"
                :class="{ 'checkbox--checked': todo.done }"
                @tap="checkTodo(todo)"
              >
                <text
                  class="bw-text checkbox-mark"
                  :class="{ 'checkbox-mark--on': todo.done }"
                  >✓</text
                >
              </view>
              <view class="todo-body">
                <!-- display as text; a single tap swaps to the input, which
                     v-focus focuses immediately (the original's v-todo-focus
                     pattern) so editing takes one tap. -->
                <text
                  v-if="editingId !== todo.id"
                  class="bw-text todo-text"
                  :class="{ 'todo-text--done': todo.done }"
                  @tap="startEdit(todo)"
                  >{{ todo.text }}</text
                >
                <input
                  v-else
                  v-focus="{ id: 'edit-' + todo.id, value: todo.text }"
                  :id="'edit-' + todo.id"
                  class="todo-input"
                  v-model="todo.text"
                  @blur="finishEdit(day.key, todo)"
                  @confirm="finishEdit(day.key, todo)"
                />
              </view>
              <view class="delete" @tap="removeTodo(day.key, todo.id)">
                <text class="bw-text delete-text">✕</text>
              </view>
            </view>
          </TransitionGroup>
        </view>
      </TransitionGroup>

      <view class="timeline-spacer" />
    </scroll-view>

    <!-- ===== Floating action button (list mode) ===== -->
    <view v-if="state === 'LIST'" class="fab" @tap="openInput">
      <text class="bw-text fab-icon">＋</text>
    </view>

    <!-- ===== Full-screen add page (slides down from the top) =====
         paddingBottom = keyboardHeight lifts the bottom bar above the soft
         keyboard on native (Lynx `keyboardstatuschanged`); on web the runtime
         resizes <lynx-view> to the visual viewport instead, so this stays 0. -->
    <view
      class="addpage"
      :class="{ 'addpage--open': state === 'INPUT' }"
      :style="{ paddingBottom: keyboardHeight ? `${keyboardHeight}px` : '' }"
      @touchstart="onAddTouchStart"
      @touchend="onAddTouchEnd"
    >
      <view class="addpage-bar">
        <view class="addpage-back" @tap="closeInput">
          <text class="bw-text addpage-back-text">‹</text>
        </view>
        <text class="bw-text addpage-title">添加事项</text>
      </view>

      <view class="addpage-input-wrap">
        <text v-if="!newTodoText" class="bw-text addpage-ph">又有事情忙啦？</text>
        <textarea
          id="addpage-ta"
          ref="taEl"
          class="addpage-input"
          v-model="newTodoText"
        />
      </view>

      <view class="addpage-bottom">
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
          <view class="addpage-submit" @tap="addTodo">
            <text class="bw-text addpage-submit-text">添加</text>
          </view>
        </view>
      </view>
    </view>

    <!-- ===== Cross-platform pickers (Lynx primitives; web + native) ===== -->
    <DayPickerSheet
      :open="dayPickerOpen"
      v-model="newTodoDate"
      @close="dayPickerOpen = false"
    />
    <DatePickerSheet
      :open="datePickerOpen"
      v-model="newTodoDate"
      @close="datePickerOpen = false"
    />
  </view>
</template>
