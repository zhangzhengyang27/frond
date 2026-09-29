import { describe, it, expect } from 'vitest'
import {
  stableServersKey,
  serversHash,
  diffServers,
  buildConfirmAsk,
  type ServerDiff
} from '../mcpConfirm'
import type { McpServerConfig } from '../store'

/**
 * B40 回归钉：MCP 配置差分确认的纯逻辑。
 * setServers 打穿了「command 不进渲染端」的书面不变量，收口手段是 connect 前
 * 的差分确认——本文件钉住差分/哈希/弹窗文案这三块决策依据。
 */

const server = (over: Partial<McpServerConfig> = {}): McpServerConfig => ({
  id: 'fs',
  label: '文件系统',
  command: 'npx',
  args: ['-y', '@modelcontextprotocol/server-fs'],
  env: {},
  enabled: true,
  ...over
})

describe('stableServersKey / serversHash（配置指纹）', () => {
  it('与数组顺序、env 键序无关', () => {
    // 同一份内容：只有数组顺序与 env 键序不同
    const a = [server({ id: 'a', env: { T: '1', S: '2' } }), server({ id: 'b', env: { U: '3' } })]
    const b = [server({ id: 'b', env: { U: '3' } }), server({ id: 'a', env: { S: '2', T: '1' } })]
    expect(stableServersKey(a)).toBe(stableServersKey(b))
    expect(serversHash(a)).toBe(serversHash(b))
  })

  it('command / args / env 值任一变化都改变哈希', () => {
    const base = [server()]
    expect(serversHash(base)).not.toBe(serversHash([server({ command: 'node' })]))
    expect(serversHash(base)).not.toBe(serversHash([server({ args: ['-y'] })]))
    expect(serversHash(base)).not.toBe(serversHash([server({ env: { T: 'x' } })]))
  })
})

describe('diffServers（当前 vs 上次确认）', () => {
  it('新增 / 移除 / 变更各归各位', () => {
    const confirmed = [server({ id: 'keep' }), server({ id: 'chg', command: 'old-cmd' }), server({ id: 'gone' })]
    const current = [server({ id: 'keep' }), server({ id: 'chg', command: 'new-cmd' }), server({ id: 'new' })]
    const diff = diffServers(current, confirmed)
    expect(diff.added.map((s) => s.id)).toEqual(['new'])
    expect(diff.removed.map((s) => s.id)).toEqual(['gone'])
    expect(diff.changed.map((s) => s.id)).toEqual(['chg'])
  })

  it('无差异 = 三项皆空（哈希相等时的快速路径语义）', () => {
    const same = [server()]
    const diff: ServerDiff = diffServers(same, same)
    expect(diff.added).toHaveLength(0)
    expect(diff.removed).toHaveLength(0)
    expect(diff.changed).toHaveLength(0)
  })
})

describe('buildConfirmAsk（系统模态内容）', () => {
  it('三类变动都进 detail；默认按钮是取消（defaultId=0 落拒绝）', () => {
    const diff = diffServers(
      [server({ id: 'new', command: 'evil-cmd' })],
      [server({ id: 'old', command: 'safe-cmd' })]
    )
    const ask = buildConfirmAsk(diff)
    expect(ask.defaultId).toBe(0)
    expect(ask.cancelId).toBe(0)
    expect(ask.buttons[0]).toBe('取消')
    expect(ask.detail).toContain('evil-cmd')
    expect(ask.detail).toContain('old')
    expect(ask.detail).toContain('新增')
    expect(ask.detail).toContain('移除')
  })
})
