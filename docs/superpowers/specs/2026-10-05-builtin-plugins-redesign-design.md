# 内置插件全面重塑设计（21 个 + 宿主能力扩展）

- 日期：2026-10-05
- 状态：设计已批准（用户确认「宿主补能力 + 插件重写」与「全部 21 个统一重做」）；spec 待用户审阅
- 前置调研：2026-10-05 插件系统与内置插件摸底（宿主能力面清单 + 21 插件逐个摘要）

## 1. 背景与目标

现状（摸底结论）：**宿主插件系统不弱，弱在内置插件的用法**。

1. 21 个内置插件中 20 个是同一套「剪贴板进 → 单条结果 → 复制出」的同构样板（ES5 内联单 HTML，118-780 行），最简一批为无状态只读转换器。
2. 能力浪费：0 个插件用视图栈（push/pop）、0 个用 React `renderView`/Form、0 个用 alert、0 个用 `submitSearchItems`、0 个有测试；有状态/写操作的仅 quickfolders（db+notify），联网的仅 currency（fetch），用命令参数的仅 regex。
3. 宿主 UI 硬缺口：列表条目不支持颜色块/图片（qrcode 被 API 逼成 markdown data-URL hack）、data 模式无分组、复制成功只能发系统通知（重口味）、accessories 只有纯文本。
4. React 视图协议已有 `List.Section`，但主进程 `parsePluginView` 归一为 v1 时**拍平丢弃分组**（隐性降级，顺带修复）。

目标：

1. 21 个内置插件升级为各有完整交互、有状态、有历史、多动作的产品级插件。
2. 内置插件成为插件作者 0→1 的示范田：20 个继续走**零构建单 HTML data 模式**（低门槛是 Frond 插件生态核心卖点），1 个（currency）转 React SDK 打样高端形态。
3. 宿主协议补齐 data 模式 UI 硬缺口：颜色块/图片条目、列表分组、轻提示（HUD）、tag 徽章。

成功标准：

- 全部 21 插件具备：实时双向转换、3 个以上动作、空态引导、HUD 复制反馈；转换类插件具备 db 历史。
- 全部 21 插件转换核心逻辑抽入 `lib.js` 并有 vitest 单测（现状 0 测试）。
- 新协议字段「声明即渲染」有单测覆盖（sanitizer 与渲染层同步，防静默清洗——清单偏好写错即静默丢失的先例教训）。
- 全量门禁绿：typecheck / eslint / stylelint / vitest / e2e smoke。

## 2. 决策记录

| 决策点 | 结论 | 依据 |
|---|---|---|
| 路径 | 宿主补能力 + 插件重写 | 用户选定；一步到位，内置插件成为真正的能力示范 |
| 范围 | 全部 21 个统一重做 + example-plugin 同步 | 用户选定；插件作者参照拉齐 |
| 插件形态 | 20 个 data 模式（零构建单 HTML）+ 1 个 React SDK 标杆（currency） | 用户在方案问题上未答，按推荐执行：data 模式是「作者 0→1」的门槛优势，React 标杆验证 SDK 端到端成熟度。**spec 审阅时可推翻此条** |

## 3. 宿主能力扩展（4 项）

### 3.1 条目颜色块 / 图片（icon 增强）

- 现状：`PluginListItem.icon` 为 `string`（remixicon 名），`PluginListPage.vue` 渲染走 `AppIcon`（**AppIcon 已支持 `color` prop**，透传成本极低）。
- 扩展：`icon: string | { value: string; tintColor?: string; dataUrl?: string }`。
  - `string` 形状向后兼容不变。
  - `tintColor`：仅接受 `#rgb` / `#rrggbb` hex，非法值剥离。
  - `dataUrl`：必须以 `data:image/png;base64,` 开头，**字符串总长 ≤ 65536 字符**（≈48KB 原始 PNG；256px 二维码约 1-3KB，余量充足），超限剥离并 console 警告。
  - 渲染优先级：`dataUrl`（圆角缩略图 `<img>`）> `tintColor`（AppIcon color）> 默认 `plug-2`。
