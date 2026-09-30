/**
 * Frond · MCP 类型定义（批 7a 循环依赖拆解）
 *
 * 从 store.ts 拆出：mcpConfirm 只需要类型（import type），但 madge 把指向 store 的
 * 类型边也算环成员——类型独立成文件后 store ↔ mcpConfirm 的环彻底消失。
 */

export interface McpServerConfig {
  id: string
  label: string
  command: string
  args: string[]
  /** 只在本机持有；读接口一律不回传值，只回键名（可能装着 token） */
  env: Record<string, string>
  enabled: boolean
}
