<template>
  <div class="flex-1 overflow-y-auto p-6 px-8">
    <div class="max-w-[1600px] mx-auto grid grid-cols-1 lg:grid-cols-[1fr_1.5fr_1fr] gap-6 h-full">
      <!-- 屏幕源选择区域 -->
      <SourceSelector
        :source-type="sourceType"
        :sources="sources"
        :selected-source="selectedSource"
        :camera-devices="cameraDevices"
        :selected-camera-device="selectedCameraDevice"
        :loading="loading"
        :is-recording="isRecording"
        :camera-error="cameraError"
        :source-error="sourceError"
        :thumbnail-errors="thumbnailErrors"
        @select-source="handleSelectSource"
        @select-camera="handleSelectCamera"
        @switch-source-type="handleSwitchSourceType"
        @refresh-sources="loadSources"
        @refresh-cameras="requestCameraPermission"
        @retry-camera="retryCamera"
        @close-camera="handleCloseCamera"
        @request-permission="requestScreenPermission"
        @select-region="handleSelectRegion"
      />

      <!-- 预览区域 -->
      <PreviewPanel
        ref="previewPanelRef"
        :has-preview="hasPreview"
        :is-recording="isRecording"
        :is-paused="isPaused"
        :recording-time="recordingTime"
        :can-record="canRecord"
        :loading="loading"
        :show-pip-camera="showPipCamera"
        :show-recording-mode-hint="showRecordingModeHint"
        :format-time="formatTime"
        @start-recording="startWithCountdownOrImmediate"
        @stop-recording="stopRecording"
        @toggle-pause="$emit('toggle-pause')"
        @select-save-path="selectSavePath"
        @open-settings="$emit('update:show-settings-dialog', true)"
      />

      <!-- 标记面板 -->
      <MarkersPanel
        :recording-id="localRecordingId"
        :is-recording="isRecording"
        :recording-time="recordingTime"
        @jump-to-marker="handleJumpToMarker"
        @marker-added="handleMarkerAdded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useStreamManager } from '@composables/useStreamManager'
import SourceSelector from '@views/screenRecorder/components/SourceSelector.vue'
import PreviewPanel from '@views/screenRecorder/components/PreviewPanel.vue'
import MarkersPanel from '@views/screenRecorder/components/MarkersPanel.vue'
import { useScreenRecorder } from '@composables/useScreenRecorder'
import { useSourceSelection } from '@composables/useSourceSelection'
import { useToast } from '@composables/useToast'
import type { DesktopCapturerSource, CameraDevice } from '@composables/useSourceSelection'
import type { Marker } from '@preload/index.d'

interface Props {
  isRecording: boolean
  isPaused?: boolean
  recordingTime: number
  currentRecordingId?: string | null
}

const props = defineProps<Props>()

const toast = useToast()
const localRecordingId = ref<string | null>(null)
// 用户框选的录制区域（屏幕 DIP 坐标系）+ 所在显示器 scaleFactor
const selectedRegion = ref<{ x: number; y: number; width: number; height: number } | null>(null)
const selectedRegionScale = ref(1)

defineEmits<{
  'update:show-settings-dialog': [value: boolean]
  'toggle-pause': []
}>()

// 使用 composables（模块级单例：与 Layout 共享同一份状态）
const {
  loading: recorderLoading,
  canRecord,
  startRecording: startRecorder,
  stopRecording,
  togglePause,
  selectSavePath,
  setRecorderOptions,
  formatTime
} = useScreenRecorder()

const {
  sources,
  selectedSource,
  cameraDevices,
  selectedCameraDevice,
  sourceType,
  loading: sourceLoading,
  cameraError,
  sourceError,
  thumbnailErrors,
  loadSources,
  requestScreenPermission,
  switchSourceType,
  requestCameraPermission,
  retryCamera,
  closeCamera: closeCameraSelection
} = useSourceSelection()

const {
  stream,
  cameraStream,
  canvasStream,
  setPreviewVideoRef,
  setPipCameraRef,
  setRegion, // PR-4
  setCursorScreenPos, // PR-4
  setAudioConfig, // 音频输入组合（麦克风/系统音频）
  setFps,
  addAudioToStream,
  getScreenStream,
  getCameraStream,
  combineStreams,
  setPreview,
  closeCamera: closeCameraStream
} = useStreamManager()