- sanitizer：`src/shared/plugin-protocol.ts` 的 item 清洗器同步扩展 + 单测。

### 3.2 列表分组（section）

- 现状：data 模式 `PluginListItem` 无组概念；React v1 协议已有 `sections`（≤20）但 `parsePluginView` 拍平丢弃。
- 扩展：`PluginListItem` 加可选 `section?: string`（清洗后 ≤40 字符，空串剥除）。
  - `parsePluginView` 不再拍平：React sections 归一时把组名注入该组 items 的 `section` 字段，保持原顺序。
  - 渲染层 `PluginListPage.vue` 将**相邻同名** `section` 聚合渲染组头（小标题 + 分隔样式，不做 sticky）。
- 服务：hash、jwt、cron、textstats、regex、colorpicker、currency；顺带修复 React `List.Section` 拍平降级。

### 3.3 showHud 轻提示

- API：`launcherApi.showHud(title: string)`，title 清洗后 ≤80 字符。
- 链路：preload `src/preload/plugin.ts` → IPC `plugapi:hud`（typedHandle，照 `plugapi:notify` 模式，含 e2e 计数）→ 渲染层胶囊全局 HUD 组件（复用现有玻璃风格 token），1.5s 自动淡出；同文本连续调用只刷新计时。
- 权限：无需 manifest 声明（纯 UI 反馈，与 notify 同级）。

### 3.4 accessories tag 徽章

- 扩展：`accessories: Array<string | { tag: string; tone?: 'default' | 'success' | 'warn' | 'danger' }>`；纯 string 向后兼容；tag 清洗后 ≤12 字符。
- 渲染：tag 渲染为小圆角底色徽章，tone 四档映射语义 token（`success`/`warn`/`danger`/默认 surface）。
- 服务：contrast（AA/AAA）、jwt（过期状态）、timestamp（秒/毫秒）、currency（币种代码）、hash（算法名）。

## 4. 插件统一公约（重写后每个插件必须具备）

1. **测试基建**：转换核心逻辑抽入 `plugins/<id>/lib.js`（无依赖纯函数，`module.exports` + 挂 `window` 的 UMD 双导出，index.html `<script src="lib.js">` 引入）；vitest 直接 import 做单测。每个插件至少覆盖：主转换路径正/反例、非法输入降级、边界（空串/超长/特殊字符）。
2. **历史记录**（转换类插件）：`db.put('history', …)` 存最近 20 条 `{ input, output, ts }`；列表分「结果 / 历史」两组；历史条目动作：以该输入重算、删除该条；列表尾部固定「清空历史」条目（带 confirm 类二次确认语义——用宿主 alert）。
3. **多动作**：结果条目 3-6 个动作（不同格式变体复制、反向转换、清空输入）；「粘贴到前台」不进本轮（宿主无此插件 API，grep 确认）。
4. **双向自动检测**：输入为有效目标格式时，列表同时提供两个方向的结果。
5. **空态引导**：`emptyMessage` + 可点击示例条目（点击即以示例输入重算）。
6. **HUD 反馈**：复制成功用 `showHud`，不再 `notify`（notify 保留给真正需要离开注意力的场景）。

## 5. 逐插件功能设计

### 5.1 转换器组（8 个，统一模板 + 特化）

