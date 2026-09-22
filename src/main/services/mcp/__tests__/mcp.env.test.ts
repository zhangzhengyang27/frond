import { describe, it, expect, beforeEach, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * env 保留规则（P-4②）。
 *
 * 为什么单独钉：渲染端拿到的配置里**没有 env 值**（可能装着 token），
 * 界面上的 JSON 编辑器回传时通常不带 env。如果不沿用本机原值，
 * 用户「只是改个 label」就会把凭据洗掉——这种坏法没有任何报错。
 */
const __userData = join(mkdtempSync(join(tmpdir(), 'leaf-mcp-store-')), 'userData')
vi.mock('electron', () => ({
  app: { getPath: () => __userData, getVersion: () => '0.0.0-test', isReady: () => true },
  ipcMain: { handle: () => {} },
  BrowserWindow: { getAllWindows: () => [] }
}))

import Database from 'better-sqlite3'
import { migrations } from '../../../db/migrations'
import { database } from '../../../db/database'
import { readMcpServers, sanitizeMcpServers, saveMcpServers, mcpOverview } from '../store'

function freshDb(): Database.Database {
  const db = new Database(':memory:')
  for (const m of migrations) {
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
  }
  return db
}

beforeEach(() => {
  ;(database as unknown as { db: Database.Database | null }).db = freshDb()
})
describe('sanitize 与 env 保留的接口约定', () => {
  it('未显式带 env 的条目清洗后是空对象（保留动作由 saveMcpServers 负责）', () => {
    const { servers } = sanitizeMcpServers([{ id: 'a', command: 'node' }])
    expect(servers[0].env).toEqual({})
  })

  it('显式带 env 的条目原样收下（值保留、非法键丢掉）', () => {
    const { servers } = sanitizeMcpServers([
      { id: 'a', command: 'node', env: { TOK: 'v', 'bad key': 'x' } }
    ])
    expect(servers[0].env).toEqual({ TOK: 'v' })
  })

  it('两条都有 env 时键集合不同也能区分（合并逻辑按 id 走）', () => {
    const { servers } = sanitizeMcpServers([
      { id: 'a', command: 'node', env: { A_TOKEN: '1' } },
      { id: 'b', command: 'node', env: { B_TOKEN: '2' } }
    ])
    expect(servers.map((s) => Object.keys(s.env))).toEqual([['A_TOKEN'], ['B_TOKEN']])
  })
})

describe('saveMcpServers：改 label 不能洗掉凭据', () => {
  it('回传不带 env → 沿用本机原值；带 env → 替换；删掉服务器 → env 一起消失', () => {
    saveMcpServers([{ id: 'a', command: 'node', label: '原名', env: { TOK: 'secret' } }])
    expect(readMcpServers()[0].env).toEqual({ TOK: 'secret' })

    // 界面只改了 label，没带 env 字段
    saveMcpServers([{ id: 'a', command: 'node', label: '新名' }])
    expect(readMcpServers()[0]).toMatchObject({ label: '新名', env: { TOK: 'secret' } })

    // 显式带 env（哪怕是空对象）按新值走：这是用户主动清凭据
    saveMcpServers([{ id: 'a', command: 'node', label: '新名', env: {} }])
    expect(readMcpServers()[0].env).toEqual({})

    saveMcpServers([{ id: 'a', command: 'node', label: '新名', env: { OTHER: 'x' } }])
    expect(readMcpServers()[0].env).toEqual({ OTHER: 'x' })

    saveMcpServers([])
    expect(readMcpServers()).toEqual([])
  })

  it('公开形态里永远看不到 env 值', () => {
    const { servers } = saveMcpServers([{ id: 'a', command: 'node', env: { TOK: 'secret' } }])
    expect(servers[0]).not.toHaveProperty('env')
    expect(servers[0].envKeys).toEqual(['TOK'])
    // 总览接口同样不能漏：它是设置页唯一的数据源
    expect(JSON.stringify(mcpOverview())).not.toContain('secret')
  })
})
