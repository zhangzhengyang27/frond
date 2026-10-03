<script setup lang="ts">
import { useId } from 'vue'

/**
 * UTextarea · 统一多行文本输入
 * - mono：JSON/代码场景等宽字体；resize: none | y
 * - error 时红描边 + aria-invalid/aria-describedby（同 UInput）
 * - attrs 透传到原生 textarea（spellcheck 等）
 */
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue: string
  placeholder?: string
  label?: string
  disabled?: boolean
  error?: string
  rows?: number
  mono?: boolean
  resize?: 'none' | 'y'
}

const props = withDefaults(defineProps<Props>(), {
  placeholder: '',
  label: '',
  disabled: false,
  error: '',
  rows: 3,
  mono: false,
  resize: 'none'
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const fieldId = useId()

const onInput = (e: Event): void => {
  emit('update:modelValue', (e.target as HTMLTextAreaElement).value)
}
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <label v-if="label" :for="fieldId" class="text-xs font-medium text-fg-secondary">
      {{ label }}
    </label>
    <textarea
      :id="fieldId"
      :value="modelValue"
      :placeholder="placeholder"
      :disabled="disabled"
      :rows="rows"
      :aria-invalid="error ? 'true' : undefined"
      :aria-describedby="error ? `${fieldId}-err` : undefined"
      class="w-full rounded-md border border-line-default bg-surface-1 px-3 py-2 text-sm text-fg-primary transition-all duration-fast placeholder:text-fg-muted focus:outline-none focus-visible:border-brand-500/50 focus-visible:shadow-ring-focus disabled:cursor-not-allowed disabled:opacity-50"
      :class="[
        mono ? 'font-mono text-[12px]' : '',
        resize === 'y' ? 'resize-y' : 'resize-none',
        error ? 'border-danger' : ''
      ]"
      v-bind="$attrs"
      @input="onInput"
    />
    <p v-if="error" :id="`${fieldId}-err`" class="text-xs text-danger">{{ error }}</p>
  </div>
</template>
