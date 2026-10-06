<script setup lang="ts" generic="T extends string | number = string">
import { computed, useId } from 'vue'

/**
 * UOptionPills · 统一分段选择器（一排单选按钮组）
 * - variant: rect（带边框档位选择）/ pill（胶囊标签）
 * - 选中态统一品牌蓝（D5：全站唯一 accent）；role=radiogroup + 方向键循环
 * - attrs 透传到容器（data-testid 等可命中）
 * - 方向键不做 disabled 跳过：落在 disabled 项上时不发事件
 */
defineOptions({ inheritAttrs: false })

interface Option {
  label: string
  value: T
  disabled?: boolean
  /** 透传到按钮的任意属性（data-* 钩子、title 等） */
  attrs?: Record<string, unknown>
}

interface Props {
  modelValue: T
  options: Option[]
  variant?: 'rect' | 'pill'
  size?: 'sm' | 'md'
  disabled?: boolean
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'rect',
  size: 'md',
  disabled: false,
  label: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const groupId = useId()

const activeIndex = computed(() =>
  Math.max(
    0,
    props.options.findIndex((o) => o.value === props.modelValue)
  )
)

const moveTo = (i: number): void => {
  const o = props.options[i]
  if (o && !o.disabled && !props.disabled) emit('update:modelValue', o.value)
}

const onKeydown = (e: KeyboardEvent): void => {
  const n = props.options.length
  if (n === 0) return
  if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
    e.preventDefault()
    moveTo((activeIndex.value + 1) % n)
  } else if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
    e.preventDefault()
    moveTo((activeIndex.value - 1 + n) % n)
  }
}

const pick = (opt: Option): void => {
  if (!props.disabled && !opt.disabled) emit('update:modelValue', opt.value)
}

const boxCls = computed(() => (props.variant === 'pill' ? 'flex flex-wrap gap-1.5' : 'flex gap-2'))

const pillCls = (opt: Option): string => {
  const active = opt.value === props.modelValue
  const size = props.size === 'sm' ? 'px-2.5 py-1 text-[12px]' : 'px-3 py-1.5 text-sm'
  const shape = props.variant === 'pill' ? 'rounded-full' : 'rounded-lg border'
  if (active) return `${size} ${shape} bg-brand-500 text-white font-medium`
  return `${size} ${shape} bg-surface-2 text-fg-primary transition-colors duration-fast hover:bg-surface-hover focus-visible:shadow-ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40`
}
</script>

<template>
  <div
    :id="groupId"
    role="radiogroup"
    :aria-label="label || undefined"
    class="flex w-fit flex-col gap-1.5"
    v-bind="$attrs"
    @keydown="onKeydown"
  >
    <span v-if="label" class="text-xs font-medium text-fg-secondary">{{ label }}</span>
    <div :class="boxCls">
      <button
        v-for="opt in options"
        :key="String(opt.value)"
        type="button"
        role="radio"
        :aria-checked="opt.value === modelValue"
        :tabindex="opt.value === modelValue ? 0 : -1"
        :disabled="disabled || opt.disabled"
        :class="pillCls(opt)"
        v-bind="opt.attrs"
        @click="pick(opt)"
      >
        {{ opt.label }}
      </button>
    </div>
  </div>
</template>
