import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, readFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import {
  loadApplicationsCacheFile,
  saveApplicationsCacheFile
} from '../applicationsCacheFile'

/**
 * B53-1 应用索引磁盘持久化：此前 applicationsCache 只在内存，每次冷启动首轮
 * get-applications 都要同步等 5-15s system_profiler。落盘后启动即回旧数据，
 * 由既有 stale-while-revalidate 逻辑决定是否后台刷新。
 */

let dir: string

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'frond-appcache-'))
})

afterEach(() => {
  rmSync(dir, { recursive: true, force: true })
})

describe('applicationsCacheFile（B53-1）', () => {
  it('save → load 往返一致', () => {
    const apps = [
      { name: 'Safari', path: '/Applications/Safari.app', aliases: ['浏览器'] },
      { name: 'Terminal', path: '/System/Applications/Utilities/Terminal.app' }
    ]
    saveApplicationsCacheFile(dir, apps as never[], 1727900000000)
    const loaded = loadApplicationsCacheFile(dir)
    expect(loaded).not.toBeNull()
    expect(loaded!.timestamp).toBe(1727900000000)
    expect(loaded!.applications).toEqual(apps)
    // 落盘的是合法 JSON
    expect(() =>
      JSON.parse(readFileSync(join(dir, 'applications-cache.json'), 'utf-8'))
    ).not.toThrow()
  })

  it('文件缺失 → null（回退同步扫描）', () => {
    expect(loadApplicationsCacheFile(dir)).toBeNull()
  })

  it('损坏 JSON → null 不抛', () => {
    writeFileSync(join(dir, 'applications-cache.json'), '{oops', 'utf-8')
    expect(loadApplicationsCacheFile(dir)).toBeNull()
  })

  it('版本不符 → null（结构升级时安全弃用旧数据）', () => {
    writeFileSync(
      join(dir, 'applications-cache.json'),
      JSON.stringify({ version: 0, timestamp: 1, applications: [] }),
      'utf-8'
    )
    expect(loadApplicationsCacheFile(dir)).toBeNull()
  })

  it('非法行（缺 name/path）被剔除，不全盘拒绝', () => {
    const apps = [
      { name: 'Good', path: '/Applications/Good.app' },
      { path: '/no/name.app' },
      { name: 'NoPath' },
      'junk'
    ]
    saveApplicationsCacheFile(dir, apps as never[], 1)
    const loaded = loadApplicationsCacheFile(dir)!
    expect(loaded.applications).toEqual([{ name: 'Good', path: '/Applications/Good.app' }])
  })

  it('save 自动建目录（userData 下首次）', () => {
    const nested = join(dir, 'sub')
    saveApplicationsCacheFile(nested, [], 1)
    expect(existsSync(join(nested, 'applications-cache.json'))).toBe(true)
  })
})
