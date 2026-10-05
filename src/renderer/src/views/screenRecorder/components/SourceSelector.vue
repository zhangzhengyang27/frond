<script setup lang="ts">
/**
 * SourceSelector · 录制源选择（屏幕 / 窗口 / 显示器区域 / 摄像头）
 * 2026-09-23 重建：原文件被截断，仅存脚本尾 68 行，脚本头部与整段模板为重建
 * 2026-10-05 UI 重设计：三栏仪表盘 → 横向源带（Cap/Screenity 式），逻辑零变动
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
  'select-region': [displayId?: number | 'cross' | 'cancel' | null]
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
  } else {
    // B57-19：取消跨屏必须回传——旧实现只翻转本地布尔，UI 无选中但沿用旧区域
    const primary = displays.value.find((d) => d.isPrimary)
    selectedDisplayId.value = primary?.id ?? null
    emit('select-region', 'cancel')
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
  <!-- 横向源带：段控 + 区域 chips + 缩略横滚（Cap 式源选择条） -->
  <div
    class="rounded-2xl border border-line-subtle bg-white/[0.04] p-3 ring-1 ring-white/10 backdrop-blur-sm"
  >
    <div class="flex flex-wrap items-center gap-3">
      <!-- 源类型段控 -->
      <div class="flex items-center rounded-md bg-white/[0.05] p-0.5">
        <button
          class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-100"
          :class="
            sourceType === 'screen'
              ? 'bg-white/10 text-white/90'
              : 'text-white/45 hover:text-white/70'
          "
          type="button"
          :disabled="isRecording"
          @click="switchSourceType('screen')"
        >
          <AppIcon icon="ri-monitor-line" :size="15" />
          屏幕
        </button>
        <button
          class="flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors duration-100"
          :class="
            sourceType === 'camera'
              ? 'bg-white/10 text-white/90'
              : 'text-white/45 hover:text-white/70'
          "
          type="button"
          :disabled="isRecording"
          @click="switchSourceType('camera')"
        >
          <AppIcon icon="ri-vidicon-line" :size="15" />
          摄像头
        </button>
      </div>

      <!-- 区域 chips（仅屏幕源） -->
      <div
        v-if="sourceType === 'screen' && displays.length"
        class="flex flex-wrap items-center gap-1.5"
      >
        <button
          v-for="display in displays"
          :key="`display-${display.id}`"
          class="rounded-md border px-3 py-1.5 text-xs transition-colors duration-100"
          :class="
            selectedDisplayId === display.id
              ? 'border-brand-400/60 bg-brand-400/15 text-brand-300'
              : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/70'
          "
          type="button"
          :disabled="isRecording"
          @click="selectDisplay(display.id)"
        >
          <AppIcon :icon="display.isPrimary ? 'ri-mac-line' : 'ri-monitor-line'" :size="12" />
          显示器 {{ display.id }}{{ display.isPrimary ? '（主）' : '' }}
        </button>
        <button
          class="rounded-md border px-3 py-1.5 text-xs transition-colors duration-100"
          :class="
            crossDisplay
              ? 'border-brand-400/60 bg-brand-400/15 text-brand-300'
              : 'border-white/10 text-white/40 hover:border-white/25 hover:text-white/70'
          "
          type="button"
          :disabled="isRecording"
          @click="toggleCrossDisplay"
        >
          <AppIcon icon="ri-layout-horizontal-line" :size="12" />
          跨显示器
        </button>
      </div>

      <div class="ml-auto flex items-center gap-2">
        <span v-if="loading" class="flex items-center gap-1.5 text-xs text-fg-tertiary">
          <AppIcon icon="ri-loader-4-line" class="animate-spin" />
          载入中…
        </span>
        <button
          class="flex size-8 items-center justify-center rounded-full text-fg-tertiary transition-colors hover:bg-surface-hover hover:text-fg-secondary"
          type="button"
          :disabled="loading || isRecording"
          :title="sourceType === 'screen' ? '刷新屏幕源' : '刷新摄像头'"
          @click="sourceType === 'screen' ? $emit('refresh-sources') : $emit('refresh-cameras')"
        >
          <AppIcon icon="ri-refresh-line" :size="15" />
        </button>
      </div>
    </div>

    <!-- 错误 / 权限 -->
    <p v-if="sourceError" class="mb-0 mt-2.5 flex items-center gap-1.5 text-[13px] text-red-400">
      <AppIcon icon="ri-error-warning-line" :size="14" />
      {{ sourceError }}
      <button
        class="ml-1 rounded-md border border-white/15 px-2 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10"
        type="button"
        @click="$emit('request-permission')"
      >
        授予权限
      </button>
    </p>
    <p v-if="cameraError" class="mb-0 mt-2.5 flex items-center gap-1.5 text-[13px] text-red-400">
      <AppIcon icon="ri-error-warning-line" :size="14" />
      {{ cameraError }}
      <button
        class="ml-1 rounded-md border border-white/15 px-2 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10"
        type="button"
        @click="$emit('retry-camera')"
      >
        重试
      </button>
      <button
        class="rounded-md border border-white/15 px-2 py-0.5 text-xs text-white/60 transition-colors hover:bg-white/10"
        type="button"
        @click="$emit('close-camera')"
      >
        关闭摄像头
      </button>
    </p>

    <!-- 屏幕 / 窗口源：横向缩略条 -->
    <div v-if="sourceType === 'screen'" class="mt-3">
      <p v-if="!loading && sources.length === 0" class="m-0 py-2 text-[13px] text-fg-tertiary">
        没有可用的屏幕或窗口源。
      </p>
      <!-- Cap TargetMenuGrid：grid-cols-2 gap-2 -->
      <div v-else class="grid w-full grid-cols-2 items-start content-start gap-2">
        <button
          v-for="source in sources"
          :key="source.id"
          class="group relative w-44 shrink-0 overflow-hidden rounded-xl border text-left transition-all duration-200 active:scale-[0.98]"
          :class="
            selectedSource?.id === source.id
              ? 'border-brand-500 shadow-[0_0_0_3px_rgba(16,163,127,0.15)]'
              : 'border-white/10 hover:border-white/25 hover:bg-white/[0.03]'
          "
          type="button"
          :disabled="isRecording"
          @click="$emit('select-source', source)"
        >
          <div
            class="flex h-[76px] w-full items-center justify-center overflow-hidden bg-white/[0.06]"
          >
            <img
              :src="getThumbnailUrl(source.thumbnail)"
              :alt="source.name"
              class="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
              @error="handleThumbnailError($event, source.id)"
              @load="handleThumbnailLoad($event, source.id)"
            />
            <AppIcon
              v-if="thumbnailErrors.has(source.id)"
              icon="ri-image-line"
              :size="20"
              class="text-fg-tertiary"
            />
          </div>
          <div class="flex items-center justify-between gap-2 px-2.5 py-2">
            <span class="truncate text-xs font-medium text-white/90">{{ source.name }}</span>
            <span
              class="shrink-0 rounded-full bg-white/[0.06] px-1.5 py-0.5 text-[10px] text-fg-tertiary"
            >
              {{ getSourceTypeLabel(source.id) }}
            </span>
          </div>
          <!-- 选中角标 -->
          <span
            v-if="selectedSource?.id === source.id"
            class="absolute right-2 top-2 flex size-5 items-center justify-center rounded-full bg-brand-400 text-[#0e0f13]"
          >
            <AppIcon icon="ri-check-line" :size="12" />
          </span>
        </button>
      </div>
    </div>

    <!-- 摄像头源 -->
    <div v-else class="mt-3">
      <p v-if="cameraDevices.length === 0" class="m-0 py-2 text-[13px] text-fg-tertiary">
        没有检测到摄像头。
      </p>
      <div v-else class="flex flex-wrap gap-2">
        <button
          v-for="device in cameraDevices"
          :key="device.deviceId"
          class="flex items-center gap-2 rounded-lg border px-3.5 py-2.5 text-[13px] transition-colors duration-100"
          :class="
            selectedCameraDevice?.deviceId === device.deviceId
              ? 'border-brand-400/60 bg-brand-400/15 text-brand-300'
              : 'border-white/10 text-white/70 hover:border-white/25'
          "
          type="button"
          :disabled="isRecording"
          @click="$emit('select-camera', device)"
        >
          <AppIcon icon="ri-vidicon-line" :size="15" />
          {{ device.label || '未命名摄像头' }}
        </button>
      </div>
    </div>
  </div>
</template>
