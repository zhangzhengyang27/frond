<!-- 2026-09-23 重建：原文件被截断，仅存 39 行真实代码（脚本尾 + 空的 style 头），其余为重建 -->
<!-- 2026-10-05 UI 重设计：预览舞台（深色媒体面）+ 悬浮控制坞（大圆 REC 键，Cap/Screen Studio 式） -->
<template>
  <div
    class="flex h-full flex-col overflow-hidden rounded-2xl border border-line-subtle bg-[#101012]"
  >
    <!-- 舞台 -->
    <div class="relative min-h-0 flex-1">
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
        v-show="showPipCamera"
        ref="pipCameraRef"
        class="absolute bottom-3 right-3 w-36 rounded-xl object-cover shadow-[0_8px_24px_rgba(0,0,0,0.5)] ring-1 ring-white/20"
        autoplay
        muted
        playsinline
      ></video>

      <!-- 空态：构图式引导 -->
      <div
        v-if="!hasPreview"
        class="absolute inset-0 flex flex-col items-center justify-center gap-3"
      >
        <div
          class="flex size-16 items-center justify-center rounded-xl bg-white/[0.06]"
        >
          <AppIcon icon="ri-focus-3-line" :size="28" class="text-white/40" />
        </div>
        <p class="m-0 text-[15px] font-medium text-white/85">从上方选择录制源</p>
        <p class="m-0 text-xs text-white/40">屏幕、窗口或摄像头，选好即可开始</p>
      </div>
      <!-- 预览错误（B59：过期源等） -->
      <div
        v-else-if="previewError"
        class="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-black/70"
      >
        <AppIcon icon="ri-error-warning-line" class="text-white" :size="32" />
        <p class="m-0 text-sm text-white">预览不可用：该源可能已关闭或失效</p>
        <p class="m-0 text-xs text-white/60">请重新选择录制源（列表已自动刷新）</p>
      </div>

      <!-- 录制状态徽章 -->
      <div
        v-if="isRecording"
        class="absolute left-4 top-4 flex items-center gap-2 rounded-full bg-black/60 px-3.5 py-1.5 text-xs font-medium text-white ring-1 ring-white/15 backdrop-blur"
      >
        <span
          class="size-2 rounded-full"
          :class="isPaused ? 'bg-amber-400' : 'animate-pulse bg-red-500'"
        />
        <span class="tabular-nums"
          >{{ isPaused ? '已暂停' : '录制中' }} · {{ formatTime(recordingTime) }}</span
        >
      </div>

      <!-- 区域录制提示 -->
      <p
        v-if="showRecordingModeHint"
        class="absolute bottom-3 left-4 m-0 rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/70 backdrop-blur"
      >
        区域录制：先在系统选区里拖出范围再开始
      </p>
    </div>

    <!-- 控制坞：大圆 REC 键 + 伴生动作 -->
    <div class="relative border-t border-white/[0.06] bg-[#17171a] px-6 py-3">
      <div class="mx-auto flex max-w-md items-center justify-between">
        <!-- 左：保存位置 -->
        <button
          class="flex size-10 items-center justify-center rounded-full text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95 disabled:opacity-40"
          type="button"
          :disabled="isRecording"
          title="保存位置"
          aria-label="保存位置"
          @click="$emit('select-save-path')"
        >
          <AppIcon icon="ri-folder-line" :size="18" />
        </button>

        <!-- 中：REC 大圆键 -->
        <div class="flex items-center gap-4">
          <button
            v-if="!isRecording"
            type="button"
            class="group relative flex size-14 items-center justify-center rounded-full bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.22),0_10px_28px_rgba(239,68,68,0.4)] transition-all duration-200 hover:scale-105 hover:bg-red-400 active:scale-95 disabled:cursor-not-allowed disabled:opacity-30 disabled:hover:scale-100"
            :disabled="!canRecord || loading"
            :title="loading ? '准备中…' : '开始录制'"
            aria-label="开始录制"
            @click="$emit('start-recording')"
          >
            <span
              class="size-5 rounded-full bg-white/90 transition-all duration-200 group-hover:size-6"
            />
          </button>
          <button
            v-else
            type="button"
            class="flex size-14 items-center justify-center rounded-[14px] bg-red-500 shadow-[0_0_0_4px_rgba(239,68,68,0.22),0_10px_28px_rgba(239,68,68,0.4)] transition-all duration-200 hover:scale-105 hover:bg-red-400 active:scale-95"
            title="停止录制"
            aria-label="停止录制"
            @click="$emit('stop-recording')"
          >
            <span class="size-5 rounded-[4px] bg-white/95" />
          </button>

          <!-- 暂停 / 继续（录制中） -->
          <button
            v-if="isRecording"
            class="flex size-10 items-center justify-center rounded-full text-white/70 ring-1 ring-white/15 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
            type="button"
            :title="isPaused ? '继续' : '暂停'"
            :aria-label="isPaused ? '继续' : '暂停'"
            @click="$emit('toggle-pause')"
          >
            <AppIcon :icon="isPaused ? 'ri-play-fill' : 'ri-pause-fill'" :size="18" />
          </button>
        </div>

        <!-- 右：标记浮层 toggle + 设置 -->
        <div class="flex items-center gap-2">
          <button
            class="flex size-10 items-center justify-center rounded-full transition-all duration-200 active:scale-95"
            :class="
              showMarkers
                ? 'bg-brand-400/20 text-brand-300 ring-1 ring-brand-400/50'
                : 'text-white/60 hover:bg-white/10 hover:text-white'
            "
            type="button"
            title="标记"
            aria-label="标记"
            @click="$emit('toggle-markers')"
          >
            <AppIcon icon="ri-bookmark-line" :size="18" />
          </button>
          <button
            class="flex size-10 items-center justify-center rounded-full text-white/60 transition-all duration-200 hover:bg-white/10 hover:text-white active:scale-95"
            type="button"
            title="录制设置"
            aria-label="设置"
            @click="$emit('open-settings')"
          >
            <AppIcon icon="ri-settings-3-line" :size="18" />
          </button>
        </div>
      </div>

      <!-- 准备中 -->
      <span
        v-if="loading"
        class="absolute right-5 top-1/2 -translate-y-1/2 text-xs text-white/50 max-md:hidden"
      >
        <AppIcon icon="ri-loader-4-line" class="me-1 inline animate-spin" />
        准备中…
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
/**
 * PreviewPanel · 录屏预览舞台与控制坞（RecordPage 主列）
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
  showMarkers?: boolean // 标记浮层开态（dock 键高亮）
  formatTime: (seconds: number) => string
}

defineProps<Props>()
defineEmits<Emits>()

const previewVideoRef = ref<HTMLVideoElement | null>(null)
const pipCameraRef = ref<HTMLVideoElement | null>(null)

// B59：预览 video 报错（典型：点选了已消失的窗口源，捕获流即刻死亡）——
// 给出可见错误与重选指引，不再裸露 Chromium「无法播放媒体」
const previewError = ref(false)
const onVideoError = (event: Event): void => {
  console.error('视频元素错误:', event)
  previewError.value = true
}
const onVideoLoaded = (): void => {
  previewError.value = false
}

interface Emits {
  (e: 'start-recording'): void
  (e: 'stop-recording'): void
  (e: 'toggle-pause'): void // PR-3
  (e: 'select-save-path'): void
  (e: 'open-settings'): void
  (e: 'toggle-markers'): void
}

// 暴露 ref 给父组件
defineExpose({
  previewVideoRef,
  pipCameraRef
})
</script>
<style scoped>
video {
  background: transparent;
}
</style>
