<template>
  <!-- 高度用 calc(100vh - 顶栏) 而非 h-screen —— 在 AppShell 的 main 内
       用 h-screen 会多出顶栏高度导致内容被裁切/双滚动条 -->
  <div
    class="flex h-[calc(100vh-var(--shell-topbar-h))] flex-col overflow-hidden bg-gradient-primary"
  >
    <!-- PR-7b: 倒计时遮罩（fixed，覆盖全屏） -->
    <div
      v-if="countdownActive"
      class="fixed inset-0 z-[60] flex items-center justify-center bg-overlay backdrop-blur-sm"
    >
      <div
        class="text-[180px] font-extrabold leading-none tabular-nums text-fg-primary drop-shadow-2xl"
      >
        {{ countdownRemaining }}
      </div>
    </div>

    <!-- 标签页导航栏（v2：改为主题感知的 UTabs 风格导航，
         旧版用 text-white / bg-white/10，依赖一个从未定义的深色渐变 → 浅色下白字不可见） -->
    <div class="border-b border-line-subtle bg-glass-bg px-8 backdrop-blur-[var(--glass-blur)]">
      <div class="mx-auto flex max-w-[1600px] gap-1 py-2">
        <router-link
          :to="{ name: 'screenRecorderRecord' }"
          class="relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium no-underline transition-colors duration-normal"
          :class="
            activeTab === 'record'
              ? 'bg-brand-500/10 text-fg-brand'
              : 'text-fg-secondary hover:bg-surface-hover hover:text-fg-primary'
          "
        >
          <AppIcon icon="ri-record-circle-line" :size="18" />
          <span>录制</span>
          <span
            v-if="activeTab === 'record'"
            class="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-brand-500"
          />
        </router-link>
        <router-link
          :to="{ name: 'screenRecorderHistory' }"
          class="relative flex items-center gap-2 rounded-md px-4 py-2 text-sm font-medium no-underline transition-colors duration-normal"
          :class="
            activeTab === 'history'
              ? 'bg-brand-500/10 text-fg-brand'
              : 'text-fg-secondary hover:bg-surface-hover hover:text-fg-primary'
          "
        >
          <AppIcon icon="ri-history-line" :size="18" />
          <span>历史记录</span>
          <span
            v-if="activeTab === 'history'"
            class="absolute inset-x-3 -bottom-2 h-0.5 rounded-full bg-brand-500"
          />
        </router-link>
      </div>
    </div>

    <!-- 主要内容区域 - 使用 router-view -->
    <div class="flex-1 overflow-hidden">
      <router-view
        :is-recording="isRecording"
        :is-paused="isPaused"
        :recording-time="recordingTime"
        :show-settings-dialog="showSettingsDialog"
        :playback-video-path="playbackVideoPath"
        :playback-recording-id="playbackRecordingId"
        :playback-video-info="playbackVideoInfo"
        @update:show-settings-dialog="showSettingsDialog = $event"
        @toggle-pause="togglePause"
        @play-video="handlePlayVideo"
        @clip-video="handleClipVideo"
        @close-playback="handleClosePlayback"
      />
    </div>

    <!-- 设置对话框 -->
    <RecordingSettingsDialog
      :show="showSettingsDialog"
      @close="showSettingsDialog = false"
      @save="handleSaveSettings"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import AppIcon from '@components/AppIcon.vue'
import RecordingSettingsDialog from '@views/screenRecorder/components/RecordingSettingsDialog.vue'
import { useToast } from '@composables/useToast'
import { useScreenRecorder } from '@composables/useScreenRecorder'
import { useSourceSelection } from '@composables/useSourceSelection'
import { useStreamManager } from '@composables/useStreamManager'

// 录制设置类型
interface RecordingSettings {
  encoder: 'vp9' | 'vp8' | 'h264'
  quality: 'low' | 'medium' | 'high' | 'custom'
  bitrate?: number
  fps: 30 | 60
  resolution: {
    width: number
    height: number
  }
  format: 'webm' | 'mp4'
  audioEnabled: boolean
  audioCodec?: 'aac' | 'opus'
  audioBitrate?: number
  // PR-5a: 系统音频
  systemAudio?: {
    enabled: boolean
    deviceId?: string
    keepMicrophone?: boolean
  }
}

const route = useRoute()
const router = useRouter()
const toast = useToast()

const showSettingsDialog = ref(false)

// 回放相关状态
const playbackVideoPath = ref<string | null>(null)
const playbackRecordingId = ref<string | null>(null)
const playbackVideoInfo = ref<{
  filename: string
  duration: number
  filePath: string
} | null>(null)

// 使用 composables
const {
  isRecording,
  isPaused, // PR-3
  recordingTime,
  stopRecording,
  togglePause // PR-3
} = useScreenRecorder()

// 调用保留（composable 内部注册 devicechange 监听并维护消费者计数，有副作用），
// 但本布局未消费其返回状态（源选择逻辑在 RecordPage 内）
useSourceSelection()

const { cleanup: cleanupStreams } = useStreamManager()

// 根据路由计算当前 tab
const activeTab = computed(() => {
  if (route.name === 'screenRecorderRecord') return 'record'
  if (route.name === 'screenRecorderHistory') return 'history'
  if (route.name === 'screenRecorderPlayback') return 'playback'
  if (route.name === 'screenRecorderClip') return 'clip'
  return 'record'
})

// 监听录制状态变化
watch(isRecording, (newVal) => {
  if (!newVal) {
    // 录制停止时清理资源
    cleanupStreams()
  }
})

