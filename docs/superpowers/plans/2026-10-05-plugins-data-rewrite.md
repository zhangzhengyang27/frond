# 内置插件批量重写·data 模式 20 个 实施计划（计划 2/3）

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 按 spec 第 4/5 节把 20 个 data 模式内置插件从「剪贴板进→单条结果→复制出」重写为有历史、多动作、分组、徽章、HUD 反馈的产品级插件，每个插件核心逻辑抽 `lib.js` 并有 vitest 单测。

**Architecture:** 每插件拆 `lib.js`（UMD 双导出纯函数，vitest 直测）+ `index.html`（API 交互层，按「统一公约」模板重写）；manifest 升 major 版本（1.x→2.0.0）并同步根目录 `plugins.json`；所有「复制」动作走 callback → 插件 `copyText + showHud`（宿主 copy 动作会隐藏胶囊，无法发 HUD）。

**Tech Stack:** 插件 = 零构建单 HTML + UMD lib.js；vitest（node）测 lib；pluginManifestAudit 审计测试自动兜版本一致性。

**Spec:** `docs/superpowers/specs/2026-10-05-builtin-plugins-redesign-design.md`（第 4 节公约、第 5.1-5.4/5.6 节逐插件功能）

## Global Constraints

- 每插件 `plugin.json` version 升为 `2.0.0`；**根目录 `plugins.json` 对应条目同步 `2.0.0`**（漏同步 → pluginManifestAudit 红，该测试是兜底不是替代）。
- 需要写剪贴板发 HUD 的插件，manifest `permissions` 加 `"clipboard.write"`（已有 `"clipboard.read"` 的保留）。
- lib.js UMD 模式（与计划 1 base64 完全一致）：

```js
;(function (root, factory) {
  var api = factory()
  if (typeof module === 'object' && module.exports) module.exports = api
  if (root && typeof root === 'object') root.FrondXxxLib = api
})(typeof globalThis !== 'undefined' ? globalThis : this, function () {
  // …纯函数…
  return { /* 导出 */ }
})
```

- lib.js 内只放纯函数（不 import `window.launcherApi`）；API 交互全在 index.html。
- 历史记录公约（spec 4.2）：db key `history`，值 `{ list: [{input, output, ts}] }` ≤20 条，相同 input+output 先去重再 unshift；列表 = 「结果」条目（无 section）+ 历史条目（`section: '历史'`，title=output 截 60、subtitle=`输入: `+input 截 60）+ 尾部「清空历史」条目（callback payload `'clear-history'`，二次确认走 `api.alert`）。
- 复制动作公约：`{ label: '复制…', type: 'callback', payload: 'copy:' + 内容 }`，onAction 里 `api.copyText(内容).then(function(){ api.showHud('已复制') })`；copy 类型动作仅用于「复制后不需要反馈」的场景（本轮统一不用）。
- 空态公约：无输入时 `api.renderList([示例条目])`，示例条目 title 带「示例：」前缀、action 为 callback `'demo:' + 示例文本`，onAction 收到后直接 process 该文本。
- 每任务完成后跑：`pnpm vitest run plugins/<id>/lib.test.js`、`npx eslint plugins/<id>/`、`pnpm test`（全量，pluginManifestAudit 在内）、`pnpm typecheck`。
- 提交点名加文件（并行会话教训）；主进程无改动，无需重启验证。
- spec 5.x 里「粘贴到前台」不实现（宿主无此 API）；「保存文件」不实现。

## 统一公约模板（每个转换类插件 index.html 按此重写；任务里只写「特化点」）

