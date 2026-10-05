<template>
  <div ref="anchorEl" class="popover-select" :data-testid="testid">
    <button
      class="popover-select-trigger"
      type="button"
      :aria-label="ariaLabel"
      :aria-expanded="open"
      aria-haspopup="listbox"
      @click.stop="toggle"
    >
      <span class="popover-select-value">{{ labelOf(modelValue) }}</span>
      <AppIcon icon="arrow-down-s-line" :size="12" />
    </button>
    <Teleport to="body">
      <div
        v-if="open"
        ref="panelEl"
        class="popover-select-panel"
        :style="panelStyle"
        role="listbox"
        :aria-label="ariaLabel"
      >
        <button
          v-for="opt in options"
          :key="opt.value"
          type="button"
          class="popover-select-option"
          role="option"
          :aria-selected="opt.value === modelValue"
          :class="{ selected: opt.value === modelValue, cursor: opt.value === cursor }"
          @mouseenter="cursor = opt.value"
          @click.stop="pick(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
/**
 * 胶囊内下拉选择（原生 <select> 的替代）：
 * 透明窗里原生 select 的选项列表是窗口表面之外的 popup，渲染不出来——
 * 点击毫无反应（与 date/time picker 同坑）。本组件用 DOM 内浮层：Teleport
 * 到 body + fixed 锚定（useAnchoredPanel），↑↓ 移动、↵ 选中、ESC 关闭。
 */
import { ref, watch, onBeforeUnmount } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import { useAnchoredPanel } from '../composables/useAnchoredPanel'

export interface PopoverOption {
  value: string
  label: string
}

const props = defineProps<{
  modelValue: string
  options: PopoverOption[]
  ariaLabel?: string
  testid?: string
}>()

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const open = ref(false)
const anchorEl = ref<HTMLElement | null>(null)
const panelEl = ref<HTMLElement | null>(null)
const labelOf = (v: string): string => props.options.find((o) => o.value === v)?.label ?? v
const cursor = ref(props.modelValue || props.options[0]?.value || '')
const panelStyle = useAnchoredPanel(panelEl, anchorEl, open)

function toggle(): void {
  open.value = !open.value
  if (open.value) cursor.value = props.modelValue || props.options[0]?.value || ''
}

function pick(opt: string): void {
  emit('update:modelValue', opt)
  open.value = false
}

function move(delta: number): void {
  const opts = props.options
  if (opts.length === 0) return
  const at = opts.findIndex((o) => o.value === cursor.value)
  cursor.value = (opts[(at === -1 ? 0 : at + delta + opts.length) % opts.length] ?? opts[0])
    ?.value ?? ''
}

/** 面板开着时由宿主（LauncherApp 键盘链或自身 keydown）转发到这里 */
function handleKey(e: KeyboardEvent): boolean {
  if (!open.value) {
    if (e.key === 'Enter' || e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      open.value = true
      return true
    }
    return false
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    move(1)
    return true
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    move(-1)
    return true
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    pick(cursor.value)
    return true
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    open.value = false
    return true
  }
  return false
}

defineExpose({ handleKey, close: () => (open.value = false) })

/** 点外部收起（Teleport 后选项不在组件子树内，监听在 document 上） */
function onDocMousedown(e: MouseEvent): void {
  const target = e.target as Node
  if (!open.value) return
  if (anchorEl.value?.contains(target)) return
  if (panelEl.value?.contains(target)) return
  open.value = false
}

document.addEventListener('mousedown', onDocMousedown)
onBeforeUnmount(() => document.removeEventListener('mousedown', onDocMousedown))

watch(
  () => props.modelValue,
  (v) => {
    if (open.value) cursor.value = v
  }
)

watch(
  () => props.options,
  (opts) => {
    if (open.value && !opts.some((o) => o.value === cursor.value)) {
      cursor.value = opts[0]?.value ?? ''
    }
  }
)
</script>

<style scoped>
.popover-select {
  position: relative;
  display: inline-flex;
}

.popover-select-trigger {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  height: 26px;
  padding: 0 8px;
  border: 1px solid var(--launcher-border);
  border-radius: 7px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text);
  cursor: pointer;
  font-size: 12px;
}

.popover-select-trigger:hover {
  border-color: var(--launcher-accent);
}

.popover-select-value {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.popover-select-panel {
  position: fixed;
  z-index: 40;
  min-width: 140px;
  padding: 4px;
  border: 1px solid var(--launcher-border);
  border-radius: 10px;
  background: var(--launcher-popover-bg);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.16);
  display: flex;
  flex-direction: column;
}

.popover-select-option {
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text);
  cursor: pointer;
  font-size: 12px;
  text-align: left;
  padding: 6px 10px;
}

.popover-select-option.cursor:not(.selected) {
  background: var(--launcher-selected-bg);
}

.popover-select-option.selected {
  background: var(--launcher-accent);
  color: var(--text-inverse);
}
</style>
