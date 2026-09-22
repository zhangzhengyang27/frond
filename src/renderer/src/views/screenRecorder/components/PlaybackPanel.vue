<template>
  <div class="flex flex-col h-full bg-gradient-primary overflow-hidden">
    <!-- 回放页面 -->
    <div class="flex-1 overflow-y-auto p-6 px-8">
      <div v-if="!videoPath" class="flex flex-col items-center justify-center h-full text-white/80">
        <AppIcon icon="ri-video-line" :size="64" class="mb-4" />
        <p class="text-lg">请选择一个视频进行回放</p>
        <p class="text-sm mt-2 text-white/60">从历史记录中选择一个录制文件</p>
      </div>
      <div
        v-else
        class="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[2fr_1fr] gap-6 h-full"
      >
        <!-- 视频播放区域 -->
        <div class="bg-surface-1 rounded-2xl p-6 shadow-lg flex flex-col">
          <div class="flex items-center justify-between mb-5">
            <h2 class="text-xl font-semibold text-gray-800 m-0">
              {{ videoInfo?.filename || '视频回放' }}
            </h2>
            <button
              class="flex items-center gap-2 px-4 py-2 text-sm text-gray-600 hover:text-gray-800 hover:bg-gray-100 rounded-lg transition-colors"
              @click="handleClose"
            >
              <AppIcon icon="ri-close-line" />
              <span>关闭</span>
            </button>
          </div>

          <!-- 视频播放器 -->
          <div
            class="relative w-full aspect-video bg-black rounded-xl overflow-hidden mb-5 shadow-[0_4px_16px_rgba(0,0,0,0.2)]"
          >
            <video
              ref="videoRef"
              :src="videoSrc"
              class="w-full h-full object-contain"
              preload="metadata"
              @loadedmetadata="handleVideoLoaded"
              @timeupdate="handleTimeUpdate"
              @play="isPlaying = true"
              @pause="isPlaying = false"
              @ended="isPlaying = false"
              @error="handleVideoError"
              @canplay="handleVideoCanPlay"
              @loadstart="handleLoadStart"
            ></video>
            <div
              v-if="loading"
              class="absolute inset-0 flex items-center justify-center bg-black/50"
            >
              <AppIcon icon="ri-loader-4-line" class="animate-spin text-white" :size="48" />
            </div>
          </div>

          <!-- 播放控制 -->
          <div class="flex flex-col gap-4">
            <!-- 时间轴 -->
            <div class="relative w-full h-16 bg-gray-100 rounded-lg overflow-hidden">
              <template v-if="duration > 0">
                <div class="absolute inset-0 flex items-center">
                  <!-- 标记点 -->
                  <template v-for="marker in markers" :key="`marker-${marker.id}`">
                    <div
                      class="absolute top-0 bottom-0 flex items-center cursor-pointer group z-10"
                      :style="{
                        left: `${Math.max(0, Math.min(100, (marker.timestamp / duration) * 100))}%`
                      }"
                      @click="handleJumpToMarker(marker)"
                    >
                      <div
                        class="w-1 h-full"
                        :style="{ backgroundColor: marker.color || '#ff4444' }"
                      ></div>
                      <div
                        class="absolute left-1 top-0 bottom-0 flex items-center justify-center w-5 h-5 bg-white rounded-full shadow-md border-2 transition-all group-hover:scale-110"
                        :style="{ borderColor: marker.color || '#ff4444' }"
                      >
                        <div
                          class="w-2 h-2 rounded-full"
                          :style="{ backgroundColor: marker.color || '#ff4444' }"
                        ></div>
                      </div>
                      <div
                        class="absolute left-6 top-0 px-2 py-1 bg-gray-900 text-white text-xs rounded opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap pointer-events-none z-20"
                      >
                        {{ marker.label }} ({{ formatTime(marker.timestamp) }})
                      </div>
                    </div>
                  </template>
                  <!-- 当前播放位置 -->
                  <div
                    v-if="currentTime !== null && currentTime >= 0 && duration > 0"
                    class="absolute top-0 bottom-0 w-0.5 bg-red-500 z-20 pointer-events-none"
                    :style="{
                      left: `${Math.max(0, Math.min(100, (currentTime / duration) * 100))}%`
                    }"
                  ></div>
                </div>
              </template>
            </div>

            <!-- 播放控制按钮 -->
            <div class="flex items-center justify-between">
              <div class="flex items-center gap-3">
                <button
                  class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
                  title="跳转到开始"
                  @click="handleSeekToStart"
                >
                  <AppIcon icon="ri-skip-back-line" :size="20" />
                </button>
                <button
                  class="flex items-center justify-center w-12 h-12 rounded-lg bg-gradient-primary text-white hover:opacity-90 transition-opacity shadow-lg"
                  title="播放/暂停"
                  @click="handlePlayPause"
                >
                  <AppIcon :icon="isPlaying ? 'ri-pause-line' : 'ri-play-line'" :size="28" />
                </button>
                <button
                  class="flex items-center justify-center w-10 h-10 rounded-lg bg-gray-200 hover:bg-gray-300 transition-colors"
                  title="跳转到结束"
                  @click="handleSeekToEnd"
                >
                  <AppIcon icon="ri-skip-forward-line" :size="20" />
                </button>
              </div>
              <div class="flex items-center gap-2 text-sm font-mono text-gray-700">
                <span>{{ formatTime(currentTime || 0) }}</span>
                <span>/</span>
                <span>{{ formatTime(duration) }}</span>
              </div>
            </div>
          </div>
        </div>

        <!-- 标记面板 -->
        <MarkersPanel
          :key="`markers-${recordingId || 'none'}`"
          :recording-id="recordingId"
          :is-recording="false"
          :recording-time="currentTime || 0"
          :duration="duration"
          :video-ref="videoRef"
          @jump-to-marker="handleJumpToMarker"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import MarkersPanel from '@views/screenRecorder/components/MarkersPanel.vue'
