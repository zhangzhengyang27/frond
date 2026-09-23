# Frond × Raycast 差距分析 V4（2026-09-17）

> ⚠️ **§2/§5 的 ❌ 清单已过期（2026-09-20 复核）**：自 09-17 起 53 个提交已落地
> fuzzy 容错层、多参数命令（text/password/dropdown）、自建文件索引、Hyper Key、系统日历四档、
> React SDK + @raycast-api 兼容层、用户主题文件、pop-to-root 三态、热键冲突检测。
> 逐条核对后的真差距与执行分解见 `docs/RAYCAST_PARITY_PLAN_V5.md`。
> 本文仍有效的部分：§3 Frond 独有点、§4 定位冲突标注、§6 资料来源。
>
> 前版 V1–V3 已归档（`docs/archive/`）。本版基于 2026-09-17 时点的双侧实况重新全面校准：
>
> - **Raycast 侧**：官方手册全目录逐页调研（manual.raycast.com）、Pro 定价页、2026 年 changelog（v0.67 → v2.4）、开发者平台 API 全索引、Store 规模。本机安装版本 **2.2.0**（最新 2.4，2026-09-14 发布）。
> - **Frond 侧**：以代码为准的全仓盘点（启动器子系统 + 非启动器模块 + 应用级设施），非 README 自述。截图模块已按 Decision-008 下线（migration 028）。
>
> 评级图例：✅ 基本持平（形态或能力对齐）｜🟡 部分（有实现但有明显降级/缺口）｜❌ 缺失｜⚡ Frond 独有（Raycast 无）

---

## 1. 总评

Frond 已不是「壳像 Raycast、里子空」的阶段：启动器主链路（胶囊窗、统一命令注册表、拼音别名、计算器兜底、剪贴板/片段/文件聚合搜索、声明式插件协议、命令级热键 + 两段式直达）都有真实实现且工程质量系统化（674 单测、7 个 e2e、性能硬断言）。**以「1:1 复刻」衡量，当前整体完成度约在「Raycast Free 无生态版」的水平：核心交互层 70–80%，但 Raycast 的三条护城河——生态（Store + 开发者平台）、AI（已升级为 Agent 平台）、系统级集成（日历/联系人/菜单栏/Hyper Key）——基本空白。**

差距按性质分四个梯队：

| 梯队 | 内容 | 性质 |
| --- | --- | --- |
| ① 交互层小差距 | 搜索排序模型、参数化命令、窗口管理细分、计算器语法面 | 补齐成本低，属于打磨 |
| ② 系统集成断层 | 系统日历（Frond 是假数据日历）、菜单栏命令、Hyper Key、文件索引 | 需要接系统 API，中成本 |
| ③ 生态断层 | Store、第三方开发者、React 级 API、调试工具链 | 需要产品化投入，高成本 |
| ④ 方向性代差 | AI（Raycast 已是 Agent 平台）、云同步/多设备、移动端 | Frond 定位文件里「明确不做」，需先做定位再谈差距 |

---

## 2. 逐维度对比

### 2.1 产品形态与导航

**Raycast**：纯启动器形态——一个胶囊窗是唯一工作面，所有功能以命令/内联页形态存在；Settings 是独立窗；无「主窗口/模块页」概念。Root Search 空态显示：收藏置顶区、最近文件、今日下一个日历事件、上下文相关的占位文案。

**Frond**：Raycast 式胶囊 + 保留了一个 Hub（主窗口模块页）+ 侧边栏 + ⌘1-4 模块直达；胶囊与主窗口通过 `?immersive=1` 沉浸窗桥接；主窗口定位是「后台支撑 + 管理面」（IA_V2 阶段C 进行中）。空态建议 = 固定动作 + 最近使用 + 收藏 + 最近搜索。

**差距**：
- ✅ 胶囊窗本身的行为（置顶覆盖全屏、失焦隐藏、光标屏定位、blur 抑制闪现、屏幕-saver 层级）已对齐；材质用 vibrancy/acrylic。
- 🟡 Frond 的双形态（胶囊 + Hub）是结构分歧：Raycast 用户只有一套心智，Frond 用户要在「胶囊搜」和「回 Hub 点」之间切换。项目自评「主窗口降级为管理面」未完成。
- ❌ 空态里没有环境上下文（Raycast 有「下一个会议」直接进根搜索；Frond 空态无任何环境信息）。
- ❌ Compact Mode（空查询时窗口收缩成一条搜索栏）无对应物。

