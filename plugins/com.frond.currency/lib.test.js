import { describe, it, expect } from 'vitest'
import { parseQuery, isCacheFresh, topCurrencies } from './lib.js'

describe('currency lib（React 视图外的纯函数契约）', () => {
  it('parseQuery 三种输入形态', () => {
    expect(parseQuery('100 usd cny', { baseCurrency: 'CNY', targetCurrency: 'USD' })).toEqual({
      amount: 100,
      from: 'USD',
      to: 'CNY'
    })
    expect(parseQuery('100', { baseCurrency: 'CNY', targetCurrency: 'USD' })).toEqual({
      amount: 100,
      from: 'CNY',
      to: 'USD'
    })
    expect(parseQuery('12.5 EUR→JPY', {})).toEqual({ amount: 12.5, from: 'EUR', to: 'JPY' })
    expect(parseQuery('abc', {})).toBeNull()
  })
  it('isCacheFresh 24h 边界', () => {
    const now = Date.now()
    expect(isCacheFresh({ ts: now - 23 * 3600e3 }, now)).toBe(true)
    expect(isCacheFresh({ ts: now - 25 * 3600e3 }, now)).toBe(false)
    expect(isCacheFresh(null, now)).toBe(false)
  })
  it('topCurrencies 恰 10 项且含 CNY/USD', () => {
    expect(topCurrencies).toHaveLength(10)
    expect(topCurrencies).toContain('CNY')
  })
})
