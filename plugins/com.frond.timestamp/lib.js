/**
 * Frond · 时间戳转换插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondTimestamplib，vitest（node）走 module.exports。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondTimestamplib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** 纯数字 10 位（秒）或 13 位（毫秒），且落在合理区间 */
  function isTimestamp(text) {
    var str = String(text).trim()
    if (!/^\d{10}(\d{3})?$/.test(str)) return false
    var n = Number(str)
    return n >= 1e9 && n <= 2e12
  }

  /** 时间戳 → { date: Date, unit: 'sec'|'ms' }；输入必须是合法时间戳（调用前可用 isTimestamp 判） */
  function tsToDate(text) {
    var str = String(text).trim()
    var n = Number(str)
    var unit = str.length === 10 ? 'sec' : 'ms'
    return { date: new Date(unit === 'sec' ? n * 1000 : n), unit: unit }
  }

  /** 相对时间（nowMs 缺省用当前时间）：秒/分钟/小时/天，过去为「前」未来为「后」 */
  function relative(tsMs, nowMs) {
    var now = typeof nowMs === 'number' ? nowMs : Date.now()
    var diff = tsMs - now
    var abs = Math.abs(diff)
    var suffix = diff < 0 ? '前' : '后'
    var MIN = 60e3
    var HOUR = 3600e3
    var DAY = 86400e3
    if (abs < MIN) return Math.max(1, Math.round(abs / 1000)) + ' 秒' + suffix
    if (abs < HOUR) return Math.round(abs / MIN) + ' 分钟' + suffix
    if (abs < DAY) return Math.round(abs / HOUR) + ' 小时' + suffix
    return Math.round(abs / DAY) + ' 天' + suffix
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n
  }

  function fmtLocal(d) {
    return (
      d.getFullYear() +
      '-' +
      pad(d.getMonth() + 1) +
      '-' +
      pad(d.getDate()) +
      ' ' +
      pad(d.getHours()) +
      ':' +
      pad(d.getMinutes()) +
      ':' +
      pad(d.getSeconds())
    )
  }

  /** 输入是时间戳 → 3 条解读（本地/UTC/相对）；输入是可解析日期 → 2 条（秒/毫秒）；皆非 → null */
  function convert(text) {
    var str = String(text).trim()
    if (str === '') return null
    if (isTimestamp(str)) {
      var td = tsToDate(str)
      var ms = td.date.getTime()
      return [
        {
          title: fmtLocal(td.date),
          subtitle: '本地时间（' + (td.unit === 'sec' ? '秒级' : '毫秒级') + '时间戳）',
          output: fmtLocal(td.date),
          section: '解读',
          accessories: [{ tag: td.unit === 'sec' ? '秒' : '毫秒' }]
        },
        {
          title: td.date.toISOString(),
          subtitle: 'UTC 时间',
          output: td.date.toISOString(),
          section: '解读',
          accessories: [{ tag: td.unit === 'sec' ? '秒' : '毫秒' }]
        },
        {
          title: relative(ms),
          subtitle: '相对当前时间',
          output: String(ms),
          section: '解读',
          accessories: [{ tag: td.unit === 'sec' ? '秒' : '毫秒' }]
        }
      ]
    }
    var d = new Date(str)
    if (!isNaN(d.getTime())) {
      var sec = Math.floor(d.getTime() / 1000)
      return [
        {
          title: String(sec),
          subtitle: '秒级时间戳（10 位）',
          output: String(sec),
          section: '时间戳',
          accessories: [{ tag: '秒' }]
        },
        {
          title: String(d.getTime()),
          subtitle: '毫秒级时间戳（13 位）',
          output: String(d.getTime()),
          section: '时间戳',
          accessories: [{ tag: '毫秒' }]
        }
      ]
    }
    return null
  }

  return { isTimestamp: isTimestamp, tsToDate: tsToDate, relative: relative, convert: convert }
})
