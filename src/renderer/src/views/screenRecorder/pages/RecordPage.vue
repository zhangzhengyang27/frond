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
        @select-region="actions.selectRegion"
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
        @start-recording="actions.startWithCountdownOrImmediate"
        @stop-recording="stopRecording"
        @toggle-pause="$emit('toggle-pause')"
        @select-save-path="selectSavePath"
        @open-settings="$emit('update:show-settings-dialog', true)"
      />

      <!-- 标记面板 -->
      <MarkersPanel
        :recording-id="actions.lastRecordingId.value"
        :is-recording="isRecording"
        :recording-time="recordingTime"
        @jump-to-marker="handleJumpToMarker"
        @marker-added="handleMarkerAdded"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { useStreamManager } from '@composables/useStreamManager'
import { useRecordingActions } from '@composables/recordingActions'
import SourceSelector from '@views/screenRecorder/components/SourceSelector.vue'
import PreviewPanel from '@views/screenRecorder/components/PreviewPanel.vue'
import MarkersPanel from '@views/screenRecorder/components/MarkersPanel.vue'
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

defineEmits<{
  'update:show-settings-dialog': [value: boolean]
  'toggle-pause': []
}>()

// 动作与流程已收敛到模块级控制器（B57-6）：快捷键在任意标签页有效，
// RecordPage 只保留源选择的 UI 编排
const actions = useRecordingActions()
const {
  isStarting,
  canRecord,
  loading: recorderLoading,
  selectSavePath,
  formatTime,
  stopRecording
} = actions
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
  getScreenStream,
  getCameraStream,
  combineStreams,
  setPreview,
  setPreviewVideoRef,
  setPipCameraRef,
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
  if (props.isRecording || isStarting.value) {
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
  if (props.isRecording || isStarting.value) {
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
  if (props.isRecording || isStarting.value) {
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

// 处理关闭摄像头
const handleCloseCamera = (): void => {
  if (props.isRecording || isStarting.value) {
    return
  }
  // 关闭摄像头流
  closeCameraStream()
  // 清除摄像头选择
  closeCameraSelection()
  // 如果之前有屏幕流，恢复屏幕预览
  if (stream.value && previewPanelRef.value?.previewVideoRef) {
    previewPanelRef.value.previewVideoRef.srcObject = stream.value
    void (previewPanelRef.value.previewVideoRef as HTMLVideoElement).play()
  } else if (previewPanelRef.value?.previewVideoRef) {
    // 如果没有屏幕流，清空预览
    previewPanelRef.value.previewVideoRef.srcObject = null
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
  void loadSources()
})
</script>
