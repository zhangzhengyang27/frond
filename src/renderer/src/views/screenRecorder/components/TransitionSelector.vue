<script setup lang="ts">
/*
 * 2026-09-23 重建件：TransitionSelector.vue 随事故丢失且全盘无副本。
 * 契约来源：ExportDialog.vue 的 `transition: 'cut'` 初值与 useVideoClip 的
 * ExportOptions['transition']（'fade' | 'cut' | 'slide'）。
 */
import { computed } from 'vue'

const props = defineProps<{ modelValue: 'fade' | 'cut' | 'slide' }>()
const emit = defineEmits<{ 'update:modelValue': [value: 'fade' | 'cut' | 'slide'] }>()

const OPTIONS: Array<{ value: 'fade' | 'cut' | 'slide'; label: string; hint: string }> = [
  { value: 'cut', label: '直切', hint: '不加过渡，导出最快' },
  { value: 'fade', label: '淡入淡出', hint: '片段之间交叉淡化' },
  { value: 'slide', label: '推移', hint: '后一片段从侧面推入' }
]

const current = computed(() => OPTIONS.find((o) => o.value === props.modelValue) ?? OPTIONS[0])

function pick(value: 'fade' | 'cut' | 'slide'): void {
  if (value !== props.modelValue) emit('update:modelValue', value)
}
</script>

<template>
  <div class="flex items-center gap-2">
    <span class="text-xs text-fg-muted">片段过渡</span>
    <div class="flex rounded-md border border-line-subtle p-0.5">
      <button
        v-for="opt in OPTIONS"
        :key="opt.value"
        type="button"
        class="rounded px-2.5 py-1 text-xs"
        :class="
          modelValue === opt.value
            ? 'bg-brand-500/10 text-fg-brand'
            : 'text-fg-secondary hover:bg-surface-hover'
        "
        :title="opt.hint"
        @click="pick(opt.value)"
      >
        {{ opt.label }}
      </button>
    </div>
    <span class="text-[11px] text-fg-faint">{{ current.hint }}</span>
  </div>
</template>
