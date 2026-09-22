<template>
  <div class="statistics-panel">
    <!-- 顶部：标题 + 区间切换 -->
    <div class="stats-topbar">
      <div class="stats-title-row">
        <span class="stats-icon">📊</span>
        <h3>专注统计</h3>
      </div>
      <div class="range-switcher">
        <button
          v-for="opt in rangeOptions"
          :key="opt.value"
          :class="['range-btn', { active: statsRange === opt.value }]"
          type="button"
          @click="setRange(opt.value)"
        >
          {{ opt.label }}
        </button>
      </div>
    </div>

    <!-- 导出工具条 -->
    <div class="export-bar">
      <span class="export-label">导出</span>
      <button class="export-btn" type="button" :disabled="exporting" @click="onExport('csv')">
        <AppIcon icon="ri-file-text-line" />
        <span>CSV</span>
      </button>
      <button class="export-btn" type="button" :disabled="exporting" @click="onExport('markdown')">
        <AppIcon icon="ri-markdown-line" />
        <span>MD</span>
      </button>
      <span v-if="exportMessage" class="export-feedback">{{ exportMessage }}</span>
    </div>

    <div v-if="loading" class="loading">
      <div class="loading-spinner" />
      <span>加载中…</span>
    </div>
    <template v-else>
      <TaskCompletionStats v-if="taskStats" :task-stats="taskStats" />
      <TrendChart :points="dailyTrend" />
      <div class="dual-grid">
        <ProjectDonut :items="projectDistribution" />
        <HourHeatmap :cells="focusHeatmap" />
      </div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { storeToRefs } from 'pinia'
import AppIcon from '@components/AppIcon.vue'
import { usePomodoroStore, type StatsRange } from '../../../stores/pomodoro'
import { exportBulkAsCSV, exportBulkAsMarkdown } from '../utils/exportTaskRecords'
import TrendChart from './TrendChart.vue'
import ProjectDonut from './ProjectDonut.vue'
import HourHeatmap from './HourHeatmap.vue'
import TaskCompletionStats from './TaskCompletionStats.vue'

const store = usePomodoroStore()
const { statsRange, dailyTrend, projectDistribution, focusHeatmap, taskStats, statsLoading } =
  storeToRefs(store)

const loading = computed(() => statsLoading.value)

const rangeOptions: Array<{ value: StatsRange; label: string }> = [
  { value: 'today', label: '今日' },
  { value: 'week', label: '近 7 天' },
  { value: 'month', label: '近 30 天' }
]

onMounted(() => {
  if (!taskStats.value) {
    store.loadStats('week')
  }
})

async function setRange(range: StatsRange): Promise<void> {
  await store.loadStats(range)
}

// M6：批量导出
const exporting = ref(false)
const exportMessage = ref<string | null>(null)

async function onExport(kind: 'csv' | 'markdown'): Promise<void> {
  exporting.value = true
  exportMessage.value = '准备数据…'
  try {
    const bounds = rangeBounds()
    if (!bounds) {
      exportMessage.value = '区间未就绪'
      return
    }
    const records = await store.fetchRecordsByRange(bounds.from, bounds.to, null)
    if (records.length === 0) {
      exportMessage.value = '无记录可导出'
      return
    }
    const projectName = `${labelOf(statsRange.value)}（全部项目）`
    const args = {
      projectName,
      from: bounds.from,
      to: bounds.to,
      records: records.map((r) => ({
        id: r.id,
        type: r.type,
        duration: r.duration,
        completedAt: r.completedAt,
        taskId: r.taskId,
        taskTitle: r.taskTitle,
        date: r.date
      }))
    }
    const res = kind === 'csv' ? await exportBulkAsCSV(args) : await exportBulkAsMarkdown(args)
    if (res.ok) {
      exportMessage.value = '已导出'
    } else if (res.canceled) {
      exportMessage.value = '已取消'
    } else {
      exportMessage.value = `失败：${res.error ?? '未知'}`
    }
  } catch (err) {
    exportMessage.value = err instanceof Error ? err.message : String(err)
  } finally {
    exporting.value = false
    setTimeout(() => {
      exportMessage.value = null
    }, 3000)
  }
}

function labelOf(r: StatsRange): string {
  if (r === 'today') return '今日'
  if (r === 'week') return '近 7 天'
  if (r === 'month') return '近 30 天'
  if (r === 'custom') return '自定义'
  return String(r)
}

function rangeBounds(): { from: number; to: number } | null {
  const now = new Date()
  const end = now.getTime()
  const start = new Date(now)
  if (statsRange.value === 'today') {
    start.setHours(0, 0, 0, 0)
  } else if (statsRange.value === 'week') {
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
  } else if (statsRange.value === 'month') {
    start.setDate(start.getDate() - 29)
    start.setHours(0, 0, 0, 0)
  } else {
    return null
  }
  return { from: start.getTime(), to: end }
}
</script>
