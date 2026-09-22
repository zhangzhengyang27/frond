import { ref, onUnmounted, type Ref } from 'vue'
import type { DesktopCapturerSource, CameraDevice } from './useSourceSelection'

// ── 模块级单例状态 ──────────────────────────────────────────
// Layout / RecordPage 共享同一份流状态（之前双实例导致预览与录制
// 各自持有不同 stream，切换页面后流状态不一致）。
const stream = ref<MediaStream | null>(null)
const cameraStream = ref<MediaStream | null>(null)
const canvasStream = ref<MediaStream | null>(null)
const previewVideoRef = ref<HTMLVideoElement | null>(null)
const pipCameraRef = ref<HTMLVideoElement | null>(null)

let canvasRef: HTMLCanvasElement | null = null
let animationFrameId: number | null = null
let hiddenScreenVideo: HTMLVideoElement | null = null
let hiddenCameraVideo: HTMLVideoElement | null = null
// 录制区域（屏幕 DIP 坐标系）。若非 null，合成 canvas 会裁剪到该区域
let captureRegion: { x: number; y: number; width: number; height: number } | null = null
// 区域所在显示器的 scaleFactor：desktopCapturer 视频帧是物理像素，
// 而 Electron screen/overlay 坐标是 DIP，绘制前必须统一乘上 scale
let captureScale = 1
// cursor 位置（屏幕 DIP 坐标系）。draw 循环里绘光圈
let cursorScreenPos: { x: number; y: number } | null = null
// 合成流的帧率（来自录制设置，默认 30）
let captureFps = 30

// ── 音频输入配置 ────────────────────────────────────────────
// micEnabled：录麦克风；systemDeviceId：系统音频 loopback 设备（BlackHole 等）。
// 两者都开时用 WebAudio 混成单轨（MediaRecorder 多音轨 webm 播放器兼容性差）。
// 旧实现 microphoneEnabled=false 时直接跳过 getUserMedia，导致
// 「系统音频 + 关麦克风」组合下连 loopback 设备都不打开、录出来完全无声。
interface AudioConfig {
  micEnabled: boolean
  systemDeviceId: string | null
}
let audioConfig: AudioConfig = { micEnabled: true, systemDeviceId: null }
// 已打开的音频流缓存（重复 combineStreams / 换源时避免反复开关麦克风）
let cachedAudioStream: MediaStream | null = null

/** 配置音频输入（RecordPage 在开始录制前从持久化设置调用） */
const setAudioConfig = (config: Partial<AudioConfig>): void => {
  const next = {
    micEnabled: config.micEnabled ?? audioConfig.micEnabled,
    systemDeviceId:
      config.systemDeviceId !== undefined ? config.systemDeviceId : audioConfig.systemDeviceId
  }
  // 配置变化时让缓存失效
  if (
    next.micEnabled !== audioConfig.micEnabled ||
    next.systemDeviceId !== audioConfig.systemDeviceId
  ) {
    releaseCachedAudio()
  }
  audioConfig = next
}

/** @deprecated 兼容旧调用：仅设置系统音频设备 ID */
const setPreferredAudioDevice = (deviceId: string | null): void => {
  setAudioConfig({ systemDeviceId: deviceId })
}

/** @deprecated 兼容旧调用：仅开关麦克风 */
const setMicrophoneEnabled = (enabled: boolean): void => {
  setAudioConfig({ micEnabled: enabled })
}

// 混音时被消费的原始流（不允许被 stop，只做持有）
const micExtraStreams: MediaStream[] = []

function releaseCachedAudio(): void {
  if (cachedAudioStream) {
    cachedAudioStream.getTracks().forEach((t) => t.stop())
    cachedAudioStream = null
  }
  // 缓存流已释放：混音 ctx 失去消费侧，必须关闭（否则配置变更后再录制
  // 每次泄漏一个 AudioContext，Chromium 有数量上限，超限后混音静默退化）
  closeMixedAudioCtx()
}

function closeMixedAudioCtx(): void {
  if (mixedAudioCtx) {
    void mixedAudioCtx.close().catch(() => {})
    mixedAudioCtx = null
  }
}

async function openMicStream(systemDeviceId: string | null): Promise<MediaStream | null> {
  try {
    const audioConstraints: MediaTrackConstraints = {
      echoCancellation: true,
      noiseSuppression: true,
      autoGainControl: true
    }
    if (systemDeviceId) {
      audioConstraints.deviceId = { exact: systemDeviceId }
    }
    return await navigator.mediaDevices.getUserMedia({ audio: audioConstraints, video: false })
  } catch (error) {
    console.warn('无法获取音频流:', error)
    return null
  }
}

