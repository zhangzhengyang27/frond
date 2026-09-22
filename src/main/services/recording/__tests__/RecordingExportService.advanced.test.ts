import { describe, it, expect } from 'vitest'
import { buildComplexExportArgs } from '../RecordingExportService'

/**
 * Leaf · 复杂导出（片头/片尾/BGM/转场）参数拼装测试
 *
 * ⚠ 恢复说明：本文件随 2026-09-22 删除事故丢了头部与用例正文，只剩下面这个 mk()
 * 默认值工厂的原文；原本唯一在册的「纯转码走简单路径」用例正文没找回，记作 it.todo。
 */

describe('buildComplexExportArgs', () => {
  type ComplexExportArgs = Parameters<typeof buildComplexExportArgs>[0]
  // 各输入默认：源 60s / 片头片尾各 5s，全部有音轨
  const mk = (over: Partial<ComplexExportArgs> = {}): ComplexExportArgs =>
    ({
      source: '/tmp/a.mp4',
      hasIntro: false,
      hasOutro: false,
      hasBgm: false,
      transition: 'cut',
      applyTransition: false,
      format: 'mp4',
      resolution: 1080,
      fps: 30,
      fadeSec: 0,
      outputPath: '/tmp/out.mp4',
      durations: { source: 60, intro: 5, outro: 5 },
      hasAudio: { source: true, intro: true, outro: true },
      ...over
    }) as ComplexExportArgs

  it('只有片尾时，输入索引按 push 顺序给到 1（旧实现硬编码 outro=2 → 引用不存在的输入）', () => {
    const args = buildComplexExportArgs(mk({ hasOutro: true, outro: '/tmp/o.mp4' }))
    expect(args.filter((a) => a === '-i')).toHaveLength(2)
    const joined = args.join(' ')
    expect(joined).toContain('[1:v]')
    expect(joined).not.toContain('[2:v]')
  })

  it('片头 + 片尾 + 源共三路视频输入，各自占一个 -i', () => {
    const args = buildComplexExportArgs(
      mk({ hasIntro: true, intro: '/tmp/i.mp4', hasOutro: true, outro: '/tmp/o.mp4' })
    )
    expect(args.filter((a) => a === '-i')).toHaveLength(3)
    expect(args[0]).toBe('-y')
  })

  it.todo('纯转码（无 intro/outro/bgm）走简单路径')
})
