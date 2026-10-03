<script setup lang="ts">
import { computed } from 'vue'

/**
 * USwitch · 统一开关
 * - size: sm（紧凑行 20×36）/ md（标准行 24×44），终结各视图手写多套尺寸
 * - 选中态统一品牌蓝（D5：全站唯一 accent = brand 蓝）
 * - attrs 透传到根 button（data-* 钩子可命中）
 */
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue: boolean
  size?: 'sm' | 'md'
  disabled?: boolean
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false,
  label: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const toggle = (): void => {
  if (!props.disabled) emit('update:modelValue', !props.modelValue)
}

const trackCls = computed(() => (props.size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'))
const knobCls = computed(() => (props.size === 'sm' ? 'size-4' : 'size-5'))
const travelCls = computed(() => {
  if (!props.modelValue) return 'translate-x-0'
  return props.size === 'sm' ? 'translate-x-4' : 'translate-x-5'
})
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label || undefined"
    :disabled="disabled"
    class="relative inline-flex shrink-0 items-center rounded-full transition-colors duration-fast focus-visible:shadow-ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    :class="[trackCls, modelValue ? 'bg-brand-500' : 'bg-surface-active ring-1 ring-line-subtle']"
    v-bind="$attrs"
    @click="toggle"
  >
    <span
      class="absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-fast"
      :class="[knobCls, travelCls]"
      aria-hidden="true"
    />
  </button>
</template>
