<template>
  <CapsulePage :hints="hints">
    <div class="focus-page">
      <div class="focus-main" @click="toggle">
        <div class="focus-left">
          <div class="focus-mode">
            <span class="focus-dot" :class="stateClass" />
            {{ modeLabel }}
          </div>
          <div v-if="snapshot.taskTitle" class="focus-task">{{ snapshot.taskTitle }}</div>
          <div class="focus-meta">
            <span v-if="snapshot.projectName">{{ snapshot.projectName }}</span>
            <span>今日 {{ snapshot.todayCompleted ?? 0 }} 🍅</span>
          </div>
        </div>
        <div class="focus-time" :class="{ running: snapshot.isRunning }">{{ timeText }}</div>
      </div>
      <div class="focus-bar">
        <div
          class="focus-bar-inner"
          :class="snapshot.currentMode === 'work' ? 'work' : 'break'"
          :style="{ width: progressPercent + '%' }"
        />
      </div>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import CapsulePage from './CapsulePage.vue'

/** tray 快照（与托盘 / 迷你窗共用通道，主窗口番茄钟桥推送） */
interface Snap {
  isRunning?: boolean
  currentMode?: 'work' | 'shortBreak' | 'longBreak'
  taskTitle?: string
  projectName?: string
  timeLeftSeconds?: number
  totalSeconds?: number
  todayCompleted?: number
}

const snapshot = ref<Snap>({})
const displayLeft = ref(0)
let tickHandle: ReturnType<typeof setInterval> | null = null

const timeText = computed(() => {
  const s = Math.max(0, Math.floor(displayLeft.value))
  const m = Math.floor(s / 60)
  return `${m.toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`
})

const modeLabel = computed(() => {
  if (!snapshot.value.isRunning && displayLeft.value <= 0) return '空闲'
  if (snapshot.value.currentMode === 'work') return snapshot.value.isRunning ? '专注中' : '已暂停'
  return snapshot.value.currentMode === 'shortBreak' ? '短休息' : '长休息'
})

const stateClass = computed(() =>
  snapshot.value.isRunning ? (snapshot.value.currentMode === 'work' ? 'work' : 'break') : 'idle'
)

const progressPercent = computed(() => {
  const total = Math.max(1, snapshot.value.totalSeconds ?? 0)
  return Math.min(100, Math.max(0, (1 - displayLeft.value / total) * 100))
})

const hints = computed(() => [
  { keys: '↵', label: snapshot.value.isRunning ? '暂停' : '开始' },
  { keys: '⌘↵', label: '跳过' },
  { keys: '⌘R', label: '重置' },
  { keys: 'ESC', label: '返回' }
])

function applySnapshot(snap: Snap): void {
  snapshot.value = { ...snapshot.value, ...snap }
  displayLeft.value = snap.timeLeftSeconds ?? 0
  // 运行中本地每秒插值（推送节流为 5s 一次）
  if (tickHandle) {
    clearInterval(tickHandle)
    tickHandle = null
  }
  if (snapshot.value.isRunning) {
    tickHandle = setInterval(() => {
      if (displayLeft.value > 0) displayLeft.value -= 1
    }, 1000)
  }
}

async function toggle(): Promise<void> {
  await window.api.pomodoro.dispatchShortcut('toggle')
}
async function skip(): Promise<void> {
  await window.api.pomodoro.dispatchShortcut('skip')
}
async function reset(): Promise<void> {
  await window.api.pomodoro.dispatchShortcut('reset')
}

/** 键盘分发（LauncherApp 集中转发）；返回 true 表示已消费 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'Enter') {
    if (e.metaKey || e.ctrlKey) {
      void skip()
    } else {
      void toggle()
    }
    return true
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'r' || e.key === 'R')) {
    void reset()
    return true
  }
  return false
}

defineExpose({ handleKey })

let unsubTraySnapshot: (() => void) | null = null

onMounted(async () => {
  // 初始状态 + 订阅增量推送（subscribeSnapshot 触发主进程按 sender 回推）
  try {
    applySnapshot((await window.api.pomodoro.integration.getTraySnapshot()) as Snap)
  } catch {
    /* 初始快照失败不阻塞订阅 */
  }
  window.api.pomodoro.integration.subscribeSnapshot()
  // 内联页随胶囊导航反复 push/pop：不退订会叠加监听，每条推送触发 N 次
  unsubTraySnapshot = window.api.pomodoro.integration.onTraySnapshot((snap) =>
    applySnapshot(snap as Snap)
  )
})

onBeforeUnmount(() => {
  if (tickHandle) clearInterval(tickHandle)
  unsubTraySnapshot?.()
  unsubTraySnapshot = null
})
</script>

<style scoped>
.focus-page {
  padding: 10px 12px 12px;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.focus-main {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--launcher-bg-elevated);
  cursor: pointer;
}

.focus-left {
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.focus-mode {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: var(--launcher-text-dim);
}

.focus-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: rgba(0, 0, 0, 0.4);
}

.focus-dot.work {
  background: #ef4444;
}

.focus-dot.break {
  background: #22c55e;
}

.focus-task {
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.focus-meta {
  display: flex;
  gap: 10px;
  font-size: 11px;
  color: var(--launcher-text-muted);
}

.focus-time {
  font-size: 34px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--launcher-text);
  letter-spacing: 0.02em;
  flex-shrink: 0;
}

.focus-time.running {
  color: #007aff;
}

.focus-bar {
  height: 4px;
  border-radius: 999px;
  background: var(--launcher-bg-elevated);
  overflow: hidden;
}

.focus-bar-inner {
  height: 100%;
  border-radius: 999px;
  transition: width 0.4s ease;
}

.focus-bar-inner.work {
  background: #ef4444;
}

.focus-bar-inner.break {
  background: #22c55e;
}
</style>
