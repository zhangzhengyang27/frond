# Leaf · 内置插件真机验证清单（D2 内功）

> **本文件 2026-09-23 从代码重生成。** 原件随 2026-09-22 桌面误删事故丢失，各备份池无副本。
> **重生成时未做过任何一轮真机验证：本文所有「结果」列都是空的。不要把本文件当"已通过"读，也不要替谁勾上任何一格。**
> `docs/README.md:33` 对本文的期望是「内置插件真机验证清单（D2 内功）」；这一格在路线上的位置是 `docs/ROADMAP.md:41`（D2 内功清单里唯一未勾的那项：「**21 个插件逐个真机验证**」），D2 的决策原文是「先把官方 21 个插件验证到可用」（`ROADMAP.md:31`）。

## 本文的事实来源

| 用来写什么 | 来源 |
| --- | --- |
| 清单条目与每条的声明内容 | `plugins/*/plugin.json`（21 份）、`plugins.json`（静态市场索引 22 条）、`example-plugin/plugin.json`、`example-react/plugin.json` |
| 每个插件实际用到哪些宿主 API | `plugins/*/index.html`（逐文件扫 `api.` 调用，方法名与首次出现行号） |
| 命令能不能被搜到、搜到后长什么样 | `src/renderer/src/launcher/composables/useCommandSources.ts:110-146`、`src/renderer/src/components/shell/CommandPalette.vue:9`、`docs/SHORTCUTS.md:18` |
| 参数槽/表单怎么渲染 | `src/shared/argSlots.ts:8-16`、`src/shared/plugin-protocol.ts:81-177`、`src/renderer/src/launcher/LauncherApp.vue:842,908,1518` |
| 动作执行落在哪 | `src/renderer/src/launcher/pages/PluginListPage.vue:128-150`、`src/renderer/src/utils/commandRunner.ts:161-183`、`src/main/launcher/runtime.ts:290-303` |
| 权限强制与失败形状 | `src/main/launcher/ipc.ts:121-126,604-672`、`src/shared/plugin-protocol.ts:494-537`、`src/main/launcher/runtime.ts:314-340` |
| 安装/清单校验 | `src/main/launcher/pluginStore.ts:194-267`（`readManifest`）、`:286-318`（`importFromFolder`）、`:321-333`（卸载清 KV） |
| 市场与 sha256 | `src/main/launcher/market.ts:104-166,501-540` |
| 热重载 | `src/main/launcher/devPlugins.ts:1-16`（模型说明）、`:31-32`（300ms 防抖） |
| 受控桥（API 白名单真身） | `src/preload/plugin.ts:58-167` |
| 已有静态闸口（不算真机） | `src/main/launcher/__tests__/pluginManifestAudit.test.ts`、`src/shared/__tests__/plugin-api-parity.test.ts`、`src/main/launcher/__tests__/market.test.ts`、`e2e/plugin-args.spec.mjs`、`e2e/plugin-arg-slots.spec.mjs`、`e2e/market-index.spec.mjs` |

---

## 0. 先把"到底几条"钉死（数量核对）

| 口径 | 实数 | 依据 |
| --- | --- | --- |
| **本清单正文（内置插件）** | **21** | `plugins/` 下带 `plugin.json` 的目录计数 = 21；自动安装也只扫这一层（`src/main/launcher/builtinPlugins.ts:60,73-105`） |
| 静态市场索引条目 | **22** | `plugins.json:3-180`，多出的一条是 `com.leaf.example`（`:5-11`，`download: "./example-plugin"`） |
| 盘上另有第 23 份清单 | 1 | `example-react/plugin.json`（id `com.leaf.example-react`，10 条命令，`permissions: ["net","schedule"]`），既不在 `plugins/` 也不在 `plugins.json`，只被 e2e 播种（`e2e/plugin-arg-slots.spec.mjs:21`，装入动作 `:150`） |
| 命令合计 / 偏好项合计 | 28 条命令 / 20 项偏好 | 由 21 份 `plugin.json` 统计（脚本累加 `commands[].code` 与 `preferences[].name`） |

**与 ROADMAP 的 21 一致吗？** 一致——`docs/ROADMAP.md:41` 说的 21 = `plugins/` 的真实条数。差异只在"市场索引 22 条"这一层：多的是模板 `com.leaf.example`，它不进 `plugins/`，因此**不会被自动安装**，只能从管理页手动装（本地目录形态）。这两个数不是一回事，勾账时要分开。
（另：`docs/ROADMAP.md:36` 的"16/21 插件 `getClipboardText` 静默失败"与本清单同一分母 21，可交叉核对。）

---

## 1. 怎么跑这一轮（前置，别跳过）

