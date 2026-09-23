<template>
  <div class="bg-switch" role="group" aria-label="背景渐变">
    <button
      v-for="opt in options"
      :key="opt.key"
      type="button"
      class="swatch"
      :class="{ active: active === opt.key }"
      :style="{ background: `var(${opt.var})` }"
      :title="opt.label"
      :aria-pressed="active === opt.key"
      @click="emit('update:active', opt.key)"
    />
  </div>
</template>

<script setup lang="ts">
/** 2026-09-23 重建件（原件全盘无副本）。 */
type CodeShotBackground = 'disco' | 'salad' | 'cucumber' | 'aqua' | 'lovely'

defineProps<{ active: CodeShotBackground }>()
const emit = defineEmits<{ 'update:active': [value: CodeShotBackground] }>()

/** 渐变的真身在 `CodeScreenshot.vue` 的容器上以 `--code-shot-*` 发布（CSS 变量会继承下来），
 *  这里只贴小色块，不再抄一遍色值。 */
const options: Array<{ key: CodeShotBackground; label: string; var: string }> = [
  { key: 'disco', label: 'Disco', var: '--code-shot-disco' },
  { key: 'salad', label: 'Salad', var: '--code-shot-salad' },
  { key: 'cucumber', label: 'Cucumber', var: '--code-shot-cucumber' },
  { key: 'aqua', label: 'Aqua', var: '--code-shot-aqua' },
  { key: 'lovely', label: 'Lovely', var: '--code-shot-lovely' }
]
</script>

<style scoped>
.bg-switch {
  display: inline-flex;
  gap: 6px;
}

.swatch {
  width: 22px;
  height: 14px;
  padding: 0;
  border: 1px solid rgba(0, 0, 0, 0.18);
  border-radius: 4px;
  cursor: pointer;
  opacity: 0.65;
  transition:
    opacity 0.15s,
    transform 0.15s;
}

.swatch:hover {
  opacity: 1;
}

.swatch.active {
  opacity: 1;
  transform: scale(1.06);
  outline: 2px solid var(--pomo-accent, #007aff);
  outline-offset: 1px;
}
</style>
