/**
 * Leaf · MCP 的跨进程类型（P-4②「工具进根搜索」）
 *
 * 放 shared 是因为**两侧都要认这份形状**：主进程从 `inputSchema` 里算出参数表，
 * 胶囊拿它决定排几格参数、⌘K 面板拿它拼副标题。类型留在 main 里的话
 * shared 的 `CommandAction` 就得反向 import 主进程（分层漏了）。
 *
 * 只列**能填的标量类型**：array / object / 联合类型 / enum 一律不进命令表
 * （见 main/services/mcp/protocol.ts 的 toolArgSpecs），所以这里没有它们的表达。
 */

export type McpArgType = 'string' | 'number' | 'integer' | 'boolean'

/** 一个可填参数（`toolArgSpecs` 的输出单元） */
export interface McpToolArg {
  name: string
  type: McpArgType
  /** 界面上的占位文案（schema 里的 description，没有就用 name） */
  description: string
  required: boolean
}

/**
 * 一条「工具命令」：胶囊结果行背后的全部信息。
 * 出自主进程缓存（连上某服务器时把 tools/list 结果存下来），
 * 所以**没连着的服务器也能在搜索框里看到它的工具**——回车时才按需起进程。
 */
export interface McpToolCommand {
  serverId: string
  serverLabel: string
  tool: string
  description: string
  args: McpToolArg[]
  /** schema 里被丢掉、界面无从填的参数个数（如实说明「另有 N 个参数不支持」） */
  droppedArgs: number
}