| 步 | 怎么做 | 为什么 |
| --- | --- | --- |
| 1 | `pnpm build`（产物 `out/main/index.js`） | `playwright.config.mjs:5` 明写"跑前先 build"；e2e 全部 launch 这个入口（`e2e/plugin-args.spec.mjs:22,64`） |
| 2 | **验内置插件要用不带 `LEAF_SKIP_BUILTIN_PLUGINS` 的实例** | 全量 e2e 会强制 `LEAF_SKIP_BUILTIN_PLUGINS = '1'`（`playwright.config.mjs:15`），此时内置插件**不会**被自动装上（`builtinPlugins.ts:56-59`）。要么起 `pnpm start` / `pnpm dev` 的实例，要么在 e2e 里用 `importFromFolder` 精确播种（`e2e/plugin-args.spec.mjs:23,74` 就是把 `plugins/com.leaf.regex` 直接装进去） |
| 3 | 自动安装只在"未安装"或"版本不同"时发生 | `builtinPlugins.ts:79-104`；已装同版本会 `skippedCount++`，改了 `plugins/` 里的代码但没抬版本号 → 机器上跑的还是旧包，**这是最容易造成"假通过/假失败"的一步** |
| 4 | 内置插件目录按启动形态解析（打包态 `resources/plugins/`；dev 与 e2e 走两条候选回退） | `builtinPlugins.ts:25-33`（`builtinPluginsDir()` 的 `../../plugins` 回退是为 `electron out/main/index.js` 那种形态准备的） |
| 5 | 两个入口都要各查一次命令 | 胶囊 `LauncherApp.vue:439` 与主窗 ⌘K `CommandPalette.vue:9` 共用 `useCommandSources()`；插件命令 key = `plugin:<id>:<code>`、badge「插件」（`useCommandSources.ts:127,131`） |
| 6 | 结果填法 | 一格只写「通过 / 失败 / 未跑」，另起一列写**在哪一层看到的**（胶囊列表 / Detail 面板 / 主窗 ⌘K / 管理页 toast / devtools 控制台）。写"通过"必须能复述出现象，否则留空 |

---

## 2. 通用检查项 U1–U10（每个插件默认全跑；§4 只列该插件的专属项）

| 编号 | 检查项 | 验证方式（真跑） | 判据出处 | 结果 |
| --- | --- | --- | --- | --- |
| U1 | 命令在 ⌘K 搜到 | 主窗 ⌘K，分别用命令 `title` 的一串中文与 `description` 里的词各搜一次 | `useCommandSources.ts:123-141`（`enabled` 且有 `commands` 才成行，`subtitle = 插件名 · 描述`） | ☐ |
| U2 | 命令在胶囊根搜索搜到 | Alt+Space 唤起，同一查询词再搜一次；两入口排序应一致 | `docs/SHORTCUTS.md:18`、`docs/IA_V2.md:45`（同一引擎同一排序） | ☐ |
| U3 | 打开后副输入框占位符是插件设的那句 | 回车进插件，看胶囊搜索框 placeholder 是否换成 `setSubInput` 传的文案 | `ipc.ts:592-596`（`plugapi:setSubInput`）→ 胶囊搜索框 | ☐ |
| U4 | 声明式列表 + Detail 渲染 | 选中条目看右侧 Detail；`detailFormat: 'markdown'` 的条目要能出标题/代码块，不是原始星号 | `plugin-protocol.ts:16-31`、`launcher/components/DetailPanel.vue:20-43`（marked + 白名单过滤） | ☐ |
| U5 | 回车动作按声明执行且收起窗口 | 默认动作 = `actions[0]`（`plugin-protocol.ts:29-30`）：`copy` 应写剪贴板并 hide；`open` 走 http(s)→浏览器、否则→路径；`callback` 回插件 | `PluginListPage.vue:128-150`（胶囊内声明式条目）、`runtime.ts:285-303`（callback 回插件）、`commandRunner.ts:161-183`（⌘K 侧走的是 **pluginSearch 持久化条目**那份同形逻辑——内置 21 个都没声明 `searchable`，这条对它们**不适用**，别当真机失败记） | ☐ |
| U6 | 参数声明按形状渲染 | 只在声明了 `arguments` 的插件上跑（见 §4）：`required` 空提交要**留在表单**、不弹假提示；`dropdown` 显示 title、提交 value | `plugin-protocol.ts:88,164-173`、`LauncherApp.vue:908,1518`、`argSlots.ts:8-16`（≤2 格且全文本才内联，含 dropdown 即进 FormPage） | ☐ |
| U7 | 偏好项渲染 + 回读 + 越界被拒 | 管理页改值保存后重开插件看是否生效；再在 devtools 里 `launcherApi.preferences.set('未声明键', 1)` 应拿到 `preference not declared` | `views/launcher/index.vue:78-114,759-795`、`runtime.ts:321,336` | ☐ |
| U8 | 权限没给时不是静默失败 | 临时把 `permissions` 改成 `[]` 重装（`importFromFolder` 覆盖同 id），走一遍主功能：要能看到"少了什么"的可见提示，而不是悄悄出空结果 | 形状见 §3；改清单后必须**抬版本号**或先卸载再装（`builtinPlugins.ts:91-101`） | ☐ |
| U9 | 空剪贴板 / 非法输入有可读空态 | 先 `pbcopy </dev/null` 清空剪贴板再打开插件；再喂一段明显非法的输入（如给 JSON 插件贴一段中文散文） | 通用写法见 `plugins/com.leaf.base64/index.html:20-31`（`readText` → catch → `showEmpty`），空态条目文案在 `:42-56` | ☐ |
| U10 | 启停与卸载干净 | 管理页禁用后 U1/U2 都搜不到；卸载后 `launcher_docs` 里该插件的 KV 清空（重装卸不到旧数据） | `pluginStore.ts:278-280`（只有 `enabled` 进命令源）、`:321-333`（`deleteByPlugin`） | ☐ |

---

## 3. 权限缺省时的返回形状（读码已定；真机要判的是"用户看得见吗"）

