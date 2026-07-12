<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue-lynx'

import './App.css'
import type { Filter, Timeline, Todo } from './types.js'
import { loadTimeline, saveTimeline } from './store.js'
import {
  getDay,
  getDayType,
  getDiffDate,
  getPickerLabel,
  getTodayDate,
} from './util.js'

type AppState = 'LIST' | 'INPUT'

// --- reactive state (ported from the original `data` object) ---------------
const state = ref<AppState>('LIST')
const timeline = ref<Timeline>({})
const activeFilter = ref<Filter>('all')
const editingId = ref<string | null>(null)

// the "new todo" being composed in INPUT mode
const newTodoText = ref('')
const newTodoDayType = ref(0)

// the day-picker offers the same relative days as the original <select>
const dayTypes = [0, 1, 2, 3, 4, 5, 6, 7]

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
/**
 * Days sorted by date, with each day's todos filtered by the active filter.
 * Days left with no matching todos are dropped — same behaviour as the
 * original `ifDayShow` / `ifTodoShow` pair.
 */
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
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
}

// --- actions ---------------------------------------------------------------
function toggleInput() {
  state.value = state.value === 'LIST' ? 'INPUT' : 'LIST'
}

function selectDayType(dayType: number) {
  newTodoDayType.value = dayType
}

function addTodo() {
  const dayType = newTodoDayType.value
  const date = getDiffDate(dayType)
  const text = newTodoText.value.trim() || '写点啥呀！'

  const tl = timeline.value
  if (!tl[date]) {
    tl[date] = { date, todos: [] }
  }
  tl[date].todos.push({ id: genId(), date, dayType, done: false, text })

  // reset composer but keep the chosen day, then return to the list
  newTodoText.value = ''
  state.value = 'LIST'
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
    <!-- App bar -->
    <view class="app-bar">
      <view
        v-if="state === 'INPUT'"
        class="app-bar-action"
        @tap="toggleInput"
      >
        <text class="app-bar-action-text">‹</text>
      </view>
      <text class="logo">BusyWeek!</text>
      <text class="logo-accent">好忙啊</text>
    </view>

    <!-- Filter tabs with a sliding indicator -->
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

    <!-- LIST mode: the timeline -->
    <scroll-view v-if="state === 'LIST'" class="timeline">
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

      <!-- bottom spacer so the FAB never covers the last item -->
      <view class="timeline-spacer" />
    </scroll-view>

    <!-- INPUT mode: compose a new todo -->
    <view v-else class="composer">
      <view class="composer-card">
        <textarea
          class="composer-input"
          v-model="newTodoText"
          placeholder="又有事情忙啦？"
        />
      </view>

      <text class="composer-label">什么时候？</text>
      <scroll-view scroll-orientation="horizontal" class="picker">
        <view
          v-for="t in dayTypes"
          :key="t"
          class="chip"
          :class="{ 'chip--active': newTodoDayType === t }"
          @tap="selectDayType(t)"
        >
          <text
            class="chip-text"
            :class="{ 'chip-text--active': newTodoDayType === t }"
            >{{ getPickerLabel(t) }}</text
          >
        </view>
      </scroll-view>

      <view class="add-btn" @tap="addTodo">
        <text class="add-btn-text">添加</text>
      </view>
    </view>

    <!-- Floating action button (morphs + -> x) -->
    <view
      class="fab"
      :class="{ 'fab--close': state === 'INPUT' }"
      @tap="toggleInput"
    >
      <text class="fab-icon">＋</text>
    </view>
  </view>
</template>
