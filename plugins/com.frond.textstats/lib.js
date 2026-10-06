/**
 * Frond · 文本统计插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondTextstatsLib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondTextstatsLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  function utf8Bytes(str) {
    if (typeof TextEncoder === 'function') return new TextEncoder().encode(str).length
    var b = 0
    for (var i = 0; i < str.length; i++) {
      var c = str.codePointAt(i)
      b += c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
      if (c > 0xffff) i++
    }
    return b
  }

  /** 统计：chars 字符数（码点）、words 词数（CJK 逐字 + ASCII 词）、lines 行数、bytes、readMinutes 按 300 词/分钟 */
  function stats(text) {
    var str = String(text)
    var chars = 0
    for (var i = 0; i < str.length; i++) {
      chars++
      if (str.codePointAt(i) > 0xffff) i++
    }
    var cjk = (str.match(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g) || []).length
    var asciiWords = str
      .replace(/[\u4e00-\u9fff\u3040-\u30ff\uac00-\ud7af]/g, ' ')
      .split(/\s+/)
      .filter(Boolean).length
    var lines = str === '' ? 0 : str.split('\n').length
    var words = cjk + asciiWords
    return {
      chars: chars,
      words: words,
      lines: lines,
      bytes: utf8Bytes(str),
      readMinutes: Math.max(1, Math.ceil(words / 300))
    }
  }

  /** 词频 TopN（ASCII 词按 \w+ 切，CJK 跳过——逐字无词频意义） */
  function topWords(text, n) {
    var tokens =
      String(text)
        .toLowerCase()
        .match(/[a-z0-9_']+/g) || []
    var freq = {}
    for (var i = 0; i < tokens.length; i++) {
      freq[tokens[i]] = (freq[tokens[i]] || 0) + 1
    }
    return Object.keys(freq)
      .map(function (w) {
        return { word: w, count: freq[w] }
      })
      .sort(function (a, b) {
        return b.count - a.count
      })
      .slice(0, n)
  }

  /** 统计组 + 词频 Top10 组 */
  function convert(text) {
    var str = String(text)
    if (str.trim() === '') return null
    var s = stats(str)
    var out = [
      {
        title: String(s.chars),
        subtitle: '字符数',
        output: String(s.chars),
        section: '统计',
        accessories: [{ tag: 'chars' }]
      },
      {
        title: String(s.words),
        subtitle: '词数',
        output: String(s.words),
        section: '统计',
        accessories: [{ tag: 'words' }]
      },
      {
        title: String(s.lines),
        subtitle: '行数',
        output: String(s.lines),
        section: '统计',
        accessories: [{ tag: 'lines' }]
      },
      {
        title: String(s.bytes),
        subtitle: '字节数（UTF-8）',
        output: String(s.bytes),
        section: '统计',
        accessories: [{ tag: 'bytes' }]
      },
      {
        title: s.readMinutes + ' 分钟',
        subtitle: '预计阅读时长（300 词/分钟）',
        output: String(s.readMinutes),
        section: '统计',
        accessories: [{ tag: 'read' }]
      }
    ]
    var tops = topWords(str, 10)
    for (var i = 0; i < tops.length; i++) {
      out.push({
        title: tops[i].word + ' × ' + tops[i].count,
        subtitle: '词频第 ' + (i + 1) + ' 位',
        output: tops[i].word + ': ' + tops[i].count,
        section: '词频 Top10',
        accessories: [{ tag: String(tops[i].count) }]
      })
    }
    return out
  }

  return { stats: stats, topWords: topWords, convert: convert }
})