| API | 缺权限时宿主返回 | 形状算明确还是静默 | 出处 |
| --- | --- | --- | --- |
| `readText` | `''`（空串） | **静默**（插件若没兜底就当剪贴板是空的） | `ipc.ts:612-616` |
| `copyText` | `false` | **静默** | `ipc.ts:605-610` |
| `openPath` | `false`（还要过 `safeOpenablePath`） | **静默** | `ipc.ts:618-626` |
| `openUrl` | `false`（协议白名单 http/https/mailto） | **静默** | `ipc.ts:664-672`、`plugin-protocol.ts:624-642` |
| `fetch` | `{ok:false,error:'permission denied: net（需在 plugin.json 声明）'}` | **明确** | `ipc.ts:516-518` |
| `schedule.list` / `add` / `remove` | `[]` / `{ok:false,error:'permission denied: schedule（…）'}` | list 静默，写侧明确 | `ipc.ts:637-660` |
| `preferences.get` / `set` 未声明键 | `{ok:false,error:'preference not declared: <键>'}` | **明确** | `runtime.ts:321,336`（读侧同闸的理由见 `:310-313`） |
| `permissions` 里写了未知值 | 装载时被剔除（拼错权限名 = 没声明），随后就落进上面那些"静默"行 | 明确拒绝吗？→ **不**，只在单测里被钉住 | `pluginStore.ts:212-217`、`pluginManifestAudit.test.ts`（`permissions 只用已知值`那条） |
| 声明式 `copy` / `open` 动作 | 由宿主直接执行，**不吃** `clipboard.write` / `fs.open` 权限 | 设计如此（`plugin-protocol.ts:521-537` 只映射 `plugapi:*` 通道） | `PluginListPage.vue:132-147` |

> 一句话判据：**没声明敏感 API 的插件（§4 里 `permissions: []` 的 4 个）不能调用 `readText/copyText/openPath/openUrl/fetch`**；本轮静态核对这 4 个都没调（见 §7 的 API 表）。真机要验的是"万一以后漂了，用户看得见吗"——按上表，四个静默项**看不见**，这就是 U8 存在的意义。

---

## 4. 逐插件清单

### 4.0 清单事实总表（21 条，全部来自各 `plugins/<id>/plugin.json`）

`commands@N` = `commands` 段起始行，后面是每条命令 `code` 与其所在行；`prefs@N` / `perms@N` 同理；`—` = 该插件无此段。API 列来自逐文件扫 `api.` 调用。

> 两点**读码已定的共性**（不再逐插件重复）：21 份清单里**没有任何一份**声明 `searchable: true` 或 `api: "react"`（逐份 `plugin.json` 的顶层键只有 `id/name/version/description/author/main/commands/preferences/permissions`），所以 `submitSearchItems` / `renderView` 两条能力在内置插件上是**零覆盖**——要验它们只能借 §5 的两个样本。另：10 份带 `preferences`、11 份不带；4 份 `permissions` 是空数组。

