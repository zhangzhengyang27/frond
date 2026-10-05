/**
 * Frond · JSON↔YAML 插件核心逻辑（lib.js）
 * UMD 双导出：插件页挂 globalThis.FrondJsonyamlLib，vitest（node）走 module.exports。
 * toYAML/parseYAML 抽自原 index.html 内置实现（简化 YAML 子集：块结构/数组/标量）。
 */
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondJsonyamlLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // ─── 简化 YAML 生成器（JSON → YAML）───
  function toYAML(obj, indent, level) {
    indent = indent || 2
    level = level || 0
    var spaces = ' '.repeat(level * indent)
    var result = ''

    if (obj === null || obj === undefined) return 'null\n'
    if (typeof obj === 'boolean') return (obj ? 'true' : 'false') + '\n'
    if (typeof obj === 'number') return obj + '\n'
    if (typeof obj === 'string') {
      if (
        obj === '' ||
        /[:#&*!|>'"%@`,[\]{}]/.test(obj) ||
        /^\s|\s$/.test(obj) ||
        obj === 'true' ||
        obj === 'false' ||
        obj === 'null' ||
        /^-?\d/.test(obj)
      ) {
        return '"' + obj.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"\n'
      }
      return obj + '\n'
    }

    if (Array.isArray(obj)) {
      if (obj.length === 0) return '[]\n'
      for (var i = 0; i < obj.length; i++) {
        var item = obj[i]
        if (item !== null && typeof item === 'object') {
          var itemYaml = toYAML(item, indent, level + 1)
          var lines = itemYaml.split('\n')
          result += spaces + '- ' + lines[0] + '\n'
          for (var j = 1; j < lines.length - 1; j++) {
            result += spaces + '  ' + lines[j] + '\n'
          }
        } else {
          result += spaces + '- ' + toYAML(item, indent, 0)
        }
      }
      return result
    }

    if (typeof obj === 'object') {
      var keys = Object.keys(obj)
      if (keys.length === 0) return '{}\n'
      for (var k = 0; k < keys.length; k++) {
        var key = keys[k]
        var val = obj[key]
        var keyStr = /[:#&*!|>'"%@`,[\]{}]/.test(key) || key === '' ? '"' + key + '"' : key
        if (
          val !== null &&
          typeof val === 'object' &&
          (Array.isArray(val) ? val.length > 0 : Object.keys(val).length > 0)
        ) {
          result += spaces + keyStr + ':\n' + toYAML(val, indent, level + 1)
        } else {
          result += spaces + keyStr + ': ' + toYAML(val, indent, 0)
        }
      }
      return result
    }
    return String(obj) + '\n'
  }

  // ─── 简化 YAML 解析器（YAML → JSON）───
  function parseYAML(text) {
    var lines = text.split('\n').filter(function (l) {
      var trimmed = l.trim()
      return trimmed !== '' && !trimmed.startsWith('#')
    })

    if (lines.length === 0) return {}

    var pos = 0

    function getIndent(line) {
      return line.length - line.trimStart().length
    }

    function parseValue(str) {
      str = str.trim()
      if (str === '' || str === '~' || str === 'null') return null
      if (str === 'true') return true
      if (str === 'false') return false
      if (/^-?\d+$/.test(str)) return parseInt(str, 10)
      if (/^-?\d+\.\d+$/.test(str)) return parseFloat(str)
      if (
        (str.startsWith('"') && str.endsWith('"')) ||
        (str.startsWith("'") && str.endsWith("'"))
      ) {
        return str.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'")
      }
      return str
    }

    function parseBlock(indent) {
      if (pos >= lines.length) return null
      var currentIndent = getIndent(lines[pos])
      if (currentIndent < indent) return null

      var firstContent = lines[pos].trim()
      if (firstContent.startsWith('- ')) {
        return parseArray(indent)
      } else {
        return parseObject(indent)
      }
    }

    function parseArray(indent) {
      var arr = []
      while (pos < lines.length) {
        var line = lines[pos]
        var lineIndent = getIndent(line)
        if (lineIndent < indent) break
        if (lineIndent > indent) break

        var content = line.trim()
        if (!content.startsWith('-')) break

        var afterDash = content.slice(1).trim()
        if (afterDash === '') {
          pos++
          if (pos < lines.length && getIndent(lines[pos]) > indent) {
            arr.push(parseBlock(getIndent(lines[pos])))
          } else {
            arr.push(null)
          }
        } else if (
          afterDash.includes(':') &&
          !afterDash.startsWith('"') &&
          !afterDash.startsWith("'")
        ) {
          var virtualIndent = indent + 2
          lines[pos] = ' '.repeat(virtualIndent) + afterDash
          var obj = parseObject(virtualIndent)
          arr.push(obj)
        } else {
          arr.push(parseValue(afterDash))
          pos++
        }
      }
      return arr
    }

    function parseObject(indent) {
      var obj = {}
      while (pos < lines.length) {
        var line = lines[pos]
        var lineIndent = getIndent(line)
        if (lineIndent < indent) break
        if (lineIndent > indent) break

        var content = line.trim()
        if (content.startsWith('- ')) break

        var colonIdx = findColon(content)
        if (colonIdx === -1) {
          pos++
          continue
        }

        var key = content.slice(0, colonIdx).trim()
        if (
          (key.startsWith('"') && key.endsWith('"')) ||
          (key.startsWith("'") && key.endsWith("'"))
        ) {
          key = key.slice(1, -1)
        }
        var value = content.slice(colonIdx + 1).trim()

        pos++

        if (value === '') {
          if (pos < lines.length && getIndent(lines[pos]) > indent) {
            obj[key] = parseBlock(getIndent(lines[pos]))
          } else {
            obj[key] = null
          }
        } else {
          obj[key] = parseValue(value)
        }
      }
      return obj
    }

    function findColon(str) {
      var inQuote = null
      for (var i = 0; i < str.length; i++) {
        var c = str[i]
        if (inQuote) {
          if (c === inQuote && str[i - 1] !== '\\') inQuote = null
        } else {
          if (c === '"' || c === "'") inQuote = c
          else if (c === ':') return i
        }
      }
      return -1
    }

    return parseBlock(getIndent(lines[0]))
  }

  /** JSON 文本 → YAML 文本 */
  function jsonToYaml(text, indent) {
    return toYAML(JSON.parse(String(text)), indent || 2, 0)
  }

  /** YAML 文本 → JSON 文本（紧凑） */
  function yamlToJson(text) {
    return JSON.stringify(parseYAML(String(text)))
  }

  function looksLikeJson(text) {
    var t = String(text).trim()
    return t[0] === '{' || t[0] === '['
  }

  /** 自动检测方向；条目 { title, output }；两个方向都失败 → null */
  function convert(text, cmd) {
    var str = String(text).trim()
    if (str === '') return null
    var wantJsonToYaml = cmd === 'json2yaml' || (cmd !== 'yaml2json' && looksLikeJson(str))
    if (wantJsonToYaml) {
      try {
        return [{ title: 'JSON → YAML', output: jsonToYaml(str).replace(/\n$/, '') }]
      } catch (e) {
        void e
        return null
      }
    }
    try {
      return [{ title: 'YAML → JSON', output: yamlToJson(str) }]
    } catch (e) {
      void e
      return null
    }
  }

  return { jsonToYaml: jsonToYaml, yamlToJson: yamlToJson, convert: convert }
})
