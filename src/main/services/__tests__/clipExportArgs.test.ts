import { describe, it, expect, vi } from 'vitest'
import { mkdtempSync, writeFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

// import ClipService 即触发其构造（electron-store 单例）——测试隔离门禁要求
// mock 掉，避免写真实用户目录；本文件只测参数构建纯函数，store 行为无关
vi.mock('electron-store', () => {
  class MemoryStore {
    get = (key: string): unknown => this.disk.get(key)
    set = (key: string, value: unknown): void => {
      this.disk.set(key, value)
    }
    private disk = new Map<string, unknown>()
  }
  return { default: MemoryStore }
})

import { buildClipFinalExportArgs } from '../ClipService'

/**
 * B37 回归钉：分辨率语义。ExportDialog 的 value（720/1080/1440/2160）是目标
 * **高度**（UI 标签 1280×720），旧实现把它当宽度拼 `-s 720x405`——奇数高被
 * libx264 yuv420p 直接拒绝（720p/4K 档 100% 失败），其余档位尺寸与标签不符。
 * 正确口径与 RecordingExportService 同款：scale=-2:H 保持源宽高比 + 宽度偶数化。
 */

const OPTS = {
  clips: [],
  outputPath: '/tmp/out.mp4',
  resolution: 720 as const,
  fps: 30 as const
}

describe('buildClipFinalExportArgs 分辨率口径（B37）', () => {
  it('无 BGM：-vf scale=-2:H，不再出现 -s WxH 硬拼', () => {
    const args = buildClipFinalExportArgs('/tmp/in.mp4', '/tmp/out.mp4', { ...OPTS })
    const i = args.indexOf('-vf')
    expect(i).toBeGreaterThanOrEqual(0)
    expect(args[i + 1]).toBe('scale=-2:720')
    expect(args.join(' ')).not.toContain('-s 720x405')
    expect(args).not.toContain('-filter_complex')
  })

  it('4K 档：scale=-2:2160（旧实现 2160x1215 奇数高必败）', () => {
    const args = buildClipFinalExportArgs('/tmp/in.mp4', '/tmp/out.mp4', {
      ...OPTS,
      resolution: 2160 as const
    })
    const i = args.indexOf('-vf')
    expect(args[i + 1]).toBe('scale=-2:2160')
  })

  it('有 BGM：-vf 与 -filter_complex 互斥，缩放并入 filter_complex 且映射 [0v]', () => {
    const dir = mkdtempSync(join(tmpdir(), 'frond-clipargs-'))
    try {
      const bgm = join(dir, 'bgm.mp3')
      writeFileSync(bgm, 'x')
      const args = buildClipFinalExportArgs('/tmp/in.mp4', '/tmp/out.mp4', {
        ...OPTS,
        backgroundMusic: { path: bgm, volume: 0.3 }
      })
      expect(args).not.toContain('-vf')
      const i = args.indexOf('-filter_complex')
      expect(args[i + 1]).toMatch(/^\[0:v\]scale=-2:720\[0v\];\[0:a\]/)
      expect(args).toContain('[0v]')
      expect(args).toContain('[outa]')
      expect(args.join(' ')).not.toContain('-s 720x405')
    } finally {
      rmSync(dir, { recursive: true, force: true })
    }
  })
})