| # | id · 名称（版本见 `plugins.json` 同 id 行） | 命令 `code`（行号） | 参数声明 | `preferences`（行号） | `permissions`（行号） | 实际用到的 `launcherApi` | 市场索引行 |
| --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | `com.leaf.base64` · Base64 编解码 | `encode`:10 / `decode`:15（`commands@8`） | 无 | — | `clipboard.read` :20 | `onEnter`:12 `setSubInput`:18 `readText`:19 `renderList`:45 `onSubInputChange`:34 `onAction`:115 | `plugins.json:37` |
| 2 | `com.leaf.baseconvert` · 进制转换 | `convert`:10 | 无 | — | `clipboard.read` :15 | 同上组（`setSubInput`:12 `readText`:13 `renderList`:38 `onSubInputChange`:28 `onAction`:180） | `:77` |
| 3 | `com.leaf.colorpicker` · 颜色选择器 | `convert`:10 / `palette`:15 | 无 | `defaultFormat`(select HEX/RGB/HSL) :20 | `clipboard.read` :29 | `onEnter`:154 `setSubInput`:157,160 `readText`:162 `renderList`:190 `preferences`:216 `onSubInputChange`:179 `onAction`:334 | `:13` |
| 4 | `com.leaf.contrast` · 颜色对比度 | `check`:10 | 无 | `fgColor`:text `bgColor`:text :15 | `[]` :29 | `preferences`:14 `setSubInput`:18 `renderList`:115 `onSubInputChange`:24 `onAction`:279 | `:117` |
| 5 | `com.leaf.cron` · Cron 解析 | `parse`:10 | 无 | — | `clipboard.read` :15 | `onEnter`:36 `setSubInput`:37 `readText`:38 `renderList`:63 `onSubInputChange`:53 `onAction`:343 | `:133` |
| 6 | `com.leaf.csvjson` · CSV↔JSON | `convert`:10 | 无 | — | `clipboard.read` :15 | `onEnter`:146 `setSubInput`:147 `readText`:148 `renderList`:173 `onSubInputChange`:163 `onAction`:269 | `:165` |
| 7 | `com.leaf.currency` · 汇率转换 | `convert`:10 | 无 | `baseCurrency` / `targetCurrency`(select) :15 | `clipboard.read`, `net` :31 | `onEnter`:49 `setSubInput`:50 `readText`:52 `renderList`:81 `preferences`:77 `fetch`:273(实调用见 `:275`) `onSubInputChange`:67 `onAction`:296 | `:29` |
| 8 | `com.leaf.hash` · 哈希计算 | `compute`:10 | 无 | — | `clipboard.read` :15 | `onEnter`:233 `setSubInput`:234 `readText`:235 `renderList`:260 `onSubInputChange`:250 `onAction`:343 | `:93` |
| 9 | `com.leaf.htmlentity` · HTML 实体编解码 | `encode`:10 / `decode`:15 | 无 | — | `clipboard.read` :20 | `onEnter`:59 `setSubInput`:65 `readText`:66 `renderList`:87 `onSubInputChange`:76 `onAction`:189 | `:149` |
| 10 | `com.leaf.jsonfmt` · JSON 格式化 | `format`:10 / `minify`:15 / `escape`:20 | 无 | `indent`(select 2/4/Tab) :25 | `clipboard.read` :34 | `onEnter`:12 `setSubInput`:19 `readText`:21 `renderList`:47 `onSubInputChange`:36 `onAction`:154 | `:21` |
| 11 | `com.leaf.jsonyaml` · JSON↔YAML | `convert`:10 | 无 | `indent`(select 2/4) :15 | `clipboard.read` :24 | `onEnter`:223 `setSubInput`:224 `readText`:225 `renderList`:250 `preferences`:273 `onSubInputChange`:240 `onAction`:349 | `:141` |
| 12 | `com.leaf.jwt` · JWT 解码 | `decode`:10 | 无 | — | `clipboard.read` :15 | `onEnter`:11 `setSubInput`:12 `readText`:13 `renderList`:38 `onSubInputChange`:28 `onAction`:310 | `:125` |
| 13 | `com.leaf.lorem` · Lorem Ipsum | `generate`:10 | 无 | `unit` / `count`(select) :15 | `[]` :31 | `onEnter`:343 `setSubInput`:344 `preferences`:359 `renderList`:376 `onSubInputChange`:348 `onAction`:420 | `:157` |
| 14 | `com.leaf.passwordgen` · 密码生成器 | `generate`:10 | 无 | `length`/`uppercase`/`lowercase`/`numbers`/`symbols`/`count` :15（6 项，最多） | `[]` :55 | `onEnter`:16 `setSubInput`:17 `preferences`:97 `renderList`:165 `onSubInputChange`:21 `onAction`:169 | `:61` |
| 15 | `com.leaf.qrcode` · 二维码生成器 | `generate`:10 | 无 | `size` / `ecc`(select) :15 | `clipboard.read` :31 | `onEnter`:685 `setSubInput`:686 `readText`:687 `renderList`:712 `preferences`:727 `onSubInputChange`:702 `onAction`:777 | `:85` |
| 16 | `com.leaf.quickfolders` · 常用目录 | `open`:10 / `add`:15 | 无 | — | `clipboard.read` :20 | `preferences`:23 `db.get`:20 `renderList`:71 `readText`:76 `onEnter`:117 `onSubInputChange`:126 `onAction`:130 `close`:135 `db.put`:31,102,145 `notify`:103,146 | `:173` |
| 17 | `com.leaf.regex` · 正则测试（v1.1.0） | `test`:10 | **`pattern`(text, required) / `text`(text) / `flags`(dropdown g/gi/gm)** — 全仓唯一声明 `arguments` 的内置插件 | `flags`(select) :29 | `clipboard.read` :44 | `onEnter`:13 `setSubInput`:20 `preferences`:17 `readText`:31 `renderList`:58 `onSubInputChange`:48 `onAction`:264 | `:101` |
| 18 | `com.leaf.textstats` · 文本统计 | `stats`:10 | 无 | — | `clipboard.read` :15 | `onEnter`:11 `setSubInput`:12 `readText`:13 `renderList`:38 `onSubInputChange`:28 `onAction`:282 | `:109` |
| 19 | `com.leaf.timestamp` · 时间戳转换 | `convert`:10 | 无 | — | `clipboard.read` :15 | `onEnter`:11 `setSubInput`:12 `readText`:13 `renderList`:65 `onSubInputChange`:28 `onAction`:224 | `:53` |
| 20 | `com.leaf.urlcodec` · URL 编解码 | `encode`:10 / `decode`:15 | 无 | — | `clipboard.read` :20 | `onEnter`:12 `setSubInput`:18 `readText`:19 `renderList`:45 `onSubInputChange`:34 `onAction`:125 | `:69` |
| 21 | `com.leaf.uuid` · UUID 生成器 | `generate`:10 | 无 | `count` / `format`(select) :15 | `[]` :31 | `onEnter`:11 `setSubInput`:12 `preferences`:75 `renderList`:114 `onSubInputChange`:16 `onAction`:119 | `:45` |

### 4.1 逐插件专属检查项（通用 U1–U10 默认另加）