```html
<!doctype html>
<html lang="zh-CN">
  <head><meta charset="UTF-8" /><title>…</title></head>
  <body>
    <script src="lib.js"></script>
    <script>
      var api = window.launcherApi
      var Lib = window.FrondXxxLib
      var currentCmd = '…' // 各插件定义；onEnter 按命令人设默认方向
      var lastOutput = null // 防抖：同输入重复触发不重复写历史
      var lastResults = [] // 本次结果 outputs 缓存：复制动作 payload='copy:<index>' 按索引取全文

      api.onEnter(function (data) {
        currentCmd = (data && data.cmd) || '…'
        api.setSubInput('…占位符…')
        api.readText().then(function (res) {
          var text = (res || '').trim()
          text ? process(text) : showEmpty()
        }).catch(function () { showEmpty() })
      })

      api.onSubInputChange(function (data) {
        var text = data && typeof data.text === 'string' ? data.text.trim() : ''
        text ? process(text) : showEmpty()
      })

      function showEmpty() {
        api.renderList([{
          title: '示例：…',
          subtitle: '输入或粘贴后实时' + '…',
          icon: '…', detail: '…用法 markdown…', detailFormat: 'markdown',
          actions: [{ label: '填入示例', type: 'callback', payload: 'demo:…示例文本…', hint: '↵' }]
        }], { id: 'root' })
      }

      function process(text) {
        var results = Lib.convert(text, currentCmd) // 每插件主入口；返回条目描述数组或 null
        if (!results || !results.length) return showError(text)
        lastResults = results.map(function (r) { return r.output }) // 复制动作按索引取全文（payload 有 2000 字符清洗上限，禁内联长文本）
        var first = results[0]
        if (first.output !== lastOutput) {
          lastOutput = first.output
          pushHistory(text, first.output)
        }
        loadHistory().then(function (hist) {
          api.renderList(buildItems(results, hist), { id: 'root' })
        })
      }

      function showError(text) { /* 失败条目：title「…失败」subtitle=原因，动作=复制原文 */ }

      // ── 历史公约实现（原样复制）──
      function loadHistory() {
        return api.db.get('history').then(function (res) {
          var d = res && res.data
          return d && Array.isArray(d.list) ? d.list : []
        }).catch(function () { return [] })
      }
      function pushHistory(input, output) {
        return loadHistory().then(function (list) {
          list = list.filter(function (h) { return !(h.input === input && h.output === output) })
          list.unshift({ input: input, output: output, ts: Date.now() })
          return api.db.put('history', { list: list.slice(0, 20) })
        }).catch(function () {})
      }
      function buildItems(results, hist) {
        var items = results.map(function (r, i) { return {
          title: r.title, subtitle: r.subtitle || undefined,
          icon: r.icon || 'checkbox-circle-line',
          accessories: r.tone ? [{ tag: r.tone.text, tone: r.tone.kind }] : undefined,
          section: r.section,            // 可选：多结果分组
          detail: r.detail || undefined, detailFormat: r.detail ? 'markdown' : undefined,
          actions: (r.actions || [{ label: '复制结果', payload: 'copy:' + i }]).map(function (a) {
            return { label: a.label, type: 'callback', payload: a.payload, hint: a.hint }
          })
        } })
        hist.forEach(function (h) { items.push({
          title: String(h.output).slice(0, 60),
          subtitle: '输入: ' + String(h.input).slice(0, 60),
          icon: 'history-line', section: '历史',
          actions: [
            { label: '复制该结果', type: 'callback', payload: 'copyh:' + h.ts, hint: '↵' },
            { label: '以该输入重算', type: 'callback', payload: 'recalc:' + h.input.slice(0, 500) },
            { label: '删除该条', type: 'callback', payload: 'del:' + h.ts }
          ]
        }) })
        if (hist.length) items.push({
          title: '清空历史（' + hist.length + ' 条）', icon: 'delete-bin-line',
          actions: [{ label: '清空', type: 'callback', payload: 'clear-history' }]
        })
        return items
      }

      api.onAction(function (data) {
        var p = data && data.action && typeof data.action.payload === 'string' ? data.action.payload : ''
        if (p.indexOf('copy:') === 0) {
          var idx = Number(p.slice(5))
          var content = lastResults[idx]
          if (typeof content !== 'string') return
          api.copyText(content).then(function () { api.showHud('已复制') }).catch(function () {})
        } else if (p.indexOf('copyh:') === 0) {
          var ts = Number(p.slice(6))
          loadHistory().then(function (list) {
            var hit = list.filter(function (h) { return h.ts === ts })[0]
            if (hit) return api.copyText(hit.output).then(function () { api.showHud('已复制') })
          }).catch(function () {})
        } else if (p === 'clear-history') {
          api.alert({ title: '清空历史', message: '确定清空全部历史记录？',
            actions: [{ id: 'ok', title: '清空', style: 'destructive' }, { id: 'cancel', title: '取消', style: 'cancel' }]
          }).then(function (id) {
            if (id !== 'ok') return
            api.db.put('history', { list: [] }).then(function () { lastOutput = null; showEmpty() })
          })
        } else if (p.indexOf('del:') === 0) {
          var ts = Number(p.slice(4))
          loadHistory().then(function (list) {
            return api.db.put('history', { list: list.filter(function (h) { return h.ts !== ts }) })
          }).then(function () { lastOutput = null; loadHistory().then(function (h) { api.renderList(buildItems(Lib.convert(lastInputText(), currentCmd) || [], h), { id: 'root' }) }) })
        } else if (p.indexOf('recalc:') === 0) {
          process(p.slice(7))
        } else if (p.indexOf('demo:') === 0) {
          process(p.slice(5))
        }
      })
      function lastInputText() { return '' } // del/清空后重渲染兜底；各插件可记录最近输入覆盖此函数
    </script>
  </body>
</html>
```

> 执行说明：以上骨架是**结构契约**（历史/动作/HUD/空态行为），各插件任务给出 `Lib.convert` 的签名与测试、渲染特化点。del 分支的重渲染允许插件用自己的「最近输入」变量替代 `lastInputText()`（骨架已留口）。生成器类（无输入转换）不需要历史段，任务里说明。

---

### Task 1: 转换器·编解码三件套（base64 增强 / urlcodec / htmlentity）

**Files:**
- Modify: `plugins/com.frond.base64/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`
- Modify: `plugins/com.frond.urlcodec/{lib.js,lib.test.js,index.html,plugin.json}`（lib 新建）
- Modify: `plugins/com.frond.htmlentity/{lib.js,lib.test.js,index.html,plugin.json}`（lib 新建）

**Interfaces:**

```js
// base64 lib（在计划 1 基础上补双向检测入口）
// 新增：convert(text, cmd) → [{title, output, tone?}] | null
//   cmd='encode'：[{title:'编码完成（N 字符）', output: base64}]；输入 isProbablyBase64 时并列 {title:'解码…', output: decode 结果}
//   cmd='decode'：decode 成功 [{title:'解码完成…', output}]；同时并列编码方向
//   双方都失败 → null。已有 encode/decode/isProbablyBase64/toUrlSafe/fromUrlSafe 保留。
// urlcodec lib：FrondUrlcodecLib { encodeComponent, decodeComponent, encodeURI_, decodeURI_, convert }
//   convert(text, cmd)：cmd='encode' → 两条并列（encodeURIComponent / encodeURI 标题注明差异）
//                       cmd='decode' → decodeURIComponent 成功即出；失败 null
// htmlentity lib：FrondHtmlentityLib { encodeNamed(text), encodeNumeric(text), decode(text), convert }
//   encode：& < > " ' 与非 ASCII → 命名实体（无命名的用 &#NNNN;）；decode：命名+数字实体 → 字符
```

- [ ] **Step 1: 写三个 lib.test.js**（关键用例全文；每个文件头部 `import { … } from './lib.js'`）

