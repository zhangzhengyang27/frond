import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { Marker } from '../../../preload/index.d'

/**
 * useMarkers（B57-7 重构）：标记状态按 recordingId 单例化。
 *
 * 旧实现每次调用创建独立 markers ref——PlaybackPanel 与 MarkersPanel 各持一份：
 * 面板增删改只刷新自己的列表，回放页时间轴 overlay 永不更新（直到重新选片）。
 * 现在「同 recordingId ⇒ 同一 store」，任何一侧刷新即全局可见；不同录制相互隔离。
 */

interface MarkerStore {
  markers: Ref<Marker[]>
  loading: Ref<boolean>
  /** 竞态守卫（B50）：换片后旧请求晚到不得覆盖新列表（按 store 隔离） */
  loadSeq: number
}

const storeCache = new Map<string, MarkerStore>()

function storeFor(recordingId: string): MarkerStore {
  let store = storeCache.get(recordingId)
  if (!store) {
    store = { markers: ref<Marker[]>([]), loading: ref(false), loadSeq: 0 }
    storeCache.set(recordingId, store)
  }
  return store
}

export function useMarkers(recordingId: Ref<string | null> | string | null = null) {
  // 获取当前的 recordingId
  const getRecordingId = (): string | null => {
    if (typeof recordingId === 'string' || recordingId === null) {
      return recordingId
    }
    return recordingId.value
  }

  // 共享列表的只读视图（随 recordingId 动态切 store）
  const markers: ComputedRef<Marker[]> = computed(
    () => storeFor(getRecordingId() ?? '__none__').markers.value
  )
  const loading: ComputedRef<boolean> = computed(
    () => storeFor(getRecordingId() ?? '__none__').loading.value
  )

  // 加载标记
  const loadMarkers = async (id?: string): Promise<void> => {
    const targetId = id || getRecordingId()
    if (!targetId) {
      return
    }
    const store = storeFor(targetId)
    const seq = ++store.loadSeq
    store.loading.value = true
    try {
      const rows = await window.api.marker.getMarkers(targetId)
      if (seq !== store.loadSeq) return // 期间又有新加载发起：丢弃本次回写
      store.markers.value = rows
    } catch (error) {
      if (seq !== store.loadSeq) return
      console.error('加载标记失败:', error)
      store.markers.value = []
    } finally {
      if (seq === store.loadSeq) store.loading.value = false
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