| 插件 | # | 专属检查项 | 验证方式 | 结果 |
| --- | --- | --- | --- | --- |
| base64 | a | 两条命令各自换 placeholder（`encode`/`decode` 各一句，`:13-18`） | 分别用 `encode`、`decode` 进插件，比对占位符 | ☐ |
|  | b | 空剪贴板时是"等待输入"空态而不是报错（`:26-31` → `showEmpty` `:42-56`） | 清剪贴板后打开 | ☐ |
| baseconvert | a | `0x/0b/0o` 前缀输入被吃下（placeholder 自称支持，`index.html:12`） | 贴 `0xff`、`0b101`、`0o17` 各一次 | ☐ |
| colorpicker | a | `palette` 命令走的是色板分支、placeholder 变「搜索颜色名称…」（`:157` vs `:160`） | 分别进 `convert` / `palette` | ☐ |
|  | b | `defaultFormat` 偏好真的决定复制出去的字符串形态（`preferences` 读取点 `:216`） | 改偏好为 `RGB` 与 `HSL` 各复制一次 | ☐ |
| contrast | a | 零权限却要用两个颜色：默认值来自偏好 `fgColor`/`bgColor`（`index.html:14`） | 改偏好后重开，看初值 | ☐ |
|  | b | 空格分隔一次输入两个色（placeholder 约定 `:18`） | 输入 `#000 #FFF` 与只输一个色各一次 | ☐ |
| cron | a | 5 段与 6/7 段（Quartz）都解析（能力自述见 `plugins.json:136`） | 各贴一条表达式 | ☐ |
| csvjson | a | 「自动识别」真的双向：CSV→JSON 与 JSON→CSV | 两个方向各一次 | ☐ |
| currency | a | **2026-09-23 已修一处真缺陷**：`fetchRates` 原来读 `res.data`（`index.html:277`），而宿主代理回的是 `{ok,status,body,contentType}`、没有 `data` 字段（`runtime.ts:395-397`、`example-plugin/launcher-api.d.ts:39-45`）→ `rates` 恒为 undefined，有网也永远渲染成「请检查网络连接」。现改为 `JSON.parse(res.body)` 并校验 `rates` 存在。**修完仍未真机验过**，下面这格照样要跑 | 有网状态下转一笔非同名货币对（如 USD→CNY），看是否出汇率且二次查询走缓存 | ☐ |
|  | b | `net` 权限是它唯一真用到的敏感权限（U8 的样本）：把 `permissions` 改 `[]` 重装后，`fetch` 应回 `permission denied: net（…）`（`ipc.ts:516-518`） | U8 流程 | ☐ |
| hash | a | 5 种摘要（MD5/SHA1/256/384/512）都能切（能力自述 `plugins.json:96`） | 逐一切换并对照 `shasum`/`openssl` | ☐ |
| htmlentity | a | 命名实体与数字实体都能反解（`plugins.json:152`） | 贴 `&amp;` 与 `&#x4e2d;` | ☐ |
| jsonfmt | b | 三条命令各一条动作语义：`format`/`minify` 的产物要能直接贴回（回车即复制） | 逐条命令回车 + 粘贴验证 | ☐ |
| jsonfmt | a | `indent` 偏好含字面量 `"Tab"`（字符串不是制表符）：选它时缩进是否真的按 tab 出 | 偏好切到 `Tab` 后格式化一段 JSON | ☐ |
| jsonyaml | a | YAML 缩进偏好生效（`index.html:273` 读偏好） | `indent=2` 与 `4` 各转一次 | ☐ |
| jwt | a | 过期时间/签发者等声明展示（`plugins.json:128`）；`exp` 过期时是否**看得出的标红/提示** | 贴一个已过期 token | ☐ |
| lorem | a | 零权限、无剪贴板依赖：`unit`×`count` 组合出数量正确 | `word/sentence/paragraph` × `1/3/5/10` 抽查 | ☐ |
| passwordgen | a | 6 项偏好（含 4 个 checkbox）在管理页全部渲染出来——checkbox 的 `default` 必须是布尔，否则清洗器会丢（`plugin-protocol.ts:614-615`、审计测试最后一条） | 管理页逐项改值保存 + 重开插件验证 | ☐ |
|  | b | 随机性：连开两次结果不同、长度与字符集严格符合 | 各生成两次对照 | ☐ |
| qrcode | a | Detail 里的 `![二维码](data:image/png;base64,…)`（`index.html:748-749`）能否真显示：`DetailPanel.vue:28-39` 的白名单放开了 `img[src]`，但**没有**显式放开 `data:` scheme | 生成一次，肉眼看 Detail 有没有图 | ☐ |
|  | b | 「复制图片」是 `copy` 动作 → 宿主写的是**文本**（`PluginListPage.vue:132-138` 用 `clipboard.writeText`，payload 是 data URI），不是 PNG 图像 | 回车后粘到图片查看器与文本编辑器各一次，确认实际语义 | ☐ |
|  | c | `size`/`ecc` 偏好真的改变输出（`:727` 读偏好、`:733-734` 用值） | 128/512 与 L/H 各一次 | ☐ |
| quickfolders | a | 唯一用 `db` 存数据的内置插件：条目跨重启留存（`db.get`:20 / `db.put`:31,102,145） | 加一条 → 退出应用 → 重开看还在不在 | ☐ |
|  | b | `open` 命令不 `setSubInput`：搜索框保持全局 placeholder，靠 `onSubInputChange` 过滤（`:126`）——这是有意还是漏了，真机判 | 打开后看搜索框文案与过滤是否可用 | ☐ |
|  | c | 「添加常用目录」从剪贴板读路径 + `notify` 回执（`:76`、`:103`）；`remove` 走 `callback`（`:59`） | 复制一个真实目录路径 → `add` 命令 → 看系统通知标题是否为插件名 | ☐ |
|  | d | `open` 动作类型宿主直接开目录（`type:'open'`，`:57`）→ Finder 里真出现该目录；且**不需要** `fs.open` 权限（§3 末行） | 回车一次 | ☐ |
| regex | a | **参数槽的主样本**：3 参数含 `dropdown` → 按设计必走 FormPage，不走内联（`argSlots.ts:8-11`：≤2 格且全文本才内联） | 用「正则测试 \d+」这类查询命中参数化命令，看是不是进表单页 | ☐ |
|  | b | `pattern` `required:true`：空提交要留在表单并把焦点落在字段（`LauncherApp.vue:1518`） | 清空必填格直接 ↵ | ☐ |
|  | c | dropdown 显示 title、提交 value（`g（全局）` → `g`），且 `text` 留空时回落剪贴板（`plugin.json` 声明 `留空则取剪贴板`；`index.html:31` 调 `readText`） | 选 `gi（全局 + 忽略大小写）` 一次，比对匹配数 | ☐ |
|  | d | 版本号 1.1.0 必须与 `plugins.json:103` 一致（审计测试会红，但真机也要确认已装版本） | 管理页看已装版本 | ☐ |
| textstats | a | 中英混排下的字数/词频口径与自述一致（`plugins.json:112`） | 贴一段中英混合文本，人工对一遍 | ☐ |
| timestamp | a | 秒/毫秒自动判别 + 留空显示当前时间（`index.html:12`） | 贴 10 位与 13 位各一次，再留空一次 | ☐ |
| urlcodec | a | 两条命令各自 placeholder（`:13-18`） | 分别进 `encode`/`decode` | ☐ |
| uuid | a | `format=nohyphen` 与 `uppercase` 真生效；批量数量严格等于偏好值（`index.html:75`） | 三种格式 × 数量 1/5/10/20 抽查 | ☐ |

