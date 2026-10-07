import { describe, it, expect, beforeAll, afterAll, vi } from 'vitest'
import { mkdirSync, rmSync, writeFileSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * P-3.2 静默更新的权限闸与可更新清单（端到端小集成）：
 * 真实 tmpdir 当「应用根」——打包索引 plugins.json + 同目录插件源目录，
 * 走 market 的 dir 形态（无网络）。electron mock 只给路径。
 */
const ROOT = join(tmpdir(), 'frond-market-silent-test')

vi.mock('electron', () => ({
  app: {
    getPath: () => ROOT,
    getAppPath: () => ROOT,
    isPackaged: false,
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import { computePluginUpdates, installFromMarket } from '../market'
import { getPlugin, importFromFolder, setPluginEnabled } from '../pluginStore'

const bundledSrc = (version: string, permissions: string[]): string => {
  const dir = join(ROOT, 'com.silent.a')
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    join(dir, 'plugin.json'),
    JSON.stringify({ id: 'com.silent.a', name: 'Silent A', version, permissions })
  )
  return dir
}

const auditActions = (): string[] => {
  try {
    return readFileSync(join(ROOT, 'launcher-plugins', 'audit.jsonl'), 'utf-8')
      .trim()
      .split('\n')
      .map((l) => (JSON.parse(l) as { action: string }).action)
  } catch {
    return []
  }
}

beforeAll(() => {
  rmSync(ROOT, { recursive: true, force: true })
  mkdirSync(ROOT, { recursive: true })
  // 打包索引（marketIndexPath = ROOT/plugins.json）：dir 形态条目
  writeFileSync(
    join(ROOT, 'plugins.json'),
    JSON.stringify({
      version: 1,
      plugins: [{ id: 'com.silent.a', name: 'Silent A', version: '1.1.0', download: './com.silent.a' }]
    })
  )
  // 已装 v1.0.0（同 id），用户已手动停用
  bundledSrc('1.1.0', ['clipboard.write'])
  const seed = join(ROOT, 'seed', 'com.silent.a')
  mkdirSync(seed, { recursive: true })
  writeFileSync(
    join(seed, 'plugin.json'),
    JSON.stringify({
      id: 'com.silent.a',
      name: 'Silent A',
      version: '1.0.0',
      permissions: ['clipboard.write']
    })
  )
  importFromFolder(seed, { origin: { kind: 'market', ref: 'bundled' } })
  setPluginEnabled('com.silent.a', false)
})

afterAll(() => {
  rmSync(ROOT, { recursive: true, force: true })
})

describe('computePluginUpdates（P-3.2 徽标数据源）', () => {
  it('已装 1.0.0 对索引 1.1.0 → 唯一可更新条目，带当前/新版本与来源', () => {
    expect(computePluginUpdates()).toEqual([
      {
        id: 'com.silent.a',
        name: 'Silent A',
        currentVersion: '1.0.0',
        newVersion: '1.1.0',
        source: 'bundled'
      }
    ])
  })
})

describe('installFromMarket 静默模式（自动更新专用权限闸）', () => {
  it('新版本多声明权限 → blocked 且不落盘（启停/版本原样）', async () => {
    bundledSrc('1.1.0', ['clipboard.write', 'net'])
    const result = await installFromMarket('com.silent.a', { silent: true })
    expect(result.success).toBe(false)
    expect(result.blocked).toBe(true)
    expect(result.addedPermissions).toEqual(['net'])
    const p = getPlugin('com.silent.a')
    expect(p?.version).toBe('1.0.0')
    expect(p?.enabled).toBe(false)
    expect(auditActions().filter((a) => a === 'update')).toHaveLength(0)
  })

  it('权限不变 → 静默更新成功，保留停用状态与安装时间，来源/审计落盘', async () => {
    bundledSrc('1.1.0', ['clipboard.write'])
    const before = getPlugin('com.silent.a')
    const result = await installFromMarket('com.silent.a', { silent: true })
    expect(result.success).toBe(true)
    const p = getPlugin('com.silent.a')
    expect(p?.version).toBe('1.1.0')
    expect(p?.enabled).toBe(false)
    expect(p?.installedAt).toBe(before?.installedAt)
    expect(p?.updatedAt).toBeDefined()
    expect(p?.origin).toEqual({ kind: 'market', ref: 'bundled' })
    expect(auditActions()).toContain('update')
    // 更新完成后可更新清单清空
    expect(computePluginUpdates()).toEqual([])
  })
})
