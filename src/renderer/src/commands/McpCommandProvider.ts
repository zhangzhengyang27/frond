/**
 * Frond · MCP 工具命令提供者（P-4②「工具进根搜索」）
 *
 * 数据来自**主进程的工具清单缓存**（连上某个服务器时把 tools/list 落一次盘），
 * 所以这里**不会 spawn 任何东西**：唤起胶囊不该为「用户可能想跑个工具」付常驻子进程的代价。
 * 没连着的工具行照样列出来，回车那一刻才由主进程真连接（见 main/services/mcp/store.ts 的 runMcpTool）。
 */
import type { CommandEntry } from '@shared/commands'
import type { McpToolCommand } from '@shared/mcp'

/**
 * 一条工具 → 搜索框的一行。
 *
 * 为什么不进 Registry、而是像插件命令那样单独一路（P-4② 收尾时先做成 provider，又改回来）：
 * 命令表被**推送**刷新时只该重拉变了的那一路。挂在 Registry 的 fast 批里，一次 MCP 变化
 * 就得连着把系统命令、模块行、Quicklinks 全重算一遍；而单独一路的刷新代价是一条 IPC。
 * 插件命令早就在这个位置上，两路口径一致。
 */
export function mcpToolToEntry(c: McpToolCommand): CommandEntry {
  return {
    // key 里带服务器 id：两台服务器有同名工具是常态，撞了不只是多一行，
    // 收藏 / 使用统计 / 用户别名全按 key 存，会劈成两半或者互相顶掉
    key: `mcp:${c.serverId}:${c.tool}`,
    title: c.tool,
    // 参数填不满这件事必须**看得见**：摆一条提交上去会被服务器拒的工具而不说一句，
    // 用户只会觉得「这个工具坏了」。schema 里丢掉的参数个数直接进副标题。
    subtitle: [
      c.serverLabel,
      c.description,
      c.droppedArgs > 0 ? `另有 ${c.droppedArgs} 个参数不支持在这里填` : ''
    ]
      .filter(Boolean)
      .join(' · '),
    icon: 'tools',
    badge: 'MCP',
    // 服务器名与 id 当别名：中文名工具打不出全名时，用「服务器名 + 尾巴」也能命中
    aliases: [c.serverLabel, c.serverId],
    acceptsArgs: c.args.length > 0,
    action: {
      type: 'mcpTool',
      serverId: c.serverId,
      serverLabel: c.serverLabel,
      tool: c.tool,
      args: c.args
    }
  }
}

/** 读一次工具清单（主进程只读缓存，不 spawn）；通道不存在或读失败就一行都不出 */
export async function loadMcpToolEntries(): Promise<CommandEntry[]> {
  try {
    const list = (await window.api.ai.mcpToolCommands()) as McpToolCommand[]
    return list.map(mcpToolToEntry)
  } catch {
    // 主进程没这条通道（旧构建）或读缓存失败：MCP 那一行都不出，别的源照常
    return []
  }
}
