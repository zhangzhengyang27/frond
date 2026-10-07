# Frond 对标头部产品差距分析报告（2026-10-07）

> 维度：功能完整性 / 技术架构 / 用户体验 / 性能 / 市场竞争力。
> 与既有文档的关系：不替代 [RAYCAST_GAP_ANALYSIS_V4.md](./RAYCAST_GAP_ANALYSIS_V4.md)（2026-09-17，功能清单式差距，部分条目已闭）和 [RAYCAST_PARITY_PLAN_V5.md](./RAYCAST_PARITY_PLAN_V5.md)（任务分解）。本报告是 2026-10-07 时点的**多维对标 + 优先级重排**：代码结论以当前 main（v0.2.1，cb57a22）为准，外部基准以 2026-09 自建基准快照 + 2026-10 公开信息为准。
> **决策状态（2026-10-07）：§8 建议已逐项拍板（见 §8.0 决策表），各行仅在与决议不同处标注 ✅执行 / ★主攻 / ⏳顺位后移 / ⏸搁置。**

---

## 0. 执行摘要

**一句话判断：Frond 的单体功能面已覆盖 Raycast 免费层约七成，工程质量门禁超出多数同类独立产品；真正的断层不在"功能数量"，而在三层基础设施——生态分发、签名/更新信任链、AI 使用面。**

五维度速览：

| 维度 | 一句话结论 |
| --- | --- |
| 功能完整性 | 追平/领先点扎实（拼音匹配、MCP 客户端、剪贴板 OCR+二维码、窗口管理 25 动作、独立索引进程）；但"平台型功能"（插件商店运营、日历写操作、脚本命令目录）差距一个身位 |
| 技术架构 | 本地数据层（SQLite+34 迁移+FTS5+trigram）与安全模型（BrowserView 沙箱、SSRF 三层守卫）对标甚至优于头部公开信息；短板是 Electron 内存成本、无遥测/崩溃上报、单插件无版本化更新 |
| 用户体验 | 中文体验（拼音、两段式直达、触发词扩展）是差异化护城河；英文世界基本不可用（零 i18n）；细节厚度（空态环境上下文、排序自学习、Paste-as）差一档 |
| 性能 | 索引 worker 化后最大历史病灶已除，热唤起有 <200ms 硬断言；但无对外可引用的性能数据，FTS 写放大待决 |
| 市场竞争力 | 未签名 + 自动更新不可用 = 分发摩擦与留存双杀；无商业化路径；中文-only 既是护城河也是天花板 |

**Top 5 短板（按杠杆/成本排序）**：① 签名/公证/自动更新闭环；② 插件分发"最后一公里"（单插件 semver 更新、权限引导页、来源审计）；③ AI 使用面（**部分已闭**：动作面板「问 AI」与剪贴板 ⌘I 已于 2026-09-25 落地，剩余为系统级划词指令形态）；④ 排序学习 frecency 全局化；⑤ README 与产品现实脱节 + 性能数据缺位（可信度层）。

---

## 1. 对标格局（2026-10 时点）

| 产品 | 2026-10 现状 | 对 Frond 的意义 |
| --- | --- | --- |
| **Raycast**（主基准） | 2.0 已于 2026-08 底 GA，扩展 API 带到 macOS 与 Windows **同构新桌面端**（2026-05 公测）；Windows 版 2025-12 GA 后持续高频迭代（2026-03 v0.51 加入自定义窗口管理命令）；定价 Free / Pro $8–10·月 / Advanced AI $20·月 / Teams $12–25·人·月（AI Credits 计价）；扩展 3300+（我方 2026-09 基准口径，第三方统计 1500–2000+，口径不一） | 差距拉大的速度取决于其"跨平台同构 + AI Credits"两条曲线；单机功能层已不是主要差距来源，**生态与商业化基础设施才是** |
| **Alfred 5.8** | macOS only，Powerpack 一次性买断（£34 起），Workflows 生态成熟，AI workflows 生态在生长 | 反例证明"买断制 + 单平台深耕"可长期存活；Frond 的中文深耕路线与之同构 |
| **PowerToys Command Palette** | 微软 2026 年连续加码：0.98（3 月，性能优化+窗口透明）、0.99（5 月）、0.101（8 月，Compact Mode + Window Hopper） | Windows 侧免费同位竞品被微软亲自养大——坐实"Windows 暂缓"决策的正确性 |
| uTools / Vicinae / Ueli | uTools 占据中文启动器市场心智（插件市场+会员制）；Vicinae/Ueli 是开源参考（见 [REFERENCE_VICINAE_UELI.md](./REFERENCE_VICINAE_UELI.md)） | Frond 在中文市场的真正对手是 uTools 而非 Raycast；开源侧可借鉴其社区分发 |

