<script setup lang="ts">
/**
 * ClipTimeline · 剪辑时间轴（视频预览 + 片段条 + 点击跳转）
 * 2026-09-23 重建：原文件被截断，仅存 2 行真实代码，其余按 ClipEditor 的事件契约重建
 */
// 待核：props/emits 名单由 ClipEditor 现存 handler 反推，非原件
import { computed, ref, watch } from 'vue'
import type { Clip, VideoInfo } from '@composables/useVideoClip'

interface Props {
  videoPath: string
  clips?: Clip[]
  selectedClipId?: string | null
}

const props = withDefaults(defineProps<Props>(), {
  clips: () => [],
  selectedClipId: null
})

const emit = defineEmits<{
  seek: [time: number]
  'clip-select': [clip: Clip]
  'add-clip': [startTime: number, endTime: number]
  'video-info-loaded': [info: VideoInfo]
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const blobUrl = ref('')

watch(
  () => props.videoPath,
  (path) => {
    blobUrl.value = path ? `video://${encodeURI(path)}` : ''
  },
  { immediate: true }
)

const duration = ref(0) // 使用 ref 存储时长，参考 PlaybackPanel.vue

// 计算视频源路径（video:// 协议流式 URL，主进程支持 Range 分片）
const videoSrc = computed(() => blobUrl.value || '')

const currentTime = ref(0)

const clipPercent = (clip: Clip): { left: number; width: number } => {
  if (duration.value <= 0) return { left: 0, width: 0 }
  return {
    left: (clip.startTime / duration.value) * 100,
    width: ((clip.endTime - clip.startTime) / duration.value) * 100
  }
}

function handleLoadedMetadata(event: Event): void {
  const video = event.target as HTMLVideoElement
  duration.value = Number.isFinite(video.duration) ? video.duration : 0
  const info: VideoInfo = {
    duration: duration.value,
    width: video.videoWidth,
    height: video.videoHeight,
    fps: 30
  }
  emit('video-info-loaded', info)
}

function handleTimeUpdate(event: Event): void {
  currentTime.value = (event.target as HTMLVideoElement).currentTime
}

function handleTrackClick(event: MouseEvent): void {
  if (duration.value <= 0) return
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  const time = ratio * duration.value
  if (videoRef.value) videoRef.value.currentTime = time
  currentTime.value = time
  emit('seek', time)
}

function handleAddSelection(clip: Clip): void {
  emit('add-clip', clip.startTime, clip.endTime)
}

const format = (seconds: number): string => {
  const total = Math.max(0, Math.floor(seconds))
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`
}
</script>

<template>
  <div class="flex flex-col gap-3">
    <div class="relative w-full aspect-video bg-black rounded-xl overflow-hidden">
      <video
        ref="videoRef"
        :src="videoSrc"
        class="w-full h-full object-contain"
        preload="metadata"
        @loadedmetadata="handleLoadedMetadata"
        @timeupdate="handleTimeUpdate"
      ></video>
    </div>

    <div
      class="relative h-10 w-full cursor-pointer overflow-hidden rounded-lg bg-gray-100"
      @click="handleTrackClick"
    >
      <div
        v-for="clip in clips"
        :key="clip.id"
        class="absolute top-0 bottom-0 rounded bg-brand-500/70"
        :class="{ 'ring-2 ring-brand-600': selectedClipId === clip.id }"
        :style="{
          left: `${clipPercent(clip).left}%`,
          width: `${Math.max(clipPercent(clip).width, 1)}%`
        }"
        @click.stop="emit('clip-select', clip)"
      >
        <button
          class="h-full w-full px-1 text-left text-[11px] text-white"
          type="button"
          @click.stop="handleAddSelection(clip)"
        >
          {{ clip.label || `${format(clip.startTime)}–${format(clip.endTime)}` }}
        </button>
      </div>
      <div
        v-if="duration > 0"
        class="pointer-events-none absolute top-0 bottom-0 w-0.5 bg-danger"
        :style="{ left: `${(currentTime / duration) * 100}%` }"
      />
    </div>
  </div>
</template>
