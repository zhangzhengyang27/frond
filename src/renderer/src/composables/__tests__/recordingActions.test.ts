// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, vi } from 'vitest'

/**
 * B57-6 回归钉：录制动作模块化。
 * 旧实现动作写死在 RecordPage 组件闭包 + 快捷键监听挂会被卸载的组件 →
 * 非「录制」标签页快捷键整体失效。动作收敛到模块单例后：
 *  - 快捷键响应与组件生命周期解耦（本文件验证动作语义本身）
 *  - B57-11：启动链 isStarting 置位，二次触发有提示；loading 点亮
 */

const mockRecorder = vi.hoisted(() => {
  return {
    isRecording: { value: false },
    canRecord: { value: true },
    loading: { value: false },
    startRecording: vi.fn(async () => 'rid-1'),
    stopRecording: vi.fn(),
    togglePause: vi.fn(),
    selectSavePath: vi.fn(async () => null),
    setRecorderOptions: vi.fn(),
    claimRecordingStart: vi.fn(() => true),
    releaseRecordingStart: vi.fn()
  }
})

const mockSource = vi.hoisted(() => {
  return {
    selectedSource: { value: null },
    selectedCameraDevice: { value: null },
    loading: { value: false },
    cameraError: { value: null },
    sourceError: { value: null },
    loadSources: vi.fn(async () => {}),
    requestScreenPermission: vi.fn(async () => {}),
    switchSourceType: vi.fn(),
    requestCameraPermission: vi.fn(async () => {}),
    retryCamera: vi.fn(),
    closeCamera: vi.fn()
  }
})

const mockStreams = vi.hoisted(() => {
  return {
    stream: { value: null as MediaStream | null },
    cameraStream: { value: null as MediaStream | null },
    canvasStream: { value: null as MediaStream | null },
    setRegion: vi.fn(),
    setCursorScreenPos: vi.fn(),
    setAudioConfig: vi.fn(),
    setFps: vi.fn(),
    addAudioToStream: vi.fn(async () => {}),
    getScreenStream: vi.fn(async () => null),
    getCameraStream: vi.fn(async () => null),
    combineStreams: vi.fn(async () => null),
    setPreview: vi.fn(async () => {}),
    closeCamera: vi.fn(),
    getCursorScreenPos: vi.fn(() => null)
  }
})

const toastMock = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
  info: vi.fn()
}))

vi.mock('../useScreenRecorder', () => ({ useScreenRecorder: () => mockRecorder }))
vi.mock('../useSourceSelection', () => ({ useSourceSelection: () => mockSource }))
vi.mock('../useStreamManager', () => ({
  useStreamManager: () => mockStreams,
  getCursorScreenPos: mockStreams.getCursorScreenPos
}))
vi.mock('../useToast', () => ({ useToast: () => toastMock }))

import { useRecordingActions } from '../recordingActions'

function installApi(settings: Record<string, unknown> = { countdownSeconds: 0 }): void {
  ;(window as unknown as { api: unknown }).api = {
    recordingSettings: { getSettings: vi.fn(async () => settings) },
    recording: {
      cursor: { start: vi.fn(async () => ({ ok: true })), stop: vi.fn(async () => ({ ok: true })) }
    }
  }
}

const fakeStream = { getVideoTracks: () => [], getAudioTracks: () => [] } as unknown as MediaStream

beforeEach(() => {
  vi.clearAllMocks()
  mockRecorder.isRecording.value = false
  mockSource.selectedSource.value = null
  mockSource.selectedCameraDevice.value = null
  mockStreams.stream.value = null
  mockStreams.cameraStream.value = null
  mockStreams.canvasStream.value = null
  installApi()
})