---

## 2. 功能完整性

### 2.1 已追平或领先（保持即可，别拆）

| 能力 | Frond 现状 | 相对位置 |
| --- | --- | --- |
| 启动器第一方模块面 | 25 个胶囊内联页（`src/shared/commands.ts:28-56`）+ 14+ 系统命令 + 25 窗口管理动作（`src/main/modules/systemCommands.ts`） | Raycast 免费层核心面基本对齐；窗口管理动作数已超 Raycast v0.51（Windows）的命令式方案 |
| 中文搜索体验 | 拼音/拼音首字母匹配（pinyin-pro）+ 自研三层模糊引擎（`src/shared/fuzzyEngine.ts`） | Raycast 无拼音匹配，**中文市场真差异化** |
| 剪贴板历史 | 四类内容、OCR（中英双语 tesseract）、二维码提取（jsqr）、敏感应用屏蔽、加密持久化（`src/main/services/ClipboardHistoryService.ts`） | OCR/二维码提取为我方 2026-09 基准中头部产品未内置的能力 |
| MCP 客户端 | spawn 本地 server、tools 进根搜索、差分确认闸（`src/main/services/mcp/`） | Raycast 无对应物；AI Agentic 入口的先手棋 |
| 全局快捷键体系 | 命令级全局热键四类 + 两段式直达 chords + Hyper Key（hidutil）+ 冲突三态检测 + 失败退避重试（`src/main/launcher/hotkeys.ts`） | 厚度对标 Raycast，chords/Hyper Key 有超出 |
| BYOM AI 聊天 | OpenAI 兼容流式、多预设（DeepSeek/通义/Ollama）、key 加密（`src/main/services/AIService.ts`） | 形态存在，但使用面窄（见 §2.2） |

### 2.2 差距（按档位）

| 档位 | 能力 | 头部现状 | Frond 现状（证据） |
| --- | --- | --- | --- |
| 🔴 P0 | 插件平台运营 | 商店 3300+ 扩展、账号/评分/审核、单插件自动更新 | 静态市场 + 可选远程 https JSON 索引（`src/main/launcher/market.ts`）；无账号/评分/审核、**已装插件无版本管理与自动更新** |
| ✅ 已闭（勘察复核 2026-10-07） | AI 一级动作面 | Quick AI（划词/快捷指令）、AI 问剪贴板、AI 进每个结果的动作面板、AI Credits 计价 | **P-4③ 已于 2026-09-25 落地**：「问 AI：解释这条」一级动作在全部结果类型的动作面板（`useActionPanel.ts:213-225`，`aiReady` 门控；prompt 拼装 `shared/aiAsk.ts`），剪贴板详情 ⌘I「AI 加工」（`ClipboardPage.vue:254-273`），e2e `ai-action.spec.mjs` 钉住。真实剩余仅 Raycast 的系统级划词指令与 Credits 计价形态 |
| 🟡 P1 | 文本扩展语法厚度 | TextExpander 级：`{cursor}`、日期算术/locale、嵌套、导入器 | 无 `{cursor}`/日期算术/`{calculator}`/嵌套/修饰符管道，无 TextExpander/Espanso 导入（`src/main/modules/expansionTemplate.ts`） |
| 🟡 P1 | 日历 | 可读可写、交互式建改事件 | **只读**：仅"下一个会议"+自动入会（`src/main/index.ts:398-400`） |
| 🟡 P1 | 脚本命令 | Script Commands 目录自动发现（Raycast/Alfred 均有生态） | 全仓无对应物；对 shell 用户是明显缺口 |
| 🟡 P1 | Paste-as / 链接预览 | 多格式粘贴（富文本/RTF/HTML 原格式）、链接 favicon/社交卡 | 剪贴板四类已齐，但无多格式原样保存与预览 |
| 🟡 P1 | 命令级 deep link | `raycast://` 可直达任意命令并带参 | `frond://` 仅 launcher/settings/plugin 三条路由（`src/main/launcher/frondUrl.ts`） |
| 🟢 P2 | 专注护盾网站级拦截 | Raycast Focus 网站真拦截 | mac 应用级真拦截，网站命中仅遮罩（`src/main/modules/focusShield.ts`，产品决策："不替用户关网页"） |
| 🟢 P2 | 主题市场 | 社区主题分发 | 有用户主题机制（`src/main/modules/userThemes.ts`）无分发市场 |
| 🟢 P2 | 云同步/账号/移动端 | Cloud Sync（Pro）、Teams | P-5 立项未开工（D3 已推翻"不做"，风险最高、刻意殿后） |

