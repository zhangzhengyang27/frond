import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * P-3.2 更新语义 + P-3.4 来源审计：importFromFolder 的首装/更新双路径。
 * 真实 tmpdir + 真实 fs（pluginManifest.test.ts 同款 electron mock），不 mock fs。
 */
const ROOT = join(tmpdir(), 'frond-pluginstore-test')

vi.mock('electron', () => ({
  app: {
    getPath: () => ROOT,
    getAppPath: () => ROOT,
    isPackaged: false,
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import {
  importFromFolder,
  listPlugins,
  getPlugin,
  setPluginEnabled,
  setPluginOriginIfMissing,
  removePlugin
} from '../pluginStore'

const pluginRoot = () => join(ROOT, 'launcher-plugins')

const auditLines = (): Array<Record<string, unknown>> =>
  readFileSync(join(pluginRoot(), 'audit.jsonl'), 'utf-8')
    .trim()
    .split('\n')
    .map((l) => JSON.parse(l) as Record<string, unknown>)

function writeSource(id: string, version: string, permissions?: string[]): string {
  const dir = join(ROOT, 'src', id, version)
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'plugin.json'),
    JSON.stringify({ id, name: id, version, ...(permissions ? { permissions } : {}) })
  )
  return dir
}

beforeAll(() => {
  rmSync(ROOT, { recursive: true, force: true })
  mkdirSync(ROOT, { recursive: true })
})

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('importFromFolder 首装', () => {
  it('enabled:true + origin 落 installed.json + 审计 install', () => {
    const dir = writeSource('com.test.first', '1.0.0', ['clipboard.write'])
    const p = importFromFolder(dir, { origin: { kind: 'market', ref: 'bundled' } })
    expect(p.enabled).toBe(true)
    expect(p.origin).toEqual({ kind: 'market', ref: 'bundled' })
    expect(getPlugin('com.test.first')?.origin).toEqual({ kind: 'market', ref: 'bundled' })
    const entry = auditLines().find((a) => a.pluginId === 'com.test.first')
    expect(entry?.action).toBe('install')
    expect(entry?.toVersion).toBe('1.0.0')
    expect(entry?.origin).toEqual({ kind: 'market', ref: 'bundled' })
  })
})

describe('importFromFolder 更新（isUpdate，P-3.2 核心语义）', () => {
  it('保留启停状态与 installedAt，写 updatedAt；审计带 from/to', () => {
    const v1 = writeSource('com.test.upd', '1.0.0', ['clipboard.write'])
    importFromFolder(v1, { origin: { kind: 'market', ref: 'bundled' } })
    setPluginEnabled('com.test.upd', false)
    const before = getPlugin('com.test.upd')
    expect(before?.enabled).toBe(false)

    const v2 = writeSource('com.test.upd', '1.1.0', ['clipboard.write'])
    const updated = importFromFolder(v2, {
      origin: { kind: 'market', ref: 'bundled' },
      isUpdate: true
    })
    expect(updated.version).toBe('1.1.0')
    // 用户手动停用的插件不会被更新悄悄拉起（此前会）
    expect(updated.enabled).toBe(false)
    expect(listPlugins().find((p) => p.id === 'com.test.upd')?.enabled).toBe(false)
    expect(updated.installedAt).toBe(before?.installedAt)
    expect(updated.updatedAt).toBeDefined()
    expect((updated.updatedAt as number) >= (before?.installedAt as number)).toBe(true)

    const entry = auditLines().filter((a) => a.pluginId === 'com.test.upd').at(-1)
    expect(entry?.action).toBe('update')
    expect(entry?.fromVersion).toBe('1.0.0')
    expect(entry?.toVersion).toBe('1.1.0')
  })

  it('不带 isUpdate 的覆盖导入维持旧行为：enabled 重置 true（本地导入路径依赖此行为）', () => {
    const v1 = writeSource('com.test.legacy', '1.0.0')
    importFromFolder(v1)
    setPluginEnabled('com.test.legacy', false)
    const v2 = writeSource('com.test.legacy', '2.0.0')
    const p = importFromFolder(v2)
    expect(p.enabled).toBe(true)
    expect(p.updatedAt).toBeUndefined()
  })
})

describe('来源回填（P-3.4）', () => {
  it('缺失时写入，已有则不覆盖', () => {
    const dir = writeSource('com.test.backfill', '1.0.0')
    importFromFolder(dir, { origin: { kind: 'local' } })
    setPluginOriginIfMissing('com.test.backfill', { kind: 'builtin', ref: 'bundled' })
    // 已有 local origin，不覆盖
    expect(getPlugin('com.test.backfill')?.origin).toEqual({ kind: 'local' })

    // 手动造一条无 origin 的记录（模拟 P-3.4 之前的旧安装）：直接改盘上索引
    const dir2 = writeSource('com.test.old', '1.0.0')
    importFromFolder(dir2)
    const idxPath = join(pluginRoot(), 'installed.json')
    const raw = JSON.parse(readFileSync(idxPath, 'utf-8')) as Array<Record<string, unknown>>
    for (const rec of raw) {
      if (rec.id === 'com.test.old') delete rec.origin
    }
    writeFileSync(idxPath, JSON.stringify(raw))
    setPluginOriginIfMissing('com.test.old', { kind: 'builtin', ref: 'bundled' })
    expect(getPlugin('com.test.old')?.origin).toEqual({ kind: 'builtin', ref: 'bundled' })
  })
})

describe('卸载审计', () => {
  it('removePlugin 落 remove 审计（带版本与来源）', () => {
    const dir = writeSource('com.test.rm', '3.1.0', ['net'])
    importFromFolder(dir, { origin: { kind: 'dev', ref: '/dev/src' } })
    expect(getPlugin('com.test.rm')).toBeDefined()
    // removePlugin 会顺带清 KV；单测环境数据库未就绪，内部已容错
    removePlugin('com.test.rm')
    expect(getPlugin('com.test.rm')).toBeUndefined()
    const entry = auditLines().filter((a) => a.pluginId === 'com.test.rm').at(-1)
    expect(entry?.action).toBe('remove')
    expect(entry?.fromVersion).toBe('3.1.0')
  })
})