import { useMarkers } from '@composables/useMarkers'
import type { Marker } from '@preload/index.d'

interface Props {
  videoPath?: string | null
  recordingId?: string | null
  videoInfo?: {
    filename: string
    duration: number
    filePath: string
  } | null
}

const props = withDefaults(defineProps<Props>(), {
  videoPath: null,
  recordingId: null,
  videoInfo: null
})

const emit = defineEmits<{
  close: []
}>()

const videoRef = ref<HTMLVideoElement | null>(null)
const currentTime = ref<number>(0)
const isPlaying = ref(false)
const loading = ref(false)
const duration = ref(0)
const blobUrl = ref<string | null>(null)

// 使用 computed 来创建响应式的 recordingId ref
const recordingIdRef = computed(() => props.recordingId)
const { markers, loadMarkers } = useMarkers(recordingIdRef)

// 格式化时间函数
const formatTime = (seconds: number): string => {
  // 处理无效值
  if (!isFinite(seconds) || isNaN(seconds) || seconds < 0) {
    return '00:00'
  }

  const hours = Math.floor(seconds / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  const secs = Math.floor(seconds % 60)

  if (hours > 0) {
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }
  return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
}

// 计算视频源路径（使用 blob URL）
const videoSrc = computed(() => {
  return blobUrl.value || ''
})

// 监听视频路径变化，通过 IPC 读取文件并创建 blob URL
watch(
  () => props.videoPath,
  async (newPath, oldPath) => {
    // 如果路径变化，先清空视频源，避免触发错误
    if (newPath !== oldPath && videoRef.value) {
      videoRef.value.pause()
      videoRef.value.src = ''
      duration.value = 0
      currentTime.value = 0
      isPlaying.value = false
    }

    // 清理旧的 blob URL
    if (blobUrl.value) {
      URL.revokeObjectURL(blobUrl.value)
      blobUrl.value = null
    }

    // 如果有新路径，通过 IPC 读取文件并创建 blob URL
    if (newPath) {
      loading.value = true

      // 如果 videoInfo 中有时长信息，先使用它
      if (props.videoInfo?.duration && props.videoInfo.duration > 0) {
        duration.value = props.videoInfo.duration
        console.log('使用 videoInfo 中的时长:', duration.value)
      }

      try {
        // 通过 IPC 读取文件
        const arrayBuffer = await window.api.video.readFile(newPath)

        // 获取文件扩展名以确定 MIME 类型
        const ext = newPath.toLowerCase().substring(newPath.lastIndexOf('.'))
        const mimeTypes: Record<string, string> = {
          '.webm': 'video/webm',
          '.mp4': 'video/mp4',
          '.ogg': 'video/ogg',
          '.ogv': 'video/ogg',
          '.mov': 'video/quicktime',
          '.avi': 'video/x-msvideo',
          '.mkv': 'video/x-matroska'
        }
        const mimeType = mimeTypes[ext] || 'video/webm'

        // 创建 blob URL
        const blob = new Blob([arrayBuffer], { type: mimeType })
        blobUrl.value = URL.createObjectURL(blob)
      } catch (error) {
        console.error('读取视频文件失败:', error)
        loading.value = false
      }
    } else {
      loading.value = false
    }
  },
  { immediate: true }
)

// 监听 blob URL 变化，加载视频
watch(
  () => blobUrl.value,
  async (newUrl, oldUrl) => {
    if (!videoRef.value) return

    // 如果 URL 变化，重置状态
    if (newUrl !== oldUrl) {
      videoRef.value.pause()
      duration.value = 0
      currentTime.value = 0
      isPlaying.value = false

      // 如果有新 URL，等待 DOM 更新后再加载
      if (newUrl) {
        // 等待下一个 tick，确保 video 元素的 src 已经更新
        await new Promise<void>((resolve) => setTimeout(resolve, 0))

        if (!videoRef.value) {
          loading.value = false
          return
        }

        // 确保视频元素的 src 已设置
        if (videoRef.value.src !== newUrl) {
          videoRef.value.src = newUrl
        }

        // 强制加载视频元数据
        videoRef.value.load()

        // 等待视频加载元数据
        await new Promise<void>((resolve) => {
          if (!videoRef.value) {
            loading.value = false
            resolve()
            return
          }

          const onLoadedMetadata = (): void => {
            if (videoRef.value) {
              const videoDuration = videoRef.value.duration
              console.log('视频元数据加载完成，时长:', videoDuration)
              if (isFinite(videoDuration) && !isNaN(videoDuration) && videoDuration > 0) {
                // 使用视频元素获取的时长（更准确）
                duration.value = videoDuration
                currentTime.value = videoRef.value.currentTime || 0
              } else {
                console.warn('视频时长无效:', videoDuration)
                // 如果视频元素无法获取时长，尝试使用 videoInfo 中的时长
                if (props.videoInfo?.duration && props.videoInfo.duration > 0) {
                  duration.value = props.videoInfo.duration
                  console.log('使用 videoInfo 中的时长作为备用:', duration.value)
                }
              }
            }
            loading.value = false
            videoRef.value?.removeEventListener('loadedmetadata', onLoadedMetadata)
            resolve()
          }

          const onError = (): void => {
            console.error('视频加载失败:', videoRef.value?.error)
            loading.value = false
            duration.value = 0
            currentTime.value = 0
            videoRef.value?.removeEventListener('loadedmetadata', onLoadedMetadata)
            videoRef.value?.removeEventListener('error', onError)
            resolve()
          }

          // 如果 videoInfo 中有时长信息，先使用它
          if (props.videoInfo?.duration && props.videoInfo.duration > 0 && duration.value === 0) {
            duration.value = props.videoInfo.duration
            console.log('使用 videoInfo 中的时长（在等待元数据前）:', duration.value)
          }

          // 如果视频已经加载了元数据，直接获取时长
          if (videoRef.value.readyState >= 1) {
            const videoDuration = videoRef.value.duration
            if (isFinite(videoDuration) && !isNaN(videoDuration) && videoDuration > 0) {
              duration.value = videoDuration
              currentTime.value = videoRef.value.currentTime || 0
              loading.value = false
              resolve()
              return
            }
          }

          videoRef.value.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
          videoRef.value.addEventListener('error', onError, { once: true })

          // 设置超时，避免永远等待
          setTimeout(() => {
            if (loading.value) {
              console.warn('视频加载超时')
              // 即使超时，也尝试获取时长
              if (videoRef.value && videoRef.value.readyState >= 1) {
                const videoDuration = videoRef.value.duration
                if (isFinite(videoDuration) && !isNaN(videoDuration) && videoDuration > 0) {
                  duration.value = videoDuration
                }
              }
              loading.value = false
              videoRef.value?.removeEventListener('loadedmetadata', onLoadedMetadata)
              videoRef.value?.removeEventListener('error', onError)
              resolve()
            }
          }, 10000)
        })
      } else {
        loading.value = false
      }
    }
  },
  { immediate: true }
)

// 监听 videoInfo 变化，更新时长
watch(
  () => props.videoInfo?.duration,
  (newDuration) => {
    if (newDuration && newDuration > 0 && duration.value === 0) {
      duration.value = newDuration
      console.log('从 videoInfo 更新时长:', duration.value)
    }
  },
  { immediate: true }
)

// 监听 recordingId 变化，加载标记
watch(
  () => props.recordingId,
  async (newId, oldId) => {
    console.log('recordingId 变化:', { oldId, newId })
    if (newId) {
      console.log('开始加载标记，recordingId:', newId)
      await loadMarkers(newId)
      console.log('标记加载完成，标记数量:', markers.value.length)
      if (markers.value.length > 0) {
        console.log(
          '标记列表:',
          markers.value.map((m) => ({ time: m.timestamp, label: m.label }))
        )
      } else {
        console.warn('未找到标记，recordingId:', newId)
      }
    } else {
      console.log('recordingId 为空，清空标记')
      // markers 是只读的，通过 loadMarkers 清空
      await loadMarkers('')
    }
  },
  { immediate: true }
)

// 视频加载完成
const handleVideoLoaded = (): void => {
  if (videoRef.value) {
    const videoDuration = videoRef.value.duration
    console.log('handleVideoLoaded - 视频时长:', videoDuration)
    if (isFinite(videoDuration) && !isNaN(videoDuration) && videoDuration > 0) {
      duration.value = videoDuration
      currentTime.value = videoRef.value.currentTime || 0
    }
  }
}

// 视频可以播放
const handleVideoCanPlay = (): void => {
  loading.value = false
  if (videoRef.value) {
    const videoDuration = videoRef.value.duration
    console.log('handleVideoCanPlay - 视频时长:', videoDuration)
    if (isFinite(videoDuration) && !isNaN(videoDuration) && videoDuration > 0) {
      duration.value = videoDuration
    }
  }
}

// 视频开始加载
const handleLoadStart = (): void => {
  console.log('视频开始加载')
  loading.value = true
}

// 视频加载错误
const handleVideoError = (event: Event): void => {
  // 如果视频源为空，忽略错误（这是正常的清理过程）
  if (!blobUrl.value || !videoRef.value?.src) {
    return
  }

  console.error('视频播放错误:', event)
  loading.value = false
  if (videoRef.value?.error) {
    const error = videoRef.value.error
    let errorMessage = '视频加载失败'
    // MediaError 错误代码常量
    const MEDIA_ERR_ABORTED = 1
    const MEDIA_ERR_NETWORK = 2
    const MEDIA_ERR_DECODE = 3
    const MEDIA_ERR_SRC_NOT_SUPPORTED = 4

    switch (error?.code) {
      case MEDIA_ERR_ABORTED:
        errorMessage = '视频加载被中止'
        break
      case MEDIA_ERR_NETWORK:
        errorMessage = '网络错误，无法加载视频'
        break
      case MEDIA_ERR_DECODE:
        errorMessage = '视频解码失败'
        break
      case MEDIA_ERR_SRC_NOT_SUPPORTED:
        errorMessage = '视频格式不支持'
        break
    }
    console.error(errorMessage, error)
  }
}

// 更新时间
const handleTimeUpdate = (): void => {
  if (videoRef.value) {
    currentTime.value = videoRef.value.currentTime
  }
}

// 播放/暂停
const handlePlayPause = (): void => {
  if (videoRef.value) {
    if (isPlaying.value) {
      videoRef.value.pause()
    } else {
      videoRef.value.play()
    }
  }
}

// 跳转到开始
const handleSeekToStart = (): void => {
  if (videoRef.value) {
    videoRef.value.currentTime = 0
  }
}

// 跳转到结束
const handleSeekToEnd = (): void => {
  if (videoRef.value && duration.value > 0) {
    videoRef.value.currentTime = duration.value
  }
}

// 跳转到标记时间点
const handleJumpToMarker = (marker: Marker | number): void => {
  if (videoRef.value) {
    const timestamp = typeof marker === 'number' ? marker : marker.timestamp
    if (timestamp >= 0 && timestamp <= duration.value) {
      videoRef.value.currentTime = timestamp
      // 如果视频暂停，自动播放
      if (videoRef.value.paused) {
        videoRef.value.play().catch((error) => {
          console.error('播放视频失败:', error)
        })
      }
    }
  }
}

// 关闭回放
const handleClose = (): void => {
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.src = ''
  }
  // 清理 blob URL
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value)
    blobUrl.value = null
  }
  emit('close')
}

onMounted(() => {
  // 组件挂载时的初始化
})

onUnmounted(() => {
  // 组件卸载时清理
  if (videoRef.value) {
    videoRef.value.pause()
    videoRef.value.src = ''
  }
  // 清理 blob URL
  if (blobUrl.value) {
    URL.revokeObjectURL(blobUrl.value)
    blobUrl.value = null
  }
})
</script>
