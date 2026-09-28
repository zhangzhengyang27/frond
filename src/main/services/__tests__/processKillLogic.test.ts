import { describe, it, expect } from 'vitest'
import { parsePsOutput, deriveDisplayName, isProtected, type ProcessInfo } from '../processKillLogic'

describe('processKillLogic · Kill Process（Raycast parity）', () => {
  describe('parsePsOutput（ps -axo pid=,pcpu=,pmem=,comm= 输出 → 列表）', () => {
    it('解析 pid/cpu/mem 与含空格的命令路径，按 cpu 降序', () => {
      const out = [
        '  123   0.5  1.2 /Applications/Safari.app/Contents/MacOS/Safari',
        '  456  88.1  4.0 /Applications/Google Chrome.app/Contents/MacOS/Google Chrome Helper (Renderer)',
        '   78   0.0  0.1 /usr/sbin/cfprefsd',
        ''
      ].join('\n')
      const rows = parsePsOutput(out)
      expect(rows).toHaveLength(3)
      // cpu 降序：Chrome Helper (88.1) 在最前
      expect(rows[0].pid).toBe(456)
      expect(rows[0].cpu).toBe(88.1)
      expect(rows[0].mem).toBe(4)
      expect(rows[0].command).toBe(
        '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome Helper (Renderer)'
      )
      expect(rows[2].pid).toBe(78)
    })

    it('畸形行（缺列/非数字）跳过而不是炸掉整个列表', () => {
      const out = ['garbage', '999', '  1  x  y /bin/sh', '  2  3.3  0.4 /bin/ok'].join('\n')
      const rows = parsePsOutput(out)
      expect(rows.map((r) => r.pid)).toEqual([2])
    })
  })

  describe('deriveDisplayName（从命令路径给人类可读名）', () => {
    it('.app bundle 取 bundle 名（含空格）', () => {
      expect(
        deriveDisplayName('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome')
      ).toBe('Google Chrome')
      expect(deriveDisplayName('/System/Applications/Calculator.app/Contents/MacOS/Calculator')).toBe(
        'Calculator'
      )
    })

    it('非 bundle 取 basename', () => {
      expect(deriveDisplayName('/usr/sbin/cfprefsd')).toBe('cfprefsd')
      expect(deriveDisplayName('kernel_task')).toBe('kernel_task')
    })
  })

  describe('isProtected（kill 的 fail-closed 名单）', () => {
    const row = (pid: number, displayName: string, command = '/bin/x'): ProcessInfo => ({
      pid,
      cpu: 0,
      mem: 0,
      command,
      displayName
    })

    it('pid ≤ 1 与自身进程树拒绝', () => {
      expect(isProtected(row(1, 'launchd'), 500, '/Applications/Frond.app')).toBe(true)
      expect(isProtected(row(0, 'kernel'), 500, '/Applications/Frond.app')).toBe(true)
      expect(isProtected(row(500, 'Frond', '/Applications/Frond.app/Contents/MacOS/Frond'), 500, '/Applications/Frond.app')).toBe(true)
      expect(isProtected(row(501, 'Frond Helper', '/Applications/Frond.app/Contents/MacOS/Frond Helper'), 500, '/Applications/Frond.app')).toBe(true)
    })

    it('核心系统进程拒绝（杀掉会话就没了）', () => {
      for (const name of ['kernel_task', 'WindowServer', 'loginwindow', 'Dock', 'Finder']) {
        expect(isProtected(row(600, name), 500, '/Applications/Frond.app')).toBe(true)
      }
    })

    it('普通应用放行', () => {
      expect(
        isProtected(
          row(700, 'Google Chrome', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'),
          500,
          '/Applications/Frond.app'
        )
      ).toBe(false)
    })
  })
})
