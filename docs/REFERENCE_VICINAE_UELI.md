# Frond × Vicinae / ueli 源码借鉴笔记（2026-09-18）

> 两个参考仓库已 shallow clone 到 `references/`（已 gitignore，不入库）：
> - `references/vicinae` — C++/Qt 开源 Raycast 克隆，**兼容 Raycast 扩展 API**（★9.8k，活跃）
> - `references/ueli` — Electron+TS 跨平台启动器（★4.6k，活跃），与 Frond 同栈
>
> 本文是两仓深读结论，条目均附仓库相对路径。对准 `RAYCAST_GAP_ANALYSIS_V4.md` 列出的缺口：
> 模糊容错 / frecency / 多参数命令 / React 级扩展 API / 剪贴板细节 / 文件索引 / 热键冲突检测。

---

## 一、Vicinae：Raycast 交互与扩展体系的开源参考实现

### 1.1 总体架构

单仓库多目标，业务逻辑全在 C++，QML 只做表现层（`AGENTS.md` 有明文约定）：

| 目标 | 说明 | 路径 |
| --- | --- | --- |
| 主程序 | C++23/Qt Quick，约 40 个服务 | `src/server/src/services/` |
| 扩展运行时 | Node 跑 TS 扩展管理器 | `src/typescript/extension-manager/` |
| 剪贴板捕获 | Wayland data-control 独立进程 | `src/data-control-server/` |
| 键盘注入/片段 | evdev/uinput 独立进程 | `src/snippet/` |
| 文件索引 | inotify + sqlite FTS5 独立进程 | `src/file-indexer/` |
| IPC 协议 | 自研 IDL `figura`，生成 C++/TS 双端 RPC 桩 | `figura/*.fig` |

跨进程通信统一为 **4 字节长度前缀 JSON**（stdout / worker postMessage / Unix socket 三种承载）。

### 1.2 Raycast 扩展兼容层（Frond 生态缺口的核心答案）

这是全仓最有价值的部分——它证明了「不重写 Raycast，也能兼容其扩展生态」是可行的，且实现量级可控：

- **进程模型**：C++ 用 QProcess 拉起 node 跑单文件打包的 extension-manager（`src/server/src/extension/manager/extension-manager.cpp:93`）；node 运行时可自动下载并以硬链接改名 `vicinae-ext-runtime`（`extension/node-runtime/node-runtime.cpp:27`）。每个命令在 `node:worker_threads` worker 里跑，**worker 预热但一次不复用保证隔离**，堆上限 1000MB、退出宽限 5s、握手超时 1s（`src/typescript/extension-manager/src/index.ts:11,300`）。
- **渲染协议**：自研 reconciler（基于 react-reconciler，`reconciler.ts:76`）把 React 树产出为 `{$t: "list-item", props, children}` 普通对象 JSON；**函数 props 替换成回调 id 注册表**。`UI.render(JSON.stringify({views}))` 发给 C++（`loaders/load-view-command.tsx:57`；消息 schema `figura/tsapi.fig:112`）。C++ 侧 glaze 解析为 `ListModel/GridModel/FormModel/RootDetailModel` 变体（`src/server/src/extension/model/model-parser.hpp:13`）再桥接给 QML。
- **兼容策略**：`@vicinae/raycast-api-compat` 只是一层 re-export 包装；不支持的 API（`launchCommand`、`MenuBarExtra`）用递归 Proxy 抛「不支持」错误（`raycast-api-compat/src/unsupported.ts`）；`Environment.canAccess` 按能力位门控 WindowManagement/AI 等高级 API（`extension-manager/src/worker.tsx:66`）。Raycast Store 直连 `backend.raycast.com/api/v1`（`services/raycast/raycast-store.cpp:18`）——**扩展分发不依赖 Raycast 开放任何东西**。
- **多参数命令**：manifest schema 完整支持 argument 的 text/password/dropdown 与最多多参数（`api/src/schemas/manifest.ts:201-232`），UI 侧 `ArgCompleter` 逐参数占位补全（`ui/qml/launcher/ArgCompleter.qml`）。直接对应 Frond 差距分析 §2.2 的「多参数 + password/dropdown」缺口。

### 1.3 搜索与排序（对应 §2.2 模糊/frecency 缺口）

