import { ref, computed, onUnmounted, type Ref, type ComputedRef } from 'vue'

export interface DesktopCapturerSource {
  id: string
  name: string
  thumbnail: string
}

export interface CameraDevice {
  deviceId: string
  label: string
  kind: MediaDeviceKind
}

// ── 模块级单例状态 ──────────────────────────────────────────
// 之前 Layout / RecordPage 各建一份实例，导致 getSources（带缩略图的
// 原生调用）在挂载时执行两次、源列表不同步。
const sources = ref<DesktopCapturerSource[]>([])
const selectedSource = ref<DesktopCapturerSource | null>(null)
const cameraDevices = ref<CameraDevice[]>([])
const selectedCameraDevice = ref<CameraDevice | null>(null)
const sourceType = ref<'screen' | 'camera'>('screen')
const loading = ref(false)
const cameraError = ref<string | null>(null)
const sourceError = ref<string | null>(null)
const thumbnailErrors = ref<Set<string>>(new Set())

// 设备变化监听器（devicechange：拔插摄像头/屏幕自动刷新列表）
let deviceChangeHandler: ((event: Event) => void) | null = null

// 权限失败后的延迟重试句柄：卸载时清理，避免回调写已卸载组件的 ref
const permissionRetryTimers = new Set<ReturnType<typeof setTimeout>>()

function schedulePermissionRetry(fn: () => void, delayMs: number): void {
  const timer = setTimeout(() => {
    permissionRetryTimers.delete(timer)
    fn()
  }, delayMs)
  permissionRetryTimers.add(timer)
}

function ensureDeviceChangeListener(): void {
  if (deviceChangeHandler || typeof navigator === 'undefined' || !navigator.mediaDevices) return
  deviceChangeHandler = (): void => {
    // loading 期间跳过，避免与手动刷新互相踩踏
    if (loading.value) return
    void loadCameraDevices()
    if (sourceType.value === 'screen') void loadSources()
  }
  navigator.mediaDevices.addEventListener('devicechange', deviceChangeHandler)
}

const hasSelectedSource = computed(() => {
  return !!selectedSource.value || !!selectedCameraDevice.value
})

// 加载屏幕源
const loadSources = async (): Promise<void> => {
  loading.value = true
  thumbnailErrors.value.clear()
  sourceError.value = null // 清除之前的错误
  try {
    const sourcesList = await window.api.screenRecorder.getSources({
      types: ['screen', 'window'],
      thumbnailSize: { width: 200, height: 150 }
    })
    sources.value = sourcesList
    // 验证每个缩略图是否有效
    sources.value.forEach((source) => {
      if (!source.thumbnail || source.thumbnail.trim() === '') {
        thumbnailErrors.value.add(source.id)
      }
    })
  } catch (error) {
    console.error('加载屏幕源失败:', error)
    const err = error as { message?: string; needsPermission?: unknown }
    const errorMessage = err.message || String(error)
    const needsPermission = err.needsPermission === true

    // 设置友好的错误信息
    if (errorMessage.includes('屏幕录制权限') || errorMessage.includes('权限')) {
      sourceError.value = errorMessage // 使用后端返回的友好错误信息
    } else if (errorMessage.includes('permission') || errorMessage.includes('denied')) {
      sourceError.value = '需要屏幕录制权限。请在系统设置中授予权限。'
    } else {
      sourceError.value = `加载屏幕源失败: ${errorMessage}`
    }

    // 如果是权限问题，自动请求权限
    if (needsPermission || errorMessage.includes('Failed to get sources')) {
      // 延迟一下再请求权限，让用户看到错误信息
      schedulePermissionRetry(() => {
        void requestScreenPermission()
      }, 500)
    }

    // 清空源列表
    sources.value = []
  } finally {
    loading.value = false
  }
}

// 请求屏幕录制权限
const requestScreenPermission = async (): Promise<void> => {
  try {
    const result = await window.api.screenRecorder.requestPermission()
    if (result.success) {
      // 显示通知，提醒用户重启应用
      await window.api.notification.warning(
        '权限设置',
        '已打开系统设置。请授予屏幕录制权限后，重启应用以使权限生效。'
      )
      // 延迟后重新检查权限
      schedulePermissionRetry(() => {
        void checkPermission()
      }, 3000) // 给用户时间授予权限
    } else {
      sourceError.value = result.message || '无法打开权限设置'
    }
  } catch (error) {
    console.error('请求权限失败:', error)
    sourceError.value = `请求权限失败: ${(error as Error).message}`
  }
}

