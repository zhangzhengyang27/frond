import { describe, it, expect, afterAll } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  createFrameParser,
  encodeMessage,
  parseInitializeResult,
  parseToolCallResult,
  parseToolList,
  requiredArgNames,
  MAX_FRAME_BYTES
} from '../protocol'
import { connectServer, callToolOnServer, serverViews, stopAllServers } from '../client'
import { sanitizeMcpServers } from '../store'

/**
 * MCP 客户端最小面（P-4②）。
 *
 * 分两层：协议纯函数（含畸形输入），以及**真 spawn 一个 node 子进程**当服务器——
 * 分帧、id 配对、服务器往 stdout 混打日志这三种坏法，mock 是测不出来的。
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const FIXTURE = join(__dirname, 'fixtures', 'fixture-server.mjs')

function spawnFixture(mode: string) {
  return connectServer({
    id: `fx-${mode}`,
    command: process.execPath,
    args: [FIXTURE],
    env: { MCP_FIXTURE_MODE: mode }
  })
}

afterAll(() => stopAllServers())

describe('protocol：分帧与解析', () => {
  it('半截帧留着等下一块，一次多块全交付', () => {
    const f = createFrameParser()
    expect(f.push('{"a":1').frames).toEqual([])
    const r = f.push('}\n{"b":2}\n{"c":3}\n')
    expect(r.error).toBeNull()
    expect(r.frames).toEqual(['{"a":1}', '{"b":2}', '{"c":3}'])
  })

  it('单帧超限直接 fatal（服务器狂吐不能把主进程撑爆）', () => {
    const f = createFrameParser()
    const r = f.push(`${'x'.repeat(MAX_FRAME_BYTES + 10)}\n`)
    expect(r.error).toMatch(/上限/)
  })

  it('未闭合的长流也判 fatal', () => {
    const f = createFrameParser()
    const r = f.push('x'.repeat(MAX_FRAME_BYTES + 10))
    expect(r.error).toMatch(/未闭合/)
  })

  it('encodeMessage 结尾带换行（协议要求行分隔）', () => {
    expect(encodeMessage({ a: 1 })).toBe('{"a":1}\n')
  })

  it('initialize 响应形态不认识就返回 null，不猜', () => {
    expect(
      parseInitializeResult({
        result: { protocolVersion: '2025-06-18', serverInfo: { name: 'x' } }
      })
    ).toEqual({ protocolVersion: '2025-06-18', serverName: 'x' })
    expect(parseInitializeResult({ result: { serverInfo: {} } })).toBeNull()
    expect(parseInitializeResult({ error: {} })).toBeNull()
    expect(parseInitializeResult(null)).toBeNull()
  })

  it('工具清单：非法条目逐条剔除并计数，不静默少几个', () => {
    const { tools, skipped } = parseToolList({
      result: {
        tools: [
          { name: 'ok_tool', description: 'd', inputSchema: { type: 'object' } },
          { name: '../escape' },
          { name: '' },
          { description: '缺 name' },
          null,
          'string',
          { name: 'ok_two' }
        ]
      }
    })
    expect(tools.map((t) => t.name)).toEqual(['ok_tool', 'ok_two'])
    expect(skipped).toBe(5)
    // inputSchema 缺失时补空对象，界面按「无必填」处理
    expect(tools[1].inputSchema).toEqual({})
    expect(tools[1].description).toBe('')
  })

  it('非数组的 tools 不当成空列表蒙混（调用方据此报错）', () => {
    expect(parseToolList({ result: { tools: 'nope' } })).toEqual({ tools: [], skipped: 0 })
  })

  it('结果只收 text，其它形态如实计数', () => {
    const r = parseToolCallResult({
      result: { content: [{ type: 'text', text: 'a' }, { type: 'image' }, { type: 'text', text: 'b' }] }
    })
    expect(r).toMatchObject({ ok: true, text: 'a\nb', ignoredContent: 1 })
  })

  it('isError 与 JSON-RPC error 都是失败，并带上原因', () => {
    expect(parseToolCallResult({ result: { isError: true, content: [{ type: 'text', text: '炸了' }] } })).toMatchObject({
      ok: false,
      error: '炸了'
    })
    expect(parseToolCallResult({ error: { message: 'not found' } })).toMatchObject({
      ok: false,
      error: 'not found'
    })
    expect(parseToolCallResult({}).error).toContain('result')
  })

  it('必填参数名取出来给界面用，形状不对就空', () => {
    expect(requiredArgNames({ required: ['a', 1, 'b'] })).toEqual(['a', 'b'])
    expect(requiredArgNames({})).toEqual([])
    expect(requiredArgNames(undefined)).toEqual([])
  })
})

describe('client：真 spawn node 跑夹具服务器', () => {
  it('握手 + 列工具：非法工具计数如实带回', async () => {
    const view = await spawnFixture('normal')
    expect(view.status).toBe('ready')
    expect(view.serverName).toBe('fixture-mcp')
    expect(view.protocolVersion).toBe('2025-06-18')
    expect(view.tools.map((t) => t.name)).toEqual(['echo', 'ping_no_args'])
    expect(view.skipped).toBe(3)
    stopAllServers()
  })

  it('混进 stdout 的日志行与非 JSON 行不能打乱 id 配对', async () => {
    const view = await spawnFixture('garbage')
    expect(view.status).toBe('ready')
    expect(view.tools.map((t) => t.name)).toEqual(['echo', 'ping_no_args'])
    stopAllServers()
  })

  it('tools/call 走通并回文本，图片内容如实报「忽略了 1 个」', async () => {
    const view = await spawnFixture('normal')
    expect(view.status).toBe('ready')
    const res = await callToolOnServer('fx-normal', 'echo', { msg: 'hi' })
    expect(res).toMatchObject({ ok: true, text: 'echo:hi', ignoredContent: 1 })
    stopAllServers()
  })

  it('未连接的 id 调用直接失败，不吊着', async () => {
    const res = await callToolOnServer('nope', 'echo', {})
    expect(res.ok).toBe(false)
    expect(res.error).toContain('未连接')
  })

  it('单帧超限 → 会话判死并带上原因', async () => {
    const view = await spawnFixture('hugeframe')
    expect(view.status).toBe('error')
    expect(view.error).toMatch(/上限/)
    stopAllServers()
  })

  it('tools 不是数组 → 明确报形态不认识，不当成「这个服务器没有工具」', async () => {
    const view = await spawnFixture('badtools')
    expect(view.status).toBe('error')
    expect(view.error).toContain('不认识')
  })

  it('命令不存在 → error 状态而不是抛出，进程也不留', async () => {
    const view = await connectServer({ id: 'bad', command: 'definitely-not-a-binary-xyz' })
    expect(view.status).toBe('error')
    expect(view.error).toBeTruthy()
    expect(serverViews().find((v) => v.id === 'bad')?.status).not.toBe('ready')
  })

  it('空命令直接拒，不 spawn', async () => {
    const view = await connectServer({ id: 'empty', command: '   ' })
    expect(view.status).toBe('error')
    expect(view.error).toBe('命令为空')
  })

  it('服务器不回应 → 握手超时后判死（这条要等 10s，但「吊着不返回」是真实风险）', async () => {
    const view = await spawnFixture('silent')
    expect(view.status).toBe('error')
    expect(view.error).toContain('超时')
  }, 15_000)
})

describe('sanitizeMcpServers：这是本机执行命令的清单，清洗从严', () => {
  const ok = { id: 'demo', label: 'Demo', command: 'node', args: ['server.js'], env: { TOK: 'x' }, enabled: true }

  it('合法配置通过并保留 env 值', () => {
    const { servers, rejected } = sanitizeMcpServers([ok])
    expect(servers[0]).toMatchObject({ id: 'demo', command: 'node', args: ['server.js'], enabled: true })
    expect(servers[0].env.TOK).toBe('x')
    expect(rejected).toEqual([])
  })

  it('id 非法 / 重复 / 非对象 逐条剔除并给原因', () => {
    const { servers, rejected } = sanitizeMcpServers([
      { ...ok, id: 'Bad ID' },
      ok,
      { ...ok, label: '第二次' },
      'nope'
    ])
    expect(servers.map((s) => s.id)).toEqual(['demo'])
    expect(rejected.map((r) => r.reason).join(' ')).toMatch(/id 非法/)
    expect(rejected.map((r) => r.reason).join(' ')).toMatch(/id 重复/)
  })

  it('把「命令 + 参数」整串塞进 command 的写法直接拒收（我们不开 shell，那样只会变成找不到的可执行文件）', () => {
    const { servers, rejected } = sanitizeMcpServers([{ ...ok, command: 'node server.js' }])
    expect(servers).toHaveLength(0)
    expect(rejected[0].reason).toContain('参数放 args')
  })

  it('空 command 剔除；args 与 env 有上限；非字符串 env 键丢掉', () => {
    const r = sanitizeMcpServers([
      { ...ok, command: '  ' },
      {
        ...ok,
        id: 'big',
        args: Array.from({ length: 100 }, (_, i) => `a${i}`),
        env: { GOOD: '1', 'bad key': '2', 123: '3' }
      }
    ])
    expect(r.rejected[0].reason).toBe('command 为空')
    expect(r.servers[0].args).toHaveLength(32)
    expect(Object.keys(r.servers[0].env)).toEqual(['GOOD'])
  })

  it('enabled 缺省为 true，显式 false 才停用；label 缺省取 id', () => {
    const { servers } = sanitizeMcpServers([{ id: 'a', command: 'node' }])
    expect(servers[0]).toMatchObject({ id: 'a', label: 'a', enabled: true, args: [] })
  })

  it('超过 12 个服务器的部分剔除（每个都是一个常驻子进程的额度）', () => {
    const many = Array.from({ length: 15 }, (_, i) => ({ ...ok, id: `s${i}` }))
    const r = sanitizeMcpServers(many)
    expect(r.servers).toHaveLength(12)
    expect(r.rejected.length).toBe(3)
  })

  it('整体不是数组 → 一条不收并说明', () => {
    expect(sanitizeMcpServers({})).toMatchObject({ servers: [], rejected: [{ index: -1, reason: '不是数组' }] })
  })
})
