# Frond · 关键决策记录（ADR-lite）

记录日期：2026-07-26

## Decision-001 · Slogan 选择

**决策**：C — _Tools that breathe with your day._

**理由**：贴合"叶"的概念，传递常驻、不打断、可感不可见的调性，避免直接喊"工具集"的工程味道。

---

## Decision-002 · 1.0 范围

**决策**：9 个模块精细化到商用级；**本地音乐**和**代码片段**1.0 期间不动。

**理由**：

- 这两个模块当前相对完整，强行改会引入更多 bug
- 把精力集中到能带来用户感知升级的模块（截图/录制/壁纸/搜索）
- 1.0 后第一迭代立即补齐这两个

**实施**：见 `MODULE_TIERS.md` 的 "1.0 实际改的 9 个模块" 清单。

---

## Decision-003 · 账号系统

**决策**：1.0 不做，2.0 再说。

**理由**：符合"本地优先"差异化叙事；1.0 用户量小，账号收益不抵开发成本。

**后续动作**：2.0 启动时重新评估。

---

## Decision-004 · 云同步

**决策**：暂时不做，写入后续计划（roadmap）。

**替代方案**：1.0 提供"导入 / 导出 JSON"作为数据迁移的最小可行方案，让用户在多设备之间至少能"手动同步"。

**后续动作**：在 `docs/ROADMAP.md`（待创建）列入 2.0+ 待评估项。

---

## Decision-005 · 商业模式

**决策**：D — 开源（GitHub 公开发布）。

**影响**：

- 移除一切与"账号 / 订阅 / 付费功能"相关的暗示（避免误导用户）
- README、官网、About 页都需要开源项目的话术
- 1.0 发布前需选 License（建议 MIT 或 Apache 2.0）
- 移除作者邮箱占位等（package.json 当前的 `"author": "example.com"` 必须替换）

**注意**：开源对"商业化"叙事有冲突，但用户明确选了开源。后续所有文档避免"商用术语"。

---

## Decision-006 · 1.0 不做的项

| 不做项     | 备注                                            |
| ---------- | ----------------------------------------------- |
| 插件系统   | 推迟到 2.0                                      |
| AI 能力    | 推迟（与不做云同步一致，避免 1.0 引入外部依赖） |
| 自定义主题 | 1.0 仅提供浅色 / 深色 / 跟随系统                |
| 多语言     | 1.0 仅中文，但 vue-i18n 框架要接好              |

---

## Decision-007 · 技术栈调整

**决策**：C — 引入 SQLite（better-sqlite3），用于图片库 / 录制历史的存储。

**理由**：

- 当前 electron-store 是 JSON 文件，图片库和录制历史这类条数大、查询多的场景不合适
- better-sqlite3 是同步 API，简单且快
- 仅在主进程使用，对渲染进程暴露 IPC

**实施要点**：

1. 主进程封装 `Database` 服务（`src/main/services/DatabaseService.ts`）
2. 图片库表 `photos(id, file_path, file_name, file_size, width, height, created_at, imported_at, modified_at, is_favorite)`
3. 录制历史表 `recording_history(id, file_path, duration, created_at, thumbnail_path)`
4. 录制标记表 `recording_markers(id, recording_id, time_ms, label, color)`
5. 旧的 JSON 数据一次性迁移脚本（`scripts/migrate-to-sqlite.ts`）

**保留 electron-store 的场景**：

- `preferencesStore`（设置项）
- `musicStore`（播放列表）
- `wallpaperStore`（收藏的壁纸）
- 其他轻量配置

**待验证项**：

- better-sqlite3 在 macOS arm64 的原生编译（pnpm 已配 `onlyBuiltDependencies`，应能自动 rebuild）
- 在 Windows 上 electron-builder 是否正确打包 native 模块

---

## Decision-008 · 截图模块下线（2026-09-17）

**决策**：从应用中整体移除截图功能（含贴图 Pin 与截图历史），功能已在独立项目中实现维护。

**理由**：

- 截图能力由独立项目承接，本应用内重复维护两套实现
- 精简启动包体与主进程初始化成本（原截图模块按需懒加载 + 常驻 BrowserView）

**实施**：

1. Migration 028 `remove_screenshot`：drop `ss_screenshots` 表与索引（幂等）
2. 删除主进程 `modules/screenshot.ts` / `ScreenshotService` / `ipc/screenshotHistory` /
   `ipc/pin` / `PinService` / `repos/ScreenshotRepository`，及渲染层 `views/screenshot/`、
   `screenshot.html` 多页入口、启动器 ShotsPage / 统一搜索截图源
3. shared 层同步收敛：MODULES 去掉 screenshot、IPC 契约删除 `screenshot.*` 通道、
   命令层删除 `action` 类型（唯一消费方是截图）与 `screenshotItem` / `shots`
4. ⌘1 随之空出，不重排 ⌘2-4（见 `useModuleShortcuts` 注释）

