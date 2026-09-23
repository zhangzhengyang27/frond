import { ref, computed, type Ref } from 'vue'
import type { Marker } from '../../../preload/index.d'

export function useMarkers(recordingId: Ref<string | null> | string | null = null) {
  const markers = ref<Marker[]>([])
  const loading = ref(false)

  // 获取当前的 recordingId
  const getRecordingId = (): string | null => {
    if (typeof recordingId === 'string' || recordingId === null) {
      return recordingId
    }
    return recordingId.value
  }

  // 加载标记
  const loadMarkers = async (id?: string): Promise<void> => {
    const targetId = id || getRecordingId()
    if (!targetId) {
      markers.value = []
      return
    }

    loading.value = true
    try {
      markers.value = await window.api.marker.getMarkers(targetId)
    } catch (error) {
      console.error('加载标记失败:', error)
      markers.value = []
    } finally {
      loading.value = false
    }
  }

  // 添加标记
  const addMarker = async (timestamp: number, label: string = '标记'): Promise<Marker | null> => {
    const targetId = getRecordingId()
    if (!targetId) {
      console.warn('无法添加标记：未指定录制 ID')
      return null
    }

    try {
      const marker = await window.api.marker.addMarker(targetId, timestamp, label)
      await loadMarkers(targetId)
      return marker
    } catch (error) {
      console.error('添加标记失败:', error)
      return null
    }
  }

  // 删除标记
  const removeMarker = async (markerId: string): Promise<boolean> => {
    const targetId = getRecordingId()
    if (!targetId) {
      return false
    }

    try {
      const success = await window.api.marker.removeMarker(targetId, markerId)
      if (success) {
        await loadMarkers(targetId)
      }
      return success
    } catch (error) {
      console.error('删除标记失败:', error)
      return false
    }
  }

  // 更新标记
  const updateMarker = async (
    markerId: string,
    updates: Partial<Marker>
  ): Promise<Marker | null> => {
    const targetId = getRecordingId()
    if (!targetId) {
      return null
    }

    try {
      const marker = await window.api.marker.updateMarker(targetId, markerId, updates)
      if (marker) {
        await loadMarkers(targetId)
      }
      return marker
    } catch (error) {
      console.error('更新标记失败:', error)
      return null
    }
  }

  // 清空标记
  const clearMarkers = async (): Promise<void> => {
    const targetId = getRecordingId()
    if (!targetId) {
      return
    }

    try {
      await window.api.marker.clearMarkers(targetId)
      await loadMarkers(targetId)
    } catch (error) {
      console.error('清空标记失败:', error)
    }
  }

  // 导出为 CSV
  const exportToCSV = async (): Promise<string | null> => {
    const targetId = getRecordingId()
    if (!targetId) {
      return null
    }

    try {
      return await window.api.marker.exportToCSV(targetId)
    } catch (error) {
      console.error('导出标记失败:', error)
      return null
    }
  }

  // 格式化时间
  const formatTime = (seconds: number): string => {
    const hours = Math.floor(seconds / 3600)
    const minutes = Math.floor((seconds % 3600) / 60)
    const secs = Math.floor(seconds % 60)

    if (hours > 0) {
      return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
    }
    return `${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`
  }

  // 按时间戳排序的标记
  const sortedMarkers = computed(() => {
    return [...markers.value].sort((a, b) => a.timestamp - b.timestamp)
  })

  return {
    markers: sortedMarkers,
    loading,
    loadMarkers,
    addMarker,
    removeMarker,
    updateMarker,
    clearMarkers,
    exportToCSV,
    formatTime
  }
}
