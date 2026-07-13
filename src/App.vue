<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue-lynx'

import './App.css'
import type { Filter, Timeline, Todo } from './types.js'
import { loadTimeline, saveTimeline } from './store.js'
import { getDateDiff, getDay, getDayType, getTodayDate, parseDate } from './util.js'
import DatePickerSheet from './components/DatePickerSheet.vue'
import DayPickerSheet from './components/DayPickerSheet.vue'

type AppState = 'LIST' | 'INPUT'

// --- reactive state (ported from the original `data` object) ---------------
const state = ref<AppState>('LIST')
const timeline = ref<Timeline>({})
const activeFilter = ref<Filter>('all')
const editingId = ref<string | null>(null)

// the "new todo" being composed on the add page
const newTodoText = ref('')
const newTodoDate = ref(getTodayDate())

// cross-platform pickers (built from Lynx primitives — work on web + native)
const dayPickerOpen = ref(false)
const datePickerOpen = ref(false)

// day-type + weekday label for the currently chosen date
const dayTypeLabel = computed(
  () => `${getDayType(newTodoDate.value)} ${getDay(newTodoDate.value)}`,
)
// short "M月D日" for the date field
const prettyDate = computed(() => {
  const { month0, day } = parseDate(newTodoDate.value)
  return `${month0 + 1}月${day}日`
})

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: '全部' },
  { value: 'active', label: '在忙' },
  { value: 'done', label: '完成' },
]
const filterIndex = computed(() =>
  Math.max(0, filters.findIndex((f) => f.value === activeFilter.value)),
)

// --- load & persist --------------------------------------------------------
onMounted(async () => {
  timeline.value = await loadTimeline()
})

watch(timeline, (tl) => saveTimeline(tl), { deep: true })

// --- derived view ----------------------------------------------------------
const visibleDays = computed(() => {
  const tl = timeline.value
  return Object.keys(tl)
    .sort()
    .map((key) => {
      const todos = tl[key].todos.filter((todo) => {
        if (activeFilter.value === 'active') return !todo.done
        if (activeFilter.value === 'done') return todo.done
        return true
      })
      return { key, todos }
    })
    .filter((day) => day.todos.length > 0)
})

const isEmpty = computed(() => visibleDays.value.length === 0)

// --- helpers exposed to the template ---------------------------------------
function isToday(dateStr: string): boolean {
  return dateStr === getTodayDate()
}

function genId(): string {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

// --- actions ---------------------------------------------------------------
function openInput() {
  newTodoText.value = ''
  newTodoDate.value = getTodayDate()
  state.value = 'INPUT'
}
function closeInput() {
  state.value = 'LIST'
}
function toggleInput() {
  if (state.value === 'LIST') openInput()
  else closeInput()
}

// keyboard dismiss: blur the textarea (hides the soft keyboard)
const taEl = ref<{ blur?: () => void } | null>(null)
function dismissKb() {
  taEl.value?.blur?.()
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

function startEdit(todo: Todo) {
  editingId.value = todo.id
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
        <text class="logo">BusyWeek!</text>
        <text class="logo-accent">好忙啊</text>
      </view>
      <view class="filters">
        <view
          v-for="f in filters"
          :key="f.value"
          class="filter"
          @tap="activeFilter = f.value"
        >
          <text
            class="filter-text"
            :class="{ 'filter-text--active': activeFilter === f.value }"
            >{{ f.label }}</text
          >
        </view>
        <view
          class="filter-indicator"
          :style="{ transform: `translateX(${filterIndex * 100}%)` }"
        />
      </view>
    </view>

    <!-- ===== Only this list scrolls ===== -->
    <scroll-view class="timeline">
      <view v-if="isEmpty" class="empty">
        <view class="empty-badge"><text class="empty-badge-text">✓</text></view>
        <text class="empty-text">这周还不忙</text>
        <text class="empty-hint">点右下角 + 添加事项吧</text>
      </view>

      <view v-for="day in visibleDays" :key="day.key" class="day-group">
        <view class="day-header">
          <view class="day-type-wrap">
            <view v-if="isToday(day.key)" class="today-dot" />
            <text
              class="day-type"
              :class="{ 'day-type--today': isToday(day.key) }"
              >{{ getDayType(day.key) }}</text
            >
          </view>
          <text class="day-date">{{ day.key }} · {{ getDay(day.key) }}</text>
        </view>

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
              class="checkbox-mark"
              :class="{ 'checkbox-mark--on': todo.done }"
              >✓</text
            >
          </view>
          <view class="todo-body">
            <text
              v-if="editingId !== todo.id"
              class="todo-text"
              :class="{ 'todo-text--done': todo.done }"
              @tap="startEdit(todo)"
              >{{ todo.text }}</text
            >
            <input
              v-else
              class="todo-input"
              v-model="todo.text"
              @blur="finishEdit(day.key, todo)"
              @confirm="finishEdit(day.key, todo)"
            />
          </view>
          <view class="delete" @tap="removeTodo(day.key, todo.id)">
            <text class="delete-text">✕</text>
          </view>
        </view>
      </view>

      <view class="timeline-spacer" />
    </scroll-view>

    <!-- ===== Floating action button (list mode) ===== -->
    <view v-if="state === 'LIST'" class="fab" @tap="openInput">
      <text class="fab-icon">＋</text>
    </view>

    <!-- ===== Full-screen add page (slides down from the top) ===== -->
    <view class="addpage" :class="{ 'addpage--open': state === 'INPUT' }">
      <view class="addpage-bar" @tap="dismissKb">
        <view class="addpage-back" @tap="closeInput">
          <text class="addpage-back-text">‹</text>
        </view>
        <text class="addpage-title">添加事项</text>
      </view>

      <view class="addpage-input-wrap">
        <text v-if="!newTodoText" class="addpage-ph">又有事情忙啦？</text>
        <textarea ref="taEl" class="addpage-input" v-model="newTodoText" />
      </view>

      <view class="addpage-bottom">
        <view class="addpage-row">
          <!-- day-type field → opens the cross-platform day picker sheet -->
          <view class="addpage-field" @tap="dayPickerOpen = true">
            <text class="addpage-field-text">{{ dayTypeLabel }}</text>
            <text class="addpage-field-caret">▾</text>
          </view>
          <!-- date field → opens the cross-platform calendar sheet -->
          <view class="addpage-field" @tap="datePickerOpen = true">
            <text class="addpage-field-text">{{ prettyDate }}</text>
            <text class="addpage-field-caret">📅</text>
          </view>
          <view class="addpage-submit" @tap="addTodo">
            <text class="addpage-submit-text">添加</text>
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
