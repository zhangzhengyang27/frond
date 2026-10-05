<template>
  <div class="mode-selector">
    <div class="segmented" role="group" aria-label="计时模式">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="segment"
        :class="[{ active: currentMode === opt.value }, `is-${opt.value}`]"
        :disabled="switchLocked && currentMode !== opt.value"
        :title="switchLocked && currentMode !== opt.value ? '严格模式：专注中不允许切换' : undefined"
        @click="emit('switch', opt.value)"
      >
        <AppIcon :icon="opt.icon" />
        <span>{{ opt.label }}</span>
      </button>
    </div>
    <button
      type="button"
      class="gear"
      :title="settingsTitle"
      :aria-label="settingsTitle"
      @click="emit('open-settings')"
    >
      <AppIcon icon="settings-3" />
    </button>
  </div>
</template>

<script setup lang="ts">
/** 2026-09-23 重建件（原件全盘无副本，按 index.vue 的用法与 props/emits 契约重建）。 */
import AppIcon from '@components/AppIcon.vue'
import type { TimerMode } from '../../../stores/pomodoro'

interface Props {
  currentMode: TimerMode
  settingsTitle?: string
  /** B60-17：严格模式专注中——非当前模式按钮置灰（此前点击静默无效，像按钮坏了） */
  switchLocked?: boolean
}
withDefaults(defineProps<Props>(), { settingsTitle: '设置', switchLocked: false })

const emit = defineEmits<{
  switch: [mode: TimerMode]
  'open-settings': []
}>()

const options: Array<{ value: TimerMode; label: string; icon: string }> = [
  { value: 'work', label: '专注', icon: 'focus-2' },
  { value: 'shortBreak', label: '短休', icon: 'cup' },
  { value: 'longBreak', label: '长休', icon: 'cloud' }
]
</script>

<style scoped>
/* B61：分段控件安静化——活动段浮起为白卡 + 模式色文字（不再色块填充） */
.mode-selector {
  display: flex;
  align-items: center;
  gap: 8px;
}

.segmented {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--pomo-surface-container-low);
  border: 1px solid var(--pomo-surface-border);
  border-radius: 999px;
}

.segment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 5px 13px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 550;
  color: var(--pomo-text-muted);
  transition:
    background 0.2s,
    color 0.3s,
    box-shadow 0.2s;
}

.segment:hover {
  color: var(--pomo-text-strong);
}

/* B60-17：严格模式专注中——非当前模式置灰 */
.segment:disabled {
  cursor: not-allowed;
  opacity: 0.4;
}

.segment:disabled:hover {
  color: var(--pomo-text-muted);
}

.segment i {
  font-size: 14px;
}

.segment.active {
  background: var(--pomo-surface);
  box-shadow: var(--pomo-shadow-card);
}

.segment.is-work.active {
  color: var(--pomo-work);
}

.segment.is-shortBreak.active {
  color: var(--pomo-short);
}

.segment.is-longBreak.active {
  color: var(--pomo-long);
}

.gear {
  width: 32px;
  height: 32px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 50%;
  background: transparent;
  cursor: pointer;
  font-size: 15px;
  color: var(--pomo-text-muted);
  transition:
    color 0.2s,
    background 0.2s,
    transform 0.3s;
}

.gear:hover {
  color: var(--pomo-text-strong);
  background: var(--pomo-surface-container);
  transform: rotate(30deg);
}
</style>
