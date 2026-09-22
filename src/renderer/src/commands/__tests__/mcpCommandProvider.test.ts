import { describe, it, expect } from 'vitest'
import { mcpToolToCommand } from '../McpCommandProvider'
import { commandToEntry } from '../CommandLoader'
import type { McpToolCommand } from '@shared/mcp'

/**
 * 主进程那份工具清单 → 搜索框的一行（P-4②「工具进根搜索」）。
 * 只测映射：key 的组成、副标题里必须看得见「有几个参数填不了」、acceptsArgs 的口径。
 */
const tool = (over: Partial<McpToolCommand>): McpToolCommand => ({
  serverId: 'srv',
  serverLabel: '本地服务器',
  tool: 'echo',
  description: '把参数原样回报',
  args: [{ name: 'msg', type: 'string', description: '要发的话', required: true }],
  droppedArgs: 0,
  ...over
})

describe('mcpToolToCommand', () => {
  it('key 带服务器 id，动作带全套执行信息（两台服务器有同名工具是常态）', () => {
    const c = mcpToolToCommand(tool({}))
    expect(c.id).toBe('mcp:srv:echo')
    expect(c.actions[0]).toEqual({
      type: 'mcpTool',
      serverId: 'srv',
      serverLabel: '本地服务器',
      tool: 'echo',
      args: [{ name: 'msg', type: 'string', description: '要发的话', required: true }]
    })
  })

  it('有参数才 acceptsArgs（决定「命令 + 尾部参数」那种查询写法能不能命中这条）', () => {
    expect(mcpToolToCommand(tool({})).acceptsArgs).toBe(true)
    expect(mcpToolToCommand(tool({ args: [] })).acceptsArgs).toBe(false)
  })

  it('填不了的参数个数写进副标题：不写就是「这条命令按下去必失败还看不出原因」', () => {
    expect(mcpToolToCommand(tool({ droppedArgs: 0 })).subtitle).toBe('本地服务器 · 把参数原样回报')
    expect(mcpToolToCommand(tool({ droppedArgs: 2 })).subtitle).toBe(
      '本地服务器 · 把参数原样回报 · 另有 2 个参数不支持在这里填'
    )
    expect(mcpToolToCommand(tool({ description: '', droppedArgs: 0 })).subtitle).toBe(
      '本地服务器'
    )
  })

  it('适配器把参数化标记与徽标原样搬到 CommandEntry（搜索用的是条目不是 Command）', () => {
    const entry = commandToEntry(mcpToolToCommand(tool({})))
    expect(entry).toMatchObject({
      key: 'mcp:srv:echo',
      title: 'echo',
      badge: 'MCP',
      icon: 'tools',
      acceptsArgs: true
    })
  })
})