// 检查屏幕录制权限
const checkPermission = async (): Promise<boolean> => {
  try {
    const result = await window.api.screenRecorder.checkPermission()
    if (result.hasPermission) {
      sourceError.value = null
      // 如果有权限但之前有错误，重新加载源
      if (sources.value.length === 0) {
        await loadSources()
      }
      return true
    } else {
      sourceError.value = result.message || '需要授予屏幕录制权限'
      return false
    }
  } catch (error) {
    console.error('检查权限失败:', error)
    return false
  }
}

// 切换源类型
const switchSourceType = (type: 'screen' | 'camera'): void => {
  sourceType.value = type
  // 只自动加载屏幕源，摄像头需要用户主动点击刷新按钮
  if (type === 'screen' && sources.value.length === 0) {
    loadSources()
  }
  // 切换到摄像头标签页时，尝试枚举设备（不请求权限）
  if (type === 'camera' && cameraDevices.value.length === 0) {
    loadCameraDevices()
  }
}

// 加载摄像头设备（不自动请求权限）
const loadCameraDevices = async (): Promise<void> => {
  loading.value = true
  cameraError.value = null

  try {
    // 先尝试枚举设备（不会请求权限）
    let devices: MediaDeviceInfo[] = []
    try {
      devices = await navigator.mediaDevices.enumerateDevices()
    } catch (error) {
      console.error('枚举设备失败:', error)
      // 如果枚举失败，不自动请求权限，而是提示用户
      cameraError.value = '无法枚举摄像头设备，请点击刷新按钮授权摄像头权限'
      loading.value = false
      return
    }

    // 过滤出摄像头设备
    const cameras = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `摄像头 ${device.deviceId.slice(0, 8)}`,
        kind: device.kind as MediaDeviceKind
      }))

    cameraDevices.value = cameras

    // 如果设备没有标签（说明没有权限），提示用户
    if (
      cameras.length > 0 &&
      cameras.every((cam) => !cam.label || cam.label === `摄像头 ${cam.deviceId.slice(0, 8)}`)
    ) {
      cameraError.value = '摄像头权限未授予，请点击刷新按钮授权摄像头权限'
    }
  } catch (error) {
    console.error('加载摄像头设备失败:', error)
    const errorMessage = (error as Error).message || String(error)

    if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
      cameraError.value = '摄像头权限被拒绝，请点击刷新按钮重新授权'
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
      cameraError.value = '摄像头无法启动，可能被其他应用占用。请关闭其他使用摄像头的应用后重试'
    } else {
      cameraError.value = `无法访问摄像头: ${errorMessage}`
    }
  } finally {
    loading.value = false
  }
}

// 请求摄像头权限并加载设备
const requestCameraPermission = async (): Promise<void> => {
  loading.value = true
  cameraError.value = null

  try {
    // 请求权限（使用更灵活的约束）
    const permissionStream = await navigator.mediaDevices.getUserMedia({
      video: {
        width: { ideal: 1280, min: 640 },
        height: { ideal: 720, min: 480 },
        frameRate: { ideal: 30 }
      },
      audio: false
    })
    permissionStream.getTracks().forEach((track) => track.stop())

    // 重新枚举设备
    const devices = await navigator.mediaDevices.enumerateDevices()

    // 过滤出摄像头设备
    const cameras = devices
      .filter((device) => device.kind === 'videoinput')
      .map((device) => ({
        deviceId: device.deviceId,
        label: device.label || `摄像头 ${device.deviceId.slice(0, 8)}`,
        kind: device.kind as MediaDeviceKind
      }))

    cameraDevices.value = cameras

    // 如果没有找到摄像头设备
    if (cameras.length === 0) {
      cameraError.value = '未找到可用的摄像头设备，请检查摄像头是否已连接'
    }
  } catch (error) {
    console.error('请求摄像头权限失败:', error)
    const errorMessage = (error as Error).message || String(error)

    if (errorMessage.includes('Permission denied') || errorMessage.includes('NotAllowedError')) {
      cameraError.value = '摄像头权限被拒绝，请在系统设置中授予摄像头权限'
    } else if (
      errorMessage.includes('NotFoundError') ||
      errorMessage.includes('Requested device not found') ||
      errorMessage.includes('DevicesNotFoundError')
    ) {
      cameraError.value = '未找到摄像头设备，请检查摄像头是否已连接并重新刷新'
    } else if (
      errorMessage.includes('NotReadableError') ||
      errorMessage.includes('TrackStartError') ||
      errorMessage.includes('Could not start video source')
    ) {
      cameraError.value = '摄像头无法启动，可能被其他应用占用。请关闭其他使用摄像头的应用后重试'
    } else {
      cameraError.value = `无法访问摄像头: ${errorMessage}`
    }
  } finally {
    loading.value = false
  }
}

