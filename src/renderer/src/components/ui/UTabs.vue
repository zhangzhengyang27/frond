<script setup lang="ts">
import { computed } from 'vue'

/**
 * UTabs · 统一页签（受控）
 * - variant: underline（常规页签）/ segment（分段选择，对应录屏按钮组风格）
 * - ArrowLeft/Right 循环 + Home/End 跳转，roving tabindex
 */
interface Tab {
  id: string
  label: string
}

interface Props {
  tabs: Tab[]
  modelValue: string
  variant?: 'underline' | 'segment'
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'underline',
  label: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const activeIndex = computed(() =>
  Math.max(
    0,
    props.tabs.findIndex((t) => t.id === props.modelValue)
  )
)

const moveTo = (i: number): void => {
  const t = props.tabs[i]
  if (t) emit('update:modelValue', t.id)
}

const onKeydown = (e: KeyboardEvent): void => {
  const n = props.tabs.length
  if (n === 0) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    moveTo((activeIndex.value + 1) % n)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    moveTo((activeIndex.value - 1 + n) % n)
  } else if (e.key === 'Home') {
    e.preventDefault()
    moveTo(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    moveTo(n - 1)
  }
}

const tabCls = (id: string): string => {
  const active = id === props.modelValue
  if (props.variant === 'segment') {
    return active
      ? 'bg-brand-500 text-white'
      : 'bg-surface-2 text-fg-primary hover:bg-surface-hover'
  }
  return active
    ? 'border-brand-500 text-fg-primary'
    : 'border-transparent text-fg-secondary hover:border-line-strong hover:text-fg-primary'
}
</script>

<template>
  <div
    role="tablist"
    :aria-label="label || undefined"
    class="flex"
    :class="
      variant === 'segment'
        ? 'gap-1 rounded-md bg-surface-2/50 p-1'
        : 'gap-4 border-b border-line-subtle'
    "
    @keydown="onKeydown"
  >
    <button
      v-for="t in tabs"
      :key="t.id"
      type="button"
      role="tab"
      :aria-selected="t.id === modelValue"
      :tabindex="t.id === modelValue ? 0 : -1"
      class="whitespace-nowrap text-sm font-medium transition-all duration-fast focus-visible:shadow-ring-focus focus-visible:outline-none"
      :class="[
        variant === 'segment' ? 'rounded-sm px-3 py-1.5' : '-mb-px border-b-2 pb-2 pt-1',
        tabCls(t.id)
      ]"
      @click="moveTo(tabs.indexOf(t))"
    >
      {{ t.label }}
    </button>
  </div>
</template>
