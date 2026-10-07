import { describe, expect, it } from 'vitest'
import {
  CRASH_STATE_FILENAME,
  buildDiagnosticSummary,
  buildIssueTitle,
  buildIssueUrl,
  diffPendingDumps,
  isDumpFile,
  parseState,
  pruneSeen,
  serializeState,
  type CrashDumpInfo
} from '../crashReportCore'

const dump = (file: string, sizeBytes = 1024, modifiedAt = 1730000000000): CrashDumpInfo => ({
  file,
  sizeBytes,
  modifiedAt
})

describe('isDumpFile', () => {
  it('只认 .dmp（大小写不敏感），metadata/settings 不算', () => {
    expect(isDumpFile('abc.dmp')).toBe(true)
    expect(isDumpFile('ABC.DMP')).toBe(true)
    expect(isDumpFile('metadata')).toBe(false)
    expect(isDumpFile('settings')).toBe(false)
    expect(isDumpFile('x.dmp.txt')).toBe(false)
  })
})

describe('diffPendingDumps / pruneSeen', () => {
  it('diff 只留没确认过的新转储', () => {
    const dumps = [dump('a.dmp'), dump('b.dmp'), dump('c.dmp')]
    const pending = diffPendingDumps(dumps, ['b.dmp'])
    expect(pending.map((d) => d.file)).toEqual(['a.dmp', 'c.dmp'])
  })

  it('prune 剔除已消失的历史条目，防止状态文件膨胀', () => {
    const dumps = [dump('a.dmp')]
    expect(pruneSeen(dumps, ['a.dmp', 'gone.dmp', 'also-gone.dmp'])).toEqual(['a.dmp'])
  })
})

describe('parseState / serializeState', () => {
  it('roundtrip', () => {
    const state = { seen: ['a.dmp', 'b.dmp'] }
    expect(parseState(serializeState(state))).toEqual(state)
  })

  it('缺失 / 非法 JSON / 形状不对 → 一律按从未确认过处理', () => {
    expect(parseState(null)).toEqual({ seen: [] })
    expect(parseState(undefined)).toEqual({ seen: [] })
    expect(parseState('not json{')).toEqual({ seen: [] })
    expect(parseState('{"seen":"x"}')).toEqual({ seen: [] })
    expect(parseState('{"other":1}')).toEqual({ seen: [] })
  })

  it('seen 里混入非字符串元素会被过滤', () => {
    expect(parseState('{"seen":["a.dmp",3,null]}')).toEqual({ seen: ['a.dmp'] })
  })

  it('状态文件名常量（CrashReportService 与测试共用同一份）', () => {
    expect(CRASH_STATE_FILENAME).toBe('crash-report-state.json')
  })
})

describe('buildDiagnosticSummary', () => {
  it('包含版本/平台/转储明细与日志导出指引', () => {
    const text = buildDiagnosticSummary({
      appVersion: '0.2.1',
      electronVersion: '38.5.0',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '25.5.0',
      locale: 'zh-CN',
      optIn: true,
      dumps: [dump('crash-2026.dmp', 2 * 1024 * 1024)],
      userDataDir: '/tmp/userData',
      crashDumpsDir: '/tmp/crashDumps',
      capturedAt: '2026-10-07T00:00:00.000Z'
    })
    expect(text).toContain('版本: 0.2.1（Electron 38.5.0）')
    expect(text).toContain('平台: darwin arm64')
    expect(text).toContain('崩溃收集: 已开启')
    expect(text).toContain('转储份数: 1')
    expect(text).toContain('crash-2026.dmp（2.00 MB')
    expect(text).toContain('应用数据目录: /tmp/userData')
    expect(text).toContain('导出日志')
  })

  it('无转储时份数为 0，不产生空行项', () => {
    const text = buildDiagnosticSummary({
      appVersion: '0.2.1',
      electronVersion: '38.5.0',
      platform: 'darwin',
      arch: 'arm64',
      osRelease: '25.5.0',
      locale: 'zh-CN',
      optIn: false,
      dumps: [],
      userDataDir: '/tmp/userData',
      crashDumpsDir: '/tmp/crashDumps'
    })
    expect(text).toContain('转储份数: 0')
    expect(text).toContain('崩溃收集: 未开启')
  })
})

describe('buildIssueUrl / buildIssueTitle', () => {
  it('URL 带模板与编码后的标题，尾部斜杠被剥掉', () => {
    const url = buildIssueUrl('https://github.com/zhangzhengyang27/frond/', '[Crash] v0.2.1')
    expect(url).toBe(
      'https://github.com/zhangzhengyang27/frond/issues/new?template=crash-report.md&title=%5BCrash%5D%20v0.2.1'
    )
  })

  it('标题格式：版本 + 平台-架构', () => {
    expect(
      buildIssueTitle({ appVersion: '0.2.1', platform: 'darwin', arch: 'arm64' })
    ).toBe('[Crash] v0.2.1 darwin-arm64')
  })
})