---

## 3. 技术架构

### 3.1 领先项（工程门禁是本产品最硬的资产之一）

- **数据层**：SQLite 唯一真理源（better-sqlite3 13，WAL）+ **34 个版本化迁移** + FTS5/trigram 双索引（`src/main/db/`、`src/main/modules/fileIndex/db.ts:56-106`）。
- **索引进程隔离**：文件索引用 `utilityProcess.fork` 独立进程，主进程零索引 SQL（`src/main/fileIndex/worker.ts`）——对标 Raycast 的索引进程隔离设计。
- **插件沙箱**：每插件独立 BrowserView（sandbox + contextIsolation）、导航白名单、window.open deny、headless action 20s 回收、fetch 走主进程代理（禁内网/DNS rebinding 防护/钉住/2MB 上限）（`src/main/launcher/runtime.ts`）；声明式协议防注入清洗（`src/shared/plugin-protocol.ts`，878 行协议）。
- **安全三层守卫**：navigationGuard / netGuard / dnsPinning（`src/main/security/`、`src/main/launcher/`）。
- **质量门禁**：175 个单测文件（约 1337 用例）+ 40 个 e2e spec（约 168 用例，含 perf 硬断言与 IPC 契约全量扫描）+ type-aware ESLint 五族全 error + 增量 CSS 零容忍 + CI 三 OS 矩阵。**这套体系在同类独立产品中几乎没有第二家。**

### 3.2 差距项

| 短板 | 现状 | 影响 |
| --- | --- | --- |
| 运行时内存成本 | Raycast 2.0 为原生/同构新桌面端（我方基准实测 350–450MB）；Frond 是 Electron 38 + Vue 3，**无对外实测数据** | "轻量"是 README 的自我宣称（line 5），目前拿不出数字 |
| 单插件无版本化更新 | 市场 install 支持本地/zip/sha256，但**已装插件不随版本升级自动更新**（`src/main/launcher/market.ts`） | 生态运营的前置缺口：作者发新版触达不了用户 |
| 无遥测/崩溃上报 | 无 crash reporter 上报通道、无使用统计 | 单人维护模式下，用户遇到问题只能靠 issue 碰运气；可用 opt-in 方案化解隐私张力 |
| 插件 API 面小于 `@raycast/api` | 兼容层自承认 Alert/getSelectedText/open 等首次调用 console.warn 降级（`packages/frond-raycast-api/src/index.ts:15-19`）；无 Clipboard.read、OAuth、AI API | 兼容层战略（D1：只做形状适配、不跑未改动的商店扩展）下，API 面决定"作者 0→1 迁移成本" |
| 代码片段搜索退化为 LIKE | FTS 已删（迁移 034），改 `search_text` 明文列 + LIKE（`src/main/db/repos/SnippetRepository.ts:1-11`） | 片段量上千后搜索延迟会回来；是当年 FTS 写放大决策的代价，需重新评估 |
| electron-store 8.2 遗留位 | JSON 存储仅剩兼容位（数据已迁 SQLite） | 低危，找个批次清掉即可 |

---

## 4. 用户体验

### 领先项
拼音匹配、两段式直达（chords）、Hyper Key、胶囊窗 Compact Mode（空查询收成一条栏）、托盘 Raycast 化（入口+系统职责分离）、搜索历史 ↑ 恢复、Pop-to-Root 三态。

### 差距项

