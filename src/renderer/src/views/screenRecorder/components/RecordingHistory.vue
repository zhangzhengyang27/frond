<script setup lang="ts">
/**
 * RecordingHistory · 录屏历史列表
 * 2026-09-23 重建：原文件被截断，仅存 12 行真实代码（删除链路），其余按该存留重建
 */
// 待核：本组件盘上暂无引用（历史页 HistoryPage.vue 缺失），props/事件按存留脚本反推
import { onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import { useToast } from '@composables/useToast'
import { formatDateTime, formatDuration } from '@utils/format'
import type { RecordingHistory } from '@preload/index.d'

const emit = defineEmits<{
  play: [item: RecordingHistory]
  clip: [item: RecordingHistory]
}>()

const toast = useToast()
const items = ref<RecordingHistory[]>([])
const loading = ref(false)

const loadHistory = async (): Promise<void> => {
  loading.value = true
  try {
    items.value = await window.api.recordingHistory.getHistory()
  } catch (error) {
    console.error('[RecordingHistory] getHistory failed:', error)
    items.value = []
  } finally {
    loading.value = false
  }
}

const handleReveal = async (item: RecordingHistory): Promise<void> => {
  const res = await window.api.recordingHistory.showInFolder(item.filePath)
  if (!res.success) toast.error(res.error || '无法打开所在文件夹')
}

const handleDelete = async (target: RecordingHistory): Promise<void> => {
  if (!confirm(`确定删除「${target.filename}」及其视频文件吗？此操作不可撤销。`)) return
  // 以下 12 行为原件存留（删除走 recording.remove，失败再回退旧 JSON 历史）
  const recordingApi = window.api.recording
  let removed = false
  try {
    // 用户已确认删除：连同视频/缩略图文件一并删除，否则文件永久残留磁盘
    const res = await recordingApi.remove({ id: target.id, deleteFile: true })
    removed = !!res?.ok
  } catch {
    removed = false
  }
  if (!removed) {
    removed = await window.api.recordingHistory.deleteHistory(target.id)
  }
  if (removed) {
    items.value = items.value.filter((item) => item.id !== target.id)
    toast.success('已删除')
  } else {
    toast.error('删除失败')
  }
}

const formatSize = (bytes: number): string => {
  if (!bytes || bytes <= 0) return '—'
  const mb = bytes / (1024 * 1024)
  return mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb.toFixed(1)} MB`
}

onMounted(loadHistory)

defineExpose({ loadHistory })
</script>

<template>
  <div class="flex h-full flex-col gap-4">
    <div class="flex items-center justify-between">
      <h2 class="m-0 text-xl font-semibold text-gray-800">历史记录</h2>
      <button
        class="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
        type="button"
        @click="loadHistory"
      >
        <AppIcon icon="ri-refresh-line" />
        <span>刷新</span>
      </button>
    </div>

    <p v-if="loading" class="text-sm text-gray-500">载入中…</p>
    <p v-else-if="items.length === 0" class="text-sm text-gray-500">还没有录制历史。</p>

    <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
      <li
        v-for="item in items"
        :key="item.id"
        class="flex items-center gap-4 rounded-xl bg-surface-1 p-3 shadow-sm"
      >
        <img
          v-if="item.thumbnail"
          :src="`image://${encodeURI(item.thumbnail)}`"
          alt=""
          class="h-14 w-24 rounded-md object-cover"
        />
        <div v-else class="flex size-14 items-center justify-center rounded-md bg-gray-100">
          <AppIcon icon="ri-video-line" />
        </div>
        <div class="min-w-0 flex-1">
          <p class="m-0 truncate text-sm text-gray-800">{{ item.filename }}</p>
          <p class="m-0 mt-1 text-xs text-gray-500">
            {{ formatDateTime(item.createdAt) }} · {{ formatDuration(item.duration) }} ·
            {{ formatSize(item.fileSize) }}
          </p>
        </div>
        <button class="text-sm text-gray-600" type="button" @click="emit('play', item)">
          回放
        </button>
        <button class="text-sm text-gray-600" type="button" @click="emit('clip', item)">
          剪辑
        </button>
        <button class="text-sm text-gray-600" type="button" @click="handleReveal(item)">
          定位
        </button>
        <button class="text-sm text-red-500" type="button" @click="handleDelete(item)">删除</button>
      </li>
    </ul>
  </div>
</template>