describe('recordingActions（B57-6 模块化动作）', () => {
  it('快捷键 start：未录制 → 走启动流程（无源则提示且不启动）', async () => {
    const actions = useRecordingActions()
    await Promise.resolve(actions.shortcutStart())
    await vi.waitFor(() => expect(toastMock.warning).toHaveBeenCalled())
    expect(mockRecorder.startRecording).not.toHaveBeenCalled()
    expect(toastMock.warning.mock.calls[0]![0]).toContain('请先选择一个录制源')
  })

  it('快捷键 start：已录制 → 停止', () => {
    mockRecorder.isRecording.value = true
    const actions = useRecordingActions()
    actions.shortcutStart()
    expect(mockRecorder.stopRecording).toHaveBeenCalled()
  })

  it('快捷键 pause：仅录制中生效', () => {
    const actions = useRecordingActions()
    actions.shortcutPause()
    expect(mockRecorder.togglePause).not.toHaveBeenCalled()
    mockRecorder.isRecording.value = true
    actions.shortcutPause()
    expect(mockRecorder.togglePause).toHaveBeenCalled()
  })

  it('正常启动：选了屏幕源 → startRecorder 收到屏幕流，loading 复位', async () => {
    mockSource.selectedSource.value = { id: 'screen:0' } as never
    mockStreams.stream.value = fakeStream
    const actions = useRecordingActions()
    await actions.handleStartRecording()
    expect(mockRecorder.startRecording).toHaveBeenCalledWith(fakeStream)
    expect(mockRecorder.loading.value).toBe(false)
    expect(actions.isStarting.value).toBe(false)
    expect(mockRecorder.releaseRecordingStart).toHaveBeenCalled()
    // 区域：纯屏幕源 + mediarecorder 引擎 → region null（旧引擎不做管线裁剪）
    expect(mockRecorder.setRecorderOptions).toHaveBeenCalledWith(
      expect.objectContaining({ engine: 'mediarecorder', region: null })
    )
    expect(mockStreams.setFps).toHaveBeenCalled()
    expect(mockStreams.setAudioConfig).toHaveBeenCalled()
  })

  it('B57-11：启动链进行中二次触发 → info 提示且不并发启动', async () => {
    mockSource.selectedSource.value = { id: 'screen:0' } as never
    mockStreams.stream.value = fakeStream
    let resolveStart!: (v: string) => void
    mockRecorder.startRecording.mockImplementationOnce(
      () =>
        new Promise<string>((r) => {
          resolveStart = r
        })
    )
    const actions = useRecordingActions()
    const first = actions.handleStartRecording()
    await vi.waitFor(() => expect(actions.isStarting.value).toBe(true))
    await actions.handleStartRecording() // 二次触发
    expect(toastMock.info).toHaveBeenCalled()
    expect(toastMock.info.mock.calls[0]![0]).toContain('正在启动')
    resolveStart('rid-1')
    await first
    expect(mockRecorder.startRecording).toHaveBeenCalledTimes(1)
    expect(actions.isStarting.value).toBe(false)
  })

  it('beginAfterCountdown：倒计时结束直接启动', async () => {
    mockSource.selectedSource.value = { id: 'screen:0' } as never
    mockStreams.stream.value = fakeStream
    const actions = useRecordingActions()
    await actions.beginAfterCountdown()
    expect(mockRecorder.startRecording).toHaveBeenCalled()
  })

  it('selectRegion：确认 → 存区域并推送 stream manager；取消 → 不动', async () => {
    ;(window as unknown as { api: unknown }).api = {
      recording: {
        region: {
          open: vi.fn(async () => ({ region: { x: 1, y: 2, width: 3, height: 4 } })),
          listDisplays: vi.fn(async () => [
            {
              id: 0,
              scaleFactor: 2,
              isPrimary: true,
              bounds: { x: 0, y: 0, width: 1920, height: 1080 }
            }
          ])
        }
      }
    }
    const actions = useRecordingActions()
    await actions.selectRegion(undefined)
    expect(actions.selectedRegion.value).toEqual({ x: 1, y: 2, width: 3, height: 4 })
    expect(mockStreams.setRegion).toHaveBeenCalled()

    ;(
      (window as unknown as { api: { recording: { region: { open: unknown } } } }).api.recording
        .region.open as ReturnType<typeof vi.fn>
    ).mockResolvedValueOnce({ canceled: true })
    await actions.selectRegion(undefined)
    expect(actions.selectedRegion.value).toEqual({ x: 1, y: 2, width: 3, height: 4 }) // 未被清掉
  })
})
