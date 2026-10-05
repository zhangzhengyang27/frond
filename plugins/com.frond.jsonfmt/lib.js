/**
 * Frond · JSON 格式化插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondJsonfmtLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondJsonfmtLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function parse(text) {
    return JSON.parse(String(text))
  }

  function format(text, indent) {
    return JSON.stringify(parse(text), null, indent === 4 ? 4 : 2)
  }

  function minify(text) {
    return JSON.stringify(parse(text))
  }

  /** 递归排序对象键（数组内对象同样排序；保持数组顺序） */
  function sortValue(value) {
    if (Array.isArray(value)) return value.map(sortValue)
    if (value && typeof value === 'object') {
      var out = {}
      Object.keys(value)
        .sort()
        .forEach(function (k) {
          out[k] = sortValue(value[k])
        })
      return out
    }
    return value
  }

  function sortKeys(text, indent) {
    return JSON.stringify(sortValue(parse(text)), null, indent === 4 ? 4 : 2)
  }

  /** JSON 字符串字面量转义（把整段文本变成一个合法 JSON 字符串的引号内内容） */
  function escape(text) {
    return JSON.stringify(String(text)).slice(1, -1)
  }

  function unescape(text) {
    return JSON.parse('"' + String(text) + '"')
  }

  /** 校验并定位错误行列：{ok:true} 或 {ok:false, line, col, message}。旧引擎读 position N；新引擎（无 position）从「Unexpected token 'X'」定位首个坏字符 */
  function validate(text) {
    try {
      parse(text)
      return { ok: true }
    } catch (e) {
      var msg = String(e.message)
      var src = String(text)
      var pos = -1
      var m = /position (\d+)/.exec(msg)
      if (m) pos = Number(m[1])
      else {
        var t = /Unexpected token '(.)'/.exec(msg)
        if (t) pos = src.indexOf(t[1])
      }
      if (pos < 0) return { ok: false, line: 1, col: 1, message: msg }
      var before = src.slice(0, pos)
      var line = before.split('\n').length
      var col = pos - before.lastIndexOf('\n')
      return { ok: false, line: line, col: col, message: msg }
    }
  }

  /**
   * 主入口：cmd='format' → [indent2, indent4, minify, sortKeys] 四条（section '输出'）；
   * cmd='escape'/'unescape' → 单条；其余方向失败 → null。条目 { title, output, section? }。
   */
  function convert(text, cmd) {
    var str = String(text).trim()
    if (str === '') return null
    if (cmd === 'escape') return [{ title: '转义完成', output: escape(str) }]
    if (cmd === 'unescape') {
      try {
        return [{ title: '反转义完成', output: unescape(str) }]
      } catch (e) {
        void e
        return null
      }
    }
    try {
      return [
        { title: '格式化（2 空格）', output: format(str, 2), section: '输出' },
        { title: '格式化（4 空格）', output: format(str, 4), section: '输出' },
        { title: '压缩', output: minify(str), section: '输出' },
        { title: '排序键后格式化', output: sortKeys(str, 2), section: '输出' }
      ]
    } catch (e) {
      void e
      return null
    }
  }

  return {
    format: format,
    minify: minify,
    sortKeys: sortKeys,
    escape: escape,
    unescape: unescape,
    validate: validate,
    convert: convert
  }
})