- **fzf 算法复刻**：自研头文件库，含 Smith-Waterman 变体与 Path/History 两种打分 scheme（`src/lib/fuzzy/include/fuzzy/fzf.hpp`）。
- **双指标模型**：`Match{score, quality}`，**quality < 60 直接整条拒绝**（防「乱匹配」），总分 = 字段加权分 + frecency 权重（`fuzzy/fuzzy-searchable.hpp`）。
- **frecency 公式**（可直接移植到 Frond 的 useUsageBoost）：`min(25, 5·ln(1+0.1·visits) + 10·exp(-days/30)) / 25`——log 频次 + 30 天半衰期指数衰减，封顶归一化（`fuzzy-searchable.hpp:26`，`FRECENCY_WEIGHT=6`）。
- **别名永远优先于分数**，而非参与混排（`services/root-item-manager/root-item-manager.cpp:189-198`）。
- **fallback 命令是可排序的配置列表**（`root-item-manager.cpp:27-51`），对应 Frond `fallbackCommands.ts` 「宣称可配置实际无读取路径」的欠账。

### 1.4 剪贴板（对应 §2.3 细节厚度）

- **独立 sqlite 库**（与主库分离，`database/clipboard/migrations/001_init.sql`）：`selection` 表 md5 去重 + `pinned_at` + 用户自定义 `keywords` 补充索引；`data_offer` 表每 mime 一行（含 `url_host` 便于 favicon 抓取）；FTS5 porter 分词 + trigram 升级（`002_trigram_fts.sql`）。
- **敏感内容直接不入库**（password manager 标记类，`services/clipboard/clipboard-service.cpp:486-493`）——比 Frond 的「屏蔽但不拦」更彻底。
- 正文可选 sqlcipher 加密落盘（`clipboard-db.cpp:453`）——Frond 已有等价物，方向一致。
- 粘贴回写：写回系统剪贴板 → 等焦点转移 → evdev/uinput 注入 Ctrl+V，终端模拟器有专门分支（`services/paste/linux-paste-service.cpp:13`）。

### 1.5 UI 细节（对应 Frond 的 footer/面包屑、主题工作）