| 插件 | 特化新功能 |
|---|---|
| base64 | 编/解码自动检测（输入为合法 base64 时双向并列）；URL-safe 变体动作；按 76 字符换行动作；历史 |
| urlcodec | encode/decode 自动检测；`encodeURIComponent` 与 `encodeURI` 两种变体动作；历史 |
| htmlentity | encode/decode 自动检测；命名实体与数字实体变体；历史 |
| jsonfmt | format（2/4 空格两动作）/minify/escape/unescape/排序键；解析错误精确到行:列；格式校验徽章；历史 |
| baseconvert | `0x`/`0b`/`0o` 前缀自动识别输入进制；2/8/10/16 四条并列（分组 + 进制徽章）；BigInt 大整数；历史 |
| timestamp | 双向（时间戳↔日期）；相对时间（x 分钟前）；秒/毫秒徽章；「当前时间戳」实时刷新条目；UTC/本地双时区 detail；历史 |
| csvjson | 方向自动检测；表头开关变体动作；分隔符 `,`/`;`/`\t` 变体；历史 |
| jsonyaml | 方向自动检测；缩进 2/4 变体；解析错误定位；历史 |

### 5.2 生成器组（4 个）

| 插件 | 特化新功能 |
|---|---|
| uuid | v4 批量（subinput 数字 = 数量）；新增 v7（时间有序，自实现）；格式动作：大写/无连字符/urn；detail 说明版本差异 |
| passwordgen | 预置方案条目（强/中/易读/PIN）替代纯长度输入；subinput 数字 = 自定义长度；排除易混淆字符动作；熵值估算 detail；批量生成（数量 subinput） |
| lorem | 类型由 arguments dropdown（段落/句子/单词）+ subinput 数量；新增中文占位文变体；重新生成动作 |
| qrcode | **dataUrl 条目转正**（icon.dataUrl 直接显示图片，替代 markdown hack）；纠错级别/尺寸偏好改动后无需重进插件、输入时即时重算；动作：复制图片/复制文本 |

### 5.3 分析器组（5 个）

| 插件 | 特化新功能 |
|---|---|
| hash | MD5/SHA1/SHA256/SHA384/SHA512 分组并列；逐算法复制动作；base64 输出变体动作；算法名徽章 |
| regex | 匹配列表（全部匹配 + 各匹配的捕获组展开为分组）；flags 快捷切换动作（g/i/m/s toggle）；常用正则库快捷条目（邮箱/URL/手机号，点击填入）；匹配高亮 detail |
| jwt | header/payload 分组 + claims 逐条（时间戳类 claim 自动可读化）；过期徽章（有效/已过期 + 剩余/超时时间）；算法徽章；detail 明示「不校验签名」警示 |
| cron | 人类可读描述条目 + 下次 5 次执行时间分组 + 字段含义分组；常用表达式快捷条目（每分钟/每小时/每天 9 点…点击填入） |
| textstats | 统计分组（字符/词/行/字节/阅读时长）+ 词频 Top10 分组；复制统计摘要动作 |

### 5.4 颜色组（2 个）

| 插件 | 特化新功能 |
|---|---|
| colorpicker | HEX/RGB/HSL/HSV/CMYK 五格式并列（**tintColor 颜色块** + 格式徽章分组）；调色板浏览（push 视图栈——首个使用导航的内置插件）；最近颜色历史（db） |
| contrast | 双值输入语法 `前景/背景`（如 `#000/#fff`）；对比度比率与达标情况用 markdown 表格 detail（比率值 + AA/AAA 双行判定，不做图形进度条）；AA/AAA 判定徽章（tag.tone）；前景背景互换动作；示例配对条目 |

### 5.5 currency（React SDK 标杆）

- 重写为 `api: 'react'` 插件：List + ActionPanel + `nav.push` 货币选择搜索页 + Form（金额）。
- 功能：解析「100 usd cny」自然语法；换算列表（常用货币 Top10 + 收藏货币对，收藏用 db）；换向动作；**db 离线缓存 24h**（断网可用上次汇率并标注数据时间徽章）。
- 验证目标：SDK 端到端（网络 + 缓存 + 多级导航 + 表单）成熟度，为插件作者提供高端范例。

### 5.6 quickfolders（已有状态基础，增强）

- 补 remixicon 文件夹图标；按打开计数排序（db 计数）；置顶动作；「浏览子目录」push 视图栈导航；保持既有剪贴板添加路径。

