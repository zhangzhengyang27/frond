/**
 * Frond · 汇率转换插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondCurrencyLib，vitest（node）走 module.exports。
 * main.tsx（React 视图）import 本文件由 esbuild 打进 bundle——两端同一份实现。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondCurrencyLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var TOP = ['CNY', 'USD', 'EUR', 'JPY', 'GBP', 'HKD', 'KRW', 'AUD', 'CAD', 'SGD']

  /**
   * 解析「100 usd cny」/「100USD→CNY」/「100」（无币种用偏好默认）。
   * 返回 { amount, from, to } | null。
   */
  function parseQuery(q, prefs) {
    prefs = prefs || {}
    var str = String(q || '').trim()
    if (str === '') return null
    var m = /^(\d+(?:\.\d+)?)\s*([A-Za-z]{3})?\s*(?:→|->|\/|\s)\s*([A-Za-z]{3})?$/.exec(str)
    var amount, from, to
    if (!m && /^\d+(?:\.\d+)?$/.test(str)) {
      amount = Number(str)
      from = String(prefs.baseCurrency || 'CNY').toUpperCase()
      to = String(prefs.targetCurrency || 'USD').toUpperCase()
      return { amount: amount, from: from, to: to }
    }
    if (m) {
      amount = Number(m[1])
      from = (m[2] || prefs.baseCurrency || 'CNY').toUpperCase()
      to = (m[3] || prefs.targetCurrency || 'USD').toUpperCase()
    } else {
      m = /^(\d+(?:\.\d+)?)([A-Za-z]{3})$/.exec(str.replace(/\s+/g, ''))
      if (m) {
        amount = Number(m[1])
        from = m[2].toUpperCase()
        to = (prefs.targetCurrency || 'USD').toUpperCase()
      } else {
        return null
      }
    }
    if (!Number.isFinite(amount) || amount < 0) return null
    if (from.length !== 3 || to.length !== 3) return null
    return { amount: amount, from: from, to: to }
  }

  /** 缓存 24h 内有效；cache = { base, rates, ts } */
  function isCacheFresh(cache, nowMs) {
    if (!cache || typeof cache.ts !== 'number') return false
    var now = typeof nowMs === 'number' ? nowMs : Date.now()
    return now - cache.ts < 24 * 3600e3
  }

  return { parseQuery: parseQuery, isCacheFresh: isCacheFresh, topCurrencies: TOP }
})
