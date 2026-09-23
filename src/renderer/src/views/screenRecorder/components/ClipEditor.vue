<script setup lang="ts">
/**
 * ClipEditor · 录屏剪辑编辑器
 * - 视频预览 + 时间轴（点击跳转 / 框选新增片段）+ 片段列表 + 导出
 * 2026-09-23 重建：原文件被截断，仅存脚本尾 238 行，脚本头部与整段模板为重建
 */
// 待核：Props 三字段由 ClipPage 调用方与存留脚本反推；时间轴为重建（原件未留存）
import { computed, onMounted, onUnmounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import ExportDialog from '@views/screenRecorder/components/ExportDialog.vue'
import { useVideoClip } from '@composables/useVideoClip'
import type { Clip, ExportOptions, VideoInfo } from '@composables/useVideoClip'

interface Props {
  videoPath: string
  videoId?: string
  onGoBack?: () => void
}

const props = withDefaults(defineProps<Props>(), {
  videoId: () => `video-${Date.now()}`,
  onGoBack: undefined
})

const emit = defineEmits<{
  'go-back': []
}>()

// 计算视频文件名
const videoFileName = computed(() => {
  if (!props.videoPath) return '未选择视频'
  const parts = props.videoPath.split(/[/\\]/)
  return parts[parts.length - 1] || '未命名视频'
})

// 返回处理
const handleGoBack = (): void => {
  if (props.onGoBack) {
    props.onGoBack()
  } else {
    // 默认行为：触发返回事件
    emit('go-back')
  }
}

const videoRef = ref<HTMLVideoElement | null>(null)
const currentTime = ref<number | null>(null)
const isPlaying = ref(false)
const showClipDialog = ref(false)
const showExportDialog = ref(false)
const editingClip = ref<Clip | null>(null)
const selectedClip = ref<Clip | null>(null)
const clipForm = ref({
  startTime: 0,
  endTime: 0,
  label: ''
})

const {
  clips,
  loading,
  exporting,
  exportProgress,
  videoInfo,
  addClip,
  removeClip,
  updateClip,
  clearClips,
  previewClip,
  exportClips,
  formatTime,
  init,
  loadVideoInfo
} = useVideoClip(props.videoId, props.videoPath)

// play / pause 必须用具名 handler：旧版在 removeEventListener 里传了新的匿名函数
// （引用不同 → 移除无效），每次进出剪辑页都会残留一对监听（BUGS.md B11）
function handlePlay(): void {
  isPlaying.value = true
}
function handlePause(): void {
  isPlaying.value = false
}

// 初始化；init 失败（加载剪辑/视频信息出错）不能让 onMounted 产生未处理 rejection，
// 否则 video 元素的事件监听永远不会挂上（时间显示/播放态失效）
onMounted(async () => {
  try {
    await init()
  } catch (error) {
    console.error('[ClipEditor] init failed:', error)
  }
  if (videoRef.value) {
    videoRef.value.addEventListener('timeupdate', handleTimeUpdate)
    videoRef.value.addEventListener('play', handlePlay)
    videoRef.value.addEventListener('pause', handlePause)
  }
})

onUnmounted(() => {
  if (videoRef.value) {
    videoRef.value.removeEventListener('timeupdate', handleTimeUpdate)
    videoRef.value.removeEventListener('play', handlePlay)
    videoRef.value.removeEventListener('pause', handlePause)
  }
})

// 更新时间
const handleTimeUpdate = (): void => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

// 跳转到指定时间
const handleSeek = (time: number): void => {
  if (videoRef.value) {
    videoRef.value.currentTime = time
    currentTime.value = time
  }
}

// 选择剪辑片段
const handleClipSelect = (clip: Clip): void => {
  selectedClip.value = clip
}

// 处理视频信息加载
const handleVideoInfoLoaded = async (info: VideoInfo): Promise<void> => {
  // 如果传入的 info 有有效的时长，直接使用它更新 videoInfo
  if (info && info.duration > 0) {
    videoInfo.value = info
  } else {
    // 如果传入的 info 无效，尝试重新加载
    if (!videoInfo.value || videoInfo.value.duration === 0) {
      try {
        await loadVideoInfo()
      } catch (error) {
        console.error('重新加载视频信息失败:', error)
      }
    }
  }
}

// 更新剪辑片段
const handleClipUpdate = async (updatedClip: Clip): Promise<void> => {
  try {
    await updateClip(updatedClip.id, {
      startTime: updatedClip.startTime,
      endTime: updatedClip.endTime
    })
  } catch (error) {
    console.error('更新剪辑失败:', error)
    alert(`更新失败: ${(error as Error).message}`)
  }
}

// 从时间轴添加剪辑
const handleAddClipFromTimeline = async (startTime: number, endTime: number): Promise<void> => {
  try {
    await addClip(startTime, endTime)
  } catch (error) {
    console.error('添加剪辑失败:', error)
    alert(`添加失败: ${(error as Error).message}`)
  }
}

// 添加剪辑
const handleAddClip = (): void => {
  editingClip.value = null
  clipForm.value = {
    startTime: currentTime.value || 0,
    endTime: (currentTime.value || 0) + 10,
    label: ''
  }
  showClipDialog.value = true
}

// 编辑剪辑
const handleEditClip = (clip: Clip): void => {
  editingClip.value = clip
  clipForm.value = {
    startTime: clip.startTime,
    endTime: clip.endTime,
    label: clip.label || ''
  }
  showClipDialog.value = true
}

// 保存剪辑
const handleSaveClip = async (): Promise<void> => {
  if (clipForm.value.startTime >= clipForm.value.endTime) {
    alert('开始时间必须小于结束时间')
    return
  }

  try {
    if (editingClip.value) {
      await updateClip(editingClip.value.id, clipForm.value)
    } else {
      await addClip(clipForm.value.startTime, clipForm.value.endTime, clipForm.value.label)
    }
    showClipDialog.value = false
  } catch (error) {
    console.error('保存剪辑失败:', error)
    alert(`保存失败: ${(error as Error).message}`)
  }
}

// 删除剪辑
const handleRemoveClip = async (clipId: string): Promise<void> => {
  if (confirm('确定要删除这个片段吗？')) {
    try {
      await removeClip(clipId)
    } catch (error) {
      console.error('删除剪辑失败:', error)
      alert(`删除失败: ${(error as Error).message}`)
    }
  }
}

// 清空剪辑
const handleClearClips = async (): Promise<void> => {
  if (confirm('确定要清空所有片段吗？')) {
    try {
      await clearClips()
    } catch (error) {
      console.error('清空剪辑失败:', error)
      alert(`清空失败: ${(error as Error).message}`)
    }
  }
}

// 预览剪辑
const handlePreviewClip = async (clip: Clip): Promise<void> => {
  try {
    const previewPath = await previewClip(clip)
    // 可以打开预览视频或显示预览窗口
    console.log('预览路径:', previewPath)
  } catch (error) {
    console.error('预览失败:', error)
    alert(`预览失败: ${(error as Error).message}`)
  }
}

// 导出剪辑
const handleExport = async (options: Omit<ExportOptions, 'clips'>): Promise<void> => {
  try {
    const result = await exportClips(options)
    alert(`导出成功: ${result}`)
    showExportDialog.value = false
  } catch (error) {
    console.error('导出失败:', error)
    alert(`导出失败: ${(error as Error).message}`)
  }
}
// ─── 重建区（2026-09-23）：原件脚本头部丢失，以下胶水为新增 ───
const videoSrc = computed(() => (props.videoPath ? `video://${encodeURI(props.videoPath)}` : ''))
const totalDuration = computed(() => videoInfo.value?.duration ?? 0)

const dragRange = ref<{ start: number; end: number } | null>(null)

const timeFromEvent = (event: MouseEvent): number => {
  const rect = (event.currentTarget as HTMLElement).getBoundingClientRect()
  if (rect.width <= 0 || totalDuration.value <= 0) return 0
  const ratio = Math.min(1, Math.max(0, (event.clientX - rect.left) / rect.width))
  return ratio * totalDuration.value
}

const handleMetadata = (event: Event): void => {
  const video = event.target as HTMLVideoElement
  const info: VideoInfo = {
    duration: Number.isFinite(video.duration) ? video.duration : 0,
    width: video.videoWidth,
    height: video.videoHeight,
    fps: 30
  }
  void handleVideoInfoLoaded(info)
}

const togglePlay = (): void => {
  const video = videoRef.value
  if (!video) return
  if (video.paused) void video.play()
  else video.pause()
}

const onTrackPointerDown = (event: MouseEvent): void => {
  const time = timeFromEvent(event)
  dragRange.value = { start: time, end: time }
}

const onTrackPointerMove = (event: MouseEvent): void => {
  if (!dragRange.value) return
  dragRange.value = { ...dragRange.value, end: timeFromEvent(event) }
}

const onTrackPointerUp = (): void => {
  const range = dragRange.value
  dragRange.value = null
  if (!range) return
  const start = Math.min(range.start, range.end)
  const end = Math.max(range.start, range.end)
  // 拖动不足 0.5 秒视为单击：跳转而不是新增片段
  if (end - start < 0.5) {
    handleSeek(start)
    return
  }
  void handleAddClipFromTimeline(start, end)
}

const toPercent = (seconds: number): number => {
  if (totalDuration.value <= 0) return 0
  return Math.min(100, Math.max(0, (seconds / totalDuration.value) * 100))
}
</script>

<template>
  <div class="flex-1 overflow-y-auto p-6 px-8">
    <div class="mx-auto flex max-w-[1600px] flex-col gap-6">
      <!-- 头部：返回 + 文件名 + 主操作 -->
      <div class="flex items-center justify-between gap-4">
        <div class="flex min-w-0 items-center gap-3">
          <button
            class="flex items-center gap-2 px-3 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 hover:text-gray-800 rounded-lg"
            @click="handleGoBack"
          >
            <AppIcon icon="ri-arrow-left-line" />
            <span>返回</span>
          </button>
          <h2 class="m-0 truncate text-xl font-semibold text-gray-800">{{ videoFileName }}</h2>
        </div>
        <div class="flex items-center gap-2">
          <button
            class="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white transition-colors hover:bg-brand-400 disabled:opacity-50"
            :disabled="!videoPath"
            @click="handleAddClip"
          >
            添加片段
          </button>
          <button
            class="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            :disabled="clips.length === 0"
            @click="handleClearClips"
          >
            清空
          </button>
          <button
            class="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600 transition-colors hover:bg-gray-100 disabled:opacity-50"
            :disabled="clips.length === 0"
            @click="showExportDialog = true"
          >
            导出
          </button>
        </div>
      </div>

      <!-- 视频预览 -->
      <div
        class="relative aspect-video w-full overflow-hidden rounded-xl bg-black shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
      >
        <video
          ref="videoRef"
          :src="videoSrc"
          class="h-full w-full object-contain"
          preload="metadata"
          @loadedmetadata="handleMetadata"
          @click="togglePlay"
        ></video>
        <div v-if="loading" class="absolute inset-0 flex items-center justify-center bg-black/50">
          <AppIcon icon="ri-loader-4-line" :size="48" class="animate-spin text-white" />
        </div>
        <div
          v-if="!loading && !isPlaying"
          class="absolute inset-0 flex items-center justify-center"
        >
          <button
            class="flex size-14 items-center justify-center rounded-full bg-white/85 text-gray-800"
            type="button"
            @click="togglePlay"
          >
            <AppIcon icon="ri-play-fill" :size="28" />
          </button>
        </div>
      </div>

      <!-- 时间轴：单击跳转，拖框新增片段 -->
      <div class="rounded-2xl bg-surface-1 p-6 shadow-lg">
        <div class="mb-3 flex items-center justify-between text-sm text-gray-600">
          <span>{{ formatTime(currentTime ?? 0) }}</span>
          <span>{{ formatTime(totalDuration) }}</span>
        </div>
        <div
          class="relative h-12 w-full cursor-pointer overflow-hidden rounded-lg bg-gray-100"
          @mousedown="onTrackPointerDown"
          @mousemove="onTrackPointerMove"
          @mouseup="onTrackPointerUp"
          @mouseleave="onTrackPointerUp"
        >
          <div
            v-for="clip in clips"
            :key="clip.id"
            class="absolute bottom-0 top-0 rounded bg-brand-500/70"
            :class="{ 'ring-2 ring-brand-600': selectedClip?.id === clip.id }"
            :style="{
              left: `${toPercent(clip.startTime)}%`,
              width: `${Math.max(toPercent(clip.endTime - clip.startTime), 1)}%`
            }"
            @click.stop="handleClipSelect(clip)"
          />
          <div
            v-if="dragRange"
            class="pointer-events-none absolute bottom-0 top-0 bg-brand-500/25"
            :style="{
              left: `${toPercent(Math.min(dragRange.start, dragRange.end))}%`,
              width: `${Math.abs(toPercent(dragRange.end) - toPercent(dragRange.start))}%`
            }"
          />
          <div
            class="pointer-events-none absolute bottom-0 top-0 w-0.5 bg-red-500"
            :style="{ left: `${toPercent(currentTime ?? 0)}%` }"
          />
        </div>
        <p v-if="!clips.length" class="mt-3 text-sm text-gray-500">
          在时间轴上按住拖动即可框选一个新片段；单击则跳转到该时刻。
        </p>
      </div>

      <!-- 片段列表 -->
      <div class="rounded-2xl bg-surface-1 p-6 shadow-lg">
        <h3 class="m-0 mb-4 text-base font-semibold text-gray-800">片段（{{ clips.length }}）</h3>
        <p v-if="!clips.length" class="text-sm text-gray-500">还没有片段，先添加一个吧。</p>
        <ul v-else class="m-0 flex list-none flex-col gap-2 p-0">
          <li
            v-for="clip in clips"
            :key="clip.id"
            class="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2"
            :class="{ 'border-brand-500/60 bg-brand-500/5': selectedClip?.id === clip.id }"
          >
            <button
              class="flex-1 truncate text-left text-sm text-gray-700"
              type="button"
              @click="handleSeek(clip.startTime)"
            >
              {{ formatTime(clip.startTime) }} – {{ formatTime(clip.endTime) }}
              <span v-if="clip.label" class="ml-2 text-gray-500">{{ clip.label }}</span>
            </button>
            <button class="text-sm text-gray-600" type="button" @click="handleEditClip(clip)">
              编辑
            </button>
            <button class="text-sm text-gray-600" type="button" @click="handlePreviewClip(clip)">
              预览
            </button>
            <button class="text-sm text-red-500" type="button" @click="handleRemoveClip(clip.id)">
              删除
            </button>
          </li>
        </ul>
      </div>
    </div>

    <!-- 片段表单 -->
    <div v-if="showClipDialog" class="fixed inset-0 z-[1000] flex items-center p-6">
      <div class="absolute inset-0 bg-overlay" @click="showClipDialog = false" />
      <div class="relative mx-auto w-full max-w-md rounded-xl bg-white p-6 shadow-lg">
        <h3 class="m-0 mb-4 text-base font-semibold text-gray-800">
          {{ editingClip ? '编辑片段' : '新增片段' }}
        </h3>
        <div class="flex flex-col gap-3">
          <label class="flex items-center justify-between gap-3 text-sm text-gray-600">
            <span>开始（秒）</span>
            <input
              v-model.number="clipForm.startTime"
              class="h-9 w-32 rounded-md border border-gray-200 px-3"
              type="number"
              min="0"
            />
          </label>
          <label class="flex items-center justify-between gap-3 text-sm text-gray-600">
            <span>结束（秒）</span>
            <input
              v-model.number="clipForm.endTime"
              class="h-9 w-32 rounded-md border border-gray-200 px-3"
              type="number"
              min="0"
            />
          </label>
          <label class="flex items-center justify-between gap-3 text-sm text-gray-600">
            <span>名称</span>
            <input
              v-model="clipForm.label"
              class="h-9 flex-1 rounded-md border border-gray-200 px-3"
              type="text"
              placeholder="可选"
            />
          </label>
        </div>
        <div class="mt-6 flex justify-end gap-2">
          <button
            class="rounded-lg border border-gray-200 px-4 py-2 text-sm text-gray-600"
            type="button"
            @click="showClipDialog = false"
          >
            取消
          </button>
          <button
            class="rounded-lg bg-brand-500 px-4 py-2 text-sm text-white"
            type="button"
            @click="handleSaveClip"
          >
            保存
          </button>
        </div>
      </div>
    </div>

    <ExportDialog
      v-if="showExportDialog"
      :clips="clips"
      :exporting="exporting"
      :export-progress="exportProgress"
      @close="showExportDialog = false"
      @export="handleExport"
    />
  </div>
</template>
