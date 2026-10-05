/**
 * Frond · 进制转换插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondBaseconvertLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondBaseconvertLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /**
   * 识别输入：0x/0X(16)、0b/0B(2)、0o/0O(8) 前缀；无前缀按 10 进制；支持负号。
   * 返回 { value: BigInt, base } | null。
   */
  function parseInput(text) {
    var str = String(text).trim()
    if (str === '') return null
    var sign = 1n
    if (str[0] === '-') {
      sign = -1n
      str = str.slice(1)
    } else if (str[0] === '+') {
      str = str.slice(1)
    }
    var base = 10
    var body = str
    if (/^0[xX][0-9a-fA-F]+$/.test(str)) {
      base = 16
      body = str.slice(2)
    } else if (/^0[bB][01]+$/.test(str)) {
      base = 2
      body = str.slice(2)
    } else if (/^0[oO][0-7]+$/.test(str)) {
      base = 8
      body = str.slice(2)
    } else if (!/^\d+$/.test(str)) {
      return null
    }
    var value
    try {
      value = BigInt((base === 16 ? '0x' : base === 8 ? '0o' : base === 2 ? '0b' : '') + body)
    } catch (e) {
      void e
      return null
    }
    return { value: sign * value, base: base }
  }

  /** BigInt → 指定进制字符串（2/8/10/16 走原生，负号保留） */
  function toBase(value, base) {
    var v = BigInt(value)
    var neg = v < 0n
    if (neg) v = -v
    var digits = v.toString(base)
    return (neg ? '-' : '') + digits
  }

  /** 四条并列：2/8/10/16（section + 进制 tag）；解析失败 → null */
  function convert(text) {
    var parsed = parseInput(text)
    if (!parsed) return null
    var defs = [
      { base: 2, section: '二进制', tag: 'base2' },
      { base: 8, section: '八进制', tag: 'base8' },
      { base: 10, section: '十进制', tag: 'base10' },
      { base: 16, section: '十六进制', tag: 'base16' }
    ]
    return defs.map(function (d) {
      return {
        title: toBase(parsed.value, d.base),
        subtitle: '输入: ' + String(text).trim() + '（识别为 ' + parsed.base + ' 进制）',
        output: toBase(parsed.value, d.base),
        section: d.section,
        accessories: [{ tag: d.tag }]
      }
    })
  }

  return { parseInput: parseInput, toBase: toBase, convert: convert }
})