let mixedAudioCtx: AudioContext | null = null

/** 两路音频混成单轨（WebAudio） */
async function mixStreams(a: MediaStream, b: MediaStream): Promise<MediaStream | null> {
  try {
    // 防御：上一个混音 ctx 若因任何路径未释放，先关闭，避免直接覆盖泄漏
    closeMixedAudioCtx()
    const ctx = new AudioContext()
    const dest = ctx.createMediaStreamDestination()
    for (const s of [a, b]) {
      const source = ctx.createMediaStreamSource(s)
      source.connect(dest)
    }
    // 保持 context 运行直到录制结束（suspended 后 dest 无输出）
    void ctx.resume().catch(() => {})
    mixedAudioCtx = ctx
    return dest.stream
  } catch (error) {
    console.warn('音频混音失败，回退单路:', error)
    return null
  }
}

/** 获取组装好的音频轨流（麦克风 / 系统音频 / 二者混音）；无音频输入时返回 null */
const getAudioStream = async (): Promise<MediaStream | null> => {
  if (!audioConfig.micEnabled && !audioConfig.systemDeviceId) return null
  if (
    cachedAudioStream &&
    cachedAudioStream.getAudioTracks().some((t) => t.readyState === 'live')
  ) {
    return cachedAudioStream
  }
  releaseCachedAudio()

  const micStream = audioConfig.micEnabled ? await openMicStream(null) : null
  const systemStream = audioConfig.systemDeviceId
    ? await openMicStream(audioConfig.systemDeviceId)
    : null

  if (micStream && systemStream) {
    const mixed = await mixStreams(micStream, systemStream)
    // 混音成功时原始流由 mixedAudioCtx 持续消费；失败则回退系统音频单路。
    // 两种情况原始 mic 流都要持有（不能被 stop，只防 GC / 统一释放）
    micExtraStreams.push(micStream)
    cachedAudioStream = mixed ?? systemStream
  } else {
    cachedAudioStream = micStream ?? systemStream
  }
  return cachedAudioStream
}

function releaseAllAudio(): void {
  releaseCachedAudio()
  micExtraStreams.splice(0).forEach((s) => s.getTracks().forEach((t) => t.stop()))
  if (mixedAudioCtx) {
    void mixedAudioCtx.close().catch(() => {})
    mixedAudioCtx = null
  }
}

// 设置预览视频 ref（从外部组件传入）
const setPreviewVideoRef = (ref: HTMLVideoElement | null): void => {
  previewVideoRef.value = ref
}

// 设置画中画摄像头 ref（从外部组件传入）
const setPipCameraRef = (ref: HTMLVideoElement | null): void => {
  pipCameraRef.value = ref
}

// 设置录制区域（屏幕 DIP 坐标系）+ 该区域所在显示器的 scaleFactor
const setRegion = (
  region: { x: number; y: number; width: number; height: number } | null,
  scaleFactor = 1
): void => {
  captureRegion = region
  captureScale = scaleFactor > 0 ? scaleFactor : 1
}

// 设置 cursor 屏幕位置（DIP；draw 循环换算到物理像素后绘光圈）
const setCursorScreenPos = (pos: { x: number; y: number } | null): void => {
  cursorScreenPos = pos
}

/** 设置合成流帧率（来自录制设置） */
const setFps = (fps: number): void => {
  if (fps === 30 || fps === 60) captureFps = fps
}

// 合并音频轨道到视频流
const addAudioToStream = async (videoStream: MediaStream): Promise<MediaStream> => {
  const audioStream = await getAudioStream()

  if (audioStream) {
    // 将音频轨道添加到视频流
    audioStream.getAudioTracks().forEach((track) => {
      videoStream.addTrack(track)
    })
  }

  return videoStream
}

// 获取屏幕流
const getScreenStream = async (source: DesktopCapturerSource): Promise<MediaStream> => {
  // 停止之前的屏幕流
  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop())
    stream.value = null
  }

  // Electron 桌面捕获约束（chromeMediaSource/chromeMediaSourceId）不在标准
  // MediaTrackConstraints 中，这里整体收窄后透传给底层 getUserMedia
  const electronVideoConstraints = {
    mandatory: {
      chromeMediaSource: 'desktop',
      chromeMediaSourceId: source.id
    }
  } as unknown as MediaTrackConstraints

  const newStream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: electronVideoConstraints
  })

  // 添加音频轨道
  await addAudioToStream(newStream)

  stream.value = newStream
  return newStream
}

