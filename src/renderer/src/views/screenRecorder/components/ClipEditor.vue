
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
</script>
