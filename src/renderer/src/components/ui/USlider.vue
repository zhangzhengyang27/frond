<script setup lang="ts">
import { computed } from 'vue'

/**
 * USlider · 统一滑块
 * - 原生 input[type=range] 承载键盘/拖动，自绘轨道填充
 * - showValue + formatValue 展示格式化值
 */
interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  label?: string
  showValue?: boolean
  formatValue?: ((v: number) => string) | undefined
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  label: '',
  showValue: false,
  formatValue: undefined
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const onInput = (e: Event): void => {
  if (props.disabled) return
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}

const display = computed(() =>
  props.formatValue ? props.formatValue(props.modelValue) : String(props.modelValue)
)

const fillPct = computed(() => {
  const span = props.max - props.min
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((props.modelValue - props.min) / span) * 100))
})
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <div v-if="label || showValue" class="flex items-center justify-between">
      <label v-if="label" class="text-xs font-medium text-fg-secondary">{{ label }}</label>
      <span v-if="showValue" class="text-xs tabular-nums text-fg-tertiary">{{ display }}</span>
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      :aria-label="label || undefined"
      class="u-slider w-full"
      :style="{ '--u-slider-fill': `${fillPct}%` }"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.u-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 9999px;
  outline: none;
  background: linear-gradient(
    to right,
    var(--brand-500) var(--u-slider-fill, 0%),
    var(--surface-hover) var(--u-slider-fill, 0%)
  );
}
.u-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  border: 2px solid var(--brand-500);
  background: var(--surface-0);
  cursor: pointer;
  transition: transform var(--motion-fast) ease-out;
}
.u-slider::-webkit-slider-thumb:active {
  transform: scale(1.15);
}
.u-slider:focus-visible {
  box-shadow: var(--shadow-ring-focus);
}
.u-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