### 4.2 通用项打勾总表（21 × 10，**本轮全部为空**）

每格填「通过 / 失败 / 未跑」；空 = 没跑，不代表通过。

| # | id | U1 | U2 | U3 | U4 | U5 | U6 | U7 | U8 | U9 | U10 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 1 | base64 | | | | | | | | | | |
| 2 | baseconvert | | | | | | | | | | |
| 3 | colorpicker | | | | | | | | | | |
| 4 | contrast | | | | | | | | | | |
| 5 | cron | | | | | | | | | | |
| 6 | csvjson | | | | | | | | | | |
| 7 | currency | | | | | | | | | | |
| 8 | hash | | | | | | | | | | |
| 9 | htmlentity | | | | | | | | | | |
| 10 | jsonfmt | | | | | | | | | | |
| 11 | jsonyaml | | | | | | | | | | |
| 12 | jwt | | | | | | | | | | |
| 13 | lorem | | | | | | | | | | |
| 14 | passwordgen | | | | | | | | | | |
| 15 | qrcode | | | | | | | | | | |
| 16 | quickfolders | | | | | | | | | | |
| 17 | regex | | | | | | | | | | |
| 18 | textstats | | | | | | | | | | |
| 19 | timestamp | | | | | | | | | | |
| 20 | urlcodec | | | | | | | | | | |
| 21 | uuid | | | | | | | | | | |

---

## 5. 两个不进本清单但会被顺手验的样本

| 样本 | 为什么不在 21 条里 | 该验什么 |
| --- | --- | --- |
| `example-plugin/`（id `com.leaf.example`，4 命令 `list`/`prefs`/`net`/`misc`，3 偏好，`permissions: ["clipboard.read","clipboard.write","net"]`） | 不在 `plugins/`，自动安装扫不到；它是市场里唯一指向仓库模板目录的条目（`plugins.json:5-11` `download: "./example-plugin"`），形态是"本地目录" | 它是 **唯一演示 `copyText`/`alert`/`db`/`notify`/`fetch` 全谱** 的样本（`example-plugin/index.html:203`（db.put）、`:208`（fetch 实调）、`:213`（copyText）、`:225`（readText）、`:253`（alert））。U8 的"明确拒绝"这一类只有它能一次性覆盖：`alert` 无 `message` 会被整条拒（`plugin-protocol.ts:669-672`）、同一插件同时只许挂一条模态框（`ipc.ts:683-685`）。另：它对 `fetch` 返回形状的自述就是 `{ ok, status, body, contentType }`（`index.html:98`）——与 §4.1 currency 那格对照着读 |
| `example-react/`（id `com.leaf.example-react`，10 命令，其中 4 条 `mode:"action"`：`ping`/`ping-hold`/`ping-view`/`schedule-selftest`；`argsum` 是两个 text 参数；`api:"react"`；`permissions: ["net","schedule"]`） | 既不在 `plugins/` 也不在 `plugins.json` | React 视图协议（`manifest.api:'react'` → `renderView`，`plugin-protocol.ts:250-399`）、Action 命令（无界面执行，`plugin-protocol.ts:97-120` + `runtime.ts:586` 起的那段接线）、内联参数槽与 `schedule` 权限的载体（`e2e/plugin-arg-slots.spec.mjs:8-12`、`e2e/plugin-schedule.spec.mjs`）；注意 **parity 单测不扫它**（`plugin-api-parity.test.ts:74` 的目录表只有 `plugins/` 与 `example-plugin/`） |

---

## 6. 静态闸口已经覆盖了什么（**别当真机结果记账**）