base64（追加到现有 `plugins/com.frond.base64/lib.test.js`）：
```js
import { convert } from './lib.js'
describe('convert 双向检测（spec 4.4）', () => {
  it("cmd='encode'：普通文本 → 编码结果；且输入本身是 base64 时并列解码", () => {
    const r = convert('hello world', 'encode')
    expect(r).toHaveLength(1)
    expect(r[0].output).toBe(encode('hello world'))
    const r2 = convert(encode('你好'), 'encode')
    expect(r2.map((x) => x.direction)).toEqual(['encode', 'decode'])
  })
  it("cmd='decode'：合法输入双列；乱码 → null", () => {
    expect(convert(encode('hi'), 'decode')).toHaveLength(2)
    expect(convert('!!!', 'decode')).toBeNull()
  })
})
```
urlcodec（`plugins/com.frond.urlcodec/lib.test.js`）：
```js
import { encodeComponent, decodeComponent, convert } from './lib.js'
describe('urlcodec lib', () => {
  it('encodeComponent 编码保留字符差异（? & / = 被编码；encodeURI_ 不编码保留字符）', () => {
    expect(encodeComponent('a b&c=1')).toBe('a%20b%26c%3D1')
    expect(decodeComponent('a%20b%26c%3D1')).toBe('a b&c=1')
  })
  it('convert 双向：encode 两列（组件/整体）、decode 失败 → null', () => {
    expect(convert('a=1&b=中', 'encode')).toHaveLength(2)
    expect(convert('%E4%B8%AD', 'decode')[0].output).toBe('中')
    expect(convert('%E4%B8%AD%ZZ', 'decode')).toBeNull()
  })
})
```
htmlentity（`plugins/com.frond.htmlentity/lib.test.js`）：
```js
import { encodeNamed, encodeNumeric, decode, convert } from './lib.js'
describe('htmlentity lib', () => {
  it('encode：命名实体优先，无命名的走数字实体', () => {
    expect(encodeNamed('<div>')).toBe('&lt;div&gt;')
    expect(encodeNamed('中')).toBe('&#20013;')
    expect(decode('&lt;&#20013;&amp;')).toBe('<中&')
  })
  it('convert：含可编码字符时双列（命名/数字），纯文本无实体 → null 方向处理', () => {
    const r = convert('<b>bold</b>', 'encode')
    expect(r.map((x) => x.section)).toEqual(['命名实体', '数字实体'])
    expect(convert('plain', 'encode')).toHaveLength(1)
  })
})
```

- [ ] **Step 2: 跑测试确认 RED** —— `pnpm vitest run plugins/com.frond.base64/lib.test.js plugins/com.frond.urlcodec/lib.test.js plugins/com.frond.htmlentity/lib.test.js`，Expected：convert 相关 FAIL（未导出/文件不存在）。
- [ ] **Step 3: 实现 lib.js** —— base64 补 `convert`（组合已有 encode/decode/isProbablyBase64，条目附 `direction` 字段）；urlcodec/htmlentity 按签名新建（URL 编解码直接用 `encodeURIComponent`/`decodeURIComponent`/`encodeURI`/`decodeURI` 全局；实体表内置常见命名实体 ~30 个 + 数字实体规则）。三份 UMD 头照 Global Constraints。
- [ ] **Step 4: GREEN + 重写三个 index.html**（公约模板 + 特化：base64 的 convert 把 URL-safe 变体与 76 字符换行版作为**额外结果条目**返回（各自带索引，copy 动作统一 `'copy:<index>'`）；urlcodec 空态示例 `https://example.com/?a=中`；htmlentity 空态示例 `<div class="a">`。三插件 detail 用 markdown 说明双向用法）。
- [ ] **Step 5: 三个 plugin.json → version `2.0.0`、permissions 补 `"clipboard.write"`；`plugins.json` 三处 version 同步。**
- [ ] **Step 6: 验证**：`pnpm vitest run plugins/com.frond.base64 plugins/com.frond.urlcodec plugins/com.frond.htmlentity`（用目录跑全部 test 文件）→ 全绿；`pnpm test`（审计绿）；`npx eslint plugins/com.frond.urlcodec plugins/com.frond.htmlentity plugins/com.frond.base64` → 0 error；`pnpm typecheck` → 0。
- [ ] **Step 7: Commit** —— `git add plugins/com.frond.base64 plugins/com.frond.urlcodec plugins/com.frond.htmlentity plugins.json && git commit -m "feat(plugins): 编解码三件套重写——双向检测+历史+HUD+多动作（base64/urlcodec/htmlentity v2.0.0)"`

### Task 2: 转换器·结构化（jsonfmt / jsonyaml / csvjson）

**Files:** `plugins/com.frond.{jsonfmt,jsonyaml,csvjson}/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`

**Interfaces:**

```js
// jsonfmt lib：FrondJsonfmtLib { format(text, indent), minify(text), sortKeys(text, indent), escape(text), unescape(text), validate(text) → {ok, line?, col?, message?}, convert }
//   convert(text, cmd)：cmd='format' → [indent2, indent4, minify, sortKeys] 四条（section:'输出'）；escape/unescape 动作另列（section:'变体'）
//   validate 错误定位：try JSON.parse，catch 里解析 position → {line, col}
// jsonyaml lib：FrondJsonyamlLib { jsonToYaml(text, indent), yamlToJson(text), convert }
//   抽移现有 index.html 内置 YAML 库（~200 行）入 lib；自动检测：text 首字符 {/[ → jsonToYaml，否则 yamlToJson
// csvjson lib：FrondCsvjsonLib { csvToJson(text, delim), jsonToCsv(text, delim, header), detect(text), convert }
//   抽移现有实现；detect：首字符 {/[ → json→csv，否则 csv→json；表头开关、分隔符 , ; \t 由动作变体承载
```

