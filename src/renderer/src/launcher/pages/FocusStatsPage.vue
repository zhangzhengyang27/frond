<template>
  <CapsulePage :hints="hints">
    <div class="fstat-page">
      <div v-if="loading" class="fstat-empty">加载统计中…</div>
      <template v-else>
        <!-- 今日概览 -->
        <div class="fstat-today">
          <div class="fstat-cell">
            <div class="fstat-num">{{ today?.workMinutes ?? 0 }}<small> 分</small></div>
            <div class="fstat-label">今日专注</div>
          </div>
          <div class="fstat-cell">
            <div class="fstat-num">{{ today?.completedPomodoros ?? 0 }}<small> 🍅</small></div>
            <div class="fstat-label">完成番茄</div>
          </div>
          <div class="fstat-cell">
            <div class="fstat-num">{{ weekMinutes }}<small> 分</small></div>
            <div class="fstat-label">近 7 天</div>
          </div>
        </div>

        <!-- 近 7 天柱状 -->
        <div class="fstat-section-title">近 7 天</div>
        <div class="fstat-bars">
          <div v-for="p in trend" :key="p.date" class="fstat-bar-col">
            <div class="fstat-bar-wrap">
              <div
                class="fstat-bar"
                :style="{ height: barHeight(p.workMinutes) + '%' }"
                :title="`${p.date} · ${p.workMinutes} 分`"
              />
            </div>
            <div class="fstat-bar-label">{{ dayLabel(p.date) }}</div>
          </div>
        </div>

        <!-- 项目分布 -->
        <div v-if="projects.length > 0" class="fstat-section-title">项目分布（7 天）</div>
        <div v-if="projects.length > 0" class="fstat-projects">
          <div v-for="p in projects" :key="p.projectId ?? 'none'" class="fstat-project">
            <span class="fstat-dot" :style="{ background: p.color || '#888' }" />
            <span class="fstat-project-name">{{ p.projectName || '未归属' }}</span>
            <span class="fstat-project-min">{{ p.workMinutes }} 分</span>
          </div>
        </div>
      </template>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import CapsulePage from './CapsulePage.vue'

interface TrendPoint {
  date: string
  workMinutes: number
  completedPomodoros: number
}

interface ProjectPoint {
  projectId: string | null
  projectName: string
  color: string
  workMinutes: number
}

const emit = defineEmits<{ navigate: [] }>()

const trend = ref<TrendPoint[]>([])
const projects = ref<ProjectPoint[]>([])
const loading = ref(true)

const today = computed(() => trend.value[trend.value.length - 1] ?? null)
const weekMinutes = computed(() => trend.value.reduce((sum, p) => sum + p.workMinutes, 0))
const maxMinutes = computed(() => Math.max(1, ...trend.value.map((p) => p.workMinutes)))

const hints = [
  { keys: '⌘↵', label: '打开番茄钟' },
  { keys: 'ESC', label: '返回' }
]

function barHeight(minutes: number): number {
  return Math.max(4, Math.round((minutes / maxMinutes.value) * 100))
}

function dayLabel(date: string): string {
  const d = new Date(date)
  if (Number.isNaN(d.getTime())) return date.slice(-2)
  const week = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()]
  return `周${week}`
}

function openPomodoro(): void {
  window.api.launcher.openModule('pomodoro', '/pomodoro')
  emit('navigate')
}

/** 键盘分发（LauncherApp 集中转发）；返回 true 表示已消费 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
    openPomodoro()
    return true
  }
  return false
}

defineExpose({ handleKey })

onMounted(async () => {
  try {
    const [trendResult, distResult] = await Promise.all([
      window.api.pomodoro.stats.getDailyTrend(7),
      window.api.pomodoro.stats.getProjectDistribution(Date.now() - 7 * 86_400_000, Date.now())
    ])
    trend.value = (trendResult ?? []) as TrendPoint[]
    projects.value = ((distResult ?? []) as ProjectPoint[])
      .filter((p) => p.workMinutes > 0)
      .sort((a, b) => b.workMinutes - a.workMinutes)
      .slice(0, 4)
  } catch {
    /* 统计读取失败显示空态 */
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.fstat-page {
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.fstat-today {
  display: flex;
  gap: 10px;
}

.fstat-cell {
  flex: 1;
  padding: 10px 12px;
  border-radius: 10px;
  background: var(--launcher-bg-elevated);
}

.fstat-num {
  font-size: 22px;
  font-weight: 600;
  font-variant-numeric: tabular-nums;
  color: var(--launcher-text);
}

.fstat-num small {
  font-size: 12px;
  font-weight: 400;
  color: var(--launcher-text-muted);
}

.fstat-label {
  margin-top: 2px;
  font-size: 11px;
  color: var(--launcher-text-muted);
}

.fstat-section-title {
  font-size: 11px;
  letter-spacing: 0.06em;
  color: var(--launcher-text-muted);
}

.fstat-bars {
  display: flex;
  align-items: flex-end;
  gap: 10px;
  height: 90px;
}

.fstat-bar-col {
  flex: 1;
  height: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.fstat-bar-wrap {
  flex: 1;
  width: 100%;
  max-width: 34px;
  display: flex;
  align-items: flex-end;
  border-radius: 6px;
  background: var(--launcher-bg-elevated);
  overflow: hidden;
}

.fstat-bar {
  width: 100%;
  border-radius: 6px 6px 0 0;
  background: var(--launcher-accent);
  opacity: 0.85;
  transition: height 0.4s ease;
}

.fstat-bar-label {
  font-size: 10px;
  color: var(--launcher-text-muted);
}

.fstat-projects {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.fstat-project {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: var(--launcher-text-dim);
}

.fstat-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.fstat-project-name {
  flex: 1;
  min-width: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.fstat-project-min {
  color: var(--launcher-text-muted);
  font-variant-numeric: tabular-nums;
}

.fstat-empty {
  padding: 22px 0;
  text-align: center;
  font-size: 12px;
  color: var(--launcher-text-muted);
}
</style>
