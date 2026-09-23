# Frond · 内置插件真机验证清单（D2 内功）

> **本清单 2026-09-23 由代码重生成，重生成时未做过任何一轮真机验证，所有结果格为空。**
>
> **未跑过的不许打勾。** 结果列只允许在真机上、当场、亲眼看过界面之后填 `PASS` / `FAIL` / `BLOCKED`
> 并附日期与执行人；任何「代码看起来没问题」「单测过了」「e2e 绿了」都**不等于**真机验证过，
> 一律留在空格里。本文档里没有任何一个插件处于已验证状态。

## 0. 这份清单的口径与规矩

- 索引页定位：`docs/README.md:33`「内置插件真机验证清单（D2 内功）」。
- 被指着的两处：`docs/ROADMAP.md:41`（「21 个插件逐个真机验证」）、
  `docs/RAYCAST_PARITY_PLAN_V5.md:530`（「21 个内置插件逐个真机验证」；它顺带写的 `ROADMAP.md:38`
  已漂到 `ROADMAP.md:41`。本次不改那两个文件，只在此说明）。
- 清单内容**全部来自代码**：`plugins.json` + `plugins/*/plugin.json` + `example-plugin/plugin.json`
  + `src/main/launcher/*` 与 `src/preload/plugin.ts`。没有代码依据的点标「未证实」，不写结论。
- 一格怎么算跑过：该插件的 C0–C15 全部逐项判过（含专有项），任一没判就整行留空。
- 结果/备注列取值：`PASS`（判真条件全部满足）/ `FAIL`（任一条不满足，备注写哪条 + 现象）/
  `BLOCKED`（跑不下去，备注写卡在哪）。

## 1. 插件条数（以代码为准）

| 来源 | 计数方法 | 条数 |
| --- | --- | --- |
| `plugins/*/plugin.json`（内置；自动安装扫的就是这个目录） | `ls plugins` 计数 | **21** |
| `plugins.json`（静态市场索引 `plugins[]`） | `node -e "console.log(require('./plugins.json').plugins.length)"` | **22** |
| 差额来源 | 索引多出的那条是 `com.frond.example`，`download: "./example-plugin"`，不在 `plugins/` 下 | +1 |
| 内置插件命令总数（`commands[].code`） | 逐个清单累加 | 28 |
| 含示例后的命令总数 | 28 + 示例 4 | 32 |
| 内置插件 preferences 声明项数 | 逐个清单累加 | 22（示例另有 3 项） |

**与 ROADMAP 的 21 是否一致：一致，但要说清按哪个口径。**

- 按「内置插件目录」口径 = 21，`docs/ROADMAP.md:41` 与 `docs/RAYCAST_PARITY_PLAN_V5.md:530` 说的 21 就是它，
  也是 `builtinPlugins.ts:73-105` 每次启动真正扫描并自动安装的集合。
- 按「市场索引条目」口径 = **22**（`plugins.json` 里含 `com.frond.example`）。第 3 节按这个口径列 22 行，
  示例行单独标注「非内置自动安装」——它只从市场手动装（`market.ts:519-527` 目录形态）或被 dev 模式注册
  （`devPlugins.ts:245-267`）。
- 结论：**不凑数、也不改 ROADMAP**。真机跑的时候 21 条内置 + 1 条示例都要过一遍，但两者进入应用的路径不同，
  验收前置条件也不同（见 C0）。

## 2. 通用检查项（C0–C15）

每条都能判真假。「判真」= 看到的就是这样；「判假」= 别打勾，按 FAIL 记。代码位置是给复核的人验口径用的，
不代表那里已经通过。

### C0 前置：这个插件是怎么进到当前这个实例里的

- 21 个内置插件：首启由 `builtinPlugins.ts:53-105` 自动安装（版本不同才重装，`builtinPlugins.ts:91-101`）；
  判据 = 管理页「已安装插件」区有它、且显示 `v<清单版本>`。
- 示例插件：不在自动安装集合里（`builtinPluginsDir()` 只扫 `plugins/`，`builtinPlugins.ts:25-33`），
  要么市场页点安装，要么 dev 模式注册目录。