### 2.2 搜索与命令执行核心

**Raycast 排序**：精确别名 → 别名前缀 → 标题模糊分 → 副标题/关键词 → **frecency（频率×新近混合）**；另提供 Root Search Sensitivity 三档和「Reset Ranking」（学习错了可重置）。参数化命令支持**最多 3 个参数**，类型含 text / **password / dropdown**，左右方向键在参数间导航。

**Frond 排序**：连续子串 → 按序子序列；名称 100 / 副标题 30 + 连续/前缀加分；**usageBoost 只对 `module` 类型生效**，应用/插件/文件命中无频次自学习（`useUsageBoost.ts:44`）。参数化只有 Quicklink 的单 `{query}`（进 qlarg 表单页）。

**差距**：
- ❌ 无模糊容错（fuzzy）：Frond 只支持子串/子序列，输错一个字母就搜不到；Raycast 有 fuzzy 档。
- ❌ frecency 学习只覆盖模块跳转，不覆盖应用/插件/文件——这是启动器「越用越顺手」的核心，Frond 目前只有半套。
- ❌ 多参数命令（argument1 + argument2 一次填完）与 password/dropdown 参数类型缺失；FormPage 基元已存在（text/textarea/select/checkbox/date），**离目标只差「把命令参数接到 FormPage」**。
- ❌ Fallback Commands 不可配置（`fallbackCommands.ts:5` 注释宣称可配置，实际无读取路径）。
- ✅/⚡ 别名体系持平（自定义别名 + 拼音首字母），搜索历史 ↑ 恢复、收藏、Pop-to-Root、命令执行语义（copy-then-close 等 Raycast 式惯例）均已在。拼音搜索是 ⚡（Raycast 无中文体验）。

### 2.3 剪贴板历史

**Raycast**：文本/图片/文件/链接/邮件/颜色全形态；保存原始全部格式（**Paste as** 可切换富文本/纯文本/RTF/HTML）；**OCR 两档**（Fast/Accurate）+ **二维码文本提取**；⌘P 类型筛选；置顶；批量按时间窗删除；保留期 Free 1天–3月 / Pro 6月–无限；**Ask Clipboard**（自然语言问剪贴板的 AI 扩展）；链接条目抓社交卡图和 favicon；条目可重命名/编辑内容；敏感应用预屏蔽；依次粘贴（Sequence 超时可配）；云同步（Pro）。

**Frond**（`ClipboardHistoryService.ts` 640 行）：文本/图片/文件/链接四类；图片指纹去重 + 落盘；**OCR 有**（tesseract.js，可搜索）；200 条 / 图片 50 张 / 保留 30 天（置顶豁免）；敏感应用屏蔽（钥匙串/1Password/Bitwarden 指纹）；**文本加密持久化**；依次粘贴（pasteSeqIndex）；胶囊页类型筛选 + 今天/昨天/置顶分组 + List-Detail。

**差距**：结构上 Frond 已经是同形产品（甚至加密持久化是超出的部分）。缺口在细节厚度：❌ Paste as 多格式、❌ QR 识别、❌ Ask Clipboard 式 AI 问答、❌ 链接社交卡/favicon 视觉、🟡 容量与保留期（200 条/30 天 vs Raycast Pro 无限）、🟡 OCR 单档。评级：🟡（骨架 ✅，细节 🟡）。

### 2.4 片段与文本扩展

**Raycast**：关键词任意应用内展开；**动态占位符体系完整**——`{date}/{time}/{datetime}/{day}`（带 `offset="+2y +5M"` 日期算术、`format="yyyy-MM-dd"` 自定义格式、`locale`）、`{clipboard}`（带 `offset=1` 取历史第 N 条）、`{cursor}`、`{calculator}`、`{uuid}`、`{snippet name=}` 引用嵌套、`{argument}`（name/default/options）、`{selection}`、`{browser-tab}`；修饰符管道 `{clipboard | trim | uppercase}`；标签系统；导入 **TextExpander / aText / Espanso / PhraseExpress**；注入设置全套（展开模式/注入延迟/响应时间/完成音效/排除应用/词内展开）；团队共享。