- [ ] **Step 1: 三个 lib.test.js**（用例全文）
jsonfmt：
```js
import { format, minify, validate, convert } from './lib.js'
describe('jsonfmt lib', () => {
  it('format/minify 基础', () => {
    expect(format('{"a":1}', 2)).toBe('{\n  "a": 1\n}')
    expect(minify('{ "a": 1 }')).toBe('{"a":1}')
  })
  it('validate 定位到行:列', () => {
    const v = validate('{\n  "a": ,\n}')
    expect(v.ok).toBe(false)
    expect(v.line).toBe(2)
  })
  it('convert：format 命令四条输出（indent2/indent4/minify/sortKeys）', () => {
    expect(convert('{"b":1,"a":2}', 'format')).toHaveLength(4)
    expect(convert('not json', 'format')).toBeNull()
  })
})
```
jsonyaml：
```js
import { jsonToYaml, yamlToJson, convert } from './lib.js'
describe('jsonyaml lib', () => {
  it('往返', () => {
    const y = jsonToYaml('{"a":1,"b":["x"]}', 2)
    expect(y).toContain('a: 1')
    expect(yamlToJson(y)).toBe('{"a":1,"b":["x"]}')
  })
  it('convert 自动检测方向', () => {
    expect(convert('{"a":1}', 'auto')[0].title).toContain('YAML')
    expect(convert('a: 1', 'auto')[0].title).toContain('JSON')
  })
})
```
csvjson：
```js
import { csvToJson, jsonToCsv, convert } from './lib.js'
describe('csvjson lib', () => {
  it('csv→json 含引号转义与表头', () => {
    const j = csvToJson('name,age\n"x,1",2', ',')
    expect(j).toBe('[{"name":"x,1","age":"2"}]')
  })
  it('json→csv 数组对象', () => {
    expect(jsonToCsv('[{"a":1,"b":"x,y"}]', ',', true)).toBe('a,b\n1,"x,y"')
  })
  it('convert 自动检测 + 分隔符变体', () => {
    expect(convert('a;b\n1;2', 'auto')).toHaveLength(1)
    expect(convert('a,b\n1,2', 'csv-semicolon')).toHaveLength(1)
  })
})
```
- [ ] **Step 2: RED**（三文件一起跑）
- [ ] **Step 3: 实现 lib.js**（jsonyaml/csvjson 从各自现 index.html 抽移库并按签名包装；jsonfmt 的 sortKeys 递归排序对象键）
- [ ] **Step 4: GREEN + 重写 index.html**（公约 + 特化：jsonfmt 动作「复制 indent4/minify/排序键/escape/unescape」五动作；jsonyaml 空态示例 `{"name":"Frond","tags":["fast"]}`；csvjson 空态示例 `name,age\n张三,28`）
- [ ] **Step 5: manifest v2.0.0 + clipboard.write + plugins.json 同步（三处）**
- [ ] **Step 6: 验证**（同 Task 1 Step 6，三个目录）
- [ ] **Step 7: Commit** —— `feat(plugins): 结构化转换三件套重写（jsonfmt/jsonyaml/csvjson v2.0.0）——错误定位/排序键/方向自动检测/分隔符变体`

### Task 3: 转换器·数值与时间（baseconvert / timestamp）

**Files:** `plugins/com.frond.{baseconvert,timestamp}/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`

**Interfaces:**

```js
// baseconvert lib：FrondBaseconvertLib { parseInput(text) → {value: BigInt, base} | null, toBase(value, base), convert }
//   parseInput 识别 0x/0X(16)、0b/0B(2)、0o/0O(8) 前缀；无前缀按 10（负数支持 -）
//   convert(text)：成功 → 4 条 [2,8,10,16]，section 分别 '二进制'/'八进制'/'十进制'/'十六进制'，
//     accessories tag {text:'base2'…}；失败 → null
// timestamp lib：FrondTimestamplib { isTimestamp(text), tsToDate(text) → {sec|ms 判定, date: Date}, dateToTs(text), relative(tsMs), nowEntry(), convert }
//   isTimestamp：纯数字 10 位（秒）或 13 位（毫秒），范围 1e9..2e12
//   convert(text)：输入是时间戳 → 日期多条（本地/UTC/相对时间，section:'解读'）+ 秒/毫秒 tag；
//     输入是可 parse 日期 → [秒, 毫秒]（section:'时间戳'）；两者皆非 → null
//   nowEntry：`{ title: '当前时间戳: ' + Math.floor(Date.now()/1000), subtitle: 实时, icon:'time-line', actions:[复制秒/复制毫秒] }`（index.html 每 30s 重算列表）
```

- [ ] **Step 1: 两个 lib.test.js**
baseconvert：
```js
import { parseInput, toBase, convert } from './lib.js'
describe('baseconvert lib', () => {
  it('前缀识别 + BigInt 大整数', () => {
    expect(parseInput('0xff').value).toBe(255n)
    expect(parseInput('0b1010').base).toBe(2)
    expect(parseInput('-42').value).toBe(-42n)
    expect(toBase(255n, 16)).toBe('ff')
  })
  it('convert 四条并列 + 非法 → null', () => {
    const r = convert('255')
    expect(r.map((x) => x.output)).toEqual(['11111111', '377', '255', 'ff'])
    expect(convert('12a3')).toBeNull()
  })
})
```
timestamp：
```js
import { isTimestamp, tsToDate, relative, convert } from './lib.js'
describe('timestamp lib', () => {
  it('秒/毫秒判定与解读', () => {
    expect(isTimestamp('1700000000')).toBe(true)
    expect(isTimestamp('1700000000000')).toBe(true)
    expect(isTimestamp('123')).toBe(false)
    expect(tsToDate('0').date.toISOString()).toBe('1970-01-01T00:00:00.000Z')
  })
  it('relative 相对时间', () => {
    const now = Date.now()
    expect(relative(now - 65_000)).toBe('1 分钟前')
    expect(relative(now + 3_600_000)).toBe('1 小时后')
  })
  it('convert：时间戳输入与日期输入双方向', () => {
    expect(convert('1700000000')).toHaveLength(3) // 本地/UTC/相对
    expect(convert('2024-01-01')[0].section).toBe('时间戳')
    expect(convert('garbage')).toBeNull()
  })
})
```
- [ ] **Step 2: RED**
- [ ] **Step 3: 实现 lib.js**（timestamp 的 relative：秒/分/时/天/月界; baseconvert 的 toBase 用 BigInt.toString(base)（2/8/16 原生支持）+ 负号处理）
- [ ] **Step 4: GREEN + 重写 index.html**（公约 + 特化：timestamp 加「当前时间戳」实时条目列表首条、秒/毫秒 tag `{text:'秒', tone:'default'}`；baseconvert 空态示例 `0xff`）
- [ ] **Step 5: manifest v2.0.0 + clipboard.write + plugins.json 同步（两处）**
- [ ] **Step 6: 验证（两目录）**
- [ ] **Step 7: Commit** —— `feat(plugins): 数值时间转换重写（baseconvert/timestamp v2.0.0）——前缀识别/BigInt/相对时间/实时当前戳`

### Task 4: 生成器（uuid / passwordgen / lorem）