- 反例先排除：e2e/测试实例常带 `FROND_SKIP_BUILTIN_PLUGINS=1`（`builtinPlugins.ts:56-59`）→
  那种实例里 21 个全空，别把「搜不到」当插件坏了。
- 结果/备注：____

### C1 两个入口都搜得到，且不重复

- 操作：胶囊（全局快捷键唤起）里搜插件名与每条命令标题；主窗 ⌘K 面板同样搜一遍，各数命中行数。
- 判真：两处各出现、每处**仅一行**；标题 = `commands[].title`，副标题 = `<插件名> · <命令描述>`
  （`useCommandSources.ts:126-141`）；两入口共用同一份聚合源（胶囊 `LauncherApp.vue:439`、
  ⌘K `CommandPalette.vue:9,34` 都调 `useCommandSources`）。
- 判假：同一 `code` 出两行 / 只有胶囊有 / ⌘K 搜不到。
- 去重口径：命令 key 恒为 `plugin:<id>:<code>`（`useCommandSources.ts:127`），合并器按 key 与
  「动作签名 + 标题」双重去重（`mergeCommands.ts:79-97`）。**被去重时只有 DEV 构建的 console 会说话**
  （`useCommandSources.ts:246-255`），发布包里只能靠数行数。
- 附带一条：装/卸/启停后不必收起再唤起——命令表变更会播给所有窗（`ipc.ts:144-150`）。
- 结果/备注：____

### C2 停用即消失，且停用后打不开

- 操作：管理页停用（`views/launcher/index.vue:1126`）→ 两入口再搜 → 再用 `frond://plugin/<id>` 深链唤一次。
- 判真：搜索无该行（`useCommandSources.ts:124` 只留 enabled）；深链被拒并弹系统通知「插件已停用：<名>」
  （`runtime.ts:578-582`）。
- 判假：停用后还搜得到，或深链直接把界面打开了。
- 结果/备注：____

### C3 深链只能到「插件」，不能到「命令」

- 判据：`frond://plugin/<id>` 没有命令段（`frondUrl.ts:57-61`），主进程以 `cmd = null` 打开
  （`src/main/index.ts:209-215`）。多命令插件（base64 / colorpicker / htmlentity / jsonfmt / quickfolders /
  urlcodec）此时应回落到「清单里第一条命令的行为」，例：`plugins/com.frond.base64/index.html:13` 的
  `data.cmd || 'encode'`。
- 判假：深链打开后既不是首命令的行为、也没有任何可辨识状态（用户分不清在跑哪条命令）。
- 其它命令仍要逐条走：每条 `code` 分别从 ⌘K / 胶囊命令行进一遍。
- 结果/备注：____

### C4 带参数的命令按声明渲染成内联参数槽或表单页

- 唯一带参数声明的内置命令：`com.frond.regex` 的 `test`（`pattern` text 必填 / `text` text / `flags` dropdown）。
- 布局判据：`argSlots.ts:38-52` —— 含 `dropdown` → `{kind:'form',reason:'dropdown'}`；
  超过 2 格（`argSlots.ts:18`）→ `{kind:'form',reason:'too-many'}`。regex 两条都踩中，**按设计进表单页**，
  不该在搜索框里长出内联槽（`LauncherApp.vue:1210-1217` 的 `pushPage('pluginarg')`）。
- 判真（胶囊）：回车后进参数表单；`pattern` 留空提交 → 留在表单不执行
  （required 语义 `plugin-protocol.ts:88` + `argSlots.ts:122-128`）；`flags` 的候选标题要还原成值再交给插件
  （`LauncherApp.vue:690` 的 title→value 映射）。
- 判真（⌘K）：⌘K 面板**不传** `openPluginArg`（`CommandPalette.vue:102-109`），于是退化为「无参直接打开插件」
  （`commandRunner.ts:74-82`）——regex 因此走「读剪贴板」分支（`plugins/com.frond.regex/index.html:13-42`）。
  这是既定设计，但两个入口行为不同，**必须分别记录**，不能拿胶囊那次的结果替 ⌘K 打勾。