// 合并 loading 状态
const loading = computed(() => sourceLoading.value || recorderLoading.value)

// 是否有预览
const hasPreview = computed(() => {
  return !!selectedSource.value || !!selectedCameraDevice.value
})

// 是否显示画中画摄像头
const showPipCamera = computed(() => {
  return !!(selectedSource.value && selectedCameraDevice.value && cameraStream.value)
})

// 是否显示录制模式提示
const showRecordingModeHint = computed(() => {
  return !!(selectedSource.value && selectedCameraDevice.value && !props.isRecording)
})

// 处理选择屏幕源
const handleSelectSource = async (source: DesktopCapturerSource): Promise<void> => {
  if (props.isRecording) {
    return
  }

  selectedSource.value = source

  try {
    const screenStream = await getScreenStream(source)

    // 如果同时选择了摄像头，需要合成流
    if (selectedCameraDevice.value && cameraStream.value) {
      await combineStreams()
    } else {
      // 只使用屏幕时，直接设置预览
      await setPreview(screenStream)
    }
  } catch (error) {
    console.error('获取屏幕流失败:', error)
    toast.error('无法获取屏幕流，请确保已授予屏幕录制权限')
  }
}

// 处理选择摄像头
const handleSelectCamera = async (device: CameraDevice): Promise<void> => {
  if (props.isRecording) {
    return
  }

  selectedCameraDevice.value = device
  cameraError.value = null

  try {
    const camStream = await getCameraStream(device)

    // 如果同时选择了屏幕源和摄像头，需要合成流（画中画模式）
    // 注意：只有当两个源都存在且都有效时才合成
    if (selectedSource.value && stream.value && stream.value.getVideoTracks().length > 0) {
      try {
        await combineStreams()
      } catch (combineError) {
        console.warn('合成流失败，回退到只显示摄像头:', combineError)
        // 如果合成失败，回退到只显示摄像头流
        await setPreview(camStream)
      }
    } else {
      // 只使用摄像头时，设置主预览
      await setPreview(camStream)
    }
  } catch (error) {
    console.error('获取摄像头流失败:', error)
    const errorMessage = (error as Error).message || String(error)

    if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
      cameraError.value = '摄像头权限被拒绝，请在系统设置中授予摄像头权限'
    } else if (
      errorMessage.includes('NotFoundError') ||
      errorMessage.includes('DevicesNotFoundError')
    ) {
      cameraError.value = '未找到摄像头设备，请检查摄像头是否已连接'
    } else if (
      errorMessage.includes('NotReadableError') ||
      errorMessage.includes('TrackStartError') ||
      errorMessage.includes('Could not start video source')
    ) {
      cameraError.value =
        '摄像头无法启动，可能被其他应用占用。请关闭其他使用摄像头的应用（如 FaceTime、Zoom、微信等）后重试'
    } else {
      cameraError.value = `无法访问摄像头: ${errorMessage}`
    }
  }
}

// 处理切换源类型
const handleSwitchSourceType = (type: 'screen' | 'camera'): void => {
  if (props.isRecording) {
    return
  }
  switchSourceType(type)

  // 如果切换到摄像头标签页，且只选择了摄像头（没有屏幕源），确保预览显示摄像头流
  if (
    type === 'camera' &&
    selectedCameraDevice.value &&
    !selectedSource.value &&
    cameraStream.value
  ) {
    setPreview(cameraStream.value).catch((error) => {
      console.error('设置摄像头预览失败:', error)
    })
  }
  // 如果切换到屏幕标签页，且只选择了屏幕源（没有摄像头），确保预览显示屏幕流
  else if (
    type === 'screen' &&
    selectedSource.value &&
    !selectedCameraDevice.value &&
    stream.value
  ) {
    setPreview(stream.value).catch((error) => {
      console.error('设置屏幕预览失败:', error)
    })
  }
}

