import { describe, it, expect, beforeEach, vi, afterAll } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * MCP 工具进根搜索（P-4② 收尾）——主进程这一侧的三件事：
 * 参数表怎么从 inputSchema 里算出来、缓存与命令表、以及「回车那一刻」的执行门槛。
 *
 * 存储用真 sqlite（in-memory）而不是 mock prefRepository：这份缓存的坏法恰恰是
 * 「写进去的形状读出来不一样」，mock 掉读路径就什么都测不到。
 */
const __userData = join(mkdtempSync(join(tmpdir(), 'frond-mcp-tools-')), 'userData')
vi.mock('electron', () => ({
  app: { getPath: () => __userData, getVersion: () => '0.0.0-test', isReady: () => true },
  ipcMain: { handle: () => {} },
  BrowserWindow: { getAllWindows: () => [] }
}))

import Database from 'better-sqlite3'
import { migrations } from '../../../db/migrations'
import { database } from '../../../db/database'
import { coerceToolArgs, toolArgSpecs } from '../protocol'
import { stopAllServers } from '../client'
import { mcpToolCommands, runMcpTool, saveMcpServers, writeMcpServers } from '../store'
import { prefRepository } from '../../../db/repos'

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'fixtures', 'fixture-server.mjs')

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

afterAll(() => stopAllServers())

describe('toolArgSpecs：inputSchema → 能填的参数表', () => {
  it('只留顶层标量参数，必填的排前面，丢掉的计数', () => {
    const { args, dropped } = toolArgSpecs({
      type: 'object',
      properties: {
        city: { type: 'string', description: '城市名' },
        nested: { type: 'object' },
        count: { type: 'integer' },
        list: { type: 'array' },
        flag: { type: 'boolean' }
      },
      required: ['count']
    })
    expect(dropped).toBe(2)
    expect(args.map((a) => [a.name, a.type, a.required])).toEqual([
      ['count', 'integer', true],
      ['city', 'string', false],
      ['flag', 'boolean', false]
    ])
    expect(args[1].description).toBe('城市名')
  })

  it('type 写成数组（联合类型）按不支持处理，不猜哪个', () => {
    const { args, dropped } = toolArgSpecs({
      properties: { when: { type: ['string', 'null'] } }
    })
    expect(args).toEqual([])
    expect(dropped).toBe(1)
  })

  it('没有 properties / schema 缺失都是空表（不当成「有一个匿名参数」）', () => {
    expect(toolArgSpecs(undefined)).toEqual({ args: [], dropped: 0 })
    expect(toolArgSpecs({ type: 'object' })).toEqual({ args: [], dropped: 0 })
    expect(toolArgSpecs({ properties: 'nope' })).toEqual({ args: [], dropped: 0 })
  })

  it('参数格封顶 6 个（第 7 个起连表单都摆不下）', () => {
    const props: Record<string, unknown> = {}
    for (let i = 0; i < 9; i++) props[`p${i}`] = { type: 'string' }
    const { args, dropped } = toolArgSpecs({ properties: props })
    expect(args).toHaveLength(6)
    expect(dropped).toBe(3)
  })
})

describe('coerceToolArgs：界面交的字符串 → 服务器要的 JSON', () => {
  const specs = toolArgSpecs({
    properties: {
      n: { type: 'number' },
      i: { type: 'integer' },
      b: { type: 'boolean' },
      s: { type: 'string' }
    },
    required: ['s']
  }).args

  it('数字与布尔按类型转，字符串原样（含首尾空格）', () => {
    expect(coerceToolArgs(specs, { n: '1.5', i: '42', b: 'yes', s: '  hi  ' })).toEqual({
      n: 1.5,
      i: 42,
      b: true,
      s: '  hi  '
    })
  })

  it('空串 = 没填，整个键不发', () => {
    expect(coerceToolArgs(specs, { n: '', s: 'x' })).toEqual({ s: 'x' })
  })

  it('转不动的原样发过去让服务器说，而不是静默丢掉这个参数', () => {
    // 静默丢参数 = 工具按「没传这个参数」的语义跑了，用户看到的是错的结果
    const r = coerceToolArgs(specs, { i: 'abc', n: '1e5', b: 'maybe' })
    expect(r).toEqual({ i: 'abc', n: 100000, b: 'maybe' })
  })

  it('schema 里没列出的键一律不发（渲染端多塞的在这里被丢掉）', () => {
    expect(coerceToolArgs(specs, { s: 'v', injected: 'x' })).toEqual({ s: 'v' })
  })
})