// 获取摄像头流
const getCameraStream = async (device: CameraDevice): Promise<MediaStream> => {
  // 停止之前的摄像头流
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach((track) => track.stop())
    cameraStream.value = null
  }

  // 清除画中画预览
  if (pipCameraRef.value) {
    pipCameraRef.value.srcObject = null
  }

  // 验证设备是否仍然存在
  let deviceExists = false
  if (device.deviceId) {
    try {
      const devices = await navigator.mediaDevices.enumerateDevices()
      deviceExists = devices.some((d) => d.kind === 'videoinput' && d.deviceId === device.deviceId)
    } catch (error) {
      console.warn('无法枚举设备以验证设备 ID:', error)
      // 如果枚举失败，仍然尝试使用设备 ID
      deviceExists = true
    }
  }

  // 获取摄像头流 - 使用更灵活的约束，如果高分辨率失败则降级
  let constraints: MediaStreamConstraints = {
    video:
      device.deviceId && deviceExists
        ? {
            deviceId: { ideal: device.deviceId },
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
            frameRate: { ideal: 30, max: 60 }
          }
        : {
            width: { ideal: 1920, min: 640 },
            height: { ideal: 1080, min: 480 },
            frameRate: { ideal: 30, max: 60 }
          },
    audio: false
  }

  let newCameraStream: MediaStream
  try {
    newCameraStream = await navigator.mediaDevices.getUserMedia(constraints)
  } catch (error) {
    // 如果高分辨率失败，尝试使用更低的约束
    const errorMessage = (error as Error).message || String(error)

    // 如果是设备未找到错误，先重新枚举设备
    if (
      errorMessage.includes('NotFoundError') ||
      errorMessage.includes('Requested device not found')
    ) {
      console.warn('设备未找到，重新枚举设备:', errorMessage)
      try {
        const devices = await navigator.mediaDevices.enumerateDevices()
        const availableCameras = devices.filter((d) => d.kind === 'videoinput')

        if (availableCameras.length === 0) {
          throw new Error('未找到可用的摄像头设备')
        }

        // 尝试使用第一个可用的摄像头
        constraints = {
          video: availableCameras[0].deviceId
            ? {
                deviceId: { ideal: availableCameras[0].deviceId },
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                frameRate: { ideal: 30 }
              }
            : {
                width: { ideal: 1280, min: 640 },
                height: { ideal: 720, min: 480 },
                frameRate: { ideal: 30 }
              },
          audio: false
        }

        newCameraStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch {
        // 如果重新枚举也失败，抛出原始错误
        throw error
      }
    } else if (
      errorMessage.includes('Could not start video source') ||
      errorMessage.includes('NotReadableError') ||
      errorMessage.includes('TrackStartError')
    ) {
      console.warn('高分辨率摄像头流获取失败，尝试使用较低分辨率:', errorMessage)
      constraints = {
        video: {
          width: { ideal: 1280, min: 640 },
          height: { ideal: 720, min: 480 },
          frameRate: { ideal: 30 }
        },
        audio: false
      }
      try {
        newCameraStream = await navigator.mediaDevices.getUserMedia(constraints)
      } catch (retryError) {
        // 如果还是失败，尝试最基本的约束（不指定设备 ID）
        console.warn('中等分辨率也失败，尝试使用基本约束:', retryError)
        constraints = {
          video: true, // 让系统自动选择可用的摄像头
          audio: false
        }
        try {
          newCameraStream = await navigator.mediaDevices.getUserMedia(constraints)
        } catch {
          // 如果所有尝试都失败，抛出原始错误
          throw error
        }
      }
    } else {
      // 其他错误直接抛出
      throw error
    }
  }

  // 检查流是否有活动的视频轨道
  const videoTracks = newCameraStream.getVideoTracks()
  if (videoTracks.length === 0) {
    throw new Error('摄像头流没有视频轨道')
  }

  const track = videoTracks[0]
  if (track.readyState !== 'live') {
    throw new Error(`摄像头轨道状态异常: ${track.readyState}`)
  }

  cameraStream.value = newCameraStream

  // 设置画中画预览
  if (pipCameraRef.value) {
    pipCameraRef.value.srcObject = cameraStream.value
    await pipCameraRef.value.play()
  }

  return newCameraStream
}

