/**
 * Frond · MCP 配置差分确认（B40 余项：mcp:setServers 打穿「command 不进渲染端」
 * 书面不变量的收口）
 *
 * setServers 仍接受渲染端完整配置（设置页表单链路如此），但 spawn 是危险动作：
 * connectById 在「当前配置 ≠ 上次用户确认过的配置」时弹系统级模态，列出差分
 * （新增/移除/变更），用户确认后才连接并记账。纯函数在此，electron dialog 在
 * store.ts 侧动态引入（可单测、E2E 旁路与 pluginConfirm 同口径）。
 */
import { createHash } from 'crypto'
import type { McpServerConfig } from './types'

export interface ServerDiff {
  added: McpServerConfig[]
  removed: McpServerConfig[]
  /** id 相同但 command/args/env 任一变化的 */
  changed: McpServerConfig[]
}

/** 稳定序列化键：id 排序、env 键排序，保证同配置同哈希 */
export function stableServersKey(servers: McpServerConfig[]): string {
  const normalized = [...servers]
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((s) => ({
      id: s.id,
      label: s.label,
      command: s.command,
      args: [...s.args],
      enabled: s.enabled,
      env: Object.fromEntries(Object.entries(s.env ?? {}).sort(([a], [b]) => a.localeCompare(b)))
    }))
  return JSON.stringify(normalized)
}

export function serversHash(servers: McpServerConfig[]): string {
  return createHash('sha256').update(stableServersKey(servers)).digest('hex')
}

/** 按 id 差分：当前配置 vs 上次确认过的配置 */
export function diffServers(current: McpServerConfig[], confirmed: McpServerConfig[]): ServerDiff {
  const prev = new Map(confirmed.map((s) => [s.id, s]))
  const curr = new Map(current.map((s) => [s.id, s]))
  const diff: ServerDiff = { added: [], removed: [], changed: [] }
  for (const s of current) {
    const old = prev.get(s.id)
    if (!old) {
      diff.added.push(s)
    } else if (stableServersKey([s]) !== stableServersKey([old])) {
      diff.changed.push(s)
    }
  }
  for (const s of confirmed) {
    if (!curr.has(s.id)) diff.removed.push(s)
  }
  return diff
}

const describeServer = (s: McpServerConfig): string =>
  `${s.label || s.id}（${s.id}）→ ${s.command} ${s.args.join(' ')}`.trim()

/** 确认弹窗内容（dialog.showMessageBox 选项；按钮 0 = 取消，1 = 允许连接） */
export function buildConfirmAsk(diff: ServerDiff): {
  type: 'warning'
  title: string
  message: string
  detail: string
  buttons: string[]
  defaultId: number
  cancelId: number
} {
  const lines: string[] = []
  if (diff.added.length) {
    lines.push(`新增：\n${diff.added.map((s) => `· ${describeServer(s)}`).join('\n')}`)
  }
  if (diff.removed.length) {
    lines.push(`移除：\n${diff.removed.map((s) => `· ${s.label || s.id}（${s.id}）`).join('\n')}`)
  }
  if (diff.changed.length) {
    lines.push(`变更：\n${diff.changed.map((s) => `· ${describeServer(s)}`).join('\n')}`)
  }
  return {
    type: 'warning',
    title: 'MCP 服务器配置已变更',
    message: `MCP 配置在本机命令清单上有 ${diff.added.length + diff.removed.length + diff.changed.length} 处变动，确认后才会启动对应进程`,
    detail: `${lines.join('\n\n')}\n\nMCP 服务器会在本机执行任意命令，请确认以上变动出自你的操作。`,
    buttons: ['取消', '允许连接'],
    defaultId: 0,
    cancelId: 0
  }
}

/**
 * 系统级模态确认（pluginConfirm 同口径：动态 import electron 与 launcher/window
 * 避免静态循环依赖；FROND_E2E 旁路）。按钮 0 = 取消（默认），1 = 允许连接。
 */
export async function confirmMcpConfigChange(diff: ServerDiff): Promise<boolean> {
  if (process.env.FROND_E2E === '1') return true
  const { dialog } = await import('electron')
  const { getLauncherWindow } = await import('../../launcher/window')
  const win = getLauncherWindow()
  const result = await dialog.showMessageBox(win ?? undefined!, buildConfirmAsk(diff))
  return result.response === 1
}