### 5.7 example-plugin 同步升级

- 演示全部新协议字段与 API：section、tintColor、dataUrl、tag accessories、showHud——保持插件作者文档与示例一致。

## 6. 版本与兼容

- 每个插件 `plugin.json` version 递增（major +1，如 1.0.1 → 2.0.0），`builtinPlugins.ts` 按版本号判断重装——**漏递增则重写不生效**，实施计划中每个插件任务显式含 version bump。
- 协议新字段全部可选、向后兼容：旧插件不传新字段行为不变。
- React sections 归一行为变化（拍平 → 注入 section 字段）：`PluginViewListItem` 同步加 `section` 字段，渲染端消费——对现有 React 插件（仅 example-react）无破坏。

## 7. 非目标（YAGNI 明确不做，防返工）

- data 模式自定义 HTML：破坏插件信任模型，自由 UI 需求走 React SDK。
- slider / radio / tags 等新表单控件：现有 arguments dropdown + subinput + 偏好已覆盖本轮需求。
- 文件选择器、getSelectedText：无明确插件需求。
- 「粘贴到前台」插件 API：宿主无此能力，新增系统级 API 超出本轮。
- 内联偏好编辑：用「打开设置」类动作替代。
- 屏幕取色（colorpicker）：需系统能力，超本轮。
- 文件哈希（hash）：需 fs 读权限与文件流，本轮仅文本。

## 8. 实施顺序概要（细节由实施计划展开）

1. **宿主协议扩展**：sanitizer（icon/section/tag/dataUrl）+ `parsePluginView` section 注入 + 渲染层（分组头/颜色块/图片/徽章）+ showHud 全链路 + 「声明即渲染」单测。⚠ 主进程改动不热更，需完整重启验证。
2. **插件测试基建**：lib.js UMD 抽取模式确立 + vitest 接入 `plugins/` 目录。
3. **转换器组 8 个**批量重写（先做 1 个打样确立模板，再批量）。
4. **生成器组 4 个**。
5. **分析器组 5 个**。
6. **颜色组 2 个**（依赖 tintColor 落地）。
7. **currency React 标杆** → **quickfolders** → **example-plugin**。
8. **收尾**：PLUGIN_DEV.md 新能力章节 + e2e（colorpicker 颜色块渲染、currency React 冒烟）+ 全量回归。

## 9. 风险与对策

| 风险 | 对策 |
|---|---|
| 重写后版本号漏递增，内置插件不更新 | 每插件任务显式含 version bump；收尾用 `builtinPlugins` 单测/人工验证安装日志 |
| sanitizer 与渲染层不同步，字段静默清洗 | 新字段「声明即渲染」单测强制；fail-closed 清洗器逐字段用例 |
| dataUrl 超限拖慢渲染 | 65536 字符上限剥离 + 警告；qrcode 生成尺寸受控 |
| 并行会话同仓提交冲突（记忆教训） | 提交点名加文件；宿主层与插件层分批提交 |
| 主进程改动不热更导致误判 | Phase 1 后完整重启 + 手动冒烟再进入插件批量重写 |

## 10. 测试策略

- **宿主单测**：sanitizer 新字段逐个用例（合法/非法/超限/向后兼容）；parsePluginView section 注入；HUD 通道 handler。
- **渲染单测**：PluginListPage 分组聚合（相邻同名合并、不同名断开）、颜色块/图片/tag 徽章渲染、HUD 计时与去重。
- **插件单测**：每插件 lib.js 主路径/反例/边界（vitest，`plugins/<id>/lib.test.js` 同目录存放）。
- **e2e**：colorpicker（颜色块可见）、currency（React 模式冒烟：输入→列表→详情）、qrcode（图片条目）、既有 e2e smoke 全绿。
- **手工冒烟清单**：dev 重启后逐插件过一遍「输入→结果→动作→HUD→历史」主链路。