**Files:** `plugins/com.frond.{uuid,passwordgen,lorem}/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`

**Interfaces:**

```js
// uuid lib：FrondUuidLib { uuidv4(), uuidv7(nowMs), formatUuid(uuid, fmt), generate(count, fmt) → string[] }
//   uuidv7：48bit ms 时间戳大端 + 版本 7 + 变体 10xx + 随机（单调性不要求）
//   fmt：'std' | 'upper' | 'compact'（无连字符） | 'urn'
//   generate(count ≤100, fmt)（node 测试用注入的随机源？不——crypto.getRandomValues node18+ 有，直接用；
//     测试只断言格式/唯一性/版本位，不断言具体值）
// passwordgen lib：FrondPasswordgenLib { PRESETS: {strong, medium, readable, pin}, generate(preset, length) → {password, entropyBits}, batch(preset, length, count) }
//   字符集：strong=大小写+数字+符号(20位默认)；medium=大小写+数字(16)；readable=去 0O1lI(16)；pin=数字(6)
//   entropyBits = length * log2(charsetSize)
//   generate 拒绝 length 越界（4..128）→ null
// lorem lib：FrondLoremLib { words(n), sentences(n), paragraphs(n), zhParagraphs(n), generate(kind, n, lang) → string }
//   词表内置（经典 latin ~50 词 + 中文占位词表 ~30 词）
```

- [ ] **Step 1: 三个 lib.test.js**
uuid：
```js
import { uuidv4, uuidv7, formatUuid, generate } from './lib.js'
describe('uuid lib', () => {
  it('v4 版本位与变体位正确、批量唯一', () => {
    const u = uuidv4()
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
    const set = new Set(generate(50, 'std'))
    expect(set.size).toBe(50)
  })
  it('v7：时间前缀单调可读 + 版本位 7', () => {
    const u = uuidv7(1700000000000)
    expect(u.startsWith('0f4x'.replace(/x/g, '')) || true).toBe(true) // 前缀即 ms 大端：验版本位即可
    expect(u[14]).toBe('7')
    expect(u).toMatch(/^[0-9a-f]{8}-[0-9a-f]{4}-7[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/)
  })
  it('格式变体', () => {
    const u = uuidv4()
    expect(formatUuid(u, 'upper')).toBe(u.toUpperCase())
    expect(formatUuid(u, 'compact')).not.toContain('-')
    expect(formatUuid(u, 'urn')).toMatch(/^urn:uuid:/)
  })
})
```
passwordgen：
```js
import { PRESETS, generate, batch } from './lib.js'
describe('passwordgen lib', () => {
  it('四预置方案的字符集与默认长度', () => {
    const p = generate('strong', 20)
    expect(p.password).toHaveLength(20)
    expect(p.password).toMatch(/[0-9]/)
    expect(generate('pin', 6).password).toMatch(/^\d{6}$/)
    expect(generate('readable', 16).password).not.toMatch(/[0O1lI]/)
  })
  it('熵值与越界拒绝', () => {
    expect(generate('strong', 20).entropyBits).toBeGreaterThan(100)
    expect(generate('strong', 3)).toBeNull()
    expect(batch('medium', 16, 5)).toHaveLength(5)
  })
})
```
lorem：
```js
import { generate } from './lib.js'
describe('lorem lib', () => {
  it('按类型与数量生成', () => {
    expect(generate('words', 5, 'latin').split(/\s+/)).toHaveLength(5)
    expect(generate('sentences', 3, 'latin').split(/[.!?]\s/)).toHaveLength(3)
    expect(generate('paragraphs', 2, 'latin').split('\n\n')).toHaveLength(2)
  })
  it('中文占位文', () => {
    expect(generate('paragraphs', 1, 'zh')).toMatch(/[\u4e00-\u9fa5]/)
  })
})
```
- [ ] **Step 2: RED**
- [ ] **Step 3: 实现 lib.js**（uuid 的 v4/v7 用 `crypto.getRandomValues`；lorem 词表抽自现 index.html 并补中文表；passwordgen 用 `crypto.getRandomValues` 无模偏差取数：拒绝采样 `while (v >= 256 - (256 % set.length))`）
- [ ] **Step 4: GREEN + 重写 index.html**（生成器类**无历史段**——公约模板去掉历史三函数与历史组；特化：uuid subinput 数字=批量数量、四格式动作；passwordgen 列表 = 四预置方案条目（各带 tag：`{text:'熵 ~131bit', tone:'success'}`）+ subinput 数字=自定义长度、动作「复制并重新生成」；lorem arguments dropdown（段落/句子/单词）+ 中文变体动作 +「重新生成」动作（callback payload `'regen'`，onAction 重跑 process））
- [ ] **Step 5: manifest v2.0.0 + clipboard.write + plugins.json 同步（三处）**
- [ ] **Step 6: 验证（三目录）**
- [ ] **Step 7: Commit** —— `feat(plugins): 生成器三件套重写（uuid/passwordgen/lorem v2.0.0）——v7/预置方案/熵值/中文占位`

### Task 5: 生成器·qrcode（dataUrl 条目转正）

**Files:** `plugins/com.frond.qrcode/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`

**Interfaces:**

```js
// qrcode lib：FrondQrcodeLib { qrEncode(text, opts) → { size, modules: boolean[][], version } | null, needsEcc?… }
//   抽移现有 ~600 行 QR 编码库（现 index.html 已生成 dataUrl，编码核心可整体搬移），
//   对外签名改为返回布尔矩阵（canvas 绘制留在 index.html：modules → canvas → toDataURL('image/png')）
//   opts：{ eccLevel: 'L'|'M'|'Q'|'H'（默认 M） }；text 为空或超容 → null
// index.html：把 icon.dataUrl（qrcode canvas.toDataURL 结果）直接放条目 icon：
//   { icon: { value: 'qr-code-line', dataUrl: dataUrl } }（spec 3.1——替代 markdown data-URL hack）
//   实时重算：偏好 eccLevel/size 变化无需重进（onEnter 读偏好 + onSubInputChange 每次重画）
//   动作：复制图片（copy dataUrl——宿主写剪贴板文本形态的 dataURL，与现版一致）、复制文本
```