// PR-4 / PR-6: 唤起 transparent overlay 让 user 框选区域；把 region 推给 stream manager 用于 canvas 裁剪
// payload 是可选的：displayId | 'cross' | undefined
const handleSelectRegion = async (payload?: number | 'cross' | null): Promise<void> => {
  if (props.isRecording) return
  const api = (
    window as unknown as {
      api?: {
        recording?: {
          region?: {
            open: () => Promise<{ region: { x: number; y: number; width: number; height: number } }>
            openForDisplay: (req: { displayId: number }) => Promise<{
              region: { x: number; y: number; width: number; height: number }
              displayId: number
              crossDisplay: boolean
              scaleFactor?: number
            }>
            openCrossDisplay: () => Promise<{
              region: { x: number; y: number; width: number; height: number }
              displayId: number
              crossDisplay: boolean
              scaleFactor?: number
            }>
            cancel: () => Promise<{ ok: boolean }>
            listDisplays: () => Promise<
              Array<{
                id: number
                scaleFactor: number
                isPrimary: boolean
                bounds: { x: number; y: number; width: number; height: number }
              }>
            >
          }
        }
      }
    }
  ).api
  if (!api?.recording?.region) return
  try {
    let region: { x: number; y: number; width: number; height: number }
    let scale: number | undefined
    if (payload === 'cross' && api.recording.region.openCrossDisplay) {
      const r = await api.recording.region.openCrossDisplay()
      region = r.region
      scale = r.scaleFactor
    } else if (typeof payload === 'number' && api.recording.region.openForDisplay) {
      const r = await api.recording.region.openForDisplay({ displayId: payload })
      region = r.region
      scale = r.scaleFactor
    } else if (api.recording.region.open) {
      const r = await api.recording.region.open()
      region = r.region
    } else {
      return
    }
    // openForDisplay/openCrossDisplay 会直接返回区域所在显示器的 scaleFactor；
    // 旧版 open() 不带，回退用 listDisplays 查主显示器 scale
    if (!scale) {
      try {
        const displays = await api.recording.region.listDisplays()
        scale =
          displays.find((d) => d.isPrimary)?.scaleFactor ??
          (typeof payload === 'number' ? displays.find((d) => d.id === payload)?.scaleFactor : 1) ??
          1
      } catch {
        scale = 1
      }
    }
    selectedRegion.value = region
    selectedRegionScale.value = scale
    setRegion(region, scale)
  } catch (e) {
    console.log('[RecordPage] region selection canceled:', e)
  }
}

// PR-4: 监听系统 cursor 推送，把它转给 stream manager 用于 canvas 光圈
const cursorListener = (e: Event): void => {
  const detail = (e as CustomEvent<{ x: number; y: number }>).detail
  setCursorScreenPos(detail)
}
const cursorStopListener = (): void => setCursorScreenPos(null)

onMounted(() => {
  window.addEventListener('frond:cursor-position', cursorListener)
  window.addEventListener('frond:cursor-stop', cursorStopListener)
  // PR-7a: 全局快捷键 → 录制启停
  window.addEventListener('frond:shortcut-recording-start', shortcutStartListener)
  window.addEventListener('frond:shortcut-recording-togglePause', shortcutPauseListener)
  // PR-7b: 倒计时结束 → 真正开始录制
  window.addEventListener('frond:recording-start-after-countdown', beginAfterCountdown)
})

onUnmounted(() => {
  window.removeEventListener('frond:cursor-position', cursorListener)
  window.removeEventListener('frond:cursor-stop', cursorStopListener)
  window.removeEventListener('frond:shortcut-recording-start', shortcutStartListener)
  window.removeEventListener('frond:shortcut-recording-togglePause', shortcutPauseListener)
  window.removeEventListener('frond:recording-start-after-countdown', beginAfterCountdown)
  const api = (
    window as unknown as {
      api?: { recording?: { countdown?: { cancel?: () => Promise<unknown> } } }
    }
  ).api
  void api?.recording?.countdown?.cancel?.()
})

// PR-7a: 快捷键 → start/pause toggle
async function shortcutStartListener(): Promise<void> {
  if (props.isRecording) {
    // 正在录制 → 停止
    stopRecording()
  } else {
    // 没在录制 → 触发开始流程（含倒计时）
    await startWithCountdownOrImmediate()
  }
}
async function shortcutPauseListener(): Promise<void> {
  if (!props.isRecording) return
  // 直接调用单例 togglePause。旧实现走 IPC recording.togglePause，
  // 但 preload 从未暴露该 API、main 端 handler 也是空实现 → 快捷键无效
  togglePause()
}

