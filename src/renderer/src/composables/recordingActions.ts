import { ref } from 'vue'
import { useScreenRecorder } from './useScreenRecorder'
import { useSourceSelection } from './useSourceSelection'
import { useStreamManager, getCursorScreenPos } from './useStreamManager'
import { useToast } from './useToast'

/**
 * 录制动作的模块级控制器（B57-6）。
 *
 * 旧实现把启动流程/快捷键响应写死在 RecordPage 组件闭包里，而快捷键监听
 * 挂在会被卸载的组件上——切到历史/回放/剪辑标签后 ⌘⇧⌥R/⌘⇧⌥P 整体静默失效，
 * 倒计时中切标签则录制永远不会开始。现在动作全部收敛到模块单例（依赖的
 * composables 本就是模块单例状态），监听器由 useRecordingShortcuts 挂在
 * Layout 层（录屏模块常驻），任意标签页快捷键都有效。
 *
 * B57-11：启动链期间 isStarting 置位——二次触发给出提示而非静默丢弃，
 * loading 同步点亮（PreviewPanel「准备中」、canRecord 失效）。
 */

export interface Region {
  x: number
  y: number
  width: number
  height: number
}

// 用户框选的录制区域（屏幕 DIP 坐标系）+ 所在显示器 scaleFactor（原 RecordPage 本地态）
const selectedRegion = ref<Region | null>(null)
const selectedRegionScale = ref(1)
// 启动链进行中（设置读取 + combineStreams ready-wait 最长 10s）
const isStarting = ref(false)
// 最近一次录制的 recordingId（MarkersPanel 绑定用；原 RecordPage 本地态）
const lastRecordingId = ref<string | null>(null)

