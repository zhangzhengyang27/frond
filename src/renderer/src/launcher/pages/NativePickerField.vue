<template>
  <div ref="wrapEl" class="npk-field">
    <input
      ref="inputEl"
      :value="modelValue"
      class="npk-input"
      :type="mode"
      :aria-label="ariaLabel"
      :title="'↑↓ 调整 · ↵ 打开选择面板'"
      spellcheck="false"
      @input="emit('update:modelValue', ($event.target as HTMLInputElement).value)"
      @keydown="onKeydown"
    />
    <button
      class="npk-btn"
      type="button"
      :aria-label="mode === 'date' ? '打开日历面板' : '打开时间面板'"
      :tabindex="-1"
      @click.stop="toggle"
    >
      <AppIcon :icon="mode === 'date' ? 'ri-calendar-line' : 'ri-time-line'" :size="14" />
    </button>
    <PickerPanel
      v-if="open"
      ref="panelRef"
      :mode="mode"
      :value="modelValue"
      :anchor-el="wrapEl"
      @commit="(v) => commit(String(v))"
      @cancel="open = false"
    />
  </div>
</template>

<script setup lang="ts">
/**
 * 日期/时间单行字段（原生 input + 图标 + 自建面板一体）。
 * 透明窗里原生 picker popup 渲染不出来（点图标无反应的根因），点图标/↵ 打开
 * PickerPanel（DOM 内浮层）；键盘输入与 ↑↓ 分段调值是 input 内行为，透明窗可用。
 * 键盘语义与 FormPage 的 picker 字段一致：面板开着按键归面板，↑↓ 调值，Tab 切字段。
 */
import { ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import PickerPanel from './PickerPanel.vue'

defineProps<{
  mode: 'date' | 'time'
  modelValue: string
  ariaLabel?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const wrapEl = ref<HTMLElement | null>(null)
const inputEl = ref<HTMLInputElement | null>(null)
const panelRef = ref<{ handleKey: (e: KeyboardEvent) => void } | null>(null)
const open = ref(false)

function toggle(): void {
  open.value = !open.value
}

function commit(value: string): void {
  emit('update:modelValue', value)
  open.value = false
  inputEl.value?.focus()
}

function onKeydown(e: KeyboardEvent): void {
  if (open.value) {
    e.preventDefault()
    panelRef.value?.handleKey(e)
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    open.value = true
    return
  }
  if (e.key === 'ArrowDown' || e.key === 'ArrowUp') return
}

defineExpose({ handleKey: onKeydown, close: () => (open.value = false) })
</script>

<style scoped>
.npk-field {
  position: relative;
  display: flex;
  flex: 1;
  min-width: 0;
}

.npk-input {
  flex: 1;
  width: 100%;
  min-width: 0;
  height: 30px;
  padding: 0 30px 0 10px;
  border: 1px solid var(--launcher-border);
  border-radius: 8px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text);
  font-size: 12px;
  outline: none;
  box-sizing: border-box;
}

.npk-input:focus {
  border-color: var(--launcher-accent);
}

.npk-input::-webkit-calendar-picker-indicator {
  display: none;
}

.npk-btn {
  position: absolute;
  top: 50%;
  right: 4px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text-muted);
  cursor: pointer;
  padding: 0;
}

.npk-btn:hover {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}
</style>