| 短板 | 现状与证据 | 为什么重要 |
| --- | --- | --- |
| **零 i18n** | 无 vue-i18n、无 locales 目录，UI 字符串硬编码简体中文（全仓 `createI18n/useI18n` 零命中） | Raycast 2.0 跨平台同构后，海外市场入口被语言硬性关闭；README/文档全中文进一步收窄受众 |
| 排序自学习不完整 | frecency/usageBoost 以 module 动作为主键，应用/插件/文件命中无频次学习（`src/renderer/src/composables/useUsageBoost.ts:42`） | 启动器的核心体验是"越用越准"，这是 Raycast 的隐性护城河 |
| 空态无环境上下文 | 胶囊空查询只收成一条栏；Raycast 空态直接呈现"下一个会议"等环境信息 | 日历服务已存在（`CalendarService.ts`），差的是组装 |
| 文本扩展断头路 | 触发词有，但语法厚度差一个量级（见 §2.2） | 对重度用户这是主力功能，语法不够=迁移不来 |
| README 与现实脱节 | README line 5/13 仍宣称"录屏剪辑：区域录制、时间线剪辑、GIF 导出"，但录屏模块已整体移除（迁移 `027_drop_rec_clips.ts`） | 首页可信度损伤：新用户按 README 找不到功能 |
| 安装体验（mac） | 未签名产物：右键打开 + 绕 Gatekeeper + 自动更新不可用（`release.yml:99-123`） | 非技术用户的流失点前置到了安装第一步 |

---

## 5. 性能

- **已解决**：文件索引主线程全表扫（2026-10-03 排查的真根因）已 worker 化（8a822bd）；热唤起有 e2e 硬断言 **<200ms**（`e2e/perf-baseline.spec.mjs:95`）；冷启动有 <30s 冒烟上限。
- **待决**：文件索引 FTS 写放大与补扫策略（缩范围/批维护）尚未落决策；代码片段 LIKE 搜索（见 §3.2）。
- **缺位**：① 无对外可引用的性能基线数据（内存/冷启动/输入延迟），`e2e/perf-results.spec.mjs` 是手动"量一次"spec，结果不进文档；② 无搜索输入延迟断言；③ Electron 内存成本没有与 Raycast 350–450MB 的对照口径。
- 判断：**性能的真实状况大概率不差（架构上已把该隔离的都隔离了），缺的是"可证明"**。这对一个 README 自称"轻量"的产品是纯收益的补课。

---

## 6. 市场竞争力

| 维度 | Raycast / 头部 | Frond | 差距性质 |
| --- | --- | --- | --- |
| 分发 | 官网 + 签名公证 + 自动更新 + 商店 | GitHub Releases 未签名产物 + "右键打开"教程（签名链路代码就绪，等 Apple 开发者账号，D2） | **基础设施缺位**，非能力缺位 |
| 生态 | 3300+ 扩展、开发者平台、评分审核 | 21 内置插件 + 静态/远程索引市场；无开发者增长回路 | 数量级差距，短期不可追赶，**只可换打法**（见 §8） |
| 商业化 | Free / $8 / $20 / Teams 四档，AI Credits 计价 | 无（MIT 开源，无账号） | 无商业模式本身不是罪（Alfred 买断制也活得很好），但要有**明确不收敛的答案** |
| 语言/市场 | 英语全球 | 简体中文 only | 中文市场对手实为 uTools；海外市场被语言关闭 |
| 差异化资产 | 生态、AI Credits、跨平台 | 拼音/中文体验、MCP 先手、剪贴板 OCR/QR、MIT 开源、本地优先无账号 | 真实存在的反超点，但当前**未被讲述**（README 定位语 "Tools that breathe with your day" 未承载任何差异化信息） |
| 平台 | macOS GA + Windows GA + iOS 路线 | mac 官方包（arm64+x64），win/linux 源码可构建不发布（Windows 暂缓决策） | 决策正确：PowerToys Command Palette 在 Windows 被微软养大，此时进 Windows 是消耗战 |

**竞争位置判断**：Frond 当前是"工程素质过硬的单机版 Raycast 平替（中文市场）"。它输在基础设施（信任链、分发、生态运营），赢在差异化体验与工程质量。打法上不应在对称赛道追赶，而应把"中文 + 本地优先 + MCP/AI BYOM + 开源可信"四点连成一个 Raycast 无法服务好的用户群（对隐私敏感、对 AI 供应商有自主诉求、中文输入习惯的用户）。

---

## 7. 主要短板 Top 8（按杠杆/成本排序）

1. **签名/公证/自动更新未闭环**（🔴 基础设施，等账号期间可 dry-run 全链路）——分发摩擦与留存的共同根源。
2. **插件分发最后一公里**（🔴 生态）：单插件 semver 检测+自动更新、权限引导页、来源审计——V5 P-3 剩余项；没有它，"插件作者 0→1"的投入留不住成果。
3. **AI 使用面**（🟡 部分已闭，勘察复核 2026-10-07）：动作面板「问 AI」与剪贴板 ⌘I「AI 加工」已落地（P-4③，2026-09-25）；真实剩余=Raycast Quick AI 式的系统级划词指令。
4. **排序自学习不完整**（🟡 体验核心）：frecency 只覆盖 module 动作。
5. **README/文档可信度债**（🟡 低成本高回报）：录屏宣称已删、性能无数据、"轻量"无证据。
6. **文本扩展语法厚度**（🟡）：重度用户的迁移门槛。
7. **零 i18n**（🟡 战略开关）：不急于全量翻译，但框架缺位使"任何时刻打开海外市场"都不可行。
8. **遥测/崩溃上报缺位**（🟢）：单人维护的可观测性保险，opt-in 即可。

