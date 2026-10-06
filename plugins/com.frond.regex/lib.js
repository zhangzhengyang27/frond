/**
 * Frond · 正则测试插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondRegexLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondRegexLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** 规范化 flags：只保留 gimscu 等合法单字符 */
  function parseFlags(text) {
    var str = String(text || '')
    var out = ''
    var valid = 'dgimsuvy'
    for (var i = 0; i < str.length; i++) {
      var ch = str[i]
      if (valid.indexOf(ch) !== -1 && out.indexOf(ch) === -1) out += ch
    }
    return out
  }

  /**
   * 执行匹配：返回 { matches: [{index, text, groups}] } 或 { error }（正则非法）。
   * 无 g 标志时按单次匹配处理。
   */
  function test(pattern, flags, input) {
    var re
    try {
      re = new RegExp(String(pattern), parseFlags(flags))
    } catch (e) {
      return { error: String(e.message) }
    }
    var matches = []
    var str = String(input)
    if (re.global) {
      var m
      var guard = 0
      while ((m = re.exec(str)) !== null && guard < 1000) {
        guard++
        matches.push({
          index: m.index,
          text: m[0],
          groups: m.slice(1).map(function (g) {
            return g === undefined ? '' : g
          })
        })
        if (m[0] === '') re.lastIndex++
      }
    } else {
      var m1 = re.exec(str)
      if (m1)
        matches.push({
          index: m1.index,
          text: m1[0],
          groups: m1.slice(1).map(function (g) {
            return g === undefined ? '' : g
          })
        })
    }
    return { matches: matches }
  }

  var COMMON = [
    { label: '邮箱', pattern: '[\\w.+-]+@[\\w-]+\\.[\\w.]+' },
    { label: 'URL', pattern: 'https?://[^\\s>]+' },
    { label: '手机号（中国大陆）', pattern: '1[3-9]\\d{9}' },
    { label: 'IPv4', pattern: '(\\d{1,3}\\.){3}\\d{1,3}' },
    { label: '日期 YYYY-MM-DD', pattern: '\\d{4}-\\d{2}-\\d{2}' }
  ]

  /** 输入/模式 → [匹配列表组条目]；非法正则 → [错误条目] */
  function convert(input, pattern, flags) {
    var r = test(pattern, flags, input)
    if (r.error) {
      return [
        {
          title: '正则非法',
          subtitle: r.error,
          icon: 'error-warning-line',
          matches: [],
          detail: null
        }
      ]
    }
    var items = []
    for (var i = 0; i < r.matches.length; i++) {
      var m = r.matches[i]
      items.push({
        title: '#' + (i + 1) + ' ' + m.text,
        subtitle: m.groups.length ? '捕获组: ' + m.groups.join(' | ') : '位置 ' + m.index,
        icon: 'regex-line',
        output: m.text,
        matches: r.matches,
        section: '匹配',
        accessories: [{ tag: '@' + m.index }],
        detail: highlightDetail(String(input), String(pattern), parseFlags(flags)),
        detailFormat: 'markdown'
      })
    }
    if (!r.matches.length) {
      items.push({
        title: '无匹配',
        subtitle: '正则与输入没有交集',
        icon: 'regex-line',
        matches: [],
        section: '匹配'
      })
    }
    for (var c = 0; c < COMMON.length; c++) {
      items.push({
        title: '常用：' + COMMON[c].label,
        subtitle: '`' + COMMON[c].pattern + '`',
        icon: 'bookmark-line',
        output: COMMON[c].pattern,
        section: '常用',
        matches: r.matches
      })
    }
    return items
  }

  /** markdown 高亮 detail：把每个匹配包成反引号 */
  function highlightDetail(input, pattern, flags) {
    var re
    try {
      re = new RegExp(pattern, flags.indexOf('g') === -1 ? flags + 'g' : flags)
    } catch (e) {
      void e
      return null
    }
    var out = ''
    var last = 0
    var m
    var guard = 0
    while ((m = re.exec(input)) !== null && guard < 1000) {
      guard++
      if (m[0] === '') {
        re.lastIndex++
        continue
      }
      out += input.slice(last, m.index) + '`' + m[0] + '`'
      last = m.index + m[0].length
    }
    out += input.slice(last)
    return out
  }

  return { parseFlags: parseFlags, test: test, convert: convert, COMMON: COMMON }
})
