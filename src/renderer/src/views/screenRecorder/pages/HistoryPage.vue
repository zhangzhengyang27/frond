<template>
  <div class="flex h-full flex-col overflow-hidden">
    <div class="flex items-center gap-3 border-b border-line-subtle px-6 py-4">
      <h2 class="text-base font-semibold text-fg-primary">录制历史</h2>
      <span class="text-xs text-fg-muted">{{ summaryLabel }}</span>
      <div class="ml-auto flex items-center gap-2">
        <button
          type="button"
          class="rounded-md border border-line-subtle px-3 py-1.5 text-xs text-fg-secondary hover:bg-surface-hover"
          :disabled="items.length === 0"
          @click="load"
        >
          刷新
        </button>
        <button
          type="button"
          class="rounded-md border border-line-subtle px-3 py-1.5 text-xs text-fg-danger hover:bg-surface-hover"
          :disabled="items.length === 0"
          @click="clearAll"
        >
          清空记录
        </button>
      </div>
    </div>

    <div v-if="loading" class="flex flex-1 items-center justify-center text-sm text-fg-muted">
      读取中…
    </div>
    <div
      v-else-if="items.length === 0"
      class="flex flex-1 flex-col items-center justify-center gap-3"
    >
      <AppIcon icon="ri-history-line" :size="30" class="text-fg-faint" />
      <p class="text-sm text-fg-muted">还没有录制记录</p>
      <router-link
        :to="{ name: 'screenRecorderRecord' }"
        class="rounded-md bg-brand-500 px-3 py-1.5 text-xs text-white no-underline"
      >
        去录一段
      </router-link>
    </div>

    <ul v-else class="flex-1 overflow-y-auto px-6 py-4">
      <li
        v-for="item in items"
        :key="item.id"
        class="mb-3 flex items-center gap-4 rounded-lg border border-line-subtle bg-surface-0 p-3"
      >
        <div
          class="flex h-16 w-28 shrink-0 items-center justify-center overflow-hidden rounded-md bg-surface-1"
        >
          <img
            v-if="thumbOf(item)"
            :src="thumbOf(item)"
            :alt="item.filename"
            class="h-full w-full object-cover"
            loading="lazy"
          />
          <AppIcon v-else icon="ri-film-line" :size="20" class="text-fg-faint" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="truncate text-sm font-medium text-fg-primary">{{ item.filename }}</p>
          <p class="mt-1 text-xs text-fg-muted">
            {{ dateLabel(item.createdAt) }} · {{ durationLabel(item.duration) }} ·
            {{ sizeLabel(item.fileSize) }}
          </p>
        </div>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs text-fg-secondary hover:bg-surface-hover"
            title="用系统默认程序打开"
            @click="openItem(item)"
          >
            打开
          </button>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs text-fg-secondary hover:bg-surface-hover"
            title="在访达中显示"
            @click="reveal(item)"
          >
            显示
          </button>
          <router-link
            :to="{ name: 'screenRecorderClip' }"
            class="rounded-md px-2.5 py-1.5 text-xs text-fg-brand no-underline hover:bg-surface-hover"
          >
            剪辑
          </router-link>
          <button
            type="button"
            class="rounded-md px-2.5 py-1.5 text-xs text-fg-danger hover:bg-surface-hover"
            @click="remove(item)"
          >
            删除
          </button>
        </div>
      </li>
    </ul>
  </div>
</template>

<script setup lang="ts">
/*
 * 2026-09-23 重建件：HistoryPage.vue 随事故丢失且全盘无副本（dev 缓存里没被服务过）。
 * 契约来源：Layout.vue 的导航项、router 的 screenRecorderHistory 路由、
 * preload 的 recordingHistory / recording 两组 API。
 */
import { computed, onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import type { RecordingHistory } from '@preload/index.d'

const items = ref<RecordingHistory[]>([])
const loading = ref(true)

const totalBytes = computed(() => items.value.reduce((s, i) => s + (i.fileSize || 0), 0))
const summaryLabel = computed(() =>
  items.value.length === 0
    ? '共 0 段'
    : `共 ${items.value.length} 段 · ${sizeLabel(totalBytes.value)}`
)

function thumbOf(item: RecordingHistory): string {
  return item.thumbnail ? `file://${item.thumbnail}` : ''
}

function sizeLabel(bytes: number): string {
  if (!bytes) return '0 B'
  const mb = bytes / 1024 / 1024
  return mb >= 1024 ? `${(mb / 1024).toFixed(2)} GB` : `${mb.toFixed(1)} MB`
}

function durationLabel(seconds: number): string {
  const s = Math.max(0, Math.round(seconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const pad = (n: number): string => String(n).padStart(2, '0')
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${m}:${pad(sec)}`
}

function dateLabel(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

async function load(): Promise<void> {
  loading.value = true
  try {
    items.value = await window.api.recordingHistory.getHistory()
  } catch (error) {
    console.error('[HistoryPage] getHistory failed:', error)
    items.value = []
  } finally {
    loading.value = false
  }
}

async function openItem(item: RecordingHistory): Promise<void> {
  const res = await window.api.recordingHistory.openFile(item.filePath)
  if (!res.success) console.error('[HistoryPage] openFile failed:', res.error)
}

function reveal(item: RecordingHistory): void {
  void window.api.recordingHistory.showInFolder(item.filePath)
}

async function remove(item: RecordingHistory): Promise<void> {
  // 只删记录不删文件：文件在用户磁盘上，删文件的决定权不该在这个列表里
  if (!window.confirm(`删除「${item.filename}」的记录？文件本身会留在磁盘上。`)) return
  if (await window.api.recordingHistory.deleteHistory(item.id)) {
    items.value = items.value.filter((i) => i.id !== item.id)
  }
}

async function clearAll(): Promise<void> {
  if (!window.confirm(`清空全部 ${items.value.length} 条记录？文件本身会留在磁盘上。`)) return
  await window.api.recordingHistory.clearHistory()
  items.value = []
}

onMounted(load)
</script>