// 合成屏幕和摄像头流
const combineStreams = async (): Promise<MediaStream> => {
  if (!stream.value || !cameraStream.value) {
    throw new Error('屏幕流或摄像头流不存在')
  }

  // 停止之前的合成流
  if (canvasStream.value) {
    canvasStream.value.getTracks().forEach((track) => track.stop())
    canvasStream.value = null
  }

  // 确保屏幕流有音频轨道
  if (stream.value.getAudioTracks().length === 0) {
    await addAudioToStream(stream.value)
  }

  // 停止之前的动画帧
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }

  // 清理之前的隐藏视频元素
  if (hiddenScreenVideo && hiddenScreenVideo.parentNode) {
    hiddenScreenVideo.srcObject = null
    hiddenScreenVideo.parentNode.removeChild(hiddenScreenVideo)
    hiddenScreenVideo = null
  }
  if (hiddenCameraVideo && hiddenCameraVideo.parentNode) {
    hiddenCameraVideo.srcObject = null
    hiddenCameraVideo.parentNode.removeChild(hiddenCameraVideo)
    hiddenCameraVideo = null
  }

  // 创建用于绘制屏幕的视频元素（隐藏）
  const screenVideo = document.createElement('video')
  screenVideo.srcObject = stream.value
  screenVideo.autoplay = true
  screenVideo.muted = true
  screenVideo.playsInline = true
  screenVideo.style.position = 'absolute'
  screenVideo.style.left = '-9999px'
  screenVideo.style.width = '1px'
  screenVideo.style.height = '1px'
  document.body.appendChild(screenVideo)
  hiddenScreenVideo = screenVideo

  // 创建用于绘制摄像头的视频元素（隐藏）
  const cameraVideo = document.createElement('video')
  cameraVideo.srcObject = cameraStream.value
  cameraVideo.autoplay = true
  cameraVideo.muted = true
  cameraVideo.playsInline = true
  cameraVideo.style.position = 'absolute'
  cameraVideo.style.left = '-9999px'
  cameraVideo.style.width = '1px'
  cameraVideo.style.height = '1px'
  document.body.appendChild(cameraVideo)
  hiddenCameraVideo = cameraVideo

  // 先播放视频以确保加载
  await Promise.all([screenVideo.play(), cameraVideo.play()])

  // 创建 canvas 用于合成
  // 若 captureRegion 已设置，canvas size = region 物理像素大小（DIP × scaleFactor）
  if (!canvasRef) {
    const canvas = document.createElement('canvas')
    canvas.width = 1920
    canvas.height = 1080
    canvasRef = canvas
  }

  if (captureRegion) {
    canvasRef.width = Math.max(2, Math.round(captureRegion.width * captureScale))
    canvasRef.height = Math.max(2, Math.round(captureRegion.height * captureScale))
  } else {
    canvasRef.width = 1920
    canvasRef.height = 1080
  }

  const canvas = canvasRef
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    throw new Error('无法获取 canvas 2d 上下文')
  }

  // 等待视频加载
  await new Promise<void>((resolve) => {
    let attempts = 0
    const maxAttempts = 100 // 10秒超时

    const checkReady = (): void => {
      attempts++

      const screenReady =
        screenVideo.readyState >= 2 && screenVideo.videoWidth > 0 && screenVideo.videoHeight > 0
      const cameraReady =
        cameraVideo.readyState >= 2 && cameraVideo.videoWidth > 0 && cameraVideo.videoHeight > 0

      if (screenReady && cameraReady) {
        resolve()
      } else if (attempts >= maxAttempts) {
        resolve() // 即使超时也继续
      } else {
        setTimeout(checkReady, 100)
      }
    }
    checkReady()
  })

  // 先绘制一次，确保 canvas 有内容
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, canvas.width, canvas.height)

  // 创建合成流
  const newCanvasStream = canvas.captureStream(captureFps)

  // 将屏幕流的音频轨道添加到合成流
  stream.value.getAudioTracks().forEach((audioTrack) => {
    newCanvasStream.addTrack(audioTrack)
  })

  canvasStream.value = newCanvasStream

  // 绘制函数
  const draw = (): void => {
    if (!ctx || !screenVideo) {
      return
    }

    // 窗口不可见时跳过绘制，节省 CPU/GPU（仍保持 rAF 循环以便恢复）。
    // 注意：最小化期间录制画面会停留在最后一帧。
    if (document.hidden) {
      animationFrameId = requestAnimationFrame(draw)
      return
    }

    // 清空画布
    ctx.fillStyle = '#000'
    ctx.fillRect(0, 0, canvas.width, canvas.height)

    // 绘制屏幕（主画面）
    if (screenVideo.videoWidth > 0 && screenVideo.videoHeight > 0) {
      // 若有 region，源矩形按物理像素换算（videoWidth 是物理像素，region 是 DIP）
      if (captureRegion) {
        const sx = Math.max(0, Math.round(captureRegion.x * captureScale))
        const sy = Math.max(0, Math.round(captureRegion.y * captureScale))
        // 源宽高必须扣除偏移并夹在视频范围内，否则 drawImage 源矩形越界
        // 会按规范被等比裁剪，导致画面右侧/底部错位
        const srcW = Math.max(
          2,
          Math.min(screenVideo.videoWidth - sx, Math.round(captureRegion.width * captureScale))
        )
        const srcH = Math.max(
          2,
          Math.min(screenVideo.videoHeight - sy, Math.round(captureRegion.height * captureScale))
        )
        // 直接贴满整个 canvas（canvas 已被设到 region 物理像素大小）
        ctx.drawImage(screenVideo, sx, sy, srcW, srcH, 0, 0, canvas.width, canvas.height)
      } else {
        const screenAspect = screenVideo.videoWidth / screenVideo.videoHeight
        const canvasAspect = canvas.width / canvas.height

        let drawWidth = canvas.width
        let drawHeight = canvas.height
        let offsetX = 0
        let offsetY = 0

        if (screenAspect > canvasAspect) {
          drawHeight = canvas.width / screenAspect
          offsetY = (canvas.height - drawHeight) / 2
        } else {
          drawWidth = canvas.height * screenAspect
          offsetX = (canvas.width - drawWidth) / 2
        }

        ctx.drawImage(screenVideo, offsetX, offsetY, drawWidth, drawHeight)
      }
    }

    // 鼠标光圈（cursor 与 region 同为 DIP 坐标，换算到物理像素后绘制）
    if (cursorScreenPos && captureRegion) {
      const cx = (cursorScreenPos.x - captureRegion.x) * captureScale
      const cy = (cursorScreenPos.y - captureRegion.y) * captureScale
      // 仅当 cursor 落在 region 内时画
      if (cx >= 0 && cx <= canvas.width && cy >= 0 && cy <= canvas.height) {
        const radius = 18
        // 外圈（淡黄半透）
        ctx.beginPath()
        ctx.arc(cx, cy, radius, 0, Math.PI * 2)
        ctx.strokeStyle = 'rgba(255, 216, 59, 0.9)'
        ctx.lineWidth = 3
        ctx.stroke()
        // 内圆点
        ctx.beginPath()
        ctx.arc(cx, cy, 4, 0, Math.PI * 2)
        ctx.fillStyle = 'rgba(255, 216, 59, 1)'
        ctx.fill()
      }
    }

    // 绘制摄像头（画中画，右下角）
    if (cameraVideo && cameraVideo.videoWidth > 0 && cameraVideo.videoHeight > 0) {
      const pipSize = Math.min(320, canvas.height / 4)
      const pipX = canvas.width - pipSize - 20
      const pipY = canvas.height - pipSize - 20

      // 绘制边框
      ctx.fillStyle = '#fff'
      ctx.fillRect(pipX - 2, pipY - 2, pipSize + 4, pipSize + 4)

      // 绘制摄像头画面
      ctx.drawImage(cameraVideo, pipX, pipY, pipSize, pipSize)
    }

    animationFrameId = requestAnimationFrame(draw)
  }

  // 开始绘制
  draw()

  // 等待至少一帧绘制完成
  await new Promise((resolve) => {
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve(undefined)
      })
    })
  })

  // 设置主预览为合成流
  if (previewVideoRef.value) {
    previewVideoRef.value.srcObject = newCanvasStream
    await previewVideoRef.value.play()
  }

  return newCanvasStream
}