- 判假：带 dropdown 的命令长出内联槽 / 必填为空却执行了 / ⌘K 里也弹了表单页（两处代码不同步）。
- 内联槽的正例内置插件给不出（`e2e/plugin-arg-slots.spec.mjs:9,21` 用的是 `com.frond.example-react`，
  ≤2 格纯文本才走内联）→ 这一格对 21 个内置插件**本轮无从判真**，按 BLOCKED 或留空处理。
- 结果/备注：____

### C5 未授予 permissions 时是明确拒绝，而不是静默失败或假成功

- 操作：把该插件目录复制一份、清空 `permissions`，用 dev 模式注册（`devPlugins.ts:245-267`）后触发对应动作；
  或先按第 3 节的权限列对照现状。
- 逐 API 的拒绝形状（这就是判真假的尺子）：
  - `readText` 未声明 `clipboard.read` → 主进程回**空串**（`ipc.ts:619-623`）。这与「剪贴板真的没内容」同形，
    属既定 fail-closed 设计（`plugin-protocol.ts:496-499`）。判真 = 插件出现「剪贴板为空」类兜底文案、不崩、
    不显示假结果；备注里要写下这条歧义（宿主不报错是设计，不是漏）。
  - `copyText` 未声明 `clipboard.write` → 返回 `false`（`ipc.ts:612-617`）；插件不看返回值就报「已复制」→ **FAIL**。
  - `fetch` 未声明 `net` → `{ok:false,error:'permission denied: net（需在 plugin.json 声明）'}`（`ipc.ts:515-521`），
    界面必须出现可读失败而不是空表。
  - `openUrl` / `openPath` 未声明 `net` / `fs.open` → 返回 `false`（`ipc.ts:671-679`、`ipc.ts:625-633`）。
  - `schedule.*` 未声明 `schedule` → `list` 回 `[]`、`add/remove` 回带原因（`ipc.ts:644-667`）。
- 拼错的权限名 = 没声明（`pluginStore.ts:212-217` 静默剔除）→「权限像没生效」先查清单拼写。
- 结果/备注：____

### C6 「一键复制」到底走哪条通道

- 判据：内置插件的复制**全部**是声明式列表动作 `type:'copy'` → 由胶囊渲染端 `navigator.clipboard.writeText`
  完成（`PluginListPage.vue:132-140`），**不经过插件权限闸**，失败时 `catch` 后静默 `hide()`（同处）。
  而 `searchable` 条目的 copy 走主进程统一执行端（`commandRunner.ts:161-172` + `actionHandlers.ts:131-134`）。
- 判真：回车后 ⌘V 粘出的内容与界面显示一致，且胶囊收起。
- 判假：复制到空串/上一次旧值；或界面写「回车复制」而动作里没有 copy 项。
- 结果/备注：____

### C7 `window.launcherApi` 用到的方法与 preload / 类型声明一致

- 静态面（已有闸）：`plugin-api-parity.test.ts:72-91` 扫 `plugins/` 与 `example-plugin`，把页面里的 `api.xxx`
  与 `src/preload/plugin.ts:58-167` 真正暴露的方法逐一对账（背景就是当年 16/21 调不存在的 `getClipboardText`）；
  `plugin-api-parity.test.ts:99-131` 再查敏感 API 与 `permissions` 是否配对（映射表
  `plugin-protocol.ts:522-537`）。本轮静态读码结果：21 个内置插件里 17 个调 `readText`（均已声明
  `clipboard.read`）、1 个调 `fetch`（currency，已声明 `net`），无未配对声明。
- 真机面判的是「**用得上**」：逐个确认页面调到的方法在 `example-plugin/launcher-api.d.ts` 有同名签名；
  三处不一致以 `src/preload/plugin.ts` 与 `src/shared/plugin-protocol.ts` 为准
  （`launcher-api.d.ts:4-7` 自己就是这么写的）。
