/**
 * Frond · CSV↔JSON 插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondCsvjsonLib，vitest（node）走 module.exports。
 * parseCSV/toCSV/jsonToCSV/csvToJSON 抽自原 index.html；分隔符参数化（原硬编码逗号）。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondCsvjsonLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  /** 单阶段状态机：引号内的分隔符/换行都进字段（RFC 4180 语义），空行剔除 */
  function parseCSV(text, delim) {
    delim = delim || ','
    var src = String(text)
    var rows = []
    var row = []
    var field = ''
    var inQuotes = false
    for (var i = 0; i < src.length; i++) {
      var c = src[i]
      if (inQuotes) {
        if (c === '"') {
          if (src[i + 1] === '"') {
            field += '"'
            i++
          } else inQuotes = false
        } else field += c
      } else if (c === '"') {
        inQuotes = true
      } else if (c === delim) {
        row.push(field)
        field = ''
      } else if (c === '\n') {
        row.push(field)
        field = ''
        rows.push(row)
        row = []
      } else if (c === '\r') {
        /* skip */
      } else {
        field += c
      }
    }
    if (field !== '' || row.length > 0) {
      row.push(field)
      rows.push(row)
    }
    return rows.filter(function (r) {
      return !(r.length === 1 && r[0].trim() === '')
    })
  }

  function toCSV(rows, delim) {
    delim = delim || ','
    return rows
      .map(function (row) {
        return row
          .map(function (field) {
            var s = String(field == null ? '' : field)
            if (s.includes(delim) || s.includes('"') || s.includes('\n')) {
              s = '"' + s.replace(/"/g, '""') + '"'
            }
            return s
          })
          .join(delim)
      })
      .join('\n')
  }

  /** JSON 数组（对象数组）→ CSV 文本；header=false 时不写表头行 */
  function jsonToCsv(text, delim, header) {
    var obj = JSON.parse(String(text))
    if (!Array.isArray(obj)) throw new Error('JSON 必须是数组格式')
    if (obj.length === 0) return ''
    var headers = []
    var seen = {}
    for (var i = 0; i < obj.length; i++) {
      var item = obj[i]
      if (item !== null && typeof item === 'object' && !Array.isArray(item)) {
        for (var key in item) {
          if (!seen[key]) {
            seen[key] = true
            headers.push(key)
          }
        }
      }
    }
    if (headers.length === 0) throw new Error('JSON 数组中的对象没有可识别的字段')
    var rows = header === false ? [] : [headers]
    for (var ri = 0; ri < obj.length; ri++) {
      var it = obj[ri]
      var row = headers.map(function (h) {
        var val = it[h]
        if (val === null || val === undefined) return ''
        if (typeof val === 'object') return JSON.stringify(val)
        return val
      })
      rows.push(row)
    }
    return toCSV(rows, delim)
  }

  /** CSV 文本 → JSON（对象数组，首行为表头；数字/布尔/null 自动转换） */
  function csvToJson(text, delim) {
    var rows = parseCSV(String(text), delim)
    if (rows.length === 0) throw new Error('CSV 内容为空')
    var headers = rows[0].map(function (h) {
      return h.trim()
    })
    var data = []
    for (var i = 1; i < rows.length; i++) {
      var row = rows[i]
      var obj = {}
      for (var j = 0; j < headers.length; j++) {
        var val = row[j] !== undefined ? row[j] : ''
        if (val !== '' && !isNaN(Number(val)) && /^-?\d+(\.\d+)?$/.test(val.trim())) {
          val = Number(val)
        } else if (val.toLowerCase() === 'true') {
          val = true
        } else if (val.toLowerCase() === 'false') {
          val = false
        } else if (val === '' || val.toLowerCase() === 'null') {
          val = null
        }
        obj[headers[j]] = val
      }
      data.push(obj)
    }
    return JSON.stringify(data)
  }

  function looksLikeJson(text) {
    var t = String(text).trim()
    return t[0] === '{' || t[0] === '['
  }

  /**
   * 自动检测方向（cmd 'auto'）或显式指定：'json2csv' / 'csv2json'；
   * 'csv-<delim>' 形态指定 csv→json 并用该分隔符（如 csv-semicolon → ';'）。
   * 条目 { title, output }；失败 → null。
   */
  function convert(text, cmd) {
    var str = String(text).trim()
    if (str === '') return null
    var delim = ','
    var wantCsvToJson
    if (cmd === 'csv-semicolon') {
      delim = ';'
      wantCsvToJson = true
    } else if (cmd === 'csv-tab') {
      delim = '\t'
      wantCsvToJson = true
    } else if (cmd === 'csv-comma' || cmd === 'csv2json') {
      wantCsvToJson = true
    } else if (cmd === 'json2csv') {
      wantCsvToJson = false
    } else {
      wantCsvToJson = !looksLikeJson(str)
    }
    try {
      if (wantCsvToJson) {
        return [
          {
            title: 'CSV → JSON（分隔符 ' + (delim === '\t' ? '\\t' : delim) + '）',
            output: csvToJson(str, delim)
          }
        ]
      }
      return [{ title: 'JSON → CSV', output: jsonToCsv(str, delim, true) }]
    } catch (e) {
      void e
      return null
    }
  }

  return { csvToJson: csvToJson, jsonToCsv: jsonToCsv, convert: convert }
})