- **Footer = 面包屑（点击开菜单）+ Toast 位 + 主动作按钮 + "Actions ⌘K" 按钮**（`ui/qml/launcher/Footer.qml`）——Frond 的 PageFooterBar 可直接对照其信息密度与分区。
- Action Panel：每个视图一个 `ActionPanelController`，push 新视图自动收起旧面板（`launcher-window.cpp:164-183`）+ QML popover。
- **主题是 TOML 文件**：`[colors.core]` 背景/前景/accent + 语义化子表，运行时注入 QML Theme 单例（`extra/themes/*.toml`）。Frond 用 JSON 等价实现即可对齐设计令牌层。
- pop-to-root 三态：Default/Immediate/**Suspended**（窗口隐藏后待命，下次打开时延迟清栈）（`navigation-controller.cpp:97-105,506`）；Esc 行为可配「关窗」或「回上一层」（`launcher-window.cpp:631`）。
- 窗口位置按屏幕名持久化恢复，校验屏幕仍在 + 最小可见 40px，失败回退光标屏 1/3 高度居中（`launcher-window.cpp:655-700`）。

### 1.6 其他工程点

- 状态分 `dataDir/stateDir/cacheDir` 三层（`vicinae.cpp:27-49`）；用户设置合并制 `mergeWithUser`。
- 片段占位符由 `PlaceholderString` 解析，支持光标落点与 shell 命令占位符（**预览时禁执行**防阻塞，`services/snippet/snippet-expander.hpp:33`）——Frond 片段占位符语法面差距（§2.4）可参考其解析器结构。
- 纯逻辑库自带可执行测试（fuzzy、file-indexer 等，`Makefile:106`）。

---

## 二、ueli：Electron 同栈工程参考

> 总体判断：ueli 的**架构纪律**值得学（DI 容器、模块化注册、纯数据 Action），但它的搜索体验（无 frecency、无虚拟化、无光标屏定位）**落后于 Frond 现状**，抄的时候要挑着抄。

### 2.1 Electron 架构

- 单实例锁 + 手写 DI 容器 `ModuleRegistry`，每模块一个 `bootstrap()`（`src/main/index.ts:3`、`src/main/Core/ModuleRegistry/`）；窗口统一登记在 `BrowserWindowRegistry`。
- search 窗**启动即创建**（非用时创建）；选项集中由 `DefaultBrowserWindowConstructorOptionsProvider.ts` 提供：`frame:false`、macOS vibrancy+透明、Windows backgroundMaterial(Mica/Acrylic)。
- **防闪现/焦点归还核心**在 `BrowserWindowToggler`（`src/main/Core/SearchWindow/BrowserWindowToggler/BrowserWindowToggler.ts`）：toggle = isVisible&&focused ? hide : showAndFocus；**Windows 下 hide 前先 `minimize()`**（让焦点正确还给前窗）再 hide；show 时 `app.show()+show()+restore()+focus()+webContents.send("windowFocused")`。
- 失焦隐藏是三开关配置 `["blur","afterInvocation","escapePressed"]`，且 **settings 窗可见时抑制 blur 隐藏**（`SearchWindowModule.ts:16,76-92`）——Frond 的胶囊/主窗桥接可借鉴这套抑制条件设计。
- 多显示器**没有光标屏定位**（只有 center 命令）——Frond 已领先，不必抄。
- 托盘：平台图标 resolver + nativeTheme 变更重绘 + 动态菜单（`src/main/Core/TrayIcon/TrayIconModule.ts`）。

### 2.2 插件体系（对应 Frond 声明式插件协议的演进方向）

- 核心接口 `Extension.ts`（`src/main/Core/Extension/Contract/`）：
  - `getSearchResultItems()` — 重活，全量结果**定时入索引**（默认 300s，`RescanOrchestrator.ts`）；
  - `getInstantSearchResultItems(term)` — 轻活，实时返回；
  - `getSettingKeysTriggeringRescan()` — 声明「哪些设置变更触发重扫」，避免全量重扫。
- **Item 模型是纯数据**（`src/common/Core/SearchResultItem.ts`）；**Action 也是纯数据** `{handlerId, argument, requiresConfirmation, hideWindowAfterInvocation, keyboardShortcut}`（`src/common/Core/SearchResultItemAction.ts`），main 侧 `ActionHandlerModule` 按 handlerId 分发给注册表，执行前先发 `actionInvocationStarted` 事件——「执行后是否隐藏窗口」彻底解耦。
- Workflow 扩展：一个 item 的 argument 解码为**多个 action 并发执行**（Promise.allSettled，`src/main/Extensions/Workflow/WorkflowHandler.ts`）。
- 设置项声明是**组件式而非 schema**（key 格式 `extension.<id>.<key>`，UI 由各插件 renderer 组件渲染）。

### 2.3 搜索管线

- 全量 index 在 main 维护并**落盘 JSON 缓存** + 广播 `searchIndexUpdated`（`src/main/Core/SearchIndex/SearchIndex.ts`）；搜索在 renderer 内存同步做，无防抖无取消（纯内存不值得）。
- **模糊引擎可切换**：fuzzysort（默认）/ fuse.js，threshold 与 fuzziness 的换算关系在 `src/common/Core/Search/fuzzySortFilter.ts` / `fuseJsSearchFilter.ts`——Frond 补模糊容错（§2.2）最省事的路径。
- 合并去重在 `src/renderer/Core/Search/Helpers/getSearchResult.ts`：favorites 手动置顶 → instantBefore 插队 → 模糊结果 → instantAfter。
- **无 frecency/usage 学习**——这块以 Vicinae 为准。

### 2.4 其他

- 文件搜索策略接口 `FileSearcher`：macOS mdfind / Windows Everything CLI / Linux find，各一行命令接入（`src/main/Extensions/FileSearch/`）；无自建索引（自建索引以 Vicinae 为准）。
- 热键：Electron 内置 globalShortcut + `isValidHotkey` 正则校验（`src/common/Core/Hotkey.ts`）+ 注册前 `unregisterAll()` + 设置变更事件自动重注册；**无冲突检测、无两段式**——Frond 的两段式直达反而领先，冲突检测需自己补（看 Vicinae `ui/settings/shortcut-conflict.cpp`）。
- 图标提取缓存管线：extractor 按 matcher 匹配（macOS 用 `defaults read CFBundleIconFile` + `sips` 转 PNG）+ 缓存文件名 + file:// URL 直用（`src/main/Core/ImageGenerator/`）。
- 主题：每主题给 dark/light Fluent Theme + accentColor 双值，监听 `prefers-color-scheme` 与设置事件（`src/renderer/Core/Theme/`）。
- 测试：vitest 149 个 colocated（`*.test.ts` 与源码同目录）；CI 四 OS 矩阵 typecheck+lint+test+build。
- native 模块仅 better-sqlite3 + sharp，`electron-builder install-app-deps` 重建。

---

## 三、对 Frond 的行动清单（按差距分析优先级）

| # | 行动 | 参考 | 对应缺口 |
| --- | --- | --- | --- |
| 1 | ~~引入 fuzzysort~~ → **已完成（2026-09-18，方案按证据调整）**：新增拼写容错第三层——连续/子序列之后由可切换 `FuzzyEngine` 兜底，默认引擎 fuse.js 编辑距离容错（≤5 字容 1 错、6+ 字容 2 错）。不用 fuzzysort 的原因：其 fzf 式评分无法区分合法缩写命中（`gcs`→`Google Chrome Setup` 仅 0.296）与噪音，且不解决"输错字母"这一原始缺口 | ueli `fuzzySortFilter.ts`（可切换引擎思想）；`src/shared/fuzzyEngine.ts` + `search.ts` | §2.2 ❌ 模糊 |
| 2 | ~~frecency 移植~~ **已被 V4 P0-3 完成（2026-09-17 批次）**：commandRunner 按 entry.key 全类型记录，file/clip/snip 不进 frecency 为文档化决策 | — | §2.2 frecency |
| 3 | 多参数命令 **已完成（2026-09-18）**：manifest `commands[].arguments`（text/password/dropdown，封顶 3，fail-closed 清洗）+ 胶囊 pluginarg 表单页（password 掩码 / dropdown 候选）+ 全链路带参（`openPlugin({pluginId,cmd,args})` → 插件 `onEnter` 钩子与 `getContext()` 均可读 `args`） | Vicinae `manifest.ts:201` + `ArgCompleter.qml`；Frond FormPage 基元 | §2.2 ❌ 多参数 |
| 4 | Action 纯数据模型 **Phase 1 已完成（2026-09-18，增量方案）**：main 新增统一执行端 `actionHandlers.ts`（`createDispatchMainAction` 依赖注入可单测 + fail-closed 载荷校验），system/app/file/quicklink/clipboardItem/snippetItem/copyText/openUrl 八类动作全入口共用；`action:invoke` IPC + 渲染端 commandRunner 薄层化 + 热键 dispatchCommand 复用同端（消除两套执行语义分叉）。module/page/plugin/firstParty 窗口编排类保留渲染端 | ueli `SearchResultItemAction.ts` + `ActionHandlerModule.ts` | 架构债 |
| 5 | 插件双通道 **Phase 1 已完成（2026-09-18）**：manifest `searchable: true` 门控 + `launcherApi.submitSearchItems`（打开时持久化条目集到主进程，封顶 300 条 fail-closed 清洗）+ 根搜索合并（关闭插件后仍可搜，keywords→别名进统一匹配引擎）+ 动作语义与声明式 List 对齐（copy/open/callback）。Frond 插件是 BrowserView 无法后台跑 JS，故采用「打开时提交 + 持久化索引」适配 ueli 的 getSearchResultItems 模型；instant 实时通道由既有 SubInputChange 承担 | ueli `Extension.ts` + `SearchIndex.ts` | 插件性能/一致性 |
| 6 | fallback 命令配置 **已完成**：启停（2026-09-17）+ 自定义顺序（2026-09-18，`sortFallbackCommands` + `launcher:fallbackOrder` + 管理页上移/下移） | Vicinae `root-item-manager.cpp:27` | §2.2 欠账 |
| 7 | pop-to-root 三态 **已完成（2026-09-18）**：`launcher:popToRoot`（immediately / afterInterval 30s / manually），`shouldPopToRootOnShow` 纯函数 + 管理页「回到根搜索」设置；manually 模式同时抑制 60s 空闲自动回根 | Vicinae `navigation-controller.cpp:97,506` | 交互打磨 |
| 8 | 剪贴板 **已完成（2026-09-18）**：条目备注关键词（`keywords` 补充索引，根搜索与本页筛选均可命中，详情面板内联编辑，≤10 条 × ≤30 字符）。敏感内容不入库已由 P1-6 敏感应用屏蔽实现，无需重复建设 | Vicinae `clipboard/migrations/` | §2.3 细节 |
| 9 | 文件自建索引 **M1 已完成（2026-09-18，macOS）+ M2（2026-09-19）**：FSEvents / @parcel/watcher 双后端（分支内动态 import）+ sqlite FTS5 + gitignore 风格排除 + **启动期目录水位补偿**（事件源都不回溯停机期间的变更，Vicinae 也没做这一步）+ 索引内部路径归一（正斜杠 + 盘符大写 + win32 大小写无关判定）+ fileSearch `source` 分层 + **trigram 中缀影子索引**（unicode61 把连续 CJK 当一个 token，「目计划」这类中缀主路径进不去；零结果时兜底，≥3 字符可命中、2 字中文仍是盲区）。Windows 侧未实机验证（两条 file-index e2e 仍 skip） | Vicinae `src/file-indexer/` | §2.7 ❌ |
| 10 | 热键冲突检测 **已完成（2026-09-18）**：`registerAllHotkeys` 记录失败清单（主热键重试成功自动解除）→ `hotkeysGetConflicts` IPC → 管理页主热键行警示 + 冲突热键标红（ueli 无冲突检测，仅热键体系内对齐 Vicinae） | Vicinae `shortcut-conflict.cpp` | §2.5 🟡 |
| 11 | React 级扩展 API **Phase 1 已完成（2026-09-19）**：`packages/frond-plugin-sdk`（workspace 包，react-reconciler 0.34 + react 19.3 配伍）+ 视图协议 v2（`api: 'react'` 门控，JSON 树主进程归一为 v1 条目列表，胶囊渲染管线零改动）+ List/Detail/ActionPanel + useNavigation + 回调 id 注册表（宿主 Callback 钩子回传）+ `example-react` 插件 + e2e 闭环（渲染→回调→导航详情）。Form 全家桶 **M2 已完成（2026-09-19）**：视图协议 v2 增 form 节点 + 胶囊复用 FormPage + 值经 Callback 回传 onSubmit；e2e 补第二用例（表单渲染→⌘↵→值回传→详情）。**修掉一处真 bug**：SDK 的 `commitUpdate` 沿用旧版 5 形参（带 updatePayload），0.34 实际是 `(instance, type, prevProps, nextProps, internalHandle)`，错位把 fiber 赋进 `HostNode.props` → 序列化 `stateNode>props>…` 无限递归 RangeError → root 被打坏后所有后续视图提交静默消失（此前表现为「表单回传间歇 flake」）。@raycast/api 兼容别名层 **M3 已完成（2026-09-19）**：`packages/frond-raycast-api`（`@frond/raycast-api`，不冒用 @raycast scope，插件侧 alias 指过来）——List.items/actions prop、accessories 对象数组、Form 字段命名（name/title/defaultValue/Submit）、Action.Copy·Open·Close 全部适配到 SDK；宿主没有的能力首次调用 warn 一次并安全降级，不做假实现（映射表与缺口清单见 PLUGIN_DEV.md）| Vicinae `reconciler.ts` + `model-parser.hpp` | §2.11 生态 |
| 12 | 主题令牌结构 **Phase 1 已完成（2026-09-19）**：`src/shared/themeSchema.ts`——ThemeDefinition（core 三元组 + surface/border/text/glass 语义子表），值与 tokens.css 1:1 同步（不变量测试守护漂移）；CSS 值零变化。**Phase 2 用户主题文件已完成（2026-09-19）**：`src/shared/themeFile.ts`（解析/fail-closed 校验/core 派生/CSS 值白名单）+ `src/main/modules/userThemes.ts`（`userData/themes/*.json` 读取与导入）+ 设置页「主题文件」区 + 渲染端注入 `:root,:root.dark,html.dark` 覆盖（默认不注入 = 视觉零变化）。TOML 与模块命名空间联动按拍板不做，细节见 DESIGN_TOKENS.md | Vicinae `extra/themes/*.toml` | 设计令牌 |

**Frond 已领先、不要倒退回去的点**：光标屏定位（ueli 没有）、两段式直达（ueli 没有）、剪贴板加密持久化与 OCR（ueli 没有剪贴板模块）、拼音别名（两家都没有）、胶囊 blur 抑制闪现细节。
