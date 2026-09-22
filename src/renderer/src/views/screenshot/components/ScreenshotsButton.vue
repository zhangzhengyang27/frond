<template>
  <ScreenshotsOption :open="checked" :content="option">
    <div
      v-if="type !== 'divider'"
      :class="[
        'screenshots-button',
        { 'screenshots-button-checked': checked, 'screenshots-button-disabled': disabled }
      ]"
      :title="title"
      @click="handleClick"
    >
      <span v-if="icon" :class="icon" class="screenshots-button-icon" />
      <slot v-else />
    </div>
    <div v-else class="screenshots-operations-divider" />
    <template #content>
      <slot name="option" />
    </template>
  </ScreenshotsOption>
</template>

<script setup lang="ts">
import ScreenshotsOption from './ScreenshotsOption/index.vue'

defineProps<{
  title?: string
  icon?: string
  checked?: boolean
  disabled?: boolean
  type?: 'divider'
  // option 是 button 内部 dropdown 内容，结构由 ScreenshotsOption 消费，
  // 结构多变，用 unknown 收口
  option?: unknown
}>()

const emit = defineEmits<{
  click: [e: MouseEvent]
}>()

const handleClick = (e: MouseEvent): void => {
  emit('click', e)
}
</script>

<style scoped>
.screenshots-button {
  width: 28px;
  height: 28px;
  line-height: 28px;
  color: var(--shot-text-dim);
  font-size: 16px;
  text-align: center;
  margin: 0 2px;
  vertical-align: middle;
  cursor: pointer;
  border-radius: 7px;
  transition:
    background-color 0.15s,
    color 0.15s,
    transform 0.1s;
}

.screenshots-button:hover {
  background-color: rgba(255, 255, 255, 0.09);
  color: var(--shot-text);
}

.screenshots-button:active {
  transform: scale(0.9);
}

.screenshots-button-checked {
  background-color: var(--shot-accent-soft);
  color: var(--shot-accent);
}

.screenshots-button-checked:hover {
  background-color: var(--shot-accent-soft);
  color: var(--shot-accent);
}

.screenshots-button-disabled {
  color: var(--shot-text-faint);
  cursor: not-allowed;
}

.screenshots-button-disabled:hover {
  background-color: transparent;
  color: var(--shot-text-faint);
}

.screenshots-button-disabled:active {
  transform: none;
}

.screenshots-button-icon {
  display: inline-block;
  font-size: 16px;
  line-height: 1;
}

.screenshots-operations-divider {
  background: rgba(255, 255, 255, 0.16);
  width: 1px;
  height: 18px;
  margin: 0 4px;
}
</style>
