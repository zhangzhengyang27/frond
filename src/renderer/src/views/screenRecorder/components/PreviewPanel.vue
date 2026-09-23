<!-- 2026-09-23 重建：原文件被截断，仅存 39 行真实代码（脚本尾 + 空的 style 头），其余为重建 -->
<template>
  <div class="flex h-full flex-col gap-4 rounded-2xl bg-surface-1 p-6 shadow-lg">
    <!-- 待核：模板与样式整体重建，绑定名一律取自存留脚本与 RecordPage 的传参 -->
    <div class="relative aspect-video w-full overflow-hidden rounded-xl bg-black">
      <video
        ref="previewVideoRef"
        class="h-full w-full object-contain"
        autoplay
        muted
        playsinline
        @loadedmetadata="onVideoLoaded"
        @error="onVideoError"
      ></video>
      <video
        v-if="showPipCamera"
        ref="pipCameraRef"
        class="absolute bottom-3 right-3 w-32 rounded-lg object-cover shadow-lg"
        autoplay
        muted
        playsinline
      ></video>
      <p
        v-if="!hasPreview"
        class="absolute inset-0 flex items-center justify-center text-sm text-white/70"
      >
        选择录制源后可在此预览
      </p>
      <div
        v-if="isRecording"
        class="preview-badge absolute left-3 top-3 flex items-center gap-2 rounded-full bg-black/55 px-3 py-1 text-xs text-white"
      >
        <span
          class="size-2 rounded-full"
          :class="isPaused ? 'bg-yellow-400' : 'animate-pulse bg-red-500'"
        />
        <span>{{ isPaused ? '已暂停' : '录制中' }} {{ formatTime(recordingTime) }}</span>
      </div>
    </div>

    <p v-if="showRecordingModeHint" class="m-0 text-xs text-gray-500">
      区域录制：先在系统选区里拖出范围再开始；跨显示器录制要求各屏缩放一致。
    </p>

    <div class="mt-auto flex flex-wrap items-center gap-2">
      <button
        v-if="!isRecording"
        class="rounded-lg bg-brand-500 px-5 py-2 text-sm text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
        type="button"
        :disabled="!canRecord || loading"
        @click="$emit('start-recording')"
      >
        开始录制
      </button>
      <button
        v-else
        class="rounded-lg bg-red-500 px-5 py-2 text-sm text-white transition-colors hover:bg-red-400"
        type="button"
        @click="$emit('stop-recording')"
      >
        停止录制
      </button>
      <button
        v-if="isRecording"
        class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
        type="button"
        @click="$emit('toggle-pause')"
      >
        <AppIcon :icon="isPaused ? 'ri-play-line' : 'ri-pause-line'" />
        <span>{{ isPaused ? '继续' : '暂停' }}</span>
      </button>
      <button
        class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
        type="button"
        :disabled="isRecording"
        @click="$emit('select-save-path')"
      >
        <AppIcon icon="ri-folder-line" />
        <span>保存位置</span>
      </button>
      <button
        class="flex items-center gap-1.5 rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100"
        type="button"
        @click="$emit('open-settings')"
      >
        <AppIcon icon="ri-settings-3-line" />
        <span>设置</span>
      </button>
      <span v-if="loading" class="flex items-center gap-1 text-xs text-gray-500">
        <AppIcon icon="ri-loader-4-line" class="animate-spin" />
        <span>准备中…</span>
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PreviewPanel · 录屏预览与控制（RecordPage 中间列）
 * 预览流由父组件经 defineExpose 的 previewVideoRef / pipCameraRef 直接挂 srcObject
 */
import { ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'

interface Props {
  hasPreview: boolean
  isRecording: boolean
  isPaused?: boolean // PR-3
  recordingTime: number
  canRecord: boolean
  loading: boolean
  showPipCamera: boolean
  showRecordingModeHint: boolean
  formatTime: (seconds: number) => string
}

interface Emits {
  (e: 'start-recording'): void
  (e: 'stop-recording'): void
  (e: 'toggle-pause'): void // PR-3
  (e: 'select-save-path'): void
  (e: 'open-settings'): void
}

defineProps<Props>()
defineEmits<Emits>()

const previewVideoRef = ref<HTMLVideoElement | null>(null)
const pipCameraRef = ref<HTMLVideoElement | null>(null)

const onVideoLoaded = (): void => {
  // 原件此处丢失，没留下可依据的调用点：不猜行为，先只保住 @loadedmetadata 的绑定点
}

const onVideoError = (event: Event): void => {
  console.error('视频元素错误:', event)
}

// 暴露 ref 给父组件
defineExpose({
  previewVideoRef,
  pipCameraRef
})
</script>
<style scoped>
/* 2026-09-23 重建：原件样式未留存，以下仅覆盖本模板用到的类 */
.preview-badge {
  font-variant-numeric: tabular-nums;
}
</style>
