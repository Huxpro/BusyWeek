<script setup lang="ts">
import { computed, ref, watch } from 'vue-lynx'

import './sheet.css'
import './calendar.css'
import {
  buildMonthCells,
  getMonthLabel,
  getTodayDate,
  parseDate,
  stepMonth,
} from '../util.js'

const props = defineProps<{ open: boolean; modelValue: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'close'): void
}>()

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

const view = ref(parseDate(props.modelValue))

// when the sheet opens, jump the calendar to the selected date's month
watch(
  () => props.open,
  (open) => {
    if (open) view.value = parseDate(props.modelValue)
  },
)

const monthLabel = computed(() =>
  getMonthLabel(view.value.year, view.value.month0),
)
const cells = computed(() =>
  buildMonthCells(view.value.year, view.value.month0),
)

function step(delta: number) {
  view.value = stepMonth(view.value.year, view.value.month0, delta)
}
function pick(date: string) {
  if (!date) return
  emit('update:modelValue', date)
  emit('close')
}
</script>

<template>
  <view
    v-if="open"
    class="sheet-root"
    :class="{ 'sheet-root--open': open }"
  >
    <view class="sheet-backdrop" @tap="emit('close')" />
    <view class="sheet-panel">
      <view class="sheet-header">
        <text class="bw-text sheet-title">选择日期</text>
        <view class="sheet-done" @tap="emit('close')">
          <text class="bw-text sheet-done-text">完成</text>
        </view>
      </view>

      <view class="cal-monthbar">
        <view class="cal-navbtn" @tap="step(-1)">
          <text class="bw-text cal-navtext">‹</text>
        </view>
        <text class="bw-text cal-monthlabel">{{ monthLabel }}</text>
        <view class="cal-navbtn" @tap="step(1)">
          <text class="bw-text cal-navtext">›</text>
        </view>
      </view>

      <view class="cal-weekrow">
        <view v-for="w in WEEKDAYS" :key="w" class="cal-weekcell">
          <text class="bw-text cal-weektext">{{ w }}</text>
        </view>
      </view>

      <view class="cal-grid">
        <view
          v-for="(c, i) in cells"
          :key="i"
          class="cal-cell"
          :class="{
            'cal-cell--empty': !c.date,
            'cal-cell--today': c.date && c.date === getTodayDate(),
            'cal-cell--selected': c.date && c.date === modelValue,
          }"
          @tap="pick(c.date)"
        >
          <text v-if="c.day" class="bw-text cal-daytext">{{ c.day }}</text>
        </view>
      </view>
    </view>
  </view>
</template>
