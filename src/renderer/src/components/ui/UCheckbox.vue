<script setup lang="ts">
/**
 * UCheckbox · 统一复选框
 * - 原生 input 承载可访问性与键盘行为，自绘勾选态
 * - attrs 透传到原生 input（data-test 可命中真实控件）
 */
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue: boolean
  label?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  disabled: false
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const onChange = (e: Event): void => {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <label
    class="flex w-fit items-center gap-2"
    :class="props.disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
  >
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="peer sr-only"
      v-bind="$attrs"
      @change="onChange"
    />
    <span
      class="flex size-4 shrink-0 items-center justify-center rounded-sm border transition-all duration-fast peer-focus-visible:shadow-ring-focus peer-focus-visible:outline-none"
      :class="modelValue ? 'border-brand-500 bg-brand-500' : 'border-line-strong bg-surface-1'"
      aria-hidden="true"
    >
      <svg v-if="modelValue" class="size-3 text-white" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span v-if="label" class="text-sm text-fg-primary">{{ label }}</span>
  </label>
</template>