- 本轮读码得到的调用集合（决定哪些能力对内置插件是零真机覆盖）：
  - 内置插件用到：`onEnter` `onSubInputChange` `onAction` `setSubInput` `renderList` `readText`
    `preferences.get` `db.get` `db.put` `notify` `close` `fetch`。
  - 内置插件**一个都没用**：`getContext` `renderView` `submitSearchItems` `clearList` `popView`
    `setExpandHeight` `detach` `alert` `openUrl` `openPath` `copyText` `db.remove` `db.list`
    `preferences.all/set` `schedule.*` → 这些只能由示例插件 / React 例程覆盖，别写成「内置插件已验」。
- 结果/备注：____

### C8 `searchable` 双通道：没声明就写不进去

- 判据：只有 `plugin.searchable === true` 且已启用的插件能提交条目（`pluginSearchIndex.ts:27-36`），
  而 **21 个内置插件 + 示例插件的清单里没有任何 `searchable` 字段**（本轮 grep 全为 0）→
  页面若调 `submitSearchItems` 必然拿 `{ok:false}` 且界面无提示（`ipc.ts:389-401`）。
- 真机：若某插件页面写着「关掉插件后也能搜到我的条目」这类承诺，判 **FAIL** 并记「清单缺 `searchable` 声明」。
- 结果/备注：____

### C9 偏好读写：只认清单声明过的键

- 判据：`getPluginPreference` 对未声明键回 `{ok:false,error:'preference not declared: <键>'}`
  （`runtime.ts:314-321`），`set` 同样拒（`runtime.ts:328-337`），存储命名空间 `prefs.<pluginId>`
  （`runtime.ts:322,338`）。管理页按声明自动渲染表单（`views/launcher/index.vue:64,81`）。
- 声明本身也可能被静默清洗掉（未知 type / 无候选的 select / label 空 → 整条丢，`plugin-protocol.ts:579-621`；
  上限 20 项 `plugin-protocol.ts:550`）→「设置页少一项」先跑 `pluginManifestAudit.test.ts:137-178`
  那道静态闸再判真机。
- 已知代码级偏差（必须真机确认表现）：`com.frond.quickfolders` 读 `api.preferences.get('defaultFolders')`
  （`plugins/com.frond.quickfolders/index.html:23`），但它的 `plugin.json` **没有任何 preferences 声明** →
  这趟读必然回 error。判真 = 它只是「db 为空时的回退」且回退后功能照常；判假 = 首启用不到 / 报错刷屏。
- 验法：改一次偏好 → 插件内立刻读到新值 → 重启应用仍读到新值。
- 结果/备注：____

### C10 卸载会清掉插件自己的 KV 数据

- 判据：`removePlugin` 除了删目录与索引项，还调 `docStore.deleteByPlugin(pluginId)`
  （`pluginStore.ts:321-331`，实调用在 `:327`；`docs/ROADMAP.md:43` 记的 `pluginStore.ts:318` 行号已漂）。
  数据库没就绪时该清理被 `catch` 吞掉（`pluginStore.ts:328-331`）→ 极早启动时卸载可能残留。
- 真机链：装 → 造数据（quickfolders「添加常用目录」/ 示例插件写一条 db）→ 卸载 → 重装 → 列表应为空。
- 判假：重装后旧数据还在（清理没跑，或 KV 命名空间漏了）。
- 结果/备注：____

### C11 市场条目 sha256 校验的行为

- 本轮读到的事实：`plugins.json` 的 **22 条全部没有 `sha256` 字段**。
- 规则（`market.ts`）：
  - 目录形态**根本不校验**，只做索引目录包含校验（`market.ts:519-527`；设计说明 `market.ts:19`）——
    内置插件走的正是这条，所以「内置插件包体完整性」在市场上**没有**校验这回事。
  - zip / url 形态才在解压前比对（`market.ts:529-543`）；未声明 = 跳过（`market.ts:116-121`），
    一旦声明就必须命中，否则中止安装并给「sha256 校验不通过：包体与索引声明不一致，已中止安装」原文。
  - 声明了但格式非法（不是 64 位 hex）→ **整条从索引里被剔除**（`market.ts:151-157`），
    表现是「市场少一个插件」而不是报错（解析闸 `parseMarketIndex`，`market.ts:130-169`）。
  - 远程索引与本地条目 id 撞车时远程被丢弃并回 `shadowed`（`market.ts:274-290`）。