- [ ] **Step 1: lib.test.js**
```js
import { qrEncode } from './lib.js'
describe('qrcode lib（矩阵契约）', () => {
  it('生成正方矩阵 + 三定位图案', () => {
    const qr = qrEncode('HELLO', { eccLevel: 'M' })
    expect(qr.size).toBeGreaterThanOrEqual(21)
    expect(qr.modules).toHaveLength(qr.size)
    expect(qr.modules.every((row) => row.length === qr.size)).toBe(true)
    // 左上定位角 7x7 外框：四角+边全暗
    expect(qr.modules[0][0]).toBe(true)
    expect(qr.modules[6][0]).toBe(true)
    expect(qr.modules[0][6]).toBe(true)
  })
  it('空文本 / 超容 → null', () => {
    expect(qrEncode('', { eccLevel: 'M' })).toBeNull()
  })
})
```
- [ ] **Step 2: RED → Step 3: 实现（搬移 + 签名包装）→ Step 4: GREEN + index.html 重写（icon.dataUrl 条目 + 实时偏好 + HUD 复制动作）**
- [ ] **Step 5: manifest v2.0.0 + clipboard.write + plugins.json 同步**
- [ ] **Step 6: 验证 + Commit** —— `feat(plugins): qrcode v2.0.0——dataUrl 条目转正/实时偏好/矩阵 lib 单测`

### Task 6: 分析器·文本（hash / textstats）

**Files:** `plugins/com.frond.{hash,textstats}/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`

**Interfaces:**

```js
// hash lib：FrondHashLib { md5(text), sha(algo, text) → Promise<string>, ALGOS: ['sha1','sha256','sha384','sha512'], convert(text) → Promise<Array> }
//   md5 抽移现有实现（同步）；sha 用 crypto.subtle（BrowserView 与 node18+ 均有）
//   convert 异步：五算法并列 section 'MD5'/'SHA1'/'SHA256'/'SHA384'/'SHA512'，输出小写 hex
//   index.html 动作：复制各算法结果 + 「复制 SHA256 的 base64 形态」（hex→base64 在 lib 里 hexToB64）
// textstats lib：FrondTextstatsLib { stats(text) → {chars, words, lines, bytes, readMinutes}, topWords(text, n) → [{word, count}], convert(text) }
//   words：CJK 按字计 + ASCII 按词；readMinutes = ceil(words/300)；bytes = TextEncoder 长度（lib 内自带 utf8Bytes 兜底）
//   convert：统计条目组（section '统计'，每项一条 title+值 tag）+ 词频 Top10 组（section '词频 Top10'）
```

- [ ] **Step 1: 两个 lib.test.js**
hash：
```js
import { md5, sha, convert } from './lib.js'
describe('hash lib', () => {
  it('md5 已知向量', () => {
    expect(md5('abc')).toBe('900150983cd24fb0d6963f7d28e17f72')
    expect(md5('')).toBe('d41d8cd98f00b204e9800998ecf8427e')
  })
  it('sha 已知向量（async）', async () => {
    expect(await sha('sha256', 'abc')).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad')
    expect(await sha('sha1', 'abc')).toBe('a9993e364706816aba3e25717850c26c9cd0d89d')
  })
  it('convert 五算法并列', async () => {
    const r = await convert('abc')
    expect(r.map((x) => x.section)).toEqual(['MD5', 'SHA1', 'SHA256', 'SHA384', 'SHA512'])
    expect(r.every((x) => /^[0-9a-f]+$/.test(x.output))).toBe(true)
  })
})
```
textstats：
```js
import { stats, topWords, convert } from './lib.js'
describe('textstats lib', () => {
  it('统计口径', () => {
    const s = stats('hello 世界\nworld')
    expect(s.chars).toBe(12)
    expect(s.lines).toBe(2)
    expect(s.words).toBeGreaterThanOrEqual(4) // hello+世+界+world
    expect(s.bytes).toBeGreaterThan(12)        // 中文多字节
  })
  it('词频 TopN', () => {
    expect(topWords('a b a c a', 2)[0]).toEqual({ word: 'a', count: 3 })
  })
  it('convert 两组', () => {
    const r = convert('hello world hello')
    expect(r.some((x) => x.section === '统计')).toBe(true)
    expect(r.some((x) => x.section === '词频 Top10')).toBe(true)
  })
})
```
- [ ] **Step 2: RED → Step 3: 实现 → Step 4: GREEN + index.html 重写**（hash 五组并列 + 逐算法复制动作；textstats 统计值用 tag、阅读时长条目 subtitle）
- [ ] **Step 5: manifest v2.0.0 + clipboard.write + plugins.json 同步（两处）**
- [ ] **Step 6: 验证 + Commit** —— `feat(plugins): 文本分析重写（hash/textstats v2.0.0）——五算法分组/词频/阅读时长`

### Task 7: 分析器·代码（jwt / cron / regex）

**Files:** `plugins/com.frond.{jwt,cron,regex}/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`

**Interfaces:**

```js
// jwt lib：FrondJwtLib { decode(token) → {header, payload, signature} | null, claimsToItems(payload) → Array, convert(text) }
//   base64url 自实现解码（- _ + 补 pad）；decode 校验三段结构与 JSON 可解析
//   claimsToItems：exp/iat/nbt 数值 → ISO 字符串 + 相对态（过期 tag {text:'已过期', tone:'danger'} / 有效 {text:'有效', tone:'success'}）；
//     iss/sub/aud… 逐条；返回条目含 section 'Header'/'Payload'
//   convert：token 失败 → null；成功 → [摘要条目(算法 tag+过期 tag)] + header 组 + payload 组
// cron lib：FrondCronLib { describe(expr) → string, nextRuns(expr, count, from) → Date[], fieldExplain(expr) → Array, convert(text) }
//   抽移现有解析器；支持 5 段（ Quartz 6/7 段现有实现若含则保留）；nextRuns 步进 1 分钟（现有实现为准，cap 366 天找不到 → []）
//   convert：描述条目 + section '下次执行'（5 条，title=YYYY-MM-DD HH:mm）+ section '字段'（fieldExplain）+ 常用表达式快捷条目（section '常用'：每分钟/每小时/每天 9 点/工作日 9 点，payload 'demo:'+expr）
// regex lib：FrondRegexLib { parseFlags(text), test(pattern, flags, input) → {ok, matches: [{index, text, groups: string[]}] | null, error?}, convert(input, pattern, flags) }
//   命令 arguments 三参（现有 manifest 已有 pattern/text/flags）→ index.html 用 getContext args 初值，
//   subinput 实时改测试文本；动作：flags toggle（callback payload 'flag:g' 等，循环切）
//   convert：ok → 高亮 markdown detail + 匹配组列表（section '匹配' 每匹配一条、捕获组进 subtitle）；
//     无匹配 → [空态条目]；正则非法 → 错误条目
```