// PR-7b: 倒计时 → start
async function startWithCountdownOrImmediate(): Promise<void> {
  // 倒计时秒数存在录制设置（设置对话框写入的 JSON store）里；
  // 旧实现读 window.leaf.settings（不存在的 API）→ 永远走默认 3 秒
  let seconds = 3
  try {
    const s = await window.api.recordingSettings?.getSettings()
    if (s && 'countdownSeconds' in s && typeof s.countdownSeconds === 'number') {
      seconds = s.countdownSeconds
    }
  } catch {
    // 读不到就走默认
  }
  if (seconds <= 0) {
    await handleStartRecording()
    return
  }
  try {
    const api = (
      window as unknown as {
        api?: {
          recording?: {
            countdown?: {
              start?: (req: { seconds: number; reason: 'recording' }) => Promise<unknown>
            }
          }
        }
      }
    ).api
    await api?.recording?.countdown?.start?.({ seconds, reason: 'recording' })
  } catch (e) {
    console.warn('[RecordPage] countdown.start failed:', e)
    await handleStartRecording()
  }
}

async function beginAfterCountdown(): Promise<void> {
  await handleStartRecording()
}

// 处理关闭摄像头
const handleCloseCamera = (): void => {
  if (props.isRecording) {
    return
  }
  // 关闭摄像头流
  closeCameraStream()
  // 清除摄像头选择
  closeCameraSelection()
  // 如果之前有屏幕流，恢复屏幕预览
  if (stream.value && previewPanelRef.value?.previewVideoRef) {
    previewPanelRef.value.previewVideoRef.srcObject = stream.value
    previewPanelRef.value.previewVideoRef.play()
  } else if (previewPanelRef.value?.previewVideoRef) {
    // 如果没有屏幕流，清空预览
    previewPanelRef.value.previewVideoRef.srcObject = null
  }
}

