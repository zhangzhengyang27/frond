import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'

// 检查窗口/API 是否可用
function isApiAvailable(): boolean {
  return typeof window !== 'undefined' && !!window.api && !!window.api.clip
}

/**
 * 剪辑片段接口
 */
export interface Clip {
  id: string
  startTime: number // 秒
  endTime: number // 秒
  label?: string
}

/**
 * 导出选项接口
 */
export interface ExportOptions {
  clips: Clip[]
  transition: 'fade' | 'cut' | 'slide'
  intro?: string // 片头路径
  outro?: string // 片尾路径
  backgroundMusic?: {
    path: string
    volume: number // 0-1
  }
  resolution: 720 | 1080 | 1440 | 2160
  fps: 30 | 60
  outputPath: string
}

/**
 * 导出进度接口
 */
export interface ExportProgress {
  percent: number
  currentClip: number
  totalClips: number
  message: string
}

/**
 * 视频信息接口
 */
export interface VideoInfo {
  duration: number
  width: number
  height: number
  fps: number
}

/**
 * 视频剪辑 Composable
 */
export function useVideoClip(videoId: string, videoPath: string) {
  const clips = ref<Clip[]>([])
  const loading = ref(false)
  const exporting = ref(false)
  const exportProgress = ref<ExportProgress | null>(null)
  const videoInfo = ref<VideoInfo | null>(null)

  // 加载剪辑列表
  const loadClips = async (): Promise<void> => {
    if (!isApiAvailable()) throw new Error('API 不可用')
    try {
      loading.value = true
      const loadedClips = await window.api.clip.getClips(videoId)
      clips.value = loadedClips || []
    } catch (error) {
      console.error('加载剪辑失败:', error)
      throw error
    } finally {
      loading.value = false
    }
  }

  // 加载视频信息
  const loadVideoInfo = async (): Promise<void> => {
    if (!isApiAvailable()) throw new Error('API 不可用')
    try {
      const info = await window.api.clip.getVideoInfo(videoPath)
      videoInfo.value = info
    } catch (error) {
      console.error('加载视频信息失败:', error)
      throw error
    }
  }

  // 添加剪辑片段
  const addClip = async (startTime: number, endTime: number, label?: string): Promise<Clip> => {
    if (!isApiAvailable()) throw new Error('API 不可用')
    try {
      const clip = await window.api.clip.addClip(videoId, startTime, endTime, label)
      await loadClips() // 重新加载列表
      return clip
    } catch (error) {
      console.error('添加剪辑失败:', error)
      throw error
    }
  }

  // 删除剪辑片段
  const removeClip = async (clipId: string): Promise<void> => {
    try {
      await window.api.clip.removeClip(videoId, clipId)
      await loadClips() // 重新加载列表
    } catch (error) {
      console.error('删除剪辑失败:', error)
      throw error
    }
  }

  // 更新剪辑片段
  const updateClip = async (clipId: string, updates: Partial<Clip>): Promise<void> => {
    try {
      await window.api.clip.updateClip(videoId, clipId, updates)
      await loadClips() // 重新加载列表
    } catch (error) {
      console.error('更新剪辑失败:', error)
      throw error
    }
  }

  // 清空所有剪辑片段
  const clearClips = async (): Promise<void> => {
    try {
      await window.api.clip.clearClips(videoId)
      clips.value = []
    } catch (error) {
      console.error('清空剪辑失败:', error)
      throw error
    }
  }

  // 预览剪辑片段
  const previewClip = async (clip: Clip): Promise<string> => {
    try {
      const previewPath = await window.api.clip.previewClip(videoPath, clip)
      return previewPath
    } catch (error) {
      console.error('预览剪辑失败:', error)
      throw error
    }
  }

  // 导出剪辑后的视频
  const exportClips = async (options: Omit<ExportOptions, 'clips'>): Promise<string> => {
    if (clips.value.length === 0) {
      throw new Error('没有要导出的剪辑片段')
    }

    try {
      exporting.value = true
      exportProgress.value = {
        percent: 0,
        currentClip: 0,
        totalClips: clips.value.length,
        message: '准备导出...'
      }

      const exportOptions: ExportOptions = {
        ...options,
        clips: clips.value
      }

      const result = await window.api.clip.exportClips(videoPath, exportOptions)

      if (result.success) {
        if (result.outputPath) {
          return result.outputPath
        }
        throw new Error('导出成功但未返回输出路径')
      } else {
        throw new Error(result.error || '导出失败')
      }
    } catch (error) {
      console.error('导出剪辑失败:', error)
      throw error
    } finally {
      exporting.value = false
      exportProgress.value = null
    }
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const h = Math.floor(seconds / 3600)
    const m = Math.floor((seconds % 3600) / 60)
    const s = Math.floor(seconds % 60)

    if (h > 0) {
      return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
    }
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
  }

  // 计算总时长
  const totalDuration = computed(() => {
    return clips.value.reduce((sum, clip) => sum + (clip.endTime - clip.startTime), 0)
  })

  // 监听导出进度（保存退订函数；removeAllListeners 会误杀同通道的其他订阅者）
  let unsubscribeExportProgress: (() => void) | null = null
  const setupExportProgressListener = (): void => {
    unsubscribeExportProgress?.()
    unsubscribeExportProgress = window.api.clip.onExportProgress((progress) => {
      exportProgress.value = progress
    })
  }

  // 移除导出进度监听器
  const removeExportProgressListener = (): void => {
    unsubscribeExportProgress?.()
    unsubscribeExportProgress = null
  }

  // 初始化：加载剪辑和视频信息
  const init = async (): Promise<void> => {
    await Promise.all([loadClips(), loadVideoInfo()])
    setupExportProgressListener()
  }

  // 清理资源
  onUnmounted(() => {
    removeExportProgressListener()
  })

  return {
    clips,
    loading,
    exporting,
    exportProgress,
    videoInfo,
    totalDuration,
    loadClips,
    loadVideoInfo,
    addClip,
    removeClip,
    updateClip,
    clearClips,
    previewClip,
    exportClips,
    formatTime,
    init
  }
}
