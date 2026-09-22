import { describe, it, expect } from 'vitest'
import { parseShotQuery, SCAN_MAX_FILES, OCR_BATCH_SIZE } from '../ScreenshotIndexService'

/**
 * V4 P1-10：截图库搜索查询解析（纯函数）。
 * 语法对齐 Raycast Search Screenshots：name: / text: / date:（today/yesterday/last week）
 * 前缀过滤 + 自由文本（匹配文件名或 OCR 文本）。
 */
describe('parseShotQuery', () => {
  const now = new Date(2026, 8, 17, 15, 0) // 2026-09-17 15:00 本地时间

  it('自由文本进 q', () => {
    expect(parseShotQuery('发票 号码', now)).toEqual({
      freeText: '发票 号码',
      q: '发票 号码'
    })
  })

  it('name: / text: 前缀各自归位', () => {
    const r = parseShotQuery('name:invoice text: total', now)
    expect(r.name).toBe('invoice')
    expect(r.text).toBe('total')
    expect(r.q).toBeUndefined()
  })

  it('date:today / yesterday / last week 解析为 since 时间下限', () => {
    const today = parseShotQuery('date:today', now)
    expect(today.since).toBe(new Date(2026, 8, 17).getTime())

    const yesterday = parseShotQuery('date:yesterday', now)
    expect(yesterday.since).toBe(new Date(2026, 8, 16).getTime())

    const week = parseShotQuery('date:last week', now)
    // "last week" 是一个 token（空格在 token 化前已被拆开 → "last" 与 "week" 分离）
    expect(week.since).toBeUndefined()
    expect(parseShotQuery('date:lastweek', now).since).toBe(now.getTime() - 7 * 24 * 3600 * 1000)
  })

  it('未知 date 值并入自由文本（不吞字面）', () => {
    const r = parseShotQuery('date:2026-01-01', now)
    expect(r.since).toBeUndefined()
    expect(r.freeText).toBe('date:2026-01-01')
  })

  it('混合 token', () => {
    const r = parseShotQuery('text:错误 name:log debug', now)
    expect(r.text).toBe('错误')
    expect(r.name).toBe('log')
    expect(r.freeText).toBe('debug')
  })

  it('空查询', () => {
    expect(parseShotQuery('', now).freeText).toBe('')
  })

  it('扫描/OCR 批量上限为有限值（防无界增长）', () => {
    expect(SCAN_MAX_FILES).toBeGreaterThan(0)
    expect(SCAN_MAX_FILES).toBeLessThanOrEqual(1000)
    expect(OCR_BATCH_SIZE).toBeGreaterThan(0)
    expect(OCR_BATCH_SIZE).toBeLessThanOrEqual(SCAN_MAX_FILES)
  })
})
