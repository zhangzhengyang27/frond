/**
 * Leaf · MCP 工具命令提供者（P-4②「工具进根搜索」）
 *
 * 数据来自**主进程的工具清单缓存**（连上某个服务器时把 tools/list 落一次盘），
 * 所以这里**不会 spawn 任何东西**：唤起胶囊不该为「用户可能想跑个工具」付常驻子进程的代价。
 * 没连着的工具行照样列出来，回车那一刻才由主进程真连接（见 main/services/mcp/store.ts 的 runMcpTool）。
 */
import type { Command, CommandProvider } from '@shared/commandRegistry'
import type { McpToolCommand } from '@shared/mcp'

export function mcpToolToCommand(c: McpToolCommand): Command {
  return {
    // key 里带服务器 id：两台服务器有同名工具是常态，撞了不只是多一行，
    // 收藏 / 使用统计 / 用户别名全按 key 存，会劈成两半或者互相顶掉
    id: `mcp:${c.serverId}:${c.tool}`,
    title: c.tool,
    subtitle: c.description ? `${c.serverLabel} · ${c.description}` : c.serverLabel,
    icon: 'tools',
    category: 'extension',
    badge: 'MCP',
    keywords: [c.serverLabel, c.serverId],
    acceptsArgs: c.args.length > 0,
    actions: [
      {
        type: 'mcpTool',
        serverId: c.serverId,
        serverLabel: c.serverLabel,
        tool: c.tool,
        args: c.args
      }
    ]
  }
}

export function createMcpCommandProvider(): CommandProvider {
  return {
    id: 'mcp',
    categories: ['extension'],
    reactive: false,
    async getCommands(): Promise<Command[]> {
      try {
        const list = (await window.api.ai.mcpToolCommands()) as McpToolCommand[]
        return list.map(mcpToolToCommand)
      } catch {
        // 主进程没这条通道（旧构建）或读缓存失败：MCP 那一行都不出，别的源照常
        return []
      }
    }
  }
}