- 真机判据：市场页对内置条目应如实标「未校验」——`e2e/market-index.spec.mjs:81-89` 就是这条期望。
  **但本轮读码在市场块的渲染端找不到「未校验 / sha256 校验」文案，也没有远程索引输入框**
  （市场块 `views/launcher/index.vue:122-179`，头部文案是「索引：仓库 plugins.json」，
  而 `e2e/market-index.spec.mjs:133` 期望「索引：打包 plugins.json」）→ 疑事故后重建丢了这一块，
  属真机核对项，本文档不下结论。
- 结果/备注：____

### C12 网络类插件（内置只有 `com.frond.currency` 声明了 `net`）

- 判据：`fetch` → 主进程代理 `proxyPluginFetch`（`ipc.ts:515-521` → `runtime.ts:394`），
  响应上限 2MB（`runtime.ts:370`）、15s 超时（`preload/plugin.ts:162-166` 口径），
  本地/内网/链路本地地址拒绝并做 DNS 解析复判（`runtime.ts:372-380`，防 rebinding；解析失败按拒绝处理）。
- 真机判真：正常网络出结果，且随 `baseCurrency` / `targetCurrency` 偏好变化；断网/坏域名时给**可读失败**
  （带原因），不是空列表、不是「转换成功 0」。
- 判假：把地址指到 `http://127.0.0.1` 之类竟然通（内网闸失效）→ 安全项，见即 FAIL 并单独上报。
- 结果/备注：____

### C13 声明式列表的渲染边界

- 判据：每条 item 必须同时有 `title` 与 `actions` 数组，否则**整份提交被拒**
  （`runtime.ts:136-142`，回 `item needs title and actions`）；条数封顶 300
  （`plugin-protocol.ts:285` + `runtime.ts:137`）；单条 actions 封顶 10（`runtime.ts:156`）；
  `detail` 超 5000 字符截断（`runtime.ts:150`）；`title` 200、`subtitle` 300 截断（`runtime.ts:144-145`）。
- 真机判据：超长输入（例如 200KB JSON 丢给 `com.frond.jsonfmt`）仍出一屏可读结果或明确降级，不白屏；
  重绘型插件（每敲一个字都 `renderList`）**不该长出返回栈**（`preload/plugin.ts:126-135` 的 `push` 语义 +
  `runtime.ts:114-124`）。
- 判假：在插件里按 ESC/返回时「回不去」，或返回栈越堆越长。
- 结果/备注：____

### C14 副输入框 / 高度 / detach 后能力收缩

- 判据：`setSubInput` 借用胶囊搜索框（`runtime.ts:814-819`），placeholder 应与当前状态匹配；
  `setExpandHeight` 夹在 120–580（`runtime.ts:804-812`，与 `preload/plugin.ts:67-69` 注释同口径）；
  detach 之后：声明式列表直接不可用（`runtime.ts:134` 回 `declarative list unavailable in detached mode`），
  `setSubInput` / `setExpandHeight` 直接 `return false`（`ipc.ts:581-599`），`close` 同样被拒（`ipc.ts:714-719`）。
- 真机判据：detach 成独立窗后不崩、不出现「能点但没反应」的假象；收回胶囊后副输入框交还搜索。
- 结果/备注：____

### C15 定时任务通道（对本批 21 个内置插件全部不适用）

- 判据：需要 `schedule` 权限（内置插件声明数 = 0），且只能排 **`mode:'action'` 命令**
  （`ipc.ts:649-660` 的 `isActionCommand` 闸，判定在 `plugin-protocol.ts:114-120`）。
  内置插件 `commands[]` 全无 `mode` 字段 → 缺省按 view 处理（`plugin-protocol.ts:106-108`）。
- 所以这一格对内置插件**必然判不了**：拿示例 React 插件跑（`e2e/plugin-schedule.spec.mjs:21`）；
  本表按「不适用」记，别记成「已通过」。