**保留的共用设施**：`image://` 协议、`tag_tags`、`usage_records`、tesseract.js（剪贴板历史 OCR 仍用）。

---

## Decision-009 · Raycast 对齐定位修订（2026-09-17）

**决策**：基于 `docs/RAYCAST_GAP_ANALYSIS_V4.md` 的差距结论，修订三项「明确不做」：

1. **Calendar 集成**：推翻不做，立项完整对齐（分期：只读 → My Schedule → Create Event → 入会识别/自动入会）；本地假数据日历页由真实系统日历数据替代
2. **AI 融合四候选**：立项（截图 OCR 后处理 / 笔记·片段摘要 / 剪贴板语义整理 / 番茄钟日报）；「不做 AI 平台化」维持
3. **轻量多设备同步**：立项（配置 / 片段 / Quicklinks / 别名 / 热键等小数据经 WebDAV 加密拉平）；账号与全量双向同步仍不做。
   **2026-09-17 补充（用户确认）**：范围扩为 配置+热键基底 / 代码片段 / 笔记+提醒 / 番茄钟数据（剪贴板历史与录屏仍排除）；冲突策略 = 后写覆盖 + 拉平前本地快照（保留 5 份）；bundle 以 WebDAV 口令派生密钥 AES-256-GCM 加密

**理由**：三项均为 V4 报告中 P0 级空缺，且为 Raycast 用户切换的核心体验；此前不做的约束经用户 2026-09-17 决策解除。

---

## Decision-010 · UI/交互对标 Raycast 的两项视觉拍板（2026-09-18）

**背景**：基于 `docs/UI_ALIGNMENT_CHECKLIST.md`（computer-use 真机 AX 测量 Raycast 2.2.0 逐页基准）实施 UI 对标时，两项存在方向选择，用户拍板：

1. **强调色（V8）**：launcher 全范围强调色弃 systemBlue（#007aff/#0a84ff），改用 **Raycast 品牌红 #FF6363**（含 soft/strong/badge/accent-bg 派生档，亮暗两档成对）。主窗口套件（SettingsView / 番茄钟 / 录屏等）不属克隆面，维持系统蓝不变。
2. **剪贴板列表行密度（I8）**：对齐 Raycast **单行**（标题 + 数字徽标 1-0，38px 行高）；类型/来源/时间等元数据收进右侧详情栏（此前为两行 51px）。

**落点**：第一批提交 660ebac（V8 + I8 随骨架批次落地）；强调色派生 token 见 `styles/tokens.css` launcher 亮/暗两档。

---

## Decision-011 · 推翻「不做 AI 平台化」与「不做账号/云同步」（2026-09-20）

**决策**：基于 2026-09-20 全仓差距盘点（结论见 `docs/RAYCAST_PARITY_PLAN_V5.md`），
Decision-009 三项修订中的两项限制解除，以下原「不做」项转为立项：

1. **AI 平台化**：BYOM 多 provider（Ollama / OpenRouter / 自定义 OpenAI 兼容端点）、
   MCP client 最小面（连 stdio server、列 tools、注册为命令进根搜索）、Automations
   （定时跑命令/AI 任务）、Screen Awareness（焦点窗口内容作上下文）——分期见计划 P-4
2. **账号与双向云同步**：由 Decision-009 的「轻量单向拉平」扩为全量集合双向同步，
   冲突保留双副本而非静默覆盖——分期见计划 P-5

**维持不做**（本轮明确的例外）：

- **多语言 i18n**——用户 2026-09-20 追加更正，唯一维持项，UI 继续仅中文
- **跑未改动的 Raycast 商店扩展**——不引入 Node worker 运行时，生态走自建分发（`PLUGIN_DEV.md` 那条非目标声明继续有效）
- **移动端**——长期观望

**Why**：Raycast 2.0（2026-08-25 GA）后已把 AI 与听写移入 Pro、2026-09-10 起改按用量计费、
v2.3 上 AI Tasks/Projects/Automations、v2.2 上 BYOM；Frond 的 BYOK 单端点 Chat 已不构成 parity。
账号/同步同理——换机体验的差距无法再用「备份≠同步」解释掉。

**How to apply**：「本地优先」重述为**「本地优先 + 可选端到端加密同步」**。硬约束三条：
同步必须用户显式开启、默认关闭；加密密钥由本机/WebDAV 口令派生且不出本机；
**任何功能都不得要求先登录才能使用**。违反任一条即违背本决策。

**连带影响**：Decision-010 的「`--launcher-*` 不联动用户主题」需复审（计划 P-6.3），
本决策不直接推翻它，但 D3 之后「自定义主题不做」这条已不成立——用户主题文件已落地
（`main/modules/userThemes.ts`），缺的只是联动到启动器。
**复审结论见 Decision-012（2026-09-20）**：表面/文本这一组联动，强调色那条仍然有效。
**复审结论见 Decision-012（2026-09-20）**：表面/文本这一组联动，强调色那条仍然有效。

