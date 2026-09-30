/**
 * Frond · Kill Process 纯逻辑（Raycast parity，2026-09-28）
 *
 * Electron 接线在 ProcessService.ts；本文件只放可单测的纯部分：
 * `ps -axo pid=,pcpu=,pmem=,comm=` 输出解析、人类可读名推导、kill 的
 * fail-closed 保护名单。平台：macOS（Windows 未验证，Service 侧平台守卫）。
 */
import type { ProcessInfo } from '../../shared/process'

export type { ProcessInfo }

/**
 * 解析 ps 定宽输出：前三个 token 是 pid/cpu/mem，其余（可能含空格）是命令路径。
 * 畸形行（缺列/非数字）跳过而不是炸掉整个列表。
 */
export function parsePsOutput(out: string): ProcessInfo[] {
  const rows: ProcessInfo[] = []
  for (const line of out.split('\n')) {
    const trimmed = line.trim()
    if (!trimmed) continue
    const m = trimmed.match(/^(\d+)\s+(\d+(?:\.\d+)?)\s+(\d+(?:\.\d+)?)\s+(.+)$/)
    if (!m) continue
    const pid = Number(m[1])
    const cpu = Number(m[2])
    const mem = Number(m[3])
    if (!Number.isFinite(pid) || !Number.isFinite(cpu) || !Number.isFinite(mem)) continue
    const command = m[4]!.trim()
    if (!command) continue
    rows.push({ pid, cpu, mem, command, displayName: deriveDisplayName(command) })
  }
  return rows.sort((a, b) => b.cpu - a.cpu)
}

/** .app bundle 路径取 bundle 名（如「Google Chrome.app」→「Google Chrome」），否则 basename */
export function deriveDisplayName(command: string): string {
  const m = command.match(/\/([^/]+)\.app\//)
  if (m) return m[1]!
  const base = command.split('/').pop() ?? command
  return base || command
}

/** 杀掉会导致会话/系统不可用的核心进程（kill 前 fail-closed；OS 的 root 边界是第二道） */
const PROTECTED_NAMES: ReadonlySet<string> = new Set([
  'kernel_task',
  'launchd',
  'WindowServer',
  'loginwindow',
  'SystemUIServer',
  'ControlCenter',
  'Dock',
  'Finder',
  'Spotlight',
  'Frond',
  'Electron'
])

/** 是否拒绝 kill：pid≤1、自身进程树（ownPid 或 ownExecDir 前缀命中）、核心系统进程 */
export function isProtected(
  row: Pick<ProcessInfo, 'pid' | 'displayName' | 'command'>,
  ownPid: number,
  ownExecDir: string
): boolean {
  if (row.pid <= 1) return true
  if (row.pid === ownPid) return true
  if (ownExecDir && row.command.startsWith(ownExecDir)) return true
  return PROTECTED_NAMES.has(row.displayName)
}