// 重试摄像头（请求权限）
const retryCamera = async (): Promise<void> => {
  cameraError.value = null
  await requestCameraPermission()
}

// 关闭摄像头选择
const closeCamera = (): void => {
  selectedCameraDevice.value = null
  cameraError.value = null
}

// 获取源类型标签
const getSourceTypeLabel = (sourceId: string): string => {
  if (sourceId.includes('screen')) {
    return '屏幕'
  } else if (sourceId.includes('window')) {
    return '窗口'
  }
  return '未知'
}

// 获取缩略图 URL
const getThumbnailUrl = (thumbnail: string | undefined): string => {
  if (!thumbnail) {
    return ''
  }
  if (thumbnail.startsWith('data:')) {
    return thumbnail
  }
  return `data:image/png;base64,${thumbnail}`
}

// 处理缩略图加载错误
const handleThumbnailError = (event: Event, sourceId?: string): void => {
  const img = event.target as HTMLImageElement
  if (sourceId) {
    thumbnailErrors.value.add(sourceId)
  }
  img.style.display = 'none'
}

// 处理缩略图加载成功
const handleThumbnailLoad = (event: Event, sourceId?: string): void => {
  const img = event.target as HTMLImageElement
  if (sourceId) {
    thumbnailErrors.value.delete(sourceId)
  }
  img.style.display = 'block'
}

// devicechange 监听是模块级单例，按消费者引用计数移除：
// RecordPage 切标签卸载时 Layout 仍需要设备热插拔刷新
let mountedConsumers = 0

/** useSourceSelection 返回结构 */
export interface SourceSelectionComposable {
  sources: Ref<DesktopCapturerSource[]>
  selectedSource: Ref<DesktopCapturerSource | null>
  cameraDevices: Ref<CameraDevice[]>
  selectedCameraDevice: Ref<CameraDevice | null>
  sourceType: Ref<'screen' | 'camera'>
  loading: Ref<boolean>
  cameraError: Ref<string | null>
  sourceError: Ref<string | null>
  thumbnailErrors: Ref<Set<string>>
  hasSelectedSource: ComputedRef<boolean>
  loadSources: () => Promise<void>
  requestScreenPermission: () => Promise<void>
  checkPermission: () => Promise<boolean>
  switchSourceType: (type: 'screen' | 'camera') => void
  loadCameraDevices: () => Promise<void>
  requestCameraPermission: () => Promise<void>
  retryCamera: () => Promise<void>
  closeCamera: () => void
  getSourceTypeLabel: (sourceId: string) => string
  getThumbnailUrl: (thumbnail: string | undefined) => string
  handleThumbnailError: (event: Event, sourceId?: string) => void
  handleThumbnailLoad: (event: Event, sourceId?: string) => void
}

export function useSourceSelection(): SourceSelectionComposable {
  ensureDeviceChangeListener()

  mountedConsumers += 1
  onUnmounted(() => {
    mountedConsumers = Math.max(0, mountedConsumers - 1)
    if (mountedConsumers === 0 && deviceChangeHandler) {
      navigator.mediaDevices.removeEventListener('devicechange', deviceChangeHandler)
      deviceChangeHandler = null
    }
    // 权限重试的延迟回调：最后一个消费者卸载后不再触发
    if (mountedConsumers === 0) {
      for (const timer of permissionRetryTimers) clearTimeout(timer)
      permissionRetryTimers.clear()
    }
  })

  return {
    sources,
    selectedSource,
    cameraDevices,
    selectedCameraDevice,
    sourceType,
    loading,
    cameraError,
    sourceError, // 导出屏幕源错误状态
    thumbnailErrors,
    hasSelectedSource,
    loadSources,
    requestScreenPermission, // 导出请求权限方法
    checkPermission, // 导出检查权限方法
    switchSourceType,
    loadCameraDevices,
    requestCameraPermission,
    retryCamera,
    closeCamera,
    getSourceTypeLabel,
    getThumbnailUrl,
    handleThumbnailError,
    handleThumbnailLoad
  }
}