---

## Decision-012 · 用户主题联动到启动器的边界（P-6.3 复审，2026-09-20）

**决策**：用户主题（`userData/themes/*.json`）现在会派生 `--launcher-*`，但**只到表面与文本**这一组，
共 12 个键：`bg` / `bg-elevated` / `popover-bg` / `border` / `hairline` /
`text` / `text-dim` / `text-muted` / `text-faint` / `selected-bg` / `result-hover` / `input-bg`。
**不联动**的两类：

1. **强调色**（`accent` / `accent-soft` / `accent-strong` / `selected-indicator` / `badge-bg` / `danger`）
   —— Decision-010 的独立拍板继续有效，与主窗口 `--brand-500` 不随 `core.accent` 覆写是同一条口径
2. **几何与阴影**（`radius` / `search-height` / `footer-height` / `detail-width` / `shadow` / `blur`）
   —— 不是颜色；胶囊窗尺寸由主进程算，主题插一脚只会对不齐

派生规则：深浅看 `core.bg` 的实际亮度而不是 `appearance` 字符串（与 `deriveFromCore` 同口径），
深色档**保留底色 alpha**（0.74），否则主题一开就把毛玻璃变成死色块；
`core` 落不进 hex/rgb 数值形态（hsl、颜色名）时一个键都不发——宁可整套保持 `tokens.css`，也不发半套。

**Why**：P-6.3 复审时的取舍是「换肤 = 换表面与文本」，而 Raycast 红是产品识别色，
不是主题变量；把两组混在一起会让"选了主题=整个 app 变样"变成默认预期，
而胶囊是全局快捷键唤起的识别面。默认不联动任何键（不选主题 = `tokens.css` 现状）这一条没变。

**落点**：`src/shared/themeFile.ts` 的 `launcherThemeVars()`（由 `themeToCssVars` 合并，
主窗与胶囊各自的注入器不用改）。证据：`themeFile.test.ts` 里 6 条（键集合逐一点名、
强调色与几何零命中、深/浅两档 alpha 结构、亮度判据、非数值 core 零输出）
+ `useUserTheme.test.ts` 1 条（派生值真走完渲染端注入白名单，否则是静默丢弃）
+ `e2e/user-theme.spec.mjs` 第 2 条（量胶囊根元素的计算样式，切回内置必须回到基线值）。

---

## Decision-012 · 用户主题联动到启动器的边界（P-6.3 复审，2026-09-20）

**决策**：用户主题（`userData/themes/*.json`）现在会派生 `--launcher-*`，但**只到表面与文本**这一组，
共 12 个键：`bg` / `bg-elevated` / `popover-bg` / `border` / `hairline` /
`text` / `text-dim` / `text-muted` / `text-faint` / `selected-bg` / `result-hover` / `input-bg`。
**不联动**的两类：

1. **强调色**（`accent` / `accent-soft` / `accent-strong` / `selected-indicator` / `badge-bg` / `danger`）
   —— Decision-010 的独立拍板继续有效，与主窗口 `--brand-500` 不随 `core.accent` 覆写是同一条口径
2. **几何与阴影**（`radius` / `search-height` / `footer-height` / `detail-width` / `shadow` / `blur`）
   —— 不是颜色；胶囊窗尺寸由主进程算，主题插一脚只会对不齐

派生规则：深浅看 `core.bg` 的实际亮度而不是 `appearance` 字符串（与 `deriveFromCore` 同口径），
深色档**保留底色 alpha**（0.74），否则主题一开就把毛玻璃变成死色块；
`core` 落不进 hex/rgb 数值形态（hsl、颜色名）时一个键都不发——宁可整套保持 `tokens.css`，也不发半套。

**Why**：P-6.3 复审时的取舍是「换肤 = 换表面与文本」，而 Raycast 红是产品识别色，
不是主题变量；把两组混在一起会让"选了主题=整个 app 变样"变成默认预期，
而胶囊是全局快捷键唤起的识别面。默认不联动任何键（不选主题 = `tokens.css` 现状）这一条没变。

**落点**：`src/shared/themeFile.ts` 的 `launcherThemeVars()`（由 `themeToCssVars` 合并，
主窗与胶囊各自的注入器不用改）。证据：`themeFile.test.ts` 里 6 条（键集合逐一点名、
强调色与几何零命中、深/浅两档 alpha 结构、亮度判据、非数值 core 零输出）
+ `useUserTheme.test.ts` 1 条（派生值真走完渲染端注入白名单，否则是静默丢弃）
+ `e2e/user-theme.spec.mjs` 第 2 条（量胶囊根元素的计算样式，切回内置必须回到基线值）。

---


- 云同步（roadmap 候选）
- 多源音乐
- 多显示器壁纸
- 团队协作 / 共享
- 第三方接入