// 设置预览
const setPreview = async (previewStream: MediaStream): Promise<void> => {
  if (previewVideoRef.value) {
    // 先清除旧的流引用（不停止轨道，让浏览器自动处理）
    previewVideoRef.value.srcObject = null
    // 等待一下，确保旧流已清除
    await new Promise((resolve) => setTimeout(resolve, 50))
    // 设置新流
    previewVideoRef.value.srcObject = previewStream
    await previewVideoRef.value.play()
  }
}

// 关闭摄像头
const closeCamera = (): void => {
  if (cameraStream.value) {
    // 视频轨 stop；音频轨只从流上摘除（removeTrack）——它可能来自共享的
    // 音频缓存（同一轨也挂在屏幕流/合成流上），直接 stop 会把正在用的麦克风静音
    cameraStream.value.getVideoTracks().forEach((track) => track.stop())
    cameraStream.value.getAudioTracks().forEach((track) => {
      if (cameraStream.value) cameraStream.value.removeTrack(track)
    })
    cameraStream.value = null
  }
  if (pipCameraRef.value) {
    pipCameraRef.value.srcObject = null
  }
  // 如果正在使用合成流，需要重新设置预览为屏幕流
  if (canvasStream.value && stream.value) {
    // 停止合成流
    canvasStream.value.getTracks().forEach((track) => track.stop())
    canvasStream.value = null
    // 如果只有屏幕流，设置预览为屏幕流
    if (previewVideoRef.value) {
      previewVideoRef.value.srcObject = stream.value
      previewVideoRef.value.play()
    }
  }
}

