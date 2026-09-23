<script setup lang="ts">
/**
 * SourceSelector · 录制源选择（屏幕 / 窗口 / 显示器区域 / 摄像头）
 * 2026-09-23 重建：原文件被截断，仅存脚本尾 68 行，脚本头部与整段模板为重建
 */
// 待核：Props/Emits 名单由 pages/RecordPage.vue 的实际传参反推，模板结构为重建
import { onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import type { CameraDevice, DesktopCapturerSource } from '@composables/useSourceSelection'

/** window.api.recording.region.listDisplays 的返回项（主进程 screen 显示器快照） */
interface DisplayInfo {
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}

interface Props {
  sourceType: 'screen' | 'camera'
  sources: DesktopCapturerSource[]
  selectedSource: DesktopCapturerSource | null
  cameraDevices: CameraDevice[]
  selectedCameraDevice: CameraDevice | null
  loading: boolean
  isRecording: boolean
  cameraError: string | null
  sourceError: string | null
  thumbnailErrors: Set<string>
}

interface Emits {
  'select-source': [source: DesktopCapturerSource]
  'select-camera': [device: CameraDevice]
  'switch-source-type': [type: 'screen' | 'camera']
  'refresh-sources': []
  'refresh-cameras': []
  'retry-camera': []
  'close-camera': []
  'request-permission': []
  'select-region': [displayId?: number | 'cross' | null]
}

const displays = ref<DisplayInfo[]>([])
const selectedDisplayId = ref<number | string | null>(null)
const crossDisplay = ref(false)
onMounted(async () => {
  const api = (
    window as unknown as {
      api?: { recording?: { region?: { listDisplays: () => Promise<DisplayInfo[]> } } }
    }
  ).api?.recording?.region
  if (api?.listDisplays) {
    try {
      displays.value = await api.listDisplays()
      // 默认选中主显示器
      const primary = displays.value.find((d) => d.isPrimary)
      if (primary) selectedDisplayId.value = primary.id
    } catch (e) {
      console.warn('[SourceSelector] listDisplays failed:', e)
    }
  }
})

function selectDisplay(id: number): void {
  selectedDisplayId.value = id
  crossDisplay.value = false
  emit('select-region', id)
}

function toggleCrossDisplay(): void {
  crossDisplay.value = !crossDisplay.value
  if (crossDisplay.value) {
    selectedDisplayId.value = 'cross'
    emit('select-region', 'cross')
  }
}

defineProps<Props>()
const emit = defineEmits<Emits>()

const switchSourceType = (type: 'screen' | 'camera'): void => {
  emit('switch-source-type', type)
}

const getSourceTypeLabel = (sourceId: string): string => {
  if (sourceId.includes('screen')) {
    return '屏幕'
  } else if (sourceId.includes('window')) {
    return '窗口'
  }
  return '未知'
}

const getThumbnailUrl = (thumbnail: string | undefined): string => {
  if (!thumbnail) {
    return ''
  }
  if (thumbnail.startsWith('data:')) {
    return thumbnail
  }
  return `data:image/png;base64,${thumbnail}`
}

const handleThumbnailError = (event: Event, _sourceId?: string): void => {
  const img = event.target as HTMLImageElement
  img.style.display = 'none'
}

const handleThumbnailLoad = (event: Event, _sourceId?: string): void => {
  const img = event.target as HTMLImageElement
  img.style.display = 'block'
}
</script>
<template>
  <div class="flex h-full flex-col gap-4 overflow-hidden rounded-2xl bg-surface-1 p-6 shadow-lg">
    <!-- 头部：屏幕 / 摄像头切换 + 刷新 -->
    <div class="flex items-center justify-between gap-3">
      <h2 class="m-0 text-lg font-semibold text-gray-800">选择录制源</h2>
      <div class="flex items-center gap-1 rounded-lg bg-gray-100 p-1">
        <button
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="sourceType === 'screen' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-600'"
          type="button"
          :disabled="isRecording"
          @click="switchSourceType('screen')"
        >
          屏幕
        </button>
        <button
          class="rounded-md px-3 py-1.5 text-sm transition-colors"
          :class="sourceType === 'camera' ? 'bg-white text-gray-800 shadow-xs' : 'text-gray-600'"
          type="button"
          :disabled="isRecording"
          @click="switchSourceType('camera')"
        >
          摄像头
        </button>
      </div>
    </div>

    <!-- 屏幕 / 窗口源 -->
    <div v-if="sourceType === 'screen'" class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-500">
          {{ loading ? '正在读取屏幕源…' : `${sources.length} 个可录制内容` }}
        </span>
        <button
          class="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          type="button"
          :disabled="loading || isRecording"
          @click="$emit('refresh-sources')"
        >
          <AppIcon icon="ri-refresh-line" />
          <span>刷新</span>
        </button>
      </div>

      <p v-if="sourceError" class="m-0 text-sm text-red-500">{{ sourceError }}</p>
      <button
        v-if="sourceError"
        class="self-start rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600"
        type="button"
        @click="$emit('request-permission')"
      >
        授予屏幕录制权限
      </button>

      <!-- 显示器区域（区域录制） -->
      <div v-if="displays.length" class="flex flex-col gap-2">
        <span class="text-xs tracking-wide text-gray-500">区域录制</span>
        <div class="flex flex-wrap gap-2">
          <button
            v-for="display in displays"
            :key="`display-${display.id}`"
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
            :class="
              selectedDisplayId === display.id
                ? 'border-brand-500 text-brand-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            "
            type="button"
            :disabled="isRecording"
            @click="selectDisplay(display.id)"
          >
            显示器 {{ display.id }}{{ display.isPrimary ? '（主）' : '' }}
          </button>
          <button
            class="rounded-lg border px-3 py-1.5 text-sm transition-colors"
            :class="
              crossDisplay
                ? 'border-brand-500 text-brand-600'
                : 'border-gray-200 text-gray-600 hover:bg-gray-100'
            "
            type="button"
            :disabled="isRecording"
            @click="toggleCrossDisplay"
          >
            跨显示器
          </button>
        </div>
      </div>

      <div v-if="loading" class="flex items-center gap-2 text-sm text-gray-500">
        <AppIcon icon="ri-loader-4-line" class="animate-spin" />
        <span>载入中…</span>
      </div>
      <p v-else-if="sources.length === 0" class="m-0 text-sm text-gray-500">
        没有可用的屏幕或窗口源。
      </p>

      <ul v-else class="m-0 flex min-h-0 flex-1 list-none flex-col gap-2 overflow-y-auto p-0">
        <li
          v-for="source in sources"
          :key="source.id"
          class="flex items-center gap-3 rounded-xl border p-2 transition-colors"
          :class="
            selectedSource?.id === source.id
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-gray-100 hover:bg-gray-100'
          "
        >
          <div
            class="flex h-12 w-20 shrink-0 items-center justify-center overflow-hidden rounded-md bg-gray-100"
          >
            <img
              :src="getThumbnailUrl(source.thumbnail)"
              :alt="source.name"
              class="h-full w-full object-cover"
              @error="handleThumbnailError($event, source.id)"
              @load="handleThumbnailLoad($event, source.id)"
            />
            <AppIcon v-if="thumbnailErrors.has(source.id)" icon="ri-image-line" />
          </div>
          <button
            class="min-w-0 flex-1 text-left"
            type="button"
            :disabled="isRecording"
            @click="$emit('select-source', source)"
          >
            <span class="block truncate text-sm text-gray-800">{{ source.name }}</span>
            <span class="block text-xs text-gray-500">{{ getSourceTypeLabel(source.id) }}</span>
          </button>
        </li>
      </ul>
    </div>

    <!-- 摄像头源 -->
    <div v-else class="flex min-h-0 flex-1 flex-col gap-3">
      <div class="flex items-center justify-between">
        <span class="text-sm text-gray-500">{{ cameraDevices.length }} 个摄像头</span>
        <button
          class="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-800"
          type="button"
          :disabled="isRecording"
          @click="$emit('refresh-cameras')"
        >
          <AppIcon icon="ri-refresh-line" />
          <span>刷新</span>
        </button>
      </div>

      <p v-if="cameraError" class="m-0 text-sm text-red-500">{{ cameraError }}</p>
      <div v-if="cameraError" class="flex items-center gap-2">
        <button
          class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600"
          type="button"
          @click="$emit('retry-camera')"
        >
          重试
        </button>
        <button
          class="rounded-lg border border-gray-200 px-3 py-1.5 text-sm text-gray-600"
          type="button"
          @click="$emit('close-camera')"
        >
          关闭摄像头
        </button>
      </div>

      <p v-if="cameraDevices.length === 0" class="m-0 text-sm text-gray-500">没有检测到摄像头。</p>
      <ul v-else class="m-0 flex list-none flex-col gap-2 overflow-y-auto p-0">
        <li
          v-for="device in cameraDevices"
          :key="device.deviceId"
          class="flex items-center gap-3 rounded-xl border p-2"
          :class="
            selectedCameraDevice?.deviceId === device.deviceId
              ? 'border-brand-500 bg-brand-500/5'
              : 'border-gray-100'
          "
        >
          <AppIcon icon="ri-vidicon-line" />
          <button
            class="min-w-0 flex-1 truncate text-left text-sm text-gray-800"
            type="button"
            :disabled="isRecording"
            @click="$emit('select-camera', device)"
          >
            {{ device.label || '未命名摄像头' }}
          </button>
        </li>
      </ul>
    </div>
  </div>
</template>