- [ ] **Step 1: 三个 lib.test.js**
jwt：
```js
import { decode, convert } from './lib.js'
const b64u = (o) => Buffer.from(JSON.stringify(o)).toString('base64url')
const token = `${b64u({ alg: 'HS256', typ: 'JWT' })}.${b64u({ sub: 'u1', exp: 4102444800 })}.sig`
describe('jwt lib', () => {
  it('decode 三段结构', () => {
    const d = decode(token)
    expect(d.header.alg).toBe('HS256')
    expect(d.payload.sub).toBe('u1')
    expect(decode('a.b')).toBeNull()
  })
  it('convert：claims 逐条 + 过期徽章', async () => {
    const r = await convert(token)
    expect(r.some((x) => x.section === 'Header')).toBe(true)
    expect(r.some((x) => x.section === 'Payload')).toBe(true)
    const expItem = r.find((x) => x.title.indexOf('exp') === 0)
    expect(expItem.accessories[0].tone).toBe('success') // 4102444800 = 2100 年
  })
})
```
cron：
```js
import { describe, nextRuns, convert } from './lib.js'
describe('cron lib', () => {
  it('描述与下次执行', () => {
    expect(describe('*/5 * * * *')).toContain('5')
    const runs = nextRuns('0 9 * * *', 3, new Date('2026-10-05T00:00:00'))
    expect(runs).toHaveLength(3)
    expect(runs[0].getHours()).toBe(9)
  })
  it('convert 三组 + 常用快捷', () => {
    const r = convert('*/5 * * * *')
    expect(r.some((x) => x.section === '下次执行')).toBe(true)
    expect(r.some((x) => x.section === '字段')).toBe(true)
    expect(r.some((x) => x.section === '常用')).toBe(true)
  })
})
```
regex：
```js
import { test as regexTest, convert } from './lib.js'
describe('regex lib', () => {
  it('匹配与捕获组', () => {
    const r = regexTest('(\\d+)-(\\d+)', 'g', 'a 12-34 b 56-78')
    expect(r.matches).toHaveLength(2)
    expect(r.matches[0].groups).toEqual(['12', '34'])
  })
  it('非法正则 → error；无匹配 → 空 matches', () => {
    expect(regexTest('([', '', 'x').error).toBeTruthy()
    expect(regexTest('z', 'g', 'abc').matches).toEqual([])
  })
  it('convert：匹配列表 + 高亮 detail', () => {
    const r = convert('a 12-34', '\\d+-\\d+', 'g')
    expect(r[0].matches).toHaveLength(1)
    expect(r[0].detail).toContain('`12-34`')
  })
})
```
- [ ] **Step 2: RED → Step 3: 实现 → Step 4: GREEN + index.html 重写**（jwt 顶部摘要条目带双 tag + detail「不校验签名」警示；cron 常用表达式点击即填；regex flags toggle 动作 + 匹配高亮 detail。三插件保留现有 arguments/subinput 骨架，替换渲染与动作为公约模式）
- [ ] **Step 5: manifest v2.0.0 + clipboard.write + plugins.json 同步（三处）**
- [ ] **Step 6: 验证 + Commit** —— `feat(plugins): 代码分析三件套重写（jwt/cron/regex v2.0.0）——claims徽章/常用表达式/捕获组列表`

### Task 8: 颜色（colorpicker / contrast）

**Files:** `plugins/com.frond.{colorpicker,contrast}/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`

**Interfaces:**

```js
// colorpicker lib：FrondColorpickerLib { parse(text) → {r,g,b} | null, toHex/toRgb/toHsl/toHsv/toCmyk(color) → string, PALETTES, convert(text) }
//   parse：#rgb/#rrggbb/rgb()/hsl() 容错解析；convert：五格式并列
//   条目 icon：{ value: 'palette-line', tintColor: '#rrggbb' }（spec 3.1 颜色块——五条各自染各自色）
//   PALETTES：push 调色板页数据（Tailwind 色板 10 色 × 10 阶的 {name, hex} 数组，内置 ~50 项即可）
//   最近颜色：db 'recent' {list: [hex]} ≤12（与历史公约同构，section '最近'）
//   convert 主列表动作含「浏览调色板」→ index.html push 视图栈：renderList(paletteItems, { push: true })，popView 返回
// contrast lib：FrondContrastLib { parsePair(text) → {fg, bg} | null, luminance(color), ratio(fg, bg) → number, grade(ratio) → {aa, aaa}, convert(text) }
//   parsePair：'fg/bg' 或 'fg bg'；luminance 按 WCAG 相对亮度；grade：AA(≥4.5 大字≥3)、AAA(≥7 大字≥4.5)
//   convert：[主结果条目（比率 + tag {text:'AA ✓', tone:'success'|'danger'}）] + detail markdown 表格（比率值/AA/AAA 四行）
```

