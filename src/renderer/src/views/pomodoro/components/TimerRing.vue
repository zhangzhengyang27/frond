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
        <!-- B61：环心只放时间 + 模式（任务标题在聚焦条，此前两处重复） -->
        <div class="time">{{ timeText }}</div>
        <div v-if="hint" class="hint">{{ hint }}</div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
/** 2026-09-23 重建件（原件全盘无副本，按 index.vue 的用法与 props/emits 契约重建）。
 *  B61 重构：细线巨环 + 超大细体时间——时间字符串是整个页面的视觉锚点。 */
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

const RADIUS = 46
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
  /* B61 舞台式：环即页面主角 */
  width: min(56vh, 440px);
  aspect-ratio: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  /* 环后一圈模式色光晕：把环从纸面上轻轻托起 */
  border-radius: 50%;
  background: radial-gradient(
    circle,
    var(--pomo-ring-halo, transparent) 0%,
    transparent 68%
  );
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
    stroke 0.8s ease;
}

.is-work .ring-progress {
  stroke: var(--pomo-work);
  filter: drop-shadow(0 0 8px var(--pomo-work-glow));
}

.is-shortBreak .ring-progress {
  stroke: var(--pomo-short);
  filter: drop-shadow(0 0 8px var(--pomo-short-glow));
}

.is-longBreak .ring-progress {
  stroke: var(--pomo-long);
  filter: drop-shadow(0 0 8px var(--pomo-long-glow));
}

.is-work .ring-wrap {
  --pomo-ring-halo: var(--pomo-work-soft);
}

.is-shortBreak .ring-wrap {
  --pomo-ring-halo: var(--pomo-short-soft);
}

.is-longBreak .ring-wrap {
  --pomo-ring-halo: var(--pomo-long-soft);
}

.running .ring-progress {
  animation: ring-breathe 3.2s ease-in-out infinite;
}

.paused .ring-progress {
  opacity: 0.5;
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
  gap: 6px;
  max-width: 78%;
}

/* B61：时间即主角——超大细体，tabular 防跳动 */
.time {
  font-size: clamp(48px, 11vh, 92px);
  font-weight: 250;
  letter-spacing: -0.03em;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--pomo-text-strong);
}

.hint {
  font-size: 12px;
  font-weight: 600;
  letter-spacing: 0.16em;
  text-transform: uppercase;
  color: var(--pomo-text-faint);
}

@keyframes ring-breathe {
  0%,
  100% {
    opacity: 1;
  }
  50% {
    opacity: 0.82;
  }
}
</style>
