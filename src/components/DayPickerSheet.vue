<script setup lang="ts">
import './sheet.css'
import './daypicker.css'
import { getDateDiff, getDiffDate, getPickerLabel, getTodayDate } from '../util.js'

const props = defineProps<{ open: boolean; modelValue: string }>()
const emit = defineEmits<{
  (e: 'update:modelValue', v: string): void
  (e: 'close'): void
}>()

const options = [0, 1, 2, 3, 4, 5, 6, 7]

function isActive(offset: number): boolean {
  return getDateDiff(props.modelValue, getTodayDate()) === offset
}
function pick(offset: number) {
  emit('update:modelValue', getDiffDate(offset))
  emit('close')
}
</script>

<template>
  <view class="sheet-root" :class="{ 'sheet-root--open': open }">
    <view class="sheet-backdrop" @tap="emit('close')" />
    <view class="sheet-panel">
      <view class="sheet-header">
        <text class="bw-text sheet-title">什么时候？</text>
        <view class="sheet-done" @tap="emit('close')">
          <text class="bw-text sheet-done-text">完成</text>
        </view>
      </view>

      <scroll-view class="dp-list" scroll-orientation="vertical">
        <view
          v-for="o in options"
          :key="o"
          class="dp-item"
          :class="{ 'dp-item--active': isActive(o) }"
          @tap="pick(o)"
        >
          <text
            class="bw-text dp-item-text"
            :class="{ 'dp-item-text--active': isActive(o) }"
            >{{ getPickerLabel(o) }}</text
          >
          <text v-if="isActive(o)" class="bw-text dp-check">✓</text>
        </view>
      </scroll-view>
    </view>
  </view>
</template>