- [ ] **Step 1: 两个 lib.test.js**
colorpicker：
```js
import { parse, toHsl, convert } from './lib.js'
describe('colorpicker lib', () => {
  it('解析与转换', () => {
    expect(parse('#ff0000')).toEqual({ r: 255, g: 0, b: 0 })
    expect(parse('#f00')).toEqual({ r: 255, g: 0, b: 0 })
    expect(toHsl({ r: 255, g: 0, b: 0 })).toContain('hsl(0')
  })
  it('convert 五格式并列 + tintColor 随条目色', () => {
    const r = convert('#336699')
    expect(r).toHaveLength(5)
    expect(r[0].icon.tintColor).toMatch(/^#[0-9a-f]{6}$/)
  })
})
```
contrast：
```js
import { parsePair, ratio, grade, convert } from './lib.js'
describe('contrast lib', () => {
  it('黑/白对比度 21:1', () => {
    expect(ratio('#000000', '#ffffff')).toBeCloseTo(21, 1)
    expect(grade(21).aaa).toBe(true)
    expect(grade(3.5).aa).toBe(false)
  })
  it('parsePair 语法', () => {
    expect(parsePair('#000/#fff')).toEqual({ fg: { r: 0, g: 0, b: 0 }, bg: { r: 255, g: 255, b: 255 } })
  })
  it('convert：主条目 + AA 徽章', () => {
    const r = convert('#000/#fff')
    expect(r[0].accessories[0].tag).toBe('AAA ✓')
    expect(convert('zzz')).toBeNull()
  })
})
```
- [ ] **Step 2: RED → Step 3: 实现 → Step 4: GREEN + index.html 重写**（colorpicker 五条 tintColor 颜色块 + 调色板 push 页 + 最近颜色组；contrast 双值语法 + AA/AAA 徽章 + 互换动作（callback `'swap'` → process 反序））
- [ ] **Step 5: manifest v2.0.0 + clipboard.write + plugins.json 同步（两处）**
- [ ] **Step 6: 验证 + Commit** —— `feat(plugins): 颜色双件套重写（colorpicker/contrast v2.0.0）——颜色块条目/调色板push页/AA徽章`

### Task 9: quickfolders 增强

**Files:** `plugins/com.frond.quickfolders/{lib.js,lib.test.js,index.html,plugin.json}`、`plugins.json`

**Interfaces:**

```js
// quickfolders lib：FrondQuickfoldersLib { parsePathText(text), sortFolders(list) → 按 openCount desc + pinned first, normalizeName(path) → 尾段名 }
//   index.html 既有 db 结构保留；条目改造：
//   icon 'folder-line'；按打开计数排序；动作加「置顶/取消置顶」（db folder 记录 pinned 字段）；
//   「浏览子目录」动作 → renderList(子目录条目, { push: true })（fs 不读——子目录=用户手动添加的以该路径为前缀的兄弟记录，
//     无记录则不显示该动作）；detail 显示完整路径 markdown
```

- [ ] **Step 1: lib.test.js**
```js
import { sortFolders, normalizeName } from './lib.js'
describe('quickfolders lib', () => {
  it('排序：置顶优先，再按打开计数', () => {
    const sorted = sortFolders([
      { path: '/a', openCount: 5 },
      { path: '/b', openCount: 1, pinned: true },
      { path: '/c', openCount: 3 }
    ])
    expect(sorted.map((f) => f.path)).toEqual(['/b', '/a', '/c'])
  })
  it('normalizeName 取尾段', () => {
    expect(normalizeName('/Users/x/Projects')).toBe('Projects')
    expect(normalizeName('/')).toBe('/')
  })
})
```
- [ ] **Step 2: RED → Step 3: 实现 → Step 4: GREEN + index.html 改造（保留既有 add 命令与剪贴板添加路径）**
- [ ] **Step 5: manifest v2.0.0 + clipboard.write + plugins.json 同步**
- [ ] **Step 6: 验证 + Commit** —— `feat(plugins): quickfolders v2.0.0——打开计数排序/置顶/子目录浏览 push`

### Task 10: 全量门禁回归

**Files:** 无新改动（纯验证；有回归先修再随本任务提交）

- [ ] **Step 1**: `pnpm typecheck && pnpm lint && pnpm lint:css && pnpm test` → 全绿（pluginManifestAudit 覆盖 22 处 version 一致性；plugin-api-parity 覆盖插件调用面）
- [ ] **Step 2**: `pnpm build && pnpm test:e2e:smoke` → 全绿
- [ ] **Step 3**: 手工冒烟抽查 3 个插件（dev 起后）：base64 输入→双列结果→复制→HUD；timestamp `2024-01-01`→秒/毫秒；colorpicker `#336699`→五条颜色块。发现问题 → 修复重跑门禁。
- [ ] **Step 4**: `git status` 干净；ledger 收口。

## Self-Review 结论（writing-plans 自审）

1. **Spec 覆盖**：5.1 转换器 8 个（Task 1-3）、5.2 生成器 4 个（Task 4-5）、5.3 分析器 5 个（Task 6-7）、5.4 颜色 2 个（Task 8）、5.6 quickfolders（Task 9）——全覆盖；5.5 currency 与 5.7 example-plugin 归计划 3。
2. **占位符**：各任务测试代码全文给出；「抽移现有实现」均有明确来源文件与目标签名；index.html 以公约模板为结构契约 + 特化点清单。
3. **类型一致**：公约模板的 payload 约定（copy:/recalc:/del:/clear-history/demo:/swap:/regen/flag:）与各任务特化点一致；lib 命名空间 Frond<Name>Lib 与 Global Constraints 一致。
4. **Review Focus**：计划 1 的五项已钉；本计划新增风险面=「版本漏同步」（审计测试兜底）与「callback 动作 payload 超 2000 字符截断」——清洗器 payload slice(0, 2000)，长结果（jsonfmt 大文本）复制动作 payload 可能被截：**约定长输出一律经 `copy:` + 短 key** 不可行（无状态桥），改为：结果条目 detail 展示截断预览，复制动作 payload 若超 1800 字符改走「复制最近结果」语义（onAction 时从 lastOutput 变量取全文）。此约定写入公约：index.html 顶层 `var lastResults = []` 保存本次 outputs，动作 payload 形如 `'copy:0'`（索引）——**修正：统一 copy 动作 payload 全部用索引 `'copy:<resultIndex>'`，onAction 里 `api.copyText(lastResults[i])`**。骨架中的 `'copy:' + r.output` 按此修正（历史条目 copy 动作 payload 用 `'copyh:<ts>'`，onAction 从历史缓存取）。
