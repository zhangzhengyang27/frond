<template>
  <div
    class="timer-ring"
    :class="[`is-${mode}`, { running: isRunning, paused: isPaused, flowtime }]"
    role="timer"
    :aria-label="`${hint} ${timeText}`"
  >
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 100 100" aria-hidden="true">
        <circle class="ring-track" cx="50" cy="50" :r="RADIUS" />
        <circle
          class="ring-progress"
          cx="50"
          cy="50"
          :r="RADIUS"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          stroke-linecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div class="ring-center">
        <div class="time">{{ timeText }}</div>
        <div v-if="label" class="label" :title="label">{{ label }}</div>
        <div v-if="hint" class="hint">{{ hint }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 2026-09-23 重建件（原件全盘无副本，按 index.vue 的用法与 props/emits 契约重建）。 */
import { computed } from 'vue'
import type { TimerMode } from '../../../stores/pomodoro'
import { formatCountdown } from '@utils/format'

interface Props {
  timeLeft: number
  duration: number
  mode: TimerMode
  isRunning: boolean
  isPaused: boolean
  label: string
  hint: string
  flowtime: boolean
}
const props = defineProps<Props>()

const RADIUS = 45
const circumference = 2 * Math.PI * RADIUS

// duration 为 0（正计时）时不做除法：直接画满环
const progress = computed(() => {
  if (!Number.isFinite(props.duration) || props.duration <= 0) return 1
  return Math.min(1, Math.max(0, props.timeLeft / props.duration))
})

const dashOffset = computed(() => circumference * (1 - progress.value))

const timeText = computed(() => formatCountdown(Math.max(0, Math.round(props.timeLeft))))
</script>

<style scoped>
.timer-ring {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
}

.ring-wrap {
  position: relative;
  width: min(46vh, 340px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  overflow: visible;
}

.ring-track {
  fill: none;
  stroke: var(--pomo-ring-track);
  stroke-width: var(--pomo-ring-width);
}

.ring-progress {
  fill: none;
  stroke-width: var(--pomo-ring-width);
  transition:
    stroke-dashoffset 0.6s cubic-bezier(0.16, 1, 0.3, 1),
    stroke 0.4s;
}

.is-work .ring-progress {
  stroke: var(--pomo-work);
  filter: drop-shadow(0 0 10px var(--pomo-work-glow));
}

.is-shortBreak .ring-progress {
  stroke: var(--pomo-short);
  filter: drop-shadow(0 0 10px var(--pomo-short-glow));
}

.is-longBreak .ring-progress {
  stroke: var(--pomo-long);
  filter: drop-shadow(0 0 10px var(--pomo-long-glow));
}

.running .ring-progress {
  animation: ring-breathe 3.2s ease-in-out infinite;
}

.paused .ring-progress {
  opacity: 0.55;
  filter: none;
}

.flowtime .ring-track {
  stroke-dasharray: 3 5;
}

.ring-center {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
  max-width: 72%;
}

.time {
  font-size: clamp(30px, 6vh, 46px);
  font-weight: 700;
  letter-spacing: -0.02em;
  font-variant-numeric: tabular-nums;
  color: var(--pomo-text-strong);
}

.label {
  max-width: 100%;
  font-size: 13px;
  font-weight: 500;
  color: var(--pomo-text-soft);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.hint {
  font-size: 11px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--pomo-text-muted);
}

@keyframes ring-breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.78;
  }
}
</style>