**Frond**（`textExpansion.ts` 407 行 + 片段模块）：uiohook 全局触发 + 尾随分隔符；占位符 `{date}/{time}/{datetime}/{clipboard}` + `{{param}}` 用户参数（逐个弹窗询问）；富文本注入（剪贴板 ⌘V + 指纹守卫还原）；排除自身窗口；mac/Win 可用。片段管理侧有 FTS5 检索、文件夹/标签、JSON 导入导出、胶囊页搜索复制。

**差距**：❌ 日期算术/自定义格式/locale、❌ `{cursor}`、❌ `{calculator}`、❌ snippet 嵌套、❌ 修饰符管道、❌ 第三方格式导入（TextExpander 等）、❌ 词内展开与注入微调设置、❌ 展开完成音效。核心机制（全局触发 → 模板展开 → 注入）已对齐，**占位符语法面差一个数量级**。评级：🟡。另外片段模块整体仍挂 PENDING（Decision-002），编辑器（CodeMirror 5）则明显超出 Raycast 的片段编辑形态——那是 ⚡。

### 2.5 快捷键体系

**Raycast**：每命令 alias + 全局热键；**Hyper Key**（Caps Lock/修饰键/F 键重映射为 ✦ 超级修饰键，带诊断面板、Secure Input 兼容模式）；**热键 chords**（2026-08 v0.71 加入双侧修饰键组合，如左⌘+右⌘，带冲突检测）；单修饰键热键；✦ 字形展示。

**Frond**：主热键可配置（默认 Alt+Space）；命令级全局热键（module/system/quicklink/firstParty 四类主进程直接分发）；**两段式直达**（主热键后 2s 内按住修饰键 + a-z，uiohook 实现）；`addShortcutRestorer` 冲突恢复重挂。

**差距**：❌ Hyper Key（Frond 完全没有 Caps Lock 重映射这类能力）；🟡 chords 形态不同——Raycast 是「双侧修饰键组合」，Frond 是「主热键按住 + 字母」，互不覆盖，可并存；❌ 单修饰键点按热键。评级：🟡（命令热键体系持平，Hyper Key 是显著缺口）。

### 2.6 窗口管理

