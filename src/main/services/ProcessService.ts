/**
 * Frond · 进程查杀服务（Raycast parity「Kill Process」，2026-09-28）
 *
 * macOS：ps 列进程 + SIGKILL 强杀；保护名单 fail-closed（processKillLogic.ts，
 * 纯逻辑可单测）。Windows 未验证：平台守卫返回空/拒绝——与 fileSearch 的
 * PowerShell 回退一样等真机验证轮再放开。
 */
import { execFile } from 'node:child_process'
import { dirname } from 'node:path'
import { app } from 'electron'
import { typedHandle } from '../ipc/typedIpc'
import { parsePsOutput, isProtected, type ProcessInfo } from './processKillLogic'

/** 列表上限：ps 全量数百行，胶囊列表 300 条与插件列表同档 */
const MAX_LIST = 300

function runPs(args: string[], timeoutMs = 5000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('ps', args, { timeout: timeoutMs, maxBuffer: 8 * 1024 * 1024 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(String(stdout))
    })
  })
}

export function registerProcessIpc(): void {
  typedHandle('process:list', async (): Promise<ProcessInfo[]> => {
    if (process.platform !== 'darwin') return []
    const out = await runPs(['-axo', 'pid=,pcpu=,pmem=,comm='])
    return parsePsOutput(out).slice(0, MAX_LIST)
  })

  typedHandle('process:kill', async (_event, { pid }) => {
    if (process.platform !== 'darwin') return { success: false, error: '仅 macOS 支持' }
    if (!Number.isInteger(pid) || pid <= 1) return { success: false, error: '非法 pid' }
    try {
      // 点击时复核目标身份：列表与点击之间 pid 可能易主（TOCTOU）
      const out = await runPs(['-p', String(pid), '-o', 'pid=,pcpu=,pmem=,comm='])
      const rows = parsePsOutput(out)
      if (rows.length === 0) return { success: false, error: '进程不存在' }
      if (isProtected(rows[0], process.pid, dirname(app.getPath('exe')))) {
        return { success: false, error: `受保护进程：${rows[0].displayName}` }
      }
      process.kill(pid, 'SIGKILL')
      return { success: true }
    } catch (e) {
      return { success: false, error: (e as Error).message }
    }
  })
}