// 处理开始录制
const handleStartRecording = async (): Promise<void> => {
  if (!canRecord.value) {
    return
  }

  // 启动前从持久化设置（JSON store，设置对话框的写入源）读配置并应用：
  // 编码器/码率 → MediaRecorder；fps → captureStream；麦克风/系统音频 → 音频输入
  try {
    const s = await window.api.recordingSettings?.getSettings()
    if (s) {
      const mimeTypeCandidates =
        s.encoder === 'vp8'
          ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8']
          : s.encoder === 'h264'
            ? ['video/webm;codecs=h264,opus', 'video/webm;codecs=h264']
            : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9']
      setRecorderOptions({
        mimeTypeCandidates,
        videoBitsPerSecond: (s.bitrate ?? 2500) * 1000,
        audioBitsPerSecond: (s.audioBitrate ?? 128) * 1000
      })
      setFps(s.fps)

      const sys = s.systemAudio
      const sysActive = !!sys?.enabled && !!sys?.deviceId
      setAudioConfig({
        // 音频总开关 + 「系统音频开启且未保留麦克风」时静音麦克风
        micEnabled: s.audioEnabled !== false && !(sysActive && !sys?.keepMicrophone),
        systemDeviceId: sysActive ? sys.deviceId : null
      })
    }
  } catch (e) {
    console.warn('[RecordPage] apply recording settings failed:', e)
  }

  // 检查是否有可用的流
  if (!stream.value && !cameraStream.value) {
    toast.warning('请先选择一个录制源并等待预览加载完成')
    return
  }

  try {
    // 如果同时选择了屏幕和摄像头，确保合成流已创建
    if (selectedSource.value && selectedCameraDevice.value) {
      // 如果摄像头流不存在，尝试只录制屏幕
      if (!cameraStream.value) {
        if (stream.value) {
          await startRecorder(stream.value)
          return
        }
      }

      // 如果屏幕流不存在，尝试只录制摄像头
      if (!stream.value) {
        if (cameraStream.value) {
          // 确保摄像头流有音频轨道（复用统一音频装配，含系统音频混音）
          if (cameraStream.value.getAudioTracks().length === 0) {
            await addAudioToStream(cameraStream.value)
          }
          await startRecorder(cameraStream.value)
          return
        }
      }

      // 两个流都存在，尝试合成
      if (!canvasStream.value && stream.value && cameraStream.value) {
        await combineStreams()

        // 等待一下，确保 canvas stream 已经准备好
        await new Promise((resolve) => setTimeout(resolve, 200))

        if (!canvasStream.value) {
          toast.error('无法创建合成流，请重试')
          return
        }

        // 检查 canvas stream 是否有活动的轨道
        const mixedStream = canvasStream.value as MediaStream
        const tracks = mixedStream.getTracks()
        if (tracks.length === 0) {
          toast.error('合成流无效，请重试')
          return
        }
      }
    }

    // 确定要录制的流
    let recordingStream: MediaStream | null = null

    if (selectedSource.value && selectedCameraDevice.value && canvasStream.value) {
      // 同时录制屏幕和摄像头，使用合成流
      recordingStream = canvasStream.value
    } else if (selectedSource.value && stream.value) {
      // 只录制屏幕
      recordingStream = stream.value
    } else if (selectedCameraDevice.value && cameraStream.value) {
      // 只录制摄像头，确保有音频轨道
      if (cameraStream.value.getAudioTracks().length === 0) {
        await addAudioToStream(cameraStream.value)
      }
      recordingStream = cameraStream.value
    }

    if (!recordingStream) {
      toast.warning('无法获取录制流，请确保已选择录制源并等待预览加载完成')
      return
    }

    // PR-4: 启用 cursor 追踪（主进程开始推送位置）
    const cursorApi = (
      window as unknown as {
        api?: {
          recording?: {
            cursor?: { start: () => Promise<{ ok: boolean }>; stop: () => Promise<{ ok: boolean }> }
          }
        }
      }
    ).api?.recording?.cursor
    if (cursorApi?.start) {
      void cursorApi.start()
    }

    // recordingId 由 startRecorder 内部通过 recording.start 登记产生（正式 UUID），
    // 并贯穿 saveFile / segments / markers，不再使用临时 ID
    const id = await startRecorder(recordingStream)
    localRecordingId.value = id
  } catch (error) {
    console.error('开始录制失败:', error)
    toast.error('开始录制失败: ' + (error as Error).message)
  }
}

// 获取预览面板的 ref
const previewPanelRef = ref<InstanceType<typeof PreviewPanel> | null>(null)

// 同步 ref 到 stream manager
watch(
  () => previewPanelRef.value,
  (panel): void => {
    if (panel) {
      // 将预览面板的 ref 同步到 stream manager
      setPreviewVideoRef(panel.previewVideoRef)
      setPipCameraRef(panel.pipCameraRef)
    }
  },
  { immediate: true }
)

// PR-4: 录制停止时关闭 cursor 推送
watch(
  () => props.isRecording,
  (rec, prev) => {
    if (prev && !rec) {
      const cursorApi = (
        window as unknown as {
          api?: { recording?: { cursor?: { stop: () => Promise<{ ok: boolean }> } } }
        }
      ).api?.recording?.cursor
      if (cursorApi?.stop) void cursorApi.stop()
    }
  }
)

// 处理跳转到标记时间点
const handleJumpToMarker = (timestamp: number): void => {
  // 在录制模式下，跳转功能不可用（因为是在实时录制）
  // 跳转功能应该在回放模式下使用（比如在 ClipEditor 或视频播放器中）
  if (props.isRecording) {
    // 可以显示一个提示，说明跳转功能在回放时可用
    console.log('跳转到标记时间点:', timestamp, '(当前为录制模式，跳转功能在回放时可用)')
  } else {
    // 如果不在录制模式，可能是回放模式
    console.log('跳转到标记时间点:', timestamp)
    // 这里可以添加实际的跳转逻辑，如果有视频播放器的话
  }
}

// 处理标记添加事件
const handleMarkerAdded = (marker: Marker): void => {
  console.log('标记已添加:', marker)
}

onMounted(() => {
  loadSources()
})
</script>