**Raycast**：半屏/三分/四分/**六分**、Maximize Height/Width、Center、Move×4、Move to 指定坐标、精确 Resize（v2.2 起支持像素参数）、Restore、跨显示器、**跨 macOS Spaces**、三档 Thirds/Sixths 命令组、**自定义命令（尺寸/位置/偏移，支持百分比与负偏移）**、**Window Layout（一屏 8 窗布局 + 吸附分隔条可拖联动缩放 + 保存当前布局）**、Presets（一键套用 Magnet 等习惯）、cycling（半屏循环推挤/换屏）、gaps/padding、Stage Manager 兼容。

**Frond**（`systemCommands.ts`）：left/right/top/bottom/四角/maximize/restore/center/nextDisplay 共 12 动作，mac osascript + Win SetWindowPos 双实现，失败统一通知引导授权。

**差距**：❌ 三分/六分、❌ Spaces 移动、❌ 自定义命令/布局/吸附、❌ presets/cycling/gaps。基础半屏四分是 ✅，细分与自定义层全缺。评级：🟡。

### 2.7 文件搜索

**Raycast**：**自建本地索引**（默认 home + /Applications，尊重 .gitignore/.ignore/**.rayignore**，自动排除 node_modules/构建产物/开发工具缓存目录，含隐藏文件开关、Search Scopes 自定义目录、断连卷保留、磁盘空间保护）；文件名之外还有 **Content Search**（借系统索引搜内容）；Quick Look 预览、Open in Terminal、保存为 Quicklink、AI 上下文投喂；文件夹浏览内排序切换。

**Frond**（`fileSearch.ts`）：mac 用 mdfind（name/content 双模式、-onlyin 限定、4s 超时）；Windows 走 PowerShell 递归（无索引）；胶囊内 FilesPage 有名/全文双模式 + 限定目录；打开/Finder Reveal。

**差距**：❌ 自建索引（准确性与速度受制于 Spotlight/PowerShell）、❌ ignore 规则与索引治理、❌ Quick Look / Open in Terminal 等动作层、🟡 内容搜索（mdfind 有但无治理）。macOS 限定（Win 降级、Linux 无）。评级：🟡。

### 2.8 日历 / 提醒 / 联系人

**Raycast**：EventKit 深度集成——根搜索顶部直接显示**下一个会议**（回车入会，15 家会议服务商链接识别，原生客户端优先）；My Schedule 命令（周/月动态分组）；**Create Event**（写回系统日历）；**自动入会**（可选摄像头预览、自动转写）；菜单栏日程条；**Ask Calendar**（@calendar 自然语言读写事件）；RSVP 接受/拒绝等全套动作；另有 Apple Contacts 联系人搜索进根搜索。

**Frond**：**日历页的数据源是本地 SQLite reminders 表，不是系统日历**——月网格打点 + 提醒勾选，属自制简化品（文档自述「不集成系统日历 API」）；提醒事项也是本地 reminders 表 + 到期通知，**不是 Apple Reminders**；无联系人。

**差距**：❌❌ 这是本轮盘点里**最刺眼的断层**：Raycast 把「日程」作为启动器的环境信息（根搜索顶栏、空态、菜单栏三处渗透），Frond 完全没有系统日历接入。且此差距列在 `POSITIONING.md` 的「明确不做」里——即这是**已决策的取舍**，但在「1:1 复刻」的标尺下它是 P0 级空缺。评级：❌。

### 2.9 计算器 / 换算 / 颜色 / Emoji

**Raycast**：自然语言数学（"square root of 625"、"52% of 900"、"20% off 80"、"15% tip"）；**时区**（"5pm ldn in sf"、机场码、"time diff Paris"）；**日期自然语言**（"monday in 3 weeks"、"days until 31 Mar"）；**货币与加密货币换算**；工时换算（"55h in workdays"）；表达式语法高亮；**颜色转换**（hex/rgb/hsl/oklch 带实时色块预览，可拷成 NSColor/UIColor）；全量 Emoji/Symbols 选择器（含 `:` 内联触发、肤色偏好，v2.1 起任意输入框内联）。

**Frond**：零 eval 白名单解析器（四则 + 幂 + 括号 + `20% of/off` 薄层，无函数/常量）；单位换算 7 类 48 单位（货币 13 种，**静态汇率表基准 2026-09-01**，实时汇率由市场插件承担）；Emoji 约 230 条手工精选 + AI 页内联 `:emoji`；颜色转换以内置插件形态存在（HEX/RGB/HSL 互转 + WCAG 对比度，无 oklch/原生色拷贝）。

**差距**：❌ 自然语言层（时区/日期/工时全部缺失）、❌ 实时汇率/加密货币、❌ 全量 Emoji、🟡 颜色（有转换无 oklch/NSColor 拷贝/根搜索内联预览）。评级：🟡（这是 Raycast「打字即所得」体验的重要组成，Frond 目前只在「纯算式」区间对齐）。

### 2.10 AI

**Raycast（2026-09 时点）**：已成 Agent 平台——AI Chat（agentic planning：拆任务、调扩展、写码执行、失败重试、请求决策）、Quick AI（选中即问）、**Dictation**（听写 + 词汇表）、**Screen Awareness**（把焦点窗口/屏幕内容喂给 AI）、AI Commands、AI Extensions（200+，按自然语言自动选插件填参数）、**Agents**（后台代理：搜文件/改代码/管项目）、**Automations**（定时任务跑 AI）、**MCP**（一键装 server，GitHub/Vercel/Notion/Sentry 等）、**Projects**（持久记忆 + 工作目录）、Memory、Skills、BYOK/BYOM（OpenAI 兼容/Ollama/OpenRouter）/BYOS（挂 Claude/ChatGPT 订阅）、本地模型、用量体系（credits，2026-09 起 usage-based + 新 Max 档）。

**Frond**：`AIService.ts` 432 行——OpenAI 兼容单端点 BYOK（多模型预设、Key 加密存储、SSE 流式 + 超时兜底、50 会话持久化）；AIChatPage（流式渲染、会话侧栏、翻译/总结/改写预设、Quick AI 兜底自动发送）。ROADMAP 列了 4 个「AI 融合」候选（OCR 后处理/笔记摘要/剪贴板语义整理/番茄钟日报）全部未动工；**AI 平台化（Agents/MCP/Screen Awareness）在 POSITIONING 明确不做**。

**差距**：❌❌ 代差最大的维度，且在持续拉大（Raycast 2026 主打 "Year of Agents"）。Frond 的 BYOK Chat 在 2024 年是 parity，2026 年只是 Raycast AI 体系的一个子集（相当于 Raycast 的「BYOM 自定义 Provider」单项）。评级：❌（但属**定位决策**——见 §4 冲突标注）。

### 2.11 插件生态与开发者平台

**Raycast**：TypeScript + **React** 全量 UI API（List/Grid/Detail/Form/Action Panel/Navigation/HUD/Toast/MenuBar Commands/Window Management API）；AI API（useAI）、OAuth（内置 PKCE 流程）、Storage/Cache/SQL（executeSQL）、AppleScript/PowerShell 执行、deeplink、**Background Refresh**（后台定时刷新数据）；全链路工具（CLI 脚手架、ESLint 配置、VS Code 插件、Manage Extensions 命令、debug 模式）；Store 分发（**329 页 × 每页若干 = 数千扩展**，GitHub 开源仓库 + PR 评审 + 版本管理 + 安装量排行）+ Teams 私有商店。

**Frond**：BrowserView 沙箱运行时（sandbox + contextIsolation + 导航白名单 + netGuard 内网防护）；**声明式 List/Form 协议**（插件交数据、宿主原生渲染，第三方零 UI 代码——与 Raycast 路线不同但安全边界更干净）；API 面：上下文/UI 高度/副输入框/生命周期 7 钩子/KV 存储/偏好/通知/剪贴板/打开路径/代理 fetch；**敏感权限声明制**（4 项 fail-closed）；21 个内置开发者工具插件 + 静态 JSON 市场（zip 下载 + 路径穿越防御）+ devServer 热重载。

**差距**：❌ 无第三方生态（无账号体系、无商店分发/评审/排行、无真实外部开发者）；❌ API 深度（无 OAuth、无 AI API、无 MenuBar 命令、无 Grid/Navigation 组件、无 Background Refresh、无 SQL）；❌ 工具链（ROADMAP 自认「插件视图 devtools 调试方式缺失，是第三方开发的最大障碍」）。**声明式协议是差异化赌注**：开发门槛低，但表达力天花板低（无法做 Spotify Player 这类重交互扩展）。评级：❌（生态维度），🟡（API 维度，安全模型反而领先——见 §3）。

### 2.12 菜单栏 / 系统集成 / 深链

**Raycast**：**Menu Bar Commands**（扩展可把状态常驻菜单栏，如番茄钟/汇率/构建状态）+ **Menu Bar Agenda**（下个会议挂菜单栏）；**Search Menu Bar Items**（搜索并触发前台应用的任意菜单项——键盘控 Mac 的杀手级能力）；Do Not Disturb 类系统状态；`raycast://` 深链全量（开扩展/命令/带参数/创建 fragment 等）；Script Commands（任意语言脚本注册为命令，目录即索引、自动刷新）；iOS/Watch/Shortcuts/Share Extension 伴随端。

**Frond**：托盘（左键唤起胶囊 + 右键全菜单）+ Dock 菜单 + 应用菜单；`frond://` 仅 3 条路由（launcher/settings/plugin）；`⌘,` 设置；脚本命令**无**；菜单栏常驻命令**无**；菜单项搜索**无**；iOS/Shortcuts 无。

**差距**：❌ Menu Bar Commands（Raycast 生态里高使用率的形态）、❌ Search Menu Bar Items、❌ 脚本命令体系、🟡 深链（有机制无路由面）。评级：🟡/❌。

### 2.13 数据、账号与云

**Raycast**：账号体系 + **Cloud Sync**（Pro，v0.69 beta：设置/片段/笔记/AI Chat 跨 Mac/Windows/iOS 同步，TLS 代理兼容）+ Teams 共享（共享 Quicklinks/片段/命令/私有商店）+ Enterprise（SSO/SCIM/AI 治理）。

**Frond**：本地优先（SQLite + WAL + 自动备份）+ **WebDAV 整库 AES-256-GCM 加密备份**（定位「备份不是同步」）+ 整库导出导入 + 恢复出厂 + 旧 JSON 迁移。多设备同步能力 = 0；无账号。

**差距**：这是**定位分歧而非单纯落后**（POSITIONING 明确不做账号/云同步），但客观结果上：Raycast 用户换机是「登录即恢复」，Frond 用户是「WebDAV 恢复整库」。若坚持本地优先，云同步是唯一无法用「不做」解释掉的体验断层。评级：❌（按复刻标尺）/ 定位内（按 Frond 标尺）。

### 2.14 截图（衔接 2026-09-17 下线决策）

**Raycast**：本体**不做截屏捕捉**（捕捉靠系统/CleanShot X，后者只作为索引目录出现）；内置的是 **Screenshots 索引**——对已有截图/录屏做 on-device OCR，可 `text:` 按图内文字搜索、`date:` 自然语言日期过滤、Paste Latest Screenshot 一键粘贴最近截图。

**Frond**：截图模块刚按 Decision-008 整体下线（迁移独立项目）。当前既无捕捉也无索引。

**结论**：移除捕捉功能与「对齐 Raycast」**不冲突**（Raycast 本体也不做捕捉）；但 Raycast 的「截图库 OCR 索引 + 粘贴最近截图」是一个轻量的新增对齐点，可作为后续候选（tesseract.js 已在依赖里，OCR 管线现成）。

### 2.15 形态、性能与工程质量

| 项 | Raycast | Frond | 评级 |
| --- | --- | --- | --- |
| 技术栈 | 原生（Swift/React 混合渲染） | Electron 38 + Vue 3.5 | 差距根因 |
| 启动/唤起 | 原生级 | 热唤起 <200ms 有 e2e 硬断言；冷启动有基线但无公开对比 | 🟡 |
| 内存 | 原生占用 | Electron 常驻（主窗 + 胶囊 + 插件 view 多进程） | 🟡 |
| 平台 | macOS（成熟）+ **Windows（已发布，共享扩展生态）** + iOS/Watch | mac 主力；Windows 构建从未真机验证（ROADMAP 自述）；Linux 未适配 | 🟡/❌ |
| 自动更新 | 稳定自更新 | electron-updater 就绪但 GitHub 仓库地址是占位、手动下载、未签名公证 | 🟡 |
| 测试 | 不公开 | 674 单测 + 7 e2e + 性能/契约测试，工程化程度高 | ⚡ |
| 无障碍 | 系统级支持 | aria/role 有限覆盖 + reduced-motion，无系统审计 | 🟡 |
| 语言 | 仅英文 UI | 仅中文 UI | 各自单语 |

---

## 3. Frond 独有 / 领先的点

1. ⚡ **拼音搜索**（pinyin-pro 首字母别名，e2e 有覆盖）——Raycast 对中文用户无任何拼音体验。
2. ⚡ **两段式直达**（主热键按住 + 字母）——与 Raycast v0.71 的双侧修饰键 chords 形态不同、互不覆盖。
3. ⚡ **一级模块**：番茄钟（多项目并行计时 + Flowtime + 严格模式 + 任务/统计/CSV 导出 + Todoist 导入 + 白噪音 + 迷你窗）、屏幕录制（PiP/标记/时间线剪辑/GIF/崩溃恢复/光标特效）、片段编辑器（CodeMirror + 5 视图 + 代码图片导出）——Raycast 里这些全是第三方扩展，品质参差。
4. ⚡ **开源 + 本地优先 + 无账号**；剪贴板文本加密持久化；插件敏感权限声明制 fail-closed（Raycast 的扩展权限模型远比这宽松）。
5. ⚡ 声明式插件协议：第三方零 UI 代码出列表页，安全边界清晰（代价见 §2.11）。

---

## 4. 「定位决策」与「差距」的冲突标注

以下 Raycast 能力是 Frond **主动决策不做**的（POSITIONING.md / DECISIONS.md）。在「1:1 复刻」的标尺下它们是最大空缺，在 Frond 自身定位下它们是特性。**若「一比一复刻」是当前真实目标，需要先推翻或修订这些决策，否则 §5 的 P0 无法成立：**

- AI 平台化（Agents / MCP / AI Extensions）——「明确不做」
- 账号系统与云同步——「明确不做」（备份≠同步）
- Calendar 集成——「明确不做」（但假数据日历页仍保留在产品里，体验上是负资产）
- 自定义主题、多语言、移动端——「明确不做」

---

## 5. 分级行动清单（按「1:1 复刻 Raycast」标尺）

> **执行状态（2026-09-17 第一批）**：P0-3、P0-4、P1-7（部分）、P1-6（部分）、P1-9（部分：菜单栏倒计时经复核已存在）、工程债中的元数据漂移/卸载清理/插件调试已落地；P0-1、P0-2 生态部分与 AI 相关项按 §4 冲突标注暂缓，待定位决策。各条目后的标记为本批结果。
>
> **定位决策（2026-09-17 用户确认，详见 Decision-009）**：① Calendar 立项完整对齐（P0-1 解锁）；② AI 融合四候选立项（平台化仍不做）；③ 轻量多设备同步立项。P1 剩余四项全部排入执行。
>
> **批次路线**：批次2（✅）→ 批次3（✅）→ **批次4（✅ 全部落地：第一档 只读 + 下一个会议进空态；第二档 My Schedule 日程页；第三档 Create Event 写回（Form 基元 + defaultCalendarForNewEvents + 失败系统通知）与自动入会（15s watcher + 1 分钟追认窗口 + 按事件去重 + 设置开关，判定逻辑纯函数 5 单测）；另修复 EKAuthorizationStatus 枚举映射 bug——authorized=3 而非 2）→ 批次5（✅ 全部落地：截图识字问 AI（⌘A）、笔记 AI 总结（⌘⇧A）、番茄钟日报、剪贴板 AI 加工（⌘I，按用户决策采用「选中条目单条发送」形态，隐私面最小））→ 批次6（✅ 全部落地：轻量同步 dataSync——范围=配置热键基底+片段+笔记提醒+番茄钟（用户确认），后写覆盖+拉平前本地快照 5 份（用户确认），bundle 由 WebDAV 口令派生密钥 AES-256-GCM 加密，迁移中心「轻量同步」分区推送/拉平；LWW 决策与镜像回写 8 单测）；**Hyper Key 已实施（✅ 2026-09-17，方案 A：hidutil Caps→F18 + uiohook，快按可配 + 组合复用两段式绑定，启动重申/退出还原，实验性限制与真机验收清单见 docs/HYPER_KEY_DESIGN.md）**。

### P0 · 击穿复刻宣称的空缺
1. **系统日历接入**（EventKit：根搜索下个会议 + My Schedule + 入会链接识别）——当前假数据日历页应被替代。〔✅ 已立项完整对齐（Decision-009）；**第一档已落地**（批次4：CalendarService JXA 只读 + getNextEvent 48h 窗口 + extractMeetingLink 8 服务商纯函数 + 空态置顶会议条目 + openUrl 动作类型）；My Schedule 页 / Create Event / 自动入会待后续 slice〕
2. **生态最小闭环**：商店分发（哪怕先是「在线插件索引 + 一键安装」的真实第三方目录）+ 插件调试工具链（devtools 接入）——没有外部插件，「复刻 Raycast」只是复刻了壳。
3. **搜索排序升级**：fuzzy 容错 + frecency 全类型覆盖 + 可配置 Fallback Commands——「越用越准」是启动器的第一性体验。〔✅ 2026-09-17：frecency 全类型（按 entry.key 记录，module 双 key 兼容）+ Fallback 启停可配置（启动器管理页）；fuzzy 复核——Frond 已有按序子序列匹配，与 Raycast 的 fuzzy 同级，真正缺口是容错式纠错，暂缓〕
4. **多参数命令**：把 FormPage 接进命令系统（≤3 参数 + dropdown），对齐 Raycast 的参数化命令面。〔✅ 2026-09-17 最小闭环：Quicklink 命名多参数 `{org}/{repo}`（Raycast 单参 `{query}` 语法不变），qlarg 表单按占位符多字段收集；dropdown 参数类型暂缓〕

### P1 · 显著落后
5. 计算器自然语言层（时区/日期/实时汇率——实时汇率管线在 currency 插件里已有，可下沉为内置）。
6. 片段占位符补齐（`{cursor}`、日期算术/格式、`{clipboard offset}`、TextExpander/Espanso 导入）——配合 Decision-002 把片段模块转正。〔🟡 2026-09-17：日期算术 offset + format 别名（批次1）；`{cursor}` 光标定位已落地（批次2：哨兵提取 + 注入后方向键，emoji 组合序列为已知近似）；`{clipboard offset}` / 第三方导入暂缓〕
7. 窗口管理细分（Thirds/Sixths、Spaces、gaps、Presets）。〔🟡 2026-09-17：Thirds×5 / Sixths×6 / 最大高宽（批次1）+ 全局热键路由修复 + Magnet 风格 Presets（批次2）+ **gaps 已落地**（批次3：mac 侧窗口几何重构为 JS 纯函数 windowGeometry + Electron workArea，双平台 gap 设置 0-200px 即时生效，12 个单测）；Spaces 暂缓（AppleScript 模拟稳定性待实机评估）〕
8. Hyper Key（Caps Lock 重映射 + 冲突诊断）。〔✅ 2026-09-17：方案 A 已实施（hyperKey.ts + hyperKeyLogic.ts：hidutil Caps→F18、F18 单按四种行为可配、F18+字母复用两段式绑定、启动重申/退出同步还原、5 单测）；CGEventTap 消除打字副作用为二期；真机验收清单见 docs/HYPER_KEY_DESIGN.md〕
9. Menu Bar Commands + Search Menu Bar Items。〔🟡 复核：菜单栏番茄钟倒计时（tray.setTitle）已存在；常驻 Menu Bar Commands 与菜单项搜索暂缓〕
10. 截图 OCR 索引（Search Screenshots + Paste Latest Screenshot；OCR 管线复用 tesseract.js）。〔✅ 2026-09-17 批次2：migration 029 `shot_index` + ShotIndexRepository + 扫描/OCR 批处理服务 + 胶囊「截图库」页（缩略图/OCR 文本预览，name:/text:/date: 过滤语法）+「粘贴最近截图」独立命令〕
11. 文件索引治理（ignore 规则、Search Scopes、Quick Look / Open in Terminal 动作）。
12. 剪贴板细节（Paste as、QR、链接 favicon/社交卡、保留期档位化）。〔🟡 2026-09-17：链接 favicon（批次2）+ **QR 识别已落地**（批次3：jsqr 依赖 + BGRA→RGBA 适配 + 图片条目「识别二维码」按钮 / Q 键，文本回填剪贴板）；Paste as 差距不成立（捕获即纯文本）；社交卡预览与保留期档位化暂缓〕

### P2 · 锦上添花
13. 主题系统（多主题 + 明暗各自指定；design tokens 三层架构已是现成地基）。
14. `frond://` 深链路由面扩展（open command / quicklink 带参）。
15. 更新链路落地（签名 + 公证 + 真实 release 仓库 + 自更新）。
16. Emoji 全量 Unicode 数据集 + 符号面板。
17. AI 融合四候选（OCR 后处理/摘要/剪贴板语义/日报）——先于任何 Agent 形态。

### 工程债（与 Raycast 无关但影响复刻体验）
- ~~`useUsageBoost` 仅 module 生效~~〔✅ 2026-09-17，随 P0-3〕；~~两套系统命令清单漂移~~〔✅ 2026-09-17：SYSTEM_CMD_META/WINDOW_CMD_META 扩至全量并导出，防漂移测试三断言〕；~~插件调试 devtools 缺失~~〔✅ 2026-09-17：管理页「调试」按钮 + `launcher:pluginDevtools`，PLUGIN_DEV.md 补文档〕；~~卸载清理 KV~~〔✅ 2026-09-17：`docStore.deleteByPlugin` 接入 removePlugin，ROADMAP 已勾〕。
- 其余未动：胶囊 pinned 未实现；异步 detail 未接线；3 个内联页无键盘导航；actionHint 为猜测展示；录制守护进程注释存在实现缺失；Quicklink 复用标签开关无 UI（完整 17 项清单见盘点底稿）。

---

## 6. 资料来源

Raycast 侧（2026-09-17 时点）：manual.raycast.com（Search Bar / Snippets / Dynamic Placeholders / Clipboard History / Quicklinks / Window Management / File Search / Calendar / Calculator / Notes / Focus / Screenshots / Hyper Key / Navigation / System Commands / Script Commands / Themes / Run / Translate 各页）、raycast.com/pro、raycast.com/changelog（v0.67–v2.4）、raycast.com/store、developers.raycast.com（含 llms.txt API 索引）、raycast.com/docs/ai-agents-mcp、raycast.com/docs/automations、raycast.com/agents。本机实测：/Applications/Raycast.app 2.2.0。

Frond 侧：全仓代码盘点（启动器子系统、非启动器模块、应用级设施、docs/ 自我认知文档），证据以 `文件路径:行号` 形式散见各节。
