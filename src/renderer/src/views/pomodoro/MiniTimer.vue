<!--
  Frond · M5 迷你悬浮番茄钟
  - 通过 IPC 订阅主进程的 tray snapshot（与 tray 共用通道）
  - 极简：圆形进度 + 时间 + 模式标签 + 项目名
-->
<template>
  <div class="mini-root" @click="toggleMainWindow" @contextmenu.prevent="onHide">
    <div class="ring-wrap">
      <svg class="ring" viewBox="0 0 100 100">
        <circle class="bg" cx="50" cy="50" r="46" />
        <circle
          class="fg"
          :stroke="strokeColor"
          cx="50"
          cy="50"
          r="46"
          :stroke-dasharray="circumference"
          :stroke-dashoffset="dashOffset"
          stroke-linecap="round"
          transform="rotate(-90 50 50)"
        />
      </svg>
      <div class="time">{{ timeText }}</div>
      <div class="mode">{{ modeText }}</div>
    </div>
    <div class="project">{{ projectName }}</div>
    <button class="close" type="button" title="关闭" @click.stop="onHide">
      <span>×</span>
    </button>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, onBeforeUnmount, ref } from 'vue'

interface Snapshot {
  mode?: 'work' | 'shortBreak' | 'longBreak'
  isRunning?: boolean
  timeLeftSeconds?: number
  totalSeconds?: number
  projectName?: string | null
}

const snapshot = ref<Snapshot>({
  mode: 'work',
  isRunning: false,
  timeLeftSeconds: 25 * 60,
  totalSeconds: 25 * 60,
  projectName: '空闲'
})

let unsub: (() => void) | null = null
let tickHandle: number | null = null

const circumference = 2 * Math.PI * 46

const progress = computed(() => {
  const total = Math.max(1, snapshot.value.totalSeconds ?? 1)
  const left = Math.max(0, snapshot.value.timeLeftSeconds ?? 0)
  return Math.max(0, Math.min(1, left / total))
})

const dashOffset = computed(() => circumference * (1 - progress.value))

const strokeColor = computed(() => {
  const m = snapshot.value.mode
  if (m === 'shortBreak') return '#50c878'
  if (m === 'longBreak') return '#ff6b6b'
  return '#4a9eff'
})

const timeText = computed(() => {
  const sec = Math.max(0, Math.floor(snapshot.value.timeLeftSeconds ?? 0))
  const m = Math.floor(sec / 60)
  const s = sec % 60
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
})

const modeText = computed(() => {
  const m = snapshot.value.mode
  if (m === 'shortBreak') return '短休息'
  if (m === 'longBreak') return '长休息'
  return '专注'
})

const projectName = computed(() => snapshot.value.projectName ?? '空闲')

onMounted(async () => {
  try {
    const snap = await window.api.pomodoro.integration.getTraySnapshot()
    snapshot.value = { ...snapshot.value, ...snap }
  } catch {
    /* ignore */
  }

  const api = window.api?.pomodoro?.integration as
    | {
        onTraySnapshot?: (cb: (s: Snapshot) => void) => () => void
        subscribeSnapshot?: () => void
      }
    | undefined
  if (api?.onTraySnapshot) {
    unsub = api.onTraySnapshot((s) => {
      snapshot.value = { ...snapshot.value, ...s }
    })
    // B5 修复：触发主进程的快照推送（否则 onTraySnapshot 永远收不到后续更新）
    api.subscribeSnapshot?.()
  }

  tickHandle = window.setInterval(() => {
    if (!snapshot.value.isRunning) return
    snapshot.value = {
      ...snapshot.value,
      timeLeftSeconds: Math.max(0, (snapshot.value.timeLeftSeconds ?? 0) - 1)
    }
  }, 1000)
})

onBeforeUnmount(() => {
  unsub?.()
  if (tickHandle) clearInterval(tickHandle)
})

function toggleMainWindow(): void {
  window.api?.pomodoro?.mini?.hide()
  // 不直接打开主窗口（renderer 端无权）。Mini 唤起只通过主进程 / dock 触发。
}

function onHide(): void {
  window.api?.pomodoro?.mini?.hide()
}
</script>

<style>
html,
body {
  margin: 0;
  padding: 0;
  background: transparent !important;
  width: 100%;
  height: 100%;
  overflow: hidden;
}
#app {
  width: 100%;
  height: 100%;
  background: transparent;
}
</style>

<style scoped>
.mini-root {
  width: 100%;
  height: 100vh;
  background: rgba(20, 22, 28, 0.78);
  backdrop-filter: blur(18px);
  -webkit-backdrop-filter: blur(18px);
  border: 1px solid rgba(255, 255, 255, 0.12);
  border-radius: 16px;
  /* MiniTimer 是独立置顶小窗（macOS HUD 式恒暗玻璃），文本固定亮色 */
  color: rgba(255, 255, 255, 0.92);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 10px;
  box-sizing: border-box;
  user-select: none;
  -webkit-user-select: none;
  cursor: pointer;
  position: relative;
}

.ring-wrap {
  position: relative;
  width: 96px;
  height: 96px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.ring {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}

.bg {
  fill: none;
  stroke: rgba(255, 255, 255, 0.12);
  stroke-width: 6;
}

.fg {
  fill: none;
  stroke-width: 6;
  transition: stroke-dashoffset 0.6s ease;
}

.time {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  letter-spacing: 0.5px;
}

.mode {
  position: absolute;
  bottom: -6px;
  font-size: 9px;
  color: rgba(255, 255, 255, 0.55);
}

.project {
  margin-top: 8px;
  font-size: 10px;
  color: rgba(255, 255, 255, 0.7);
  text-align: center;
  max-width: 200px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.close {
  position: absolute;
  top: 4px;
  right: 6px;
  width: 16px;
  height: 16px;
  background: transparent;
  border: 0;
  color: rgba(255, 255, 255, 0.5);
  font-size: 14px;
  cursor: pointer;
  line-height: 1;
}

.close:hover {
  color: var(--pomo-text-strong);
}
</style>