// 保存设置
const handleSaveSettings = async (settings: RecordingSettings): Promise<void> => {
  try {
    // 确保只传递可序列化的纯数据对象
    const settingsToSave: Partial<RecordingSettings> = {
      encoder: settings.encoder,
      quality: settings.quality,
      bitrate: settings.bitrate,
      fps: settings.fps,
      resolution: {
        width: settings.resolution.width,
        height: settings.resolution.height
      },
      format: settings.format,
      audioEnabled: settings.audioEnabled,
      audioCodec: settings.audioCodec,
      audioBitrate: settings.audioBitrate,
      // PR-5a
      systemAudio: settings.systemAudio
    }
    await window.api.recordingSettings.updateSettings(settingsToSave)
    showSettingsDialog.value = false
  } catch (error) {
    console.error('保存设置失败:', error)
    toast.error('保存设置失败', { description: (error as Error).message })
  }
}

// 处理播放视频（从历史记录跳转到回放）
const handlePlayVideo = (videoInfo: {
  filePath: string
  recordingId: string
  filename: string
  duration: number
}): void => {
  playbackVideoPath.value = videoInfo.filePath
  playbackRecordingId.value = videoInfo.recordingId
  playbackVideoInfo.value = {
    filename: videoInfo.filename,
    duration: videoInfo.duration,
    filePath: videoInfo.filePath
  }
  router.push({ name: 'screenRecorderPlayback' })
}

// 处理剪辑视频（从历史记录跳转到剪辑）
const handleClipVideo = (videoInfo: {
  filePath: string
  recordingId: string
  filename: string
  duration: number
}): void => {
  playbackVideoPath.value = videoInfo.filePath
  playbackRecordingId.value = videoInfo.recordingId
  playbackVideoInfo.value = {
    filename: videoInfo.filename,
    duration: videoInfo.duration,
    filePath: videoInfo.filePath
  }
  router.push({ name: 'screenRecorderClip' })
}

// 关闭回放
const handleClosePlayback = (): void => {
  playbackVideoPath.value = null
  playbackRecordingId.value = null
  playbackVideoInfo.value = null
  router.push({ name: 'screenRecorderHistory' })
}

onMounted(() => {
  // 根据当前路由设置默认 tab
  if (route.name === 'screenRecorder') {
    router.replace('/screenRecorder/record')
  }
  // loadSources 由 RecordPage 挂载时调用（composable 已是单例，
  // 这里再调一次会让带缩略图的 desktopCapturer 原生调用执行两遍）
  void attachShortcuts()
})

onUnmounted(() => {
  // 离开录屏区时若仍在录制：先停止（触发保存流程）再清理流，
  // 避免留下"界面已卸载但还在录死画面"的僵尸录制
  if (isRecording.value) stopRecording()
  cleanupStreams()
  void detachShortcuts()
})

// ── PR-7a: 全局快捷键 attach ────────────────────────────────
async function attachShortcuts(): Promise<void> {
  const api = (
    window as unknown as {
      api?: {
        recording?: {
          shortcut?: {
            attach: () => Promise<{ ok: boolean }>
            detach: () => Promise<{ ok: boolean }>
          }
        }
      }
    }
  ).api
  await api?.recording?.shortcut?.attach?.()
  // 监听推送
  window.addEventListener('leaf:shortcut-start', onShortcutStart)
  window.addEventListener('leaf:shortcut-togglePause', onShortcutTogglePause)
  // PR-7b: 倒计时（去掉 as EventListener 类型断言：EventListener 是纯类型，
  // 在运行时不存在 → eslint no-undef 报错，且 (e: Event) => void 本就可直接赋值）
  window.addEventListener('leaf:countdown-tick', onCountdownTick)
  window.addEventListener('leaf:countdown-begun', onCountdownBegun)
  window.addEventListener('leaf:countdown-cancel', onCountdownCancel)
}

async function detachShortcuts(): Promise<void> {
  window.removeEventListener('leaf:shortcut-start', onShortcutStart)
  window.removeEventListener('leaf:shortcut-togglePause', onShortcutTogglePause)
  window.removeEventListener('leaf:countdown-tick', onCountdownTick)
  window.removeEventListener('leaf:countdown-begun', onCountdownBegun)
  window.removeEventListener('leaf:countdown-cancel', onCountdownCancel)
  const api = (
    window as unknown as {
      api?: { recording?: { shortcut?: { detach: () => Promise<{ ok: boolean }> } } }
    }
  ).api
  await api?.recording?.shortcut?.detach?.()
}

// ── PR-7b: 倒计时 state ────────────────────────────────────
const countdownActive = ref(false)
const countdownRemaining = ref(0)
function onCountdownTick(e: Event): void {
  const detail = (e as CustomEvent<{ remaining: number }>).detail
  countdownActive.value = true
  countdownRemaining.value = detail.remaining
}
function onCountdownBegun(): void {
  countdownActive.value = false
  countdownRemaining.value = 0
  // 真正开始录制
  void window.dispatchEvent(new CustomEvent('leaf:recording-start-after-countdown'))
}
function onCountdownCancel(): void {
  countdownActive.value = false
  countdownRemaining.value = 0
}

// ── PR-7a: 快捷键 handler（占位 — RecordPage 监听真实 start/stop） ──
function onShortcutStart(): void {
  void window.dispatchEvent(new CustomEvent('leaf:shortcut-recording-start'))
}
function onShortcutTogglePause(): void {
  void window.dispatchEvent(new CustomEvent('leaf:shortcut-recording-togglePause'))
}
</script>
