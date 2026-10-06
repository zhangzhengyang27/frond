<script setup lang="ts" generic="T extends string | number | undefined = string">
import { useId } from 'vue'

/**
 * UInput · 统一文本输入
 * - 泛型 T 含 undefined：v-model 绑 string/number/可选 number ref 都能过类型检查
 * - v-model.number 修饰符：parseFloat，NaN 回退原始串（对齐 Vue looseToNumber）
 * - error 时红描边 + aria-invalid/aria-describedby；#prefix/#suffix 放图标
 * - attrs 透传到原生 input（data-test 可命中真实控件）
 */
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue: T
  type?: 'text' | 'password' | 'number'
  placeholder?: string
  label?: string
  disabled?: boolean
  error?: string
  modelModifiers?: { number?: boolean }
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  label: '',
  disabled: false,
  error: '',
  modelModifiers: () => ({})
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const inputId = useId()

const onInput = (e: Event): void => {
  const raw = (e.target as HTMLInputElement).value
  if (props.modelModifiers?.number) {
    const n = parseFloat(raw)
    // as T 必须保留：eslint 与 vue-tsc 对断言必要性的判定不一致（删过一次，web typecheck 挂）
    emit('update:modelValue', (Number.isNaN(n) ? raw : n) as T)
  } else {
    emit('update:modelValue', raw as T)
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <label v-if="label" :for="inputId" class="text-xs font-medium text-fg-secondary">
      {{ label }}
    </label>
    <div class="relative flex items-center">
      <span
        v-if="$slots.prefix"
        class="pointer-events-none absolute left-3 text-fg-muted"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>
      <input
        :id="inputId"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${inputId}-err` : undefined"
        class="h-9 w-full rounded-md border border-line-default bg-surface-1 px-3 text-sm text-fg-primary transition-all duration-fast placeholder:text-fg-muted focus:outline-none focus-visible:border-brand-500/50 focus-visible:shadow-ring-focus disabled:cursor-not-allowed disabled:opacity-50"
        :class="[
          $slots.prefix ? 'pl-9' : '',
          $slots.suffix ? 'pr-9' : '',
          error ? 'border-danger' : ''
        ]"
        v-bind="$attrs"
        @input="onInput"
      />
      <span v-if="$slots.suffix" class="absolute right-3 text-fg-muted" aria-hidden="true">
        <slot name="suffix" />
      </span>
    </div>
    <p v-if="error" :id="`${inputId}-err`" class="text-xs text-danger">{{ error }}</p>
  </div>
</template>
