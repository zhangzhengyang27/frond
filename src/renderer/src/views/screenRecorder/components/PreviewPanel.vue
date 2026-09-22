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
  // 视频加载完成
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