describe('工具清单缓存 → 命令表', () => {
  it('真连一次就把工具落进缓存，命令表读缓存不需要活会话', async () => {
    saveMcpServers([{ id: 'fx', label: '夹具', command: process.execPath, args: [FIXTURE] }])
    const view = await import('../store').then((m) => m.connectById('fx'))
    expect(view.status).toBe('ready')
    const rows = mcpToolCommands()
    expect(rows.map((r) => r.tool)).toEqual(['echo', 'ping_no_args'])
    expect(rows[0]).toMatchObject({ serverId: 'fx', serverLabel: '夹具' })
    expect(rows[0].args.map((a) => a.name)).toEqual(['msg'])
    // 停掉会话之后命令表照旧（这就是缓存存在的意义：胶囊唤起不该 spawn）
    stopAllServers()
    expect(mcpToolCommands().map((r) => r.tool)).toEqual(['echo', 'ping_no_args'])
  })

  it('服务器停用 = 它的工具一条都不出（摆一条回车必失败的行是噪音）', () => {
    writeMcpServers([
      {
        id: 'on',
        label: '开着',
        command: 'node',
        args: [],
        env: {},
        enabled: true
      },
      { id: 'off', label: '关了', command: 'node', args: [], env: {}, enabled: false }
    ])
    prefRepository.set(
      'mcp.toolCache',
      JSON.stringify({
        on: { label: '开着', cachedAt: 1, tools: [{ name: 't1', description: '', args: [], droppedArgs: 0 }] },
        off: { label: '关了', cachedAt: 1, tools: [{ name: 't2', description: '', args: [], droppedArgs: 0 }] }
      })
    )
    expect(mcpToolCommands().map((r) => r.serverId)).toEqual(['on'])
  })

  it('配置里删掉的服务器，缓存跟着删（否则命令表会留一条再也跑不动的行）', async () => {
    writeMcpServers([{ id: 'fx', label: '夹具', command: 'node', args: [], env: {}, enabled: true }])
    const store = await import('../store')
    store.cacheTools({ id: 'fx', label: '夹具' }, [{ name: 'keep', description: '', inputSchema: {} }])
    expect(mcpToolCommands().map((r) => r.tool)).toEqual(['keep'])
    saveMcpServers([{ id: 'other', command: 'node' }])
    expect(mcpToolCommands()).toEqual([])
    expect(JSON.parse(prefRepository.get('mcp.toolCache') ?? '{}').fx).toBeUndefined()
  })
})

describe('runMcpTool：回车那一刻的门槛', () => {
  it('配置里没有这个 id → 说清楚，不去 spawn 任何东西', async () => {
    const r = await runMcpTool('ghost', 'echo', { msg: 'hi' })
    expect(r).toMatchObject({ ok: false, error: '配置里没有这个服务器' })
  })

  it('已停用的服务器不连接也不执行', async () => {
    writeMcpServers([{ id: 'fx', label: '夹具', command: 'node', args: [], env: {}, enabled: false }])
    const r = await runMcpTool('fx', 'echo', { msg: 'hi' })
    expect(r.ok).toBe(false)
    expect(r.error).toContain('停用')
  })

  it('真连接后按名执行，参数按 schema 定型（未连接时那一次回车会先把它连上）', async () => {
    saveMcpServers([{ id: 'fx', label: '夹具', command: process.execPath, args: [FIXTURE] }])
    const r = await runMcpTool('fx', 'echo', { msg: '你好' })
    expect(r).toMatchObject({ ok: true })
    expect(r.text).toBe('echo:你好')
    // 夹具每次调用都回一张图片：本期只渲染 text，但必须如实报数
    expect(r.ignoredContent).toBe(1)
  })

  it('活会话里没有这个工具名 → 拒（缓存过期不能变成让服务器随便收名字）', async () => {
    saveMcpServers([{ id: 'fx', label: '夹具', command: process.execPath, args: [FIXTURE] }])
    const r = await runMcpTool('fx', 'dropped_tool', {})
    expect(r.ok).toBe(false)
    expect(r.error).toMatch(/服务器上没有工具「dropped_tool」/)
  })

  it('多余的参数键发不出去（界面只该给 schema 里那些格）', async () => {
    saveMcpServers([{ id: 'fx', label: '夹具', command: process.execPath, args: [FIXTURE] }])
    const r = await runMcpTool('fx', 'echo', { msg: 'ok', msg2: 'x' } as Record<string, string>)
    expect(r.ok).toBe(true)
    expect(r.text).toBe('echo:ok')
  })
})
