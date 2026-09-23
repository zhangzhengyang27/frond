<template>
  <div class="mode-selector">
    <div class="segmented" role="group" aria-label="计时模式">
      <button
        v-for="opt in options"
        :key="opt.value"
        type="button"
        class="segment"
        :class="[{ active: currentMode === opt.value }, `is-${opt.value}`]"
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
}
withDefaults(defineProps<Props>(), { settingsTitle: '设置' })

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
.mode-selector {
  display: flex;
  align-items: center;
  gap: 10px;
}

.segmented {
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 3px;
  background: var(--pomo-surface-container-low);
  border: 1px solid var(--pomo-glass-border);
  border-radius: 999px;
}

.segment {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 14px;
  border: none;
  border-radius: 999px;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
  font-weight: 600;
  color: var(--pomo-text-muted);
  transition:
    background 0.2s,
    color 0.2s;
}

.segment:hover {
  color: var(--pomo-text-strong);
}

.segment i {
  font-size: 14px;
}

.segment.active {
  color: var(--pomo-on-accent);
}

.segment.is-work.active {
  background: var(--pomo-work);
}

.segment.is-shortBreak.active {
  background: var(--pomo-short);
}

.segment.is-longBreak.active {
  background: var(--pomo-long);
}

.gear {
  width: 34px;
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--pomo-glass-border);
  border-radius: 50%;
  background: var(--pomo-surface-container);
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
  background: var(--pomo-surface-variant);
  transform: rotate(30deg);
}
</style>
