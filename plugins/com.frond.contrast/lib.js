/**
 * Frond · 颜色对比度插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondContrastLib，vitest（node）走 module.exports。
 * WCAG 2.x 相对亮度与对比度比率。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondContrastLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parseHex(text) {
    var str = String(text).trim().toLowerCase()
    var m = /^#([0-9a-f]{3})$/.exec(str)
    if (m) {
      return { r: parseInt(m[1][0] + m[1][0], 16), g: parseInt(m[1][1] + m[1][1], 16), b: parseInt(m[1][2] + m[1][2], 16) }
    }
    m = /^#([0-9a-f]{6})$/.exec(str)
    if (m) {
      return { r: parseInt(m[1].slice(0, 2), 16), g: parseInt(m[1].slice(2, 4), 16), b: parseInt(m[1].slice(4, 6), 16) }
    }
    return null
  }

  /** 'fg/bg' 或 'fg bg' → { fg, bg }；任一非法 → null */
  function parsePair(text) {
    var parts = String(text).trim().split(/[/\s]+/)
    if (parts.length !== 2) return null
    var fg = parseHex(parts[0])
    var bg = parseHex(parts[1])
    if (!fg || !bg) return null
    return { fg: fg, bg: bg }
  }

  function luminance(c) {
    var f = function (v) {
      v /= 255
      return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4)
    }
    return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b)
  }

  /** 对比度比率（大者作分子，≥1）；入参兼容 hex 字符串或已解析对象 */
  function ratio(fg, bg) {
    var f1 = typeof fg === 'string' ? parseHex(fg) : fg
    var f2 = typeof bg === 'string' ? parseHex(bg) : bg
    if (!f1 || !f2) return NaN
    var l1 = luminance(f1)
    var l2 = luminance(f2)
    var hi = Math.max(l1, l2)
    var lo = Math.min(l1, l2)
    return (hi + 0.05) / (lo + 0.05)
  }

  /** WCAG 判定：aa ≥4.5（大字 ≥3）、aaa ≥7（大字 ≥4.5） */
  function grade(r) {
    return {
      aa: r >= 4.5,
      aaLarge: r >= 3,
      aaa: r >= 7,
      aaaLarge: r >= 4.5
    }
  }

  /** 主结果条目（比率 + 最高达标 tag + markdown 表格 detail）；解析失败 → null */
  function convert(text) {
    var pair = parsePair(text)
    if (!pair) return null
    var r = ratio(pair.fg, pair.bg)
    var g = grade(r)
    var rFixed = Math.round(r * 100) / 100
    var bestTag = g.aaa ? 'AAA ✓' : g.aa ? 'AA ✓' : g.aaLarge ? 'AA 大字 ✓' : '不达标'
    var tone = g.aaa || g.aa ? 'success' : g.aaLarge ? 'warn' : 'danger'
    var hexOf = function (c) {
      var h = function (n) {
        var s = n.toString(16)
        return (s.length < 2 ? '0' : '') + s
      }
      return '#' + h(c.r) + h(c.g) + h(c.b)
    }
    var fgHex = hexOf(pair.fg)
    var bgHex = hexOf(pair.bg)
    return [
      {
        title: rFixed + ' : 1',
        subtitle: fgHex + ' on ' + bgHex + '（WCAG 对比度）',
        output: String(rFixed),
        accessories: [{ tag: bestTag, tone: tone }],
        icon: { value: 'contrast-drop-line', tintColor: fgHex },
        detail:
          '**WCAG 2.x 判定表**\n\n| 等级 | 阈值 | 结果 |\n|---|---|---|\n| AA（常规字） | ≥ 4.5 | ' +
          (g.aa ? '✓ ' + rFixed : '✗ ' + rFixed) +
          ' |\n| AA（大字） | ≥ 3 | ' +
          (g.aaLarge ? '✓ ' + rFixed : '✗ ' + rFixed) +
          ' |\n| AAA（常规字） | ≥ 7 | ' +
          (g.aaa ? '✓ ' + rFixed : '✗ ' + rFixed) +
          ' |\n| AAA（大字） | ≥ 4.5 | ' +
          (g.aaaLarge ? '✓ ' + rFixed : '✗ ' + rFixed) +
          ' |\n\n前景 `' +
          fgHex +
          '` · 背景 `' +
          bgHex +
          '`',
        detailFormat: 'markdown'
      }
    ]
  }

  return { parsePair: parsePair, parseHex: parseHex, luminance: luminance, ratio: ratio, grade: grade, convert: convert }
})