---

## 8. 可落地改进建议（三阶段，对齐既有决策）

> 约束回顾：单人维护（D 背书下每项标注工作量 S≤2d / M≤1w / L>1w）；D1 生态只走自建分发；D2 无 Apple 开发者账号，签名做到"只差证书"；Windows 暂缓；V5 顺序纪律（P-1 动作模型是 AI 动作的前置，已落地）。

### 8.0 用户拍板（2026-10-07）

下表为最终执行决议；§8 各行只在与决议不同处标注（✅执行 / ★主攻 / ⏳顺位后移 / ⏸搁置），未标注的 Phase 1/2 行即决议内项目。

| 决策项 | 结论 |
| --- | --- |
| Phase 1（≤2 周） | **执行** 1.1 README 现实对齐、1.2 性能实测固化、1.4 opt-in 崩溃上报；**1.3 签名 dry-run 搁置**——当前项目没有证书，维持 D2「只差证书」现状，不做模拟流程 |
| Phase 2（2–8 周） | **四组全部进近期 backlog**：2.1 P-3 收尾、2.2 AI 进动作面板、2.3+2.6 frecency+空态、2.4 文本扩展三件套；2.5 片段 FTS 重评估与 2.7 脚本命令未点名提前，维持顺位后置。**执行注记（2026-10-07）**：2.1 已落地（27fb88a）；2.2 经代码复核确认 2026-09-25 已存在，无需开发（本表修订于同日） |
| Phase 3（2–3 月） | **主攻 3.2 日历写 + 3.4 Paste-as**（体验厚度路线）；3.1 i18n、3.3 开发者 CLI、3.5 商业化声明顺位后移；3.6 云同步殿后不变 |
| 不做清单 | **四条全部维持**：追赶扩展数量 / Windows 官方包 / 自建账号体系 / AI 内置模型补贴 |

### Phase 1：立即可做（≤2 周，不依赖任何外部条件）

| # | 动作 | 验收标准 | 量 |
| --- | --- | --- | --- |
| 1.1 | README 现实对齐：删录屏宣称、功能表对齐 25 内联页/21 插件真值、把差异化四点写进首屏定位语 | 新用户按 README 能找到所有真实功能；无一条已删功能 | S |
| 1.2 | 性能实测一次并固化：跑 `perf-results` spec，把冷启动/热唤起/内存/空态→输入首响应写入 README 与 `docs/PERF_BASELINE.md`，并入 CI 产物归档 | 对外有四个可引用数字，与 Raycast 350–450MB 有对照口径 | S |
| 1.3 ⏸搁置 | 签名链路 dry-run：在 D2 约束下把 `notarize` 全流程用自签证书/模拟环境走通一遍，产出"只差证书"清单文档（对齐 `SIGNING_MAC.md`） | 换上真证书当天可发签名版，不需要改代码 | S |
| 1.4 | opt-in 崩溃上报最小面：Electron crashReporter + 用户显式开关 + GitHub Issue 模板聚合（不引第三方 SaaS 也可起步） | 崩溃可在本地复现取证 | M |

### Phase 2：短中期（2–8 周，生态与体验主战场）

