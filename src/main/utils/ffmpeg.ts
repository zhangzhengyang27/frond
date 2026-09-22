import { join } from 'path'
import { existsSync } from 'fs'
import { spawn, type ChildProcess } from 'child_process'

// 缓存 ffmpeg 路径，避免重复查找
let cachedFfmpegPath: string | null = null

/**
 * 获取 ffmpeg 可执行文件路径
 * 优先使用打包的 ffmpeg，如果不可用则回退到系统 ffmpeg
 */
export function getFfmpegPath(): string {
  if (cachedFfmpegPath !== null) {
    return cachedFfmpegPath
  }

  try {
    // 尝试加载打包的 ffmpeg

    // eslint-disable-next-line @typescript-eslint/no-require-imports -- 无类型声明的 CommonJS 包
    const ffmpegInstaller = require('@ffmpeg-installer/ffmpeg')
    const ffmpegPath = ffmpegInstaller.path

    if (ffmpegPath) {
      const possiblePaths = [
        // 生产环境：app.asar.unpacked 中的路径
        ffmpegPath.replace('app.asar', 'app.asar.unpacked'),
        // 开发环境：原始路径
        ffmpegPath,
        // 如果路径包含 node_modules，也尝试直接使用
        ffmpegPath.replace(/.*node_modules/, join(process.cwd(), 'node_modules'))
      ]

      for (const p of possiblePaths) {
        if (p && existsSync(p)) {
          cachedFfmpegPath = p
          console.log('使用打包的 ffmpeg:', p)
          return p
        }
      }
    }
  } catch (error) {
    console.warn('无法加载打包的 ffmpeg，将使用系统 ffmpeg:', (error as Error).message)
  }

  // 回退到系统 ffmpeg
  cachedFfmpegPath = 'ffmpeg'
  return cachedFfmpegPath
}

/** stderr 只保留尾部，避免长转码（小时级）把日志缓冲撑到 MB 级 */
export function createStderrTail(maxLines = 40): {
  push: (chunk: string) => void
  tail: () => string
} {
  const lines: string[] = []
  return {
    push(chunk: string): void {
      for (const line of chunk.split('\n')) {
        lines.push(line)
        if (lines.length > maxLines) lines.shift()
      }
    },
    tail: (): string => lines.join('\n')
  }
}

/**
 * 探测媒体文件时长（秒）。解析 ffmpeg -i 的 container 元数据。
 * 获取失败返回 null（调用方需自行降级，例如进度按字节估算）。
 */
export function probeDurationSec(filePath: string): Promise<number | null> {
  return probeMediaInfo(filePath).then((info) => info.durationSec)
}

/**
 * 探测媒体时长 + 是否含音轨 + 视频分辨率
 * （拼接/混音 filter 需要按输入有无音轨分别构造；concat 需要统一分辨率）。
 */
export function probeMediaInfo(filePath: string): Promise<{
  durationSec: number | null
  hasAudio: boolean
  width: number | null
  height: number | null
}> {
  if (!existsSync(filePath)) {
    return Promise.resolve({ durationSec: null, hasAudio: false, width: null, height: null })
  }
  const ffmpeg = getFfmpegPath()
  return new Promise<{
    durationSec: number | null
    hasAudio: boolean
    width: number | null
    height: number | null
  }>((resolve) => {
    // ffmpeg 无输出文件时会打印元数据后以错误码退出 —— 行为符合预期
    const child = spawn(ffmpeg, ['-i', filePath])
    let stderr = ''
    child.stderr.on('data', (b: Buffer) => {
      stderr += b.toString()
    })
    child.on('close', () => {
      const m = /Duration:\s*(\d+):(\d+):(\d+(?:\.\d+)?)/.exec(stderr)
      const durationSec = m ? Number(m[1]) * 3600 + Number(m[2]) * 60 + Number(m[3]) : null
      const hasAudio = /Stream\s*#\d+:\d+.*:\s*Audio:/.test(stderr)
      const dim = /Stream\s*#\d+:\d+.*:\s*Video:.*?,\s*(\d{2,5})x(\d{2,5})/.exec(stderr)
      resolve({
        durationSec,
        hasAudio,
        width: dim ? Number(dim[1]) : null,
        height: dim ? Number(dim[2]) : null
      })
    })
    child.on('error', () =>
      resolve({ durationSec: null, hasAudio: false, width: null, height: null })
    )
  })
}

/**
 * 跨平台终止 ffmpeg 子进程树。
 * Windows 上 SIGTERM 不会传递给子进程树，需要 taskkill /T。
 */
export function killFfmpegProcess(child: ChildProcess): void {
  if (!child || child.killed || child.exitCode !== null) return
  if (process.platform === 'win32' && child.pid) {
    spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'])
  } else {
    child.kill('SIGTERM')
  }
}

/**
 * 当前 ffmpeg 是否支持 xfade 滤镜（4.3+）。
 * @ffmpeg-installer 捆绑的是 2018 年构建（无 xfade），转场必须降级为硬切，
 * 否则 filter_complex 直接报 Invalid argument。结果缓存，只探测一次。
 *
 * 异步探测：旧实现 spawnSync 最长冻结主进程 10s（所有窗口无响应）。
 * 并发调用共享同一次探测。
 */
let xfadeSupportCache: boolean | null = null
let xfadeProbePromise: Promise<boolean> | null = null

export function xfadeSupportedAsync(): Promise<boolean> {
  if (xfadeSupportCache !== null) return Promise.resolve(xfadeSupportCache)
  if (!xfadeProbePromise) {
    xfadeProbePromise = new Promise<boolean>((resolve) => {
      let stdout = ''
      let settled = false
      const finish = (supported: boolean): void => {
        if (settled) return
        settled = true
        xfadeSupportCache = supported
        xfadeProbePromise = null
        resolve(supported)
      }
      const child = spawn(getFfmpegPath(), ['-hide_banner', '-filters'])
      // stdout 上限保护：-filters 输出通常几十 KB，这里放宽到 4MB
      child.stdout?.on('data', (chunk: Buffer) => {
        if (stdout.length < 4 * 1024 * 1024) stdout += chunk.toString()
      })
      child.on('close', () => finish(/ xfade /.test(stdout)))
      child.on('error', () => finish(false))
    })
  }
  return xfadeProbePromise
}

/** 同步版：只读缓存（未探测过时返回 false）；热路径请用 xfadeSupportedAsync */
export function xfadeSupported(): boolean {
  return xfadeSupportCache === true
}
