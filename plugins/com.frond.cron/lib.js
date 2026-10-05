/**
 * Frond · Cron 解析插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondCronLib，vitest（node）走 module.exports。
 * 解析器抽自原 index.html；getNextRuns 的起始时间参数化（原硬编码 now）。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondCronLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
      var FIELD_NAMES = ['分钟', '小时', '日', '月', '星期']
      var FIELD_RANGES = [
        [0, 59],
        [0, 23],
        [1, 31],
        [1, 12],
        [0, 6]
      ]
      var MONTH_NAMES = [
        '',
        '一月',
        '二月',
        '三月',
        '四月',
        '五月',
        '六月',
        '七月',
        '八月',
        '九月',
        '十月',
        '十一月',
        '十二月'
      ]
      var WEEK_NAMES = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']

      function parseField(field, min, max) {
        var result = []
        var parts = field.split(',')
        for (var i = 0; i < parts.length; i++) {
          var part = parts[i]
          var step = 1
          var stepMatch = part.match(/\/(\d+)$/)
          if (stepMatch) {
            step = parseInt(stepMatch[1], 10)
            part = part.replace(/\/\d+$/, '')
          }
          if (part === '*' || part === '?') {
            for (var v = min; v <= max; v += step) result.push(v)
          } else if (part.includes('-')) {
            var range = part.split('-')
            var start = parseInt(range[0], 10)
            var end = parseInt(range[1], 10)
            for (var v2 = start; v2 <= end; v2 += step) result.push(v2)
          } else {
            var val = parseInt(part, 10)
            if (!isNaN(val)) {
              if (step > 1) {
                for (var v3 = val; v3 <= max; v3 += step) result.push(v)
              } else {
                result.push(val)
              }
            }
          }
        }
        return [...new Set(result)].sort(function (a, b) {
          return a - b
        })
      }
      function describeField(field, index) {
        if (field === '*' || field === '?') return '每' + FIELD_NAMES[index]
        if (field.startsWith('*/')) return '每 ' + field.slice(2) + ' ' + FIELD_NAMES[index]
        if (field.includes('/')) {
          var parts = field.split('/')
          return '从 ' + parts[0] + ' 开始每 ' + parts[1] + ' ' + FIELD_NAMES[index]
        }
        if (field.includes(',')) return FIELD_NAMES[index] + ': ' + field
        if (field.includes('-')) return FIELD_NAMES[index] + ': ' + field
        if (index === 3) return MONTH_NAMES[parseInt(field, 10)] || field
        if (index === 4) return WEEK_NAMES[parseInt(field, 10)] || field
        return field
      }

  /** 解析 5 段 cron → { fields, description } | null（6/7 段取 2-6 段，含秒标记丢失容忍） */
  function parse(expr) {
    var parts = String(expr).trim().split(/\s+/)
    if (parts.length !== 5 && parts.length !== 6 && parts.length !== 7) return null
    var fields5 = parts.length === 5 ? parts : parts.slice(1, 6)
    try {
      var fields = []
      for (var i = 0; i < 5; i++) {
        fields.push(parseField(fields5[i], FIELD_RANGES[i][0], FIELD_RANGES[i][1]))
      }
      var description = '每'
      if (fields5[4] !== '*') description += describeField(fields5[4], 4) + ' '
      if (fields5[3] !== '*') description += describeField(fields5[3], 3) + ' '
      if (fields5[2] !== '*') description += describeField(fields5[2], 2) + ' '
      if (fields5[1] !== '*') description += describeField(fields5[1], 1) + ' '
      if (fields5[0] !== '*') description += describeField(fields5[0], 0) + ' '
      description = description.trim()
      if (description === '每') description = '每分钟'
      return { fields: fields, description: description, fields5: fields5 }
    } catch (e) {
      void e
      return null
    }
  }

  /** 人类可读描述（非法 → 原样返回） */
  function describe(expr) {
    var parsed = parse(expr)
    return parsed ? parsed.description : String(expr)
  }

  /** 下次执行时间（from 缺省 now） */
  function nextRuns(expr, count, from) {
    var parsed = typeof expr === 'string' ? parse(expr) : expr
    if (!parsed) return []
    var runs = []
    var current = new Date((typeof from === 'number' ? new Date(from) : from || new Date()).getTime())
    current.setSeconds(0, 0)
    current.setMinutes(current.getMinutes() + 1)
    var safety = 0
    var fields = parsed.fields
    while (runs.length < count && safety < 200000) {
      safety++
      var minute = current.getMinutes()
      var hour = current.getHours()
      var day = current.getDate()
      var month = current.getMonth() + 1
      var weekday = current.getDay()

      if (fields[0].indexOf(minute) === -1) {
        current.setMinutes(minute + 1)
        continue
      }
      if (fields[1].indexOf(hour) === -1) {
        current.setHours(hour + 1, 0, 0, 0)
        continue
      }
      if (fields[2].indexOf(day) === -1) {
        current.setDate(day + 1)
        current.setHours(0, 0, 0, 0)
        continue
      }
      if (fields[3].indexOf(month) === -1) {
        current.setMonth(month, 1)
        current.setHours(0, 0, 0, 0)
        continue
      }
      if (fields[4].indexOf(weekday) === -1) {
        current.setDate(day + 1)
        current.setHours(0, 0, 0, 0)
        continue
      }
      runs.push(new Date(current.getTime()))
      current.setMinutes(current.getMinutes() + 1)
    }
    return runs
  }

  var COMMON = ['* * * * *', '*/5 * * * *', '0 * * * *', '0 9 * * *', '0 9 * * 1-5', '0 0 * * 0']

  /** 描述 + 下次 5 次 + 字段解释 + 常用快捷；非法表达式 → [] */
  function convert(expr) {
    var parsed = parse(expr)
    if (!parsed) return []
    var items = [
      {
        title: parsed.description,
        subtitle: '表达式: ' + String(expr).trim(),
        icon: 'checkbox-circle-line',
        output: parsed.description,
        accessories: [{ tag: parsed.fields5.length + ' 段' }]
      }
    ]
    var runs = nextRuns(parsed, 5)
    for (var i = 0; i < runs.length; i++) {
      items.push({
        title: runs[i].toLocaleString('zh-CN', { hour12: false }),
        subtitle: '下次执行第 ' + (i + 1) + ' 次',
        icon: 'time-line',
        output: runs[i].toISOString(),
        section: '下次执行',
        accessories: [{ tag: 'T+' + (i + 1) }]
      })
    }
    for (var f = 0; f < 5; f++) {
      items.push({
        title: FIELD_NAMES[f] + ' [' + parsed.fields5[f] + '] → ' + describeField(parsed.fields5[f], f),
        subtitle: '取值范围 ' + FIELD_RANGES[f][0] + '-' + FIELD_RANGES[f][1],
        icon: 'list-settings-line',
        output: parsed.fields5[f],
        section: '字段'
      })
    }
    for (var c = 0; c < COMMON.length; c++) {
      items.push({
        title: COMMON[c],
        subtitle: describe(COMMON[c]),
        icon: 'flashlight-line',
        output: COMMON[c],
        section: '常用'
      })
    }
    return items
  }

  return { parse: parse, describe: describe, nextRuns: nextRuns, convert: convert, COMMON: COMMON }
})
