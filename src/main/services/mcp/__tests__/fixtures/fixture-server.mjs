#!/usr/bin/env node
/**
 * MCP 测试夹具服务器（P-4②）
 *
 * 真的走 spawn + stdio + 换行 JSON-RPC，不用 mock：客户端里最容易坏的是分帧、
 * id 配对与「服务器一边说话一边打日志」这三种情况，只有真进程能测到。
 *
 * 环境变量控制行为，让一个夹具覆盖多种路径：
 *   MCP_FIXTURE_MODE=normal|garbage|silent|hugeframe|badtools
 */
const mode = process.env.MCP_FIXTURE_MODE ?? 'normal'
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 夹具不写 TS 注解
const out = (obj) => process.stdout.write(JSON.stringify(obj) + '\n')

const TOOLS = [
  {
    name: 'echo',
    description: '把参数原样回报',
    inputSchema: { type: 'object', properties: { msg: { type: 'string' } } }
  },
  {
    name: 'ping_no_args',
    description: '无需参数',
    inputSchema: { type: 'object', properties: {} }
  },
  // 非法名：客户端应当逐条剔除并回报 skipped
  { name: '../escape', description: '恶意名', inputSchema: {} },
  { name: '', description: '空名', inputSchema: {} },
  // 没有 name 的整条也剔除
  { description: '缺 name' }
]

process.stdin.on('data', (chunk) => {
  const lines = String(chunk)
    .split('\n')
    .filter((l) => l.trim() !== '')
  for (const line of lines) {
    let msg
    try {
      msg = JSON.parse(line)
    } catch {
      continue
    }
    if (mode === 'silent') continue // 收了不回：测超时
    if (mode === 'hugeframe' && msg.method === 'tools/list') {
      process.stdout.write('x'.repeat(5 * 1024 * 1024) + '\n')
      continue
    }
    if (mode === 'garbage') {
      // 服务器把人类日志打到 stdout（MCP 不允许，但现实里常见）：客户端必须忽略非 JSON 行
      process.stdout.write('INFO: 启动中…\n')
      out({ jsonrpc: '2.0', id: msg.id, result: garbageResult(msg) })
      continue
    }
    out({ jsonrpc: '2.0', id: msg.id, result: garbageResult(msg) })
    // 通知类（无 id）也要能混进来而不打乱配对
    if (msg.method === 'tools/list')
      process.stdout.write(
        JSON.stringify({ jsonrpc: '2.0', method: 'notifications/progress' }) + '\n'
      )
  }
})

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- .mjs 夹具不写 TS 注解
function garbageResult(msg) {
  if (msg.method === 'initialize') {
    return {
      protocolVersion: '2025-06-18',
      capabilities: { tools: {} },
      serverInfo: { name: 'fixture-mcp', version: '9.9' }
    }
  }
  if (msg.method === 'tools/list') {
    return { tools: mode === 'badtools' ? 'not-an-array' : TOOLS }
  }
  if (msg.method === 'tools/call') {
    const args = msg.params?.arguments ?? {}
    return {
      content: [
        { type: 'text', text: `echo:${args.msg ?? '-'}` },
        { type: 'image', data: 'AAA', mimeType: 'image/png' }
      ]
    }
  }
  return {}
}