- 顺带一条静态疑点：审计测试的已知权限集合（`pluginManifestAudit.test.ts:36`）只有
  `clipboard.read / clipboard.write / fs.open / net`，**不含 `schedule`** → 谁哪天给内置插件声明 `schedule`，
  静态审计会判「未知权限」而真机是有效的。那是测试与协议清单的口径漂移，遇到时改测试别改插件。
- 结果/备注：____

## 3. 逐插件条目（22 行 = 21 内置 + 1 示例）

- 「命令」列 = `commands[].code`（`code` 才是 `getContext().cmd` 与 key `plugin:<id>:<code>` 用的值）。
- 「参数声明」列 = `commands[].arguments`（宿主清洗后的形状；`*` = required）。
- 「preferences」列 = `preferences[].name`（类型, 默认值/候选数）。
- 「permissions」列 = 清单原值；「无」= 空数组或未声明，此时 C5 的敏感调用一律该被拒。
- 结果 / 备注两列**故意留空**：没跑真机之前一个字符都不要填。

| id | 命令 `code` | 参数声明 | preferences 项 | permissions | 结果 | 备注 |
| --- | --- | --- | --- | --- | --- | --- |
| com.frond.base64 | `encode`, `decode` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.baseconvert | `convert` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.colorpicker | `convert`, `palette` | 无 | `defaultFormat`(select, HEX/3) | `clipboard.read` |  |  |
| com.frond.contrast | `check` | 无 | `fgColor`(text, #000000), `bgColor`(text, #FFFFFF) | 无 |  |  |
| com.frond.cron | `parse` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.csvjson | `convert` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.currency | `convert` | 无 | `baseCurrency`(select, CNY/10), `targetCurrency`(select, USD/10) | `clipboard.read`, `net` |  |  |
| com.frond.hash | `compute` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.htmlentity | `encode`, `decode` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.jsonfmt | `format`, `minify`, `escape` | 无 | `indent`(select, "2"/3) | `clipboard.read` |  |  |
| com.frond.jsonyaml | `convert` | 无 | `indent`(select, "2"/2) | `clipboard.read` |  |  |
| com.frond.jwt | `decode` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.lorem | `generate` | 无 | `unit`(select, paragraph/3), `count`(select, "3"/4) | 无 |  |  |
| com.frond.passwordgen | `generate` | 无 | `length`(select, "16"/6), `uppercase`(checkbox true), `lowercase`(checkbox true), `numbers`(checkbox true), `symbols`(checkbox true), `count`(select, "1"/3) | 无 |  |  |
| com.frond.qrcode | `generate` | 无 | `size`(select, "256"/3), `ecc`(select, M/4) | `clipboard.read` |  |  |
| com.frond.quickfolders | `open`, `add` | 无 | 无（但页面读未声明的 `defaultFolders`，见 C9） | `clipboard.read` |  |  |
| com.frond.regex | `test` | `pattern`(text)\*, `text`(text), `flags`(dropdown/3) | `flags`(select, g/5) | `clipboard.read` |  |  |
| com.frond.textstats | `stats` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.timestamp | `convert` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.urlcodec | `encode`, `decode` | 无 | 无 | `clipboard.read` |  |  |
| com.frond.uuid | `generate` | 无 | `count`(select, "1"/4), `format`(select, lowercase/3) | 无 |  |  |
| com.frond.example | `list`, `prefs`, `net`, `misc` | 无 | `author`(text, Frond), `theme`(select, 原生质感/3), `notifyOnCopy`(checkbox true) | `clipboard.read`, `clipboard.write`, `net`（非内置自动安装，走市场/dev，见 C0） |  |  |

### 3.1 逐插件的专有判据（只写代码里读得出来的）

- **多命令插件（base64 / colorpicker / htmlentity / jsonfmt / quickfolders / urlcodec）**：每条 `code`
  单独走 C1+C3；重点看 `onEnter` 收到的 `cmd` 是否真被用来切分支（如
  `plugins/com.frond.base64/index.html:12-20` 按 cmd 换 placeholder 与处理函数）。
  两条命令长得一模一样 = 命令没接上，判 FAIL。
- **contrast / lorem / passwordgen / uuid（permissions 为空）**：C5 的整套拒绝形状在这里是**常态**——
  它们本来就不该调敏感 API（本轮读码：这 4 个都没调 `readText`/`copyText`）。判据：页面不得出现
  「从剪贴板自动读取」这类依赖 `clipboard.read` 的承诺；出现即 FAIL 并记「权限与实现不符」。
- **currency**：唯一 `net`。跑 C12 + 断网文案 + 偏好生效；`api.fetch` 调用点在
  `plugins/com.frond.currency/index.html:274-275`（`https://open.er-api.com/v6/latest/<base>`）。
- **quickfolders**：三个坑叠在一起 —— ① C9 的未声明偏好读；② 唯一用到 `db.get/db.put` + `notify` + `close`
  的内置插件（`plugins/com.frond.quickfolders/index.html:20,76,102-103,135`），所以 C10 的卸载清 KV
  **拿它当主验本**；③ 「打开目录」是列表动作 `type:'open'` 带本地路径
  （`plugins/com.frond.quickfolders/index.html:57`），执行端在渲染侧 `system.openPath`
  （`PluginListPage.vue:141-149`），**不受插件的 `fs.open` 权限约束**——这条通道对第三方插件意味着什么，
  真机跑的时候顺带判一次（路径不存在 / 是文件 / 是别人家目录时各是什么长相）。
- **regex**：唯一带参数声明（C4 主验本）；参数 placeholder 写着「留空则取剪贴板」，要按 C5 的
  `readText` 空串歧义判一遍；`flags` 的 dropdown 标题→值还原见 C4。
- **jsonfmt / csvjson / jsonyaml / textstats / hash / jwt**：C13 的截断与整份拒收边界拿它们当验本
  （长输入 / 超大结果 / 非法输入三种），特别是 `renderList` 被整体拒绝时（`runtime.ts:136-142`）的白屏长相。
- **qrcode**：唯一可能产出图片的内置插件，判据要落在「回车复制的到底是图片还是文本」，
  以及 `size` / `ecc` 偏好改完是否立刻生效（C9）。
- **example（示例插件）**：`copyText`（已声明 `clipboard.write`）、`alert`、`openUrl`、`db.list`、
  `preferences.all/set`、`fetch` 的几乎唯一覆盖者（C7 列的「内置插件没用过」那一长串基本只能在这里补）；
  它也不进 C0 的自动安装集合，验之前先确认它确实装上了。

## 4. 宿主侧共性事实（会影响判读，先记在这）

| # | 事实 | 代码依据 |
| --- | --- | --- |
| H1 | 两个入口共用同一份命令聚合（胶囊与主窗 ⌘K 都调 `useCommandSources`） | `LauncherApp.vue:439`、`CommandPalette.vue:9,34` |
| H2 | 命令 key 恒为 `plugin:<id>:<code>`；重复由合并器吞掉且只在 DEV 打日志 | `useCommandSources.ts:127`、`mergeCommands.ts:79-97`、`useCommandSources.ts:246-255` |
| H3 | ⌘K 不传参数表单回调 → 带参数命令在 ⌘K 里退化为无参打开 | `CommandPalette.vue:102-109`、`commandRunner.ts:74-82` |
| H4 | 未授权 `readText` 回空串，与「剪贴板真的空」同形 | `ipc.ts:619-623` |
| H5 | 列表动作 `copy` 由渲染端 `navigator.clipboard` 执行，绕过 `clipboard.write` 权限；失败静默 | `PluginListPage.vue:132-140` |
| H6 | `commandRunner.ts` 里有两段同名 `case 'pluginSearch'`，第二段不可达 | `commandRunner.ts:161`、`commandRunner.ts:184` |
| H7 | 市场目录形态不比对哈希；只有 zip/url 才在解压前校验 | `market.ts:19`、`market.ts:519-543`、`market.ts:116-121` |
| H8 | 市场块渲染端未见「未校验 / sha256 校验」标签与远程索引输入框，且头部文案与 e2e 期望不同 | `views/launcher/index.vue:122-179` vs `e2e/market-index.spec.mjs:81-89,133` |
| H9 | `launcher:pluginDevtools` 在主进程与 IPC 契约里都在，渲染端无调用者（`ROADMAP.md:42` 却记为「管理页调试按钮」已接线） | `ipc.ts:246`、`ipc-contract.ts:711`、渲染端 grep 0 命中 |
| H10 | Action 型命令（`mode:'action'`）不挂视图、20s 无产出即回收；内置插件无一条声明 `mode` | `runtime.ts:586-648`、`runtime.ts:90`、`plugin-protocol.ts:106-120` |
| H11 | 清单字段被宿主 fail-closed 静默清洗（权限 / 参数 / 偏好 / 命令形态），写错的长相是「少了个东西」而不是报错 | `pluginStore.ts:212-254`、`plugin-protocol.ts:143-177,579-621` |
| H12 | 内置插件自动安装只在版本号不同时重装；e2e 实例常整段跳过 | `builtinPlugins.ts:56-59,91-101` |

## 5. 未证实（本轮没有代码依据，也不许凭印象填）

1. 21 个内置插件在**真机**上的任何一条表现：界面出不出得来、复制对不对、断网长相、首启耗时——全部未证实。
2. 打包态（`resources/plugins.json` + `resources/plugins/`）下的市场与自动安装行为：本轮只读了未打包回退
   （`market.ts:87-93`、`builtinPlugins.ts:25-33`），打包产物没跑，未证实。
3. macOS 系统层连带表现（系统通知是否弹得出来、剪贴板被别的 App 占用时的复制结果、
   `Notification.isSupported()` 为假的机器）：未证实。
4. 市场 UI 是否仍有「sha256 / 未校验」与远程索引输入框（H8 只是 grep 未命中，不等于界面没有）：未证实。
5. `com.frond.quickfolders` 的 `open` 动作在非绝对路径 / 不存在路径下的具体表现：未证实。
6. 各插件的**中文文案**与真实行为是否逐条一致（例如「一键复制图片」）：只做了代码级抽查，未证实。
7. React 视图协议（`renderView`）与 `submitSearchItems` 对内置插件：内置插件全未调用（C7），
   它们的真机表现属示例 / React 例程范围，不在本清单结论里。

## 6. 重生成方法（下次别再手抄）

```bash
# 条数：内置目录 / 市场索引
ls plugins | wc -l
node -e "console.log(require('./plugins.json').plugins.length)"

# 逐插件：id / version / commands(含 arguments) / preferences / permissions
node -e "
const fs=require('fs');
for(const d of fs.readdirSync('plugins')){
  const m=JSON.parse(fs.readFileSync('plugins/'+d+'/plugin.json','utf8'));
  console.log(m.id, m.version,
    (m.commands||[]).map(c=>c.code+(c.mode?'['+c.mode+']':'')+(c.arguments?'('+c.arguments.map(a=>a.name+':'+(a.type||'text')).join(',')+')':'')).join(' '),
    '| prefs:', (m.preferences||[]).map(p=>p.name+':'+p.type).join(','),
    '| perms:', (m.permissions||[]).join(','));
}"

# 页面实际调用的 launcherApi 方法（注意：链式换行的写法也要吃进去）
node -e "
const fs=require('fs');
for(const d of fs.readdirSync('plugins')){
  const h=fs.readFileSync('plugins/'+d+'/index.html','utf8'); const s=new Set();
  for(const x of h.matchAll(/api\s*\.\s*([A-Za-z_]+(?:\s*\.\s*[A-Za-z_]+)?)/g)) s.add(x[1].replace(/\s+/g,''));
  console.log(d, [...s].sort().join(','));
}"
```

静态闸（跑不跑由下一轮决定，**跑绿了也不等于真机验过**）：
`src/main/launcher/__tests__/pluginManifestAudit.test.ts`、
`src/shared/__tests__/plugin-api-parity.test.ts`。
