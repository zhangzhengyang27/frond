import { describe, it, expect, afterEach } from 'vitest'
import { CountdownService, COUNTDOWN_CANCEL_EVENT } from '../CountdownService'
import type { BrowserWindow } from 'electron'

/**
 * Leaf · CountdownService 测试
 *
 * ⚠ 恢复说明：本文件随 2026-09-22 删除事故丢了文档注释开头与大部分用例。
 * 下面 makeWin 是找回的原文；三条用例是按当前实现的显式契约重写的
 * （start 的返回值语义、cancel 的推送、非法秒数），刻意不碰计时推进——
 * 那部分原用例断言了什么没有依据，宁可少测也不猜。
 */

function makeWin(): {
  win: {
    isDestroyed: () => boolean
    webContents: { send: (channel: string, payload: unknown) => void }
  }
  sent: { channel: string; payload: unknown }[]
} {
  const sent: { channel: string; payload: unknown }[] = []
  const win = {
    isDestroyed: () => false,
    webContents: {
      send: (channel: string, payload: unknown) => {
        sent.push({ channel, payload })
      }
    }
  }
  return { win, sent }
}

/** activeCountdown 是模块级单槽，用例之间必须显式收尾，否则后一条 start 恒返回 false */
let running: CountdownService | null = null

afterEach(() => {
  running?.cancel()
  running = null
})

describe('CountdownService', () => {
  it('start 成功返回 true；同一时刻只允许一个倒计时在跑', () => {
    const { win } = makeWin()
    running = new CountdownService(() => win as unknown as BrowserWindow)
    expect(running.start(3, () => {})).toBe(true)
    expect(running.start(3, () => {})).toBe(false)
  })

  it('cancel 向窗口推 recording:countdown:cancel，收尾后又能重新 start', () => {
    const { win, sent } = makeWin()
    running = new CountdownService(() => win as unknown as BrowserWindow)
    running.start(3, () => {})
    running.cancel()
    expect(sent.map((s) => s.channel)).toContain(COUNTDOWN_CANCEL_EVENT)
    expect(running.start(3, () => {})).toBe(true)
  })

  it('非有限秒数直接拒绝，不占用倒计时槽', () => {
    const { win } = makeWin()
    running = new CountdownService(() => win as unknown as BrowserWindow)
    expect(running.start(Number.NaN, () => {})).toBe(false)
    expect(running.start(3, () => {})).toBe(true)
  })
})