| # | 动作 | 验收标准 | 量 |
| --- | --- | --- | --- |
| 2.1 | **P-3 收尾**：已装插件 semver 检测 + 单插件自动更新（复用市场 download 校验链）+ 权限引导页 + 来源审计 | 插件作者发新版，用户端 24h 内静默升级 | M |
| 2.2 ✅已闭 | **AI 进动作面板（P-4③）**：任意结果动作面板加"问 AI"一级动作；"问剪贴板"进剪贴板详情 | 无需打开聊天页即可完成一次 AI 消费 | **勘察复核：2026-09-25 已全部落地**（`useActionPanel.ts:213-225`、`shared/aiAsk.ts`、`ClipboardPage.vue:254-273`、e2e `ai-action.spec.mjs`），无需开发 |
| 2.3 | **frecency 全局化**：把 useUsageBoost 的键从 module 动作扩展到应用/插件/文件三类命中，SQLite usage 表已有地基 | 同查询重排可被单测复现 | M |
| 2.4 ✅执行 | 文本扩展补厚度：`{cursor}` + 日期算术 + Espanso 导入器（三件套一次交付，导入器自带获客） | Espanso 用户可无损迁入 | **勘察复核**：`{cursor}` 早已存在（V4 P-1-6，`expansionTemplate.ts` 码点级定位）；本批实做=日期算术（`{date +7d}`/`{date:YYYY-MM-DD +1M}`/`{time +30m}`）+ Espanso YAML 导入器（date/clipboard var 映射，其余降级输入参数） |
| 2.5 ⏳后置 | 代码片段搜索重新评估 FTS：以当前 snippet 量级实测 LIKE 延迟，超阈值则恢复 FTS5（评估批维护方案解写放大） | 有实测数据支撑的决策记录 | S |
| 2.6 | 空态环境上下文：胶囊空态呈现"下一个会议"（CalendarService 已就绪）+ 置顶剪贴板 | 空态从"收纳"变"信息面" | S |
| 2.7 ⏳后置 | 脚本命令目录：约定 `~/frond-scripts`（或配置目录）扫描 `.sh/.ps1` 生成命令进注册表 | 落一个脚本，全局热键直达 | M |

### Phase 3：中期（2–3 月，打开天花板）

| # | 动作 | 验收标准 | 量 |
| --- | --- | --- | --- |
| 3.1 ⏳后移 | **i18n 地基 + 英文**：引入 vue-i18n，抽离字符串只做 `zh-CN`/`en` 两语言；README 英文化 | 语言切换可用；海外用户可安装自用 | L |
| 3.2 ★主攻 | 日历写操作：事件创建/修改（mac EventKit，对齐只读链路） | 胶囊内建一条带参日历事件 | M |
| 3.3 ⏳后移 | 插件开发者回路：开发者文档英文化 + `frond-plugin` CLI（init/pack/publish 到自建索引）+ 3 个标杆第三方插件 | 陌生开发者不读源码能 0→1 发布 | L |
| 3.4 ★主攻 | Paste-as 富文本原格式 + 链接预览 | 四类之外增加 HTML/RTF 原样回放 | M |
| 3.5 ⏳后移 | 商业化答案（写进 POSITIONING 即可，不一定要做）：免费开源核心 + 可选托管服务（云同步 P-5/插件托管）的双轨声明 | 文档有明确"我们不收什么费/未来可能收什么费" | S |
| 3.6 | 云同步（P-5，殿后不变）：依赖数据面收敛，维持最后顺位 | — | L |

**明确不建议做的**：追赶 Raycast 扩展数量（D1 已定，数量游戏单人打不赢）；进 Windows 官方包（PowerToys CP 正被微软加码，消耗战）；自建账号体系（P-5 殿后）；AI 内置模型/补贴 token（BYOM 是成本护城河不是劣势）。

---

## 9. 来源

**外部基准（2026-10 检索）**
- [Raycast 2.0 GA / 扩展 API 跨平台同构 — developers.raycast.com changelog（2026-08-25 条目、2026-09-24 更新）](https://developers.raycast.com)
- [Raycast for Windows GA 报道 — Lifehacker（2025-12-04）](https://lifehacker.com)
- [Raycast 2.0 公测技术深读 — superopc.app（2026-05）](https://superopc.app)
- [Raycast 定价页（Free / Pro / Advanced AI / Teams）](https://www.raycast.com/pricing) 及 [CostBench 2026-08 核验](https://costbench.com/software/ai-productivity/raycast/)
- [Raycast Windows v0.51 自定义窗口管理命令 — raycast.com（2026-03-27）](https://www.raycast.com)
- [Alfred 5.8 Powerpack 买断制与 Workflows 现状 — dottie.ai（2026-10）/ iTechGuides](https://www.dottie.ai)
- [PowerToys 0.98–0.101 Command Palette 迭代（Compact Mode 等）— WindowsForum（2026-03/05/08）](https://windowsforum.com)

**内部基准**
- 2026-09 Raycast 基准快照（扩展 3300+ 口径、内存 350–450MB 实测、AI Credits 计价观察）——项目记忆库
- 代码事实：全 Paths 见正文引用，勘察时点 main@cb57a22（v0.2.1）
