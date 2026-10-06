/**
 * Frond · 颜色选择器插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondColorpickerLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondColorpickerLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** 解析 #rgb / #rrggbb / rgb() → {r,g,b} | null */
  function parse(text) {
    var str = String(text).trim().toLowerCase()
    var m = /^#([0-9a-f]{3})$/.exec(str)
    if (m) {
      return {
        r: parseInt(m[1][0] + m[1][0], 16),
        g: parseInt(m[1][1] + m[1][1], 16),
        b: parseInt(m[1][2] + m[1][2], 16)
      }
    }
    m = /^#([0-9a-f]{6})$/.exec(str)
    if (m) {
      return {
        r: parseInt(m[1].slice(0, 2), 16),
        g: parseInt(m[1].slice(2, 4), 16),
        b: parseInt(m[1].slice(4, 6), 16)
      }
    }
    m = /^rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)$/.exec(str)
    if (m) {
      return { r: Number(m[1]), g: Number(m[2]), b: Number(m[3]) }
    }
    return null
  }

  function toHex(c) {
    var h = function (n) {
      var s = Math.max(0, Math.min(255, Math.round(n))).toString(16)
      return (s.length < 2 ? '0' : '') + s
    }
    return '#' + h(c.r) + h(c.g) + h(c.b)
  }

  function toRgb(c) {
    return 'rgb(' + c.r + ', ' + c.g + ', ' + c.b + ')'
  }

  function toHsl(c) {
    var r = c.r / 255
    var g = c.g / 255
    var b = c.b / 255
    var max = Math.max(r, g, b)
    var min = Math.min(r, g, b)
    var h = 0
    var s = 0
    var l = (max + min) / 2
    if (max !== min) {
      var d = max - min
      s = l > 0.5 ? d / (2 - max - min) : d / (max + min)
      if (max === r) h = (g - b) / d + (g < b ? 6 : 0)
      else if (max === g) h = (b - r) / d + 2
      else h = (r - g) / d + 4
      h /= 6
    }
    return (
      'hsl(' + Math.round(h * 360) + ', ' + Math.round(s * 100) + '%, ' + Math.round(l * 100) + '%)'
    )
  }

  function toHsv(c) {
    var r = c.r / 255
    var g = c.g / 255
    var b = c.b / 255
    var max = Math.max(r, g, b)
    var min = Math.min(r, g, b)
    var d = max - min
    var h = 0
    if (max !== min) {
      if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6
      else if (max === g) h = ((b - r) / d + 2) / 6
      else h = ((r - g) / d + 4) / 6
    }
    return (
      'hsv(' +
      Math.round(h * 360) +
      ', ' +
      Math.round(max === 0 ? 0 : (d / max) * 100) +
      '%, ' +
      Math.round(max * 100) +
      '%)'
    )
  }

  function toCmyk(c) {
    var r = c.r / 255
    var g = c.g / 255
    var b = c.b / 255
    var k = 1 - Math.max(r, g, b)
    if (k === 1) return 'cmyk(0%, 0%, 0%, 100%)'
    var cy = (1 - r - k) / (1 - k)
    var m = (1 - g - k) / (1 - k)
    var y = (1 - b - k) / (1 - k)
    return (
      'cmyk(' +
      Math.round(cy * 100) +
      '%, ' +
      Math.round(m * 100) +
      '%, ' +
      Math.round(y * 100) +
      '%, ' +
      Math.round(k * 100) +
      '%)'
    )
  }

  /** 五格式并列；条目 icon 带 tintColor（spec 3.1 颜色块） */
  function convert(text) {
    var c = parse(text)
    if (!c) return null
    var hex = toHex(c)
    var defs = [
      { label: 'HEX', out: hex },
      { label: 'RGB', out: toRgb(c) },
      { label: 'HSL', out: toHsl(c) },
      { label: 'HSV', out: toHsv(c) },
      { label: 'CMYK', out: toCmyk(c) }
    ]
    return defs.map(function (d) {
      return {
        title: d.out,
        subtitle: hex + ' 的 ' + d.label + ' 表示',
        output: d.out,
        section: d.label,
        icon: { value: 'palette-line', tintColor: hex },
        accessories: [{ tag: d.label }]
      }
    })
  }

  var PALETTES = [
    { name: 'red', hex: '#ff3b30' },
    { name: 'orange', hex: '#ff9500' },
    { name: 'yellow', hex: '#ffcc00' },
    { name: 'green', hex: '#34c759' },
    { name: 'mint', hex: '#00c7be' },
    { name: 'teal', hex: '#30b0c7' },
    { name: 'cyan', hex: '#32ade6' },
    { name: 'blue', hex: '#007aff' },
    { name: 'indigo', hex: '#5856d6' },
    { name: 'purple', hex: '#af52de' },
    { name: 'pink', hex: '#ff2d55' },
    { name: 'brown', hex: '#a2845e' },
    { name: 'gray', hex: '#8e8e93' },
    { name: 'black', hex: '#1c1c1e' },
    { name: 'white', hex: '#ffffff' }
  ]

  return {
    parse: parse,
    toHex: toHex,
    toRgb: toRgb,
    toHsl: toHsl,
    toHsv: toHsv,
    toCmyk: toCmyk,
    convert: convert,
    PALETTES: PALETTES
  }
})