// 清理资源
const cleanup = (): void => {
  if (animationFrameId) {
    cancelAnimationFrame(animationFrameId)
    animationFrameId = null
  }
  if (hiddenScreenVideo && hiddenScreenVideo.parentNode) {
    hiddenScreenVideo.srcObject = null
    hiddenScreenVideo.parentNode.removeChild(hiddenScreenVideo)
    hiddenScreenVideo = null
  }
  if (hiddenCameraVideo && hiddenCameraVideo.parentNode) {
    hiddenCameraVideo.srcObject = null
    hiddenCameraVideo.parentNode.removeChild(hiddenCameraVideo)
    hiddenCameraVideo = null
  }
  if (stream.value) {
    stream.value.getTracks().forEach((track) => track.stop())
    stream.value = null
  }
  if (cameraStream.value) {
    cameraStream.value.getTracks().forEach((track) => track.stop())
    cameraStream.value = null
  }
  if (canvasStream.value) {
    canvasStream.value.getTracks().forEach((track) => track.stop())
    canvasStream.value = null
  }
  releaseAllAudio()
  if (previewVideoRef.value) {
    previewVideoRef.value.srcObject = null
  }
  if (pipCameraRef.value) {
    pipCameraRef.value.srcObject = null
  }
}

// 活跃消费者计数（Layout + RecordPage 共享模块级单例状态；
// RecordPage 切标签卸载时 Layout 仍在用，不能停掉共享流）
let mountedConsumers = 0

/** useStreamManager 返回结构 */
export interface StreamManagerComposable {
  stream: Ref<MediaStream | null>
  cameraStream: Ref<MediaStream | null>
  canvasStream: Ref<MediaStream | null>
  previewVideoRef: Ref<HTMLVideoElement | null>
  pipCameraRef: Ref<HTMLVideoElement | null>
  setPreviewVideoRef: (ref: HTMLVideoElement | null) => void
  setPipCameraRef: (ref: HTMLVideoElement | null) => void
  setRegion: (
    region: { x: number; y: number; width: number; height: number } | null,
    scaleFactor?: number
  ) => void
  setCursorScreenPos: (pos: { x: number; y: number } | null) => void
  setAudioConfig: (config: Partial<AudioConfig>) => void
  setPreferredAudioDevice: (deviceId: string | null) => void
  setMicrophoneEnabled: (enabled: boolean) => void
  setFps: (fps: number) => void
  addAudioToStream: (videoStream: MediaStream) => Promise<MediaStream>
  getScreenStream: (source: DesktopCapturerSource) => Promise<MediaStream>
  getCameraStream: (device: CameraDevice) => Promise<MediaStream>
  combineStreams: () => Promise<MediaStream>
  setPreview: (previewStream: MediaStream) => Promise<void>
  closeCamera: () => void
  cleanup: () => void
}

export function useStreamManager(): StreamManagerComposable {
  mountedConsumers += 1
  onUnmounted(() => {
    mountedConsumers = Math.max(0, mountedConsumers - 1)
    if (mountedConsumers === 0) cleanup()
  })

  return {
    stream,
    cameraStream,
    canvasStream,
    previewVideoRef,
    pipCameraRef,
    setPreviewVideoRef,
    setPipCameraRef,
    setRegion,
    setCursorScreenPos,
    setAudioConfig,
    setPreferredAudioDevice, // deprecated
    setMicrophoneEnabled, // deprecated
    setFps,
    addAudioToStream,
    getScreenStream,
    getCameraStream,
    combineStreams,
    setPreview,
    closeCamera,
    cleanup
  }
}