| 闸口 | 钉住的东西 | 覆盖不到什么 |
| --- | --- | --- |
| `src/main/launcher/__tests__/pluginManifestAudit.test.ts`（自述理由见 `:8-16`） | 目录非空且每条目带 `plugin.json`（`:57-63`，阈值 `>15`）、id 与目录名一致（`:65-69`）、必填字段与每条命令 `code`+`title`（`:71-82`）、`main` 入口文件真实存在（`:84-89`）、权限只用已知值（`:91-97`）、`arguments` ≤3/类型已知/dropdown 带 data（`:99-125`）、**版本号与 `plugins.json` 一致**（`:127-135`）、偏好声明过一遍真清洗器不丢项（`:137-178`）、市场索引过一遍真解析器不丢条目（`:180-`） | 运行时行为：搜得到吗、值对不对、界面长什么样 |
| `src/shared/__tests__/plugin-api-parity.test.ts` | 插件调的每个 `api.X` 都在 `preload/plugin.ts` 真暴露（`:71-96`）；敏感 API 已在 `permissions` 声明（`:98-121`） | **不比对 `launcher-api.d.ts`**（全文未引用它），也不扫 `example-react/`；不校验响应字段形状（§4.1 currency 那格就是这类） |
| `src/main/launcher/__tests__/market.test.ts`（`describe` 于 `:207`、`:366`） | 索引解析、远程条目与本地条目 id 冲突丢弃、sha256 校验 | 真实下载/解压环境 |
| e2e | `plugin-args.spec.mjs:1-12`（「正则测试 \d+」→ 参数表单 → `argPrefill` → ⌘↵ → `onEnter` 收到 args，用 `com.leaf.regex` 现装现验）；`plugin-arg-slots.spec.mjs:1-13`（内联槽不跳页，载体 `com.leaf.example-react` 的 `argsum`）；`market-index.spec.mjs`；`react-view.spec.mjs`；`plugin-schedule.spec.mjs`；`density.spec.mjs`；`capsule-*.spec.mjs` | 只有一条内置插件（regex）被真机走过一次；其余 20 条没有专属用例 |

---

## 7. `window.launcherApi` 一致性核对（本文重生成时做过的一轮静态比对）

比对三方：**实际用到的方法**（扫 `plugins/*/index.html`）· **preload 真暴露的**（`src/preload/plugin.ts:58-167`）· **d.ts 声明的**（`example-plugin/launcher-api.d.ts:69-149`）。

| API 成员 | preload 暴露 | d.ts 声明 | 需要的权限 | 21 个内置插件里谁用了 |
| --- | --- | --- | --- | --- |
| `onEnter` / `onSubInputChange` / `onAction` | `:106,111,115` | `:134,139,141` | 无 | 全部 21 个 |
| `renderList` | `:131` | `:78` | 无 | 全部 21 个 |
| `setSubInput` | `:72` | `:86` | 无 | 20 个（**除 `quickfolders`**） |
| `readText` | `:78` | `:92` | `clipboard.read`（`plugin-protocol.ts:523`） | 17 个（`permissions:[]` 的 4 个都没调） |
| `preferences.all/get/set` | `:138-143` | `:108-112` | 无（但只能碰声明过的键，`runtime.ts:321,336`） | 10 个（有 `preferences` 段的那 10 个） |
| `fetch` | `:163` | `:127-130` | `net`（`plugin-protocol.ts:527`） | 仅 `currency`（`index.html:275`） |
| `db.put/get/list` | `:118-123` | `:100-105` | 无 | 仅 `quickfolders`（`:20,31,102,145`）+ 模板 |
| `notify` | `:75` | `:90` | 无 | 仅 `quickfolders`（`:103,146`）+ 模板 |
| `close` | `:103` | `:97` | 无 | 仅 `quickfolders`（`:135`） |
| `getContext` | `:60` | `:70` | 无 | **21 个内置插件都没用**（此前扫到的 `getContext` 命中是 `canvas.getContext('2d')`，`qrcode/index.html:670`，已排除） |
| `renderView` / `submitSearchItems` / `setExpandHeight` / `popView` / `clearList` / `copyText` / `openPath` / `openUrl` / `alert` / `detach` / `onReady` / `onLeave` / `onShow` / `onHide` / `onCallback` / `schedule.*` | `:63,66,69,134,135,77,80,86,92,100,107-113,151-159` | `:82-83,80-81,87,79,91,93-96,135-140,115-124` | 见 `plugin-protocol.ts:521-537` | 内置 21 个**都没用**（`copyText/alert/db` 的用处只在 `example-plugin`） |

静态结论（**读码可证，不等于真机通过**）：

1. **成员集对齐**：把 `plugin.ts` 的 `launcherApi` 对象与 `launcher-api.d.ts` 的 `LauncherPluginApi` 各自抽出来比对，两边都是 **35 个成员、集合完全相同**（无只在一边存在的成员）。
2. **这个对齐没有闸口**：`plugin-api-parity.test.ts` 只解析 `src/preload/plugin.ts`（`:17-19` 自述），全文不读 d.ts；d.ts 自己写着「三处不一致时以那两个文件为准，本文件只是抄一份可读的」（`launcher-api.d.ts:4-5`）。所以 **d.ts 漂了不会有人知道** —— 真机轮如果拿 d.ts 当依据，请先人工比对一次。
3. **形状不比对**：parity 测试只查"方法存不存在"，不查返回值字段。`currency` 读 `res.data` 那处（§4.1）正好落在这个空洞里 —— 这条是本清单里目前**唯一一条读码就看出形状不符**的项。

---

## 8. 出问题去哪查