export function useRecordingActions() {
  const toast = useToast()
  const {
    loading,
    canRecord,
    isRecording,
    startRecording: startRecorder,
    stopRecording,
    togglePause,
    selectSavePath,
    setRecorderOptions,
    claimRecordingStart,
    releaseRecordingStart,
    formatTime
  } = useScreenRecorder()

  const {
    sources: _sources,
    selectedSource,
    cameraDevices: _cameraDevices,
    selectedCameraDevice,
    sourceType: _sourceType,
    loading: sourceLoading,
    cameraError,
    sourceError,
    thumbnailErrors: _thumbnailErrors,
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
    setRegion,
    setCursorScreenPos,
    setAudioConfig,
    setFps,
    addAudioToStream,
    combineStreams,
    closeCamera: closeCameraStream
  } = useStreamManager()

  // ── PR-4 / PR-6: 区域框选（原 RecordPage.handleSelectRegion） ──
  const selectRegion = async (payload?: number | 'cross' | 'cancel' | null): Promise<void> => {
    if (isRecording.value || isStarting.value) return
    if (payload === 'cancel') {
      // SourceSelector 取消跨屏：清除区域选择回到全屏源（B57-19）
      selectedRegion.value = null
      selectedRegionScale.value = 1
      setRegion(null, 1)
      return
    }
    const api = (
      window as unknown as {
        api?: {
          recording?: {
            region?: {
              open: () => Promise<{ region: Region } | { canceled: true }>
              openForDisplay: (req: {
                displayId: number
              }) => Promise<
                | { region: Region; displayId: number; crossDisplay: boolean; scaleFactor?: number }
                | { canceled: true }
              >
              openCrossDisplay: () => Promise<
                | { region: Region; displayId: number; crossDisplay: boolean; scaleFactor?: number }
                | { canceled: true }
              >
              cancel: () => Promise<{ ok: boolean }>
              listDisplays: () => Promise<
                Array<{
                  id: number
                  scaleFactor: number
                  isPrimary: boolean
                  bounds: Region
                }>
              >
            }
          }
        }
      }
    ).api
    if (!api?.recording?.region) return
    try {
      let region: Region
      let scale: number | undefined
      if (payload === 'cross' && api.recording.region.openCrossDisplay) {
        const r = await api.recording.region.openCrossDisplay()
        if ('canceled' in r) return // 用户 ESC/关闭：非错误（B57-14 契约收敛）
        region = r.region
        scale = r.scaleFactor
      } else if (typeof payload === 'number' && api.recording.region.openForDisplay) {
        const r = await api.recording.region.openForDisplay({ displayId: payload })
        if ('canceled' in r) return
        region = r.region
        scale = r.scaleFactor
      } else if (api.recording.region.open) {
        const r = await api.recording.region.open()
        if ('canceled' in r) return
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
            (typeof payload === 'number'
              ? displays.find((d) => d.id === payload)?.scaleFactor
              : 1) ??
            1
        } catch {
          scale = 1
        }
      }
      selectedRegion.value = region
      selectedRegionScale.value = scale
      setRegion(region, scale)
    } catch (e) {
      console.log('[recordingActions] region selection canceled:', e)
    }
  }

  // ── PR-7a: 快捷键响应 ──────────────────────────────────────
  const shortcutStart = (): void => {
    if (isRecording.value) {
      // 正在录制 → 停止
      stopRecording()
    } else {
      // 没在录制 → 触发开始流程（含倒计时）
      void startWithCountdownOrImmediate()
    }
  }

  const shortcutPause = (): void => {
    if (!isRecording.value) return
    togglePause()
  }

  // ── PR-7b: 倒计时 → start ─────────────────────────────────
  const startWithCountdownOrImmediate = async (): Promise<void> => {
    // 倒计时秒数存在录制设置（设置对话框写入的 JSON store）里
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
      console.warn('[recordingActions] countdown.start failed:', e)
      await handleStartRecording()
    }
  }

  const beginAfterCountdown = async (): Promise<void> => {
    await handleStartRecording()
  }

  // 处理开始录制（防重入闸 + B57-11 启动反馈）
  const handleStartRecording = async (): Promise<void> => {
    if (isStarting.value) {
      // 启动链（最长 10s）进行中：给出提示而非静默丢弃（B57-11）
      toast.info('正在启动录制，请稍候…')
      return
    }
    if (!canRecord.value || !claimRecordingStart()) {
      return
    }
    isStarting.value = true
    loading.value = true // 点亮 PreviewPanel「准备中」、canRecord 失效
    try {
      await startRecordingFlow()
    } finally {
      isStarting.value = false
      loading.value = false
      releaseRecordingStart()
    }
  }

  const startRecordingFlow = async (): Promise<void> => {
    // 启动前从持久化设置（JSON store，设置对话框的写入源）读配置并应用：
    // 编码器/码率 → 编码器；fps → 合成帧率；麦克风/系统音频 → 音频输入
    try {
      const s = await window.api.recordingSettings?.getSettings()
      if (s) {
        const useWebCodecs = s.engine === 'webcodecs'
        const mimeTypeCandidates = useWebCodecs
          ? [] // webcodecs 引擎不用 MediaRecorder mimeType
          : s.encoder === 'vp8'
            ? ['video/webm;codecs=vp8,opus', 'video/webm;codecs=vp8']
            : s.encoder === 'h264'
              ? ['video/webm;codecs=h264,opus', 'video/webm;codecs=h264']
              : ['video/webm;codecs=vp9,opus', 'video/webm;codecs=vp9']
        setRecorderOptions({
          engine: useWebCodecs ? 'webcodecs' : 'mediarecorder',
          // webcodecs 引擎编码器映射：mp4 容器下 vp8 无保证 → avc（设置项语义最接近 h264）
          codec: useWebCodecs ? (s.encoder === 'vp9' ? 'vp9' : 'avc') : 'avc',
          fps: s.fps,
          mimeTypeCandidates,
          videoBitsPerSecond: (s.bitrate ?? 2500) * 1000,
          audioBitsPerSecond: (s.audioBitrate ?? 128) * 1000,
          // 纯屏幕源（无摄像头）时区域裁剪由管线完成；合成流的区域/画中画/光圈
          // 已在合成层绘制，管线只做整帧贴绘（region 置 null）
          region:
            useWebCodecs && selectedSource.value && !selectedCameraDevice.value
              ? selectedRegion.value
              : null,
          regionScale: selectedRegionScale.value,
          getCursor: getCursorScreenPos
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
      console.warn('[recordingActions] apply recording settings failed:', e)
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
              cursor?: {
                start: () => Promise<{ ok: boolean }>
                stop: () => Promise<{ ok: boolean }>
              }
            }
          }
        }
      ).api?.recording?.cursor
      if (cursorApi?.start) {
        void cursorApi.start()
      }

      // recordingId 由 startRecorder 内部通过 recording.start 登记产生（正式 UUID），
      // 并贯穿 saveFile / segments / markers，不再使用临时 ID
      lastRecordingId.value = (await startRecorder(recordingStream)) ?? lastRecordingId.value
    } catch (error) {
      console.error('开始录制失败:', error)
      toast.error('开始录制失败: ' + (error as Error).message)
    }
  }

  // ── 录制停止后关闭 cursor 推送（原 RecordPage 的 isRecording watch） ──
  const stopCursorTracking = (): void => {
    const cursorApi = (
      window as unknown as {
        api?: { recording?: { cursor?: { stop: () => Promise<{ ok: boolean }> } } }
      }
    ).api?.recording?.cursor
    if (cursorApi?.stop) void cursorApi.stop()
  }

  return {
    // 状态
    isStarting,
    lastRecordingId,
    selectedRegion,
    selectedRegionScale,
    isRecording,
    loading,
    sourceLoading,
    cameraError,
    sourceError,
    selectedSource,
    selectedCameraDevice,
    stream,
    cameraStream,
    // 动作
    selectRegion,
    startWithCountdownOrImmediate,
    beginAfterCountdown,
    handleStartRecording,
    shortcutStart,
    shortcutPause,
    stopCursorTracking,
    // 转发（RecordPage 模板仍需要）
    canRecord,
    formatTime,
    stopRecording,
    togglePause,
    selectSavePath,
    loadSources,
    requestScreenPermission,
    switchSourceType,
    requestCameraPermission,
    retryCamera,
    closeCameraSelection,
    closeCameraStream,
    setCursorScreenPos
  }
}

export type RecordingActions = ReturnType<typeof useRecordingActions>
