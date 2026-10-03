<script setup lang="ts" generic="T extends string | number | undefined = string">
import { computed, useId } from 'vue'

/**
 * URadioGroup · 统一单选组
 * - 泛型 T 含 undefined：可选字段（如 audioCodec）直绑过类型检查
 * - 原生 radio 承载可访问性，自绘圆点；option 级/group 级 disabled
 * - value 直接从 options 发出，number 不经 DOM string 化
 * - direction: vertical（默认，含两行文案）/ horizontal（紧凑一行）
 */
interface Option {
  label: string
  value: T
  description?: string
  disabled?: boolean
}

interface Props {
  modelValue: T
  options: Option[]
  disabled?: boolean
  label?: string
  direction?: 'vertical' | 'horizontal'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  label: '',
  direction: 'vertical'
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const groupId = useId()

const onSelect = (opt: Option): void => {
  if (!props.disabled && !opt.disabled) emit('update:modelValue', opt.value)
}

const wrapCls = computed(() =>
  props.direction === 'horizontal' ? 'flex flex-wrap items-center gap-4' : 'flex flex-col gap-1'
)
</script>

<template>
  <div role="radiogroup" :aria-label="label || undefined" class="flex w-full flex-col gap-1.5">
    <span v-if="label" class="text-xs font-medium text-fg-secondary">{{ label }}</span>
    <div :class="wrapCls">
      <label
        v-for="opt in options"
        :key="String(opt.value)"
        class="flex items-start gap-2.5"
        :class="[
          direction === 'vertical'
            ? 'rounded-md p-2 transition-colors hover:bg-surface-hover'
            : 'cursor-pointer py-1',
          opt.disabled || disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        ]"
      >
        <input
          type="radio"
          :name="groupId"
          :checked="modelValue === opt.value"
          :disabled="opt.disabled || disabled"
          class="sr-only"
          @change="onSelect(opt)"
        />
        <span
          class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-fast"
          :class="modelValue === opt.value ? 'border-brand-500' : 'border-line-strong bg-surface-1'"
          aria-hidden="true"
        >
          <span v-if="modelValue === opt.value" class="size-2 rounded-full bg-brand-500" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-medium text-fg-primary">{{ opt.label }}</span>
          <span v-if="opt.description" class="mt-0.5 block text-xs text-fg-tertiary">
            {{ opt.description }}
          </span>
        </span>
      </label>
    </div>
  </div>
</template>
