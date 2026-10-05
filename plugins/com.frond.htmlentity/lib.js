/**
 * Frond · HTML 实体编解码插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondHtmlentityLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondHtmlentityLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  var NAMED = {
    '&': 'amp',
    '<': 'lt',
    '>': 'gt',
    '"': 'quot',
    "'": 'apos',
    ' ': 'nbsp',
    '©': 'copy',
    '®': 'reg',
    '™': 'trade',
    '—': 'mdash',
    '–': 'ndash',
    '…': 'hellip',
    '×': 'times',
    '÷': 'divide',
    '°': 'deg',
    '±': 'plusmn',
    µ: 'micro',
    '¶': 'para',
    '·': 'middot',
    '€': 'euro',
    '£': 'pound',
    '¥': 'yen',
    '§': 'sect',
    '«': 'laquo',
    '»': 'raquo',
    '←': 'larr',
    '→': 'rarr',
    '↑': 'uarr',
    '↓': 'darr'
  }
  var REVERSE = {}
  for (var ch in NAMED) REVERSE[NAMED[ch]] = ch

  function encodeNamed(text) {
    var str = String(text)
    var out = ''
    for (var i = 0; i < str.length; i++) {
      var ch = str[i]
      var code = str.codePointAt(i)
      if (NAMED[ch]) out += '&' + NAMED[ch] + ';'
      else if (code > 127) out += '&#' + code + ';'
      else out += ch
      if (code > 0xffff) i++
    }
    return out
  }

  function encodeNumeric(text) {
    var str = String(text)
    var out = ''
    for (var i = 0; i < str.length; i++) {
      var code = str.codePointAt(i)
      if (code > 127 || str[i] === '&' || str[i] === '<' || str[i] === '>') out += '&#' + code + ';'
      else out += str[i]
      if (code > 0xffff) i++
    }
    return out
  }

  /** 解码命名（含表外 → 尽力）与数字（十进制/十六进制）实体；无法识别的原样保留 */
  function decode(text) {
    var str = String(text)
    return str.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, function (ent, body) {
      if (body[0] === '#') {
        var code =
          body[1] === 'x' || body[1] === 'X'
            ? parseInt(body.slice(2), 16)
            : parseInt(body.slice(1), 10)
        return Number.isFinite(code) && code >= 0 && code <= 0x10ffff
          ? String.fromCodePoint(code)
          : ent
      }
      var named = REVERSE[body]
      return named !== undefined ? named : ent
    })
  }

  /**
   * 双向检测入口：encode → 输入含需编码字符时双列（命名/数字），纯 ASCII 可直出单列；
   * decode → 输入含 '&...;' 形态时解码单条，否则 null。条目 { title, output, section? }。
   */
  function convert(text, cmd) {
    var str = String(text)
    if (str.trim() === '') return null
    if (cmd === 'decode') {
      if (!/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/.test(str)) return null
      return [
        {
          title: '解码完成（' + str.length + ' → ' + decode(str).length + ' 字符）',
          output: decode(str)
        }
      ]
    }
    var needsEncoding = false
    for (var i = 0; i < str.length && !needsEncoding; i++) {
      var c = str[i]
      if (str.codePointAt(i) > 127 || c === '&' || c === '<' || c === '>') needsEncoding = true
    }
    if (!needsEncoding) return [{ title: '无需编码（纯文本）', output: str }]
    return [
      {
        title: '命名实体（优先命名，无命名走数字）',
        output: encodeNamed(str),
        section: '命名实体'
      },
      { title: '数字实体（全部 &#NNNN;）', output: encodeNumeric(str), section: '数字实体' }
    ]
  }

  return {
    encodeNamed: encodeNamed,
    encodeNumeric: encodeNumeric,
    decode: decode,
    convert: convert
  }
})