| 现象层 | 首查 | 备注 |
| --- | --- | --- |
| 命令搜不到 | `useCommandSources.ts:123-141`（要求 `enabled` + `Array.isArray(commands)`）→ `pluginStore.ts:269-280`（索引与 `enabled`）→ `ipc.ts:144-150`（命令表变更要广播给**所有窗口**，只推胶囊会让 ⌘K 拿着过期的表） | 键格式 `plugin:<id>:<code>`；badge 恒为「插件」 |
| 打开是白屏 | `pluginStore.ts:86-91`（安装根目录 `userData/launcher-plugins/<id>`）、`:194-199`（缺 `plugin.json` 直接抛）、`pluginEntryUrl()` `:343-349`（`devServer` 优先，否则 `plugin://`） | 审计测试只保证入口文件在盘上（`:86-91`），不保证它在 `plugin://` 下加载得起来 |
| 列表/Detail 不出现 | `plugin-protocol.ts:143-177`（arguments 清洗）、`runtime.ts:155-175`（动作清洗：白名单外的 `type` 一律降 `callback`、`label` 缺省「执行」） | 清洗是**静默降级**：清单写错不会报错，只会少东西 |
| 复制没反应 | `PluginListPage.vue:132-139`（copy → `navigator.clipboard.writeText` → 失败被**吞掉**再 hide；注释「剪贴板失败静默」）与 ⌘K 侧 `commandRunner.ts:166-171`（走 `window.api.action.invoke('copyText')`） | 两个入口实现不同，务必两边各验一次 |
| 表单/参数槽不按声明出 | `plugin-protocol.ts:143-177`（dropdown 无 data 降级 text）、`argSlots.ts:8-16`（内联 vs FormPage 的分界） | 内联只吃「≤2 格且都是 text/password」 |
| 权限没给却像"没反应" | §3 表：四个静默项在 `ipc.ts:605-672`；权限判定入口 `ipc.ts:121-126` | 老清单缺 `permissions` 字段 = 未授权（fail-closed，`:119`） |
| 偏好保存了不生效 | `runtime.ts:314-340`（读写同闸，未声明键被拒）、`views/launcher/index.vue:759-795`（保存路径与 toast） | 值落 `launcher_docs` 的 `prefs.<pluginId>` 命名空间 |
| 市场装不上 / 更新不动 | `market.ts:104-166`（索引清洗、`normalizeSha256`）、`:537`（安装前校验和）、错误文案 `:120`；版本号一致性看 §6 审计测试 | 内置插件是**本地目录形态**，给不出包体哈希 |
| 装了但跑的是旧代码 | `builtinPlugins.ts:91-101`：版本相同就 `skip` | 改 `plugins/` 不抬版本 = 机器上还是旧包，最容易误判成"修了没用" |
| 开发热重载没触发 | `devPlugins.ts:1-16`（`fs.watch` → `importFromFolder` staging 交换 → `reloadPluginView`，300ms 防抖 `:32`）；坏清单不会破坏已装版本，错误经系统通知 + `launcher:devPlugins:changed` 推给界面 | 管理页的注册入口在 `views/launcher/index.vue:626-658`（`devChannels()` 探测旧 preload） |
| 想调试插件自身 | 管理页「调试」按钮 → `launcher:pluginDevtools`（`ROADMAP.md:42` 记的这条） | 插件视图是独立 `WebContents` |

---

## 9. 重生成时发现的口径差（记账用，不改代码）

| 差在哪 | 实情 | 处理建议 |
| --- | --- | --- |
| ROADMAP 说"21 个插件"，市场索引 22 条 | 分母不同：21 = `plugins/`；22 = 多出模板 `com.leaf.example` | 本文 §0 已分开记；勾 ROADMAP:41 时按 21 算 |
| `docs/ROADMAP.md:43-44` 写"`pluginStore.ts:318` 调 `docStore.deleteByPlugin`" | 现盘面该调用在 `pluginStore.ts:327`（行号漂移） | 下次动 ROADMAP 时顺手改指针 |
| `e2e/market-index.spec.mjs:81-88` 期望界面出现「sha256 校验」或「未校验」两串之一 | 全 `src/renderer` 检索这两个串**无命中**（只有 `market.ts:120` 的错误文案含"sha256 校验"）→ 该用例可能红，或在某条我没找到的路径上拼出来 | 真机轮跑它一次再判；本文**不**断言它红 |
| `pluginStore.ts:218-229` 有连续的「`api` 模式归一」两块一字不差的重复 | 幂等、无害，但看着像事故回填留下的 | 清理留给代码侧，本文不动代码 |
| `commandRunner.ts:161` 与 `:184` 两个 `case 'pluginSearch'` | switch 里后一个不可达 | ⌘K 侧 `copy` 走的是 `:166-171`（第一块），U5 主窗分支按第一块判 |
| `docs/DECISIONS.md` 的 Decision-012 出现两次（`:185`、`:213`） | 疑同批回填 | 见 `THEME_AND_VOICE.md` §5.3 末行 |
| `example-plugin/launcher-api.d.ts:133` 注释指向 `runtime.ts:643/704/900` 的 `Enter` 载荷 | 现盘面这三处行号未逐一复核（本文只核到 `Enter` 钩子形状本身） | 标**未证实**，需要时再核 |

---

## 10. 本轮记账（跑的人自己填）

| 项 | 值 |
| --- | --- |
| 验证日期 | （未跑） |
| 机器 / macOS 版本 | （未跑） |
| 构建（`out/` 来自哪次 commit） | （未跑） |
| 实例形态（dev / preview / 打包） | （未跑） |
| 已装内置插件版本快照（管理页或 `installed.json`） | （未跑） |
| 结论（21 条里几条通过） | 0 / 21 —— **因为一格都没跑，不是因为全挂** |
