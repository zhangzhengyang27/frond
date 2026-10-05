# BUGS · Phase 0 排查结论（2026-08-29）

基线：typecheck node/web ✅ · vitest 294/294 ✅ · ESLint 15 error / 1170 warning ⚠️ · 存量硬编码样式 ~95 文件含 hex ⚠️

## 修复进度（Phase 1-3 完成后）
- ✅ B2 窗口去重：`modules/windows.ts` 增加窗口登记表，同 route 复用（focus + 进程内导航）
- ✅ B3 滚动复位：AppShell 增加 `.app-scroll` 标记类，scrollBehavior 兼容两种容器 + savedPosition 恢复
- ✅ B4 主题同步：新窗口 backgroundColor 跟随 nativeTheme + setTheme 广播 `theme:changed` +
  preload 暴露 `onThemeChanged` + useTheme 订阅
- ✅ B5 快照推送：preload 补 `subscribeSnapshot()`，MiniTimer 订阅后触发
- ✅ B6 监听器泄漏：useCursorHighlight 命名 handler + 卸载清理，删除 ipc/onPos 死代码
- ✅ B7 导出进度：`clip:exportProgress` 改发 `event.sender`
- ✅ B14 魔法数字：Sidebar 改用 `--shell-topbar-h` / `--shell-sidebar-w` token
- ✅ B16 lint-css-changed 解析缺陷（见下文）
- ✅ B17 幽灵类（见下文）
- ✅ B18 photos 原生 alert/confirm + 非品牌色 `bg-blue-500`：替换为 UToast / UModal 二次确认 /
  UTabs 筛选，高度改 `calc(100vh - var(--shell-topbar-h))`
- ⛔ B1 贴图窗口：曾补 PinPage + /screenshot/pin 路由 + preload onSetShortcuts，**2026-09-23 随贴图功能整体撤销**（见下文）
- ✅ B8 录制双轨：写入侧登记新 SQLite 记录（start/finalize）、删除走 recording.remove
  （带旧 JSON 回退）、统计改为本地计算（见下文）
- ✅ B9 ESLint error：全量清零（渲染层 + 主进程 0 error）
- ✅ B10 通知回调契约：改为 notification:event 事件模型（见下文）
- ✅ B11 ClipEditor 无效清理：play/pause 用具名 handler
- ✅ B12 右键菜单监听泄漏：SnippetList / Sidebar / Editor 全部保存句柄并在卸载时移除
- ✅ B13 死通道：删除 ping、platform:quit；其余预留通道集中登记（见下文）
- ✅ B15 examples 死订阅：补齐 local-shortcut-triggered / window-shortcut-triggered 发送方

## 🔴 高严重度

### B1 贴图（pin）功能整体断裂 —— ⛔ 2026-09-23 功能整体撤销，不再修
- 现象：截图编辑器点「贴图」创建的置顶窗口永远空白
- 根因：旧 `PinService.ts`（已删）加载 `#/screenshot/pin`，但 `router/index.ts` 无此路由（hash 模式无 catch-all）；
  主进程推送的 `pin:setImage` 无人接收（`onSetImage` 全仓库 0 调用）；
  `pin:setShortcuts` 连 preload 封装都没有；9 个 pin 通道闲置
- 当时列的两个出路里走了第二个：**移除贴图入口**。补路由只是让窗口不空白，`registerPinHandlers()`
  仍全仓零调用方 → `pin:create` 照样 reject。2026-09-23 截图换成上游 `electron-screenshots`
  （工具栏没有贴图按钮）后，用户拍板「不要这贴图、钉图的功能」，整条链删除，详见下文 B1 修复记录与 HANDOFF §11

### B2 窗口无限堆积
- 根因：`main/index.ts:149` 的 `create-new-window` 无条件 `new BrowserWindow`（`modules/windows.ts:6`），
  无按 route 去重/复用，返回值丢弃；每个新窗口自带 ⌘1-9 快捷键（useModuleShortcuts），可指数开窗
- 修复：主进程建窗口登记表，同 route 已开则 `focus()`；快捷键注册加主窗口守卫

### B3 路由切换滚动不回顶
- 根因：`router/index.ts:27-39` scrollBehavior 查找 `.App-router`，但该容器只存在于 2 个沉浸式路由；
  常规路由滚动容器是 AppShell 的 `<main>`，querySelector 返回 null；`return { top: 0 }` 滚的是不可滚的 window
- 修复：统一两种分支的滚动容器类名；savedPosition 恢复改用真实容器

### B4 多窗口主题不同步
- 根因：`ipc/preferences.ts:24` setTheme 只写 store 不广播；`windows.ts:17` backgroundColor 写死 `#fafafa`（暗色闪白）
- 修复：setTheme 后 `BrowserWindow.getAllWebContents().forEach(wc => wc.send('theme:changed'))`；
  backgroundColor 改为读偏好

## 🟡 中严重度

### B5 迷你悬浮窗实时同步断裂
- 根因：`modules/pomodoro.ts:207` 等 `subscribeSnapshot` 请求才开始推送，但 preload 未暴露该方法
- 修复：preload 补 `subscribeSnapshot()`，MiniTimer 在订阅 onTraySnapshot 后调用

### B6 useCursorHighlight 监听器泄漏
- 根因：`useCursorHighlight.ts:37-41` 两个匿名 window listener 无清理；onUnmounted 只调 stop()
- 影响：多次进出录屏页后光标推送触发 N 次，闭包阻止 GC
- 修复：提取命名 handler，onUnmounted 中 removeEventListener；顺带删除未用的 `ipc`/`onPos` 残留（L31-45）

### B7 剪辑导出进度只发主窗口
- 根因：`ipc/clips.ts:68` 硬编码 `mainWindow.webContents.send`；从副窗口导出进度条永不动
- 修复：改用 `event.sender`

### B8 录制新旧双轨并存（需产品决策）
- 现状：`recording.*` 28 个新通道已注册，渲染端仅接入 4 组（region/cursor/systemAudio/shortcut.getConfig）；
  保存仍走旧 `screen-recorder:saveFile`（useScreenRecorder.ts:118）；`recording-history:addHistory` 无人调用
- 建议：录屏模块重做时全面切换新 SQLite 通道，废弃旧链路

### B9 ESLint 15 error
- `no-undef EventListener`（类型当值用）、5 处空 catch 块、`prefer-const` ×2、
  computed 无返回值、`no-require-imports` ×2、`no-unused-vars` ×2
- 修复：Phase 5 逐个清零

## 🟢 低严重度

### B10 notification 回调契约虚假
- `index.d.ts` L455-525 五处声明 `onClick/onClose` 函数参数——函数不可过 structured clone，
  传入即抛 "An object could not be cloned"，不传则恒为 undefined
- 修复：删除类型字段；改事件模型（`notification:event` 频道按 id 分发）

### B11 ClipEditor 清理无效
- `ClipEditor.vue:307-316`：removeEventListener 传新匿名函数引用，no-op（video 元素销毁兜底，低危）

### B12 snippets 条件性监听泄漏
- `SnippetList.vue:231/242`、`Editor.vue:677/652`：菜单展开时卸载组件，document 监听存活到下次全局点击（自愈型）
  - 2026-09-23 对行号：这一条原先还列着 `snippets/Sidebar.vue` 的第 201 行，而该文件今天只有 169 行、
    也没有任何 document 监听 —— 那一腿已不成立，删掉。（是 `scripts/recovery/scan-doc-citations.cjs` 扫出来的：它把全仓文档的 file:行号 逐条对真树核一遍）

### B13 死通道 ~40 个
- 主进程注册但渲染端 0 调用：usage.toggleFavorite/isFavorite/clearRecent/removeFavorite、
  photos.getAll/getAllTags/search 等 10 个、snippet.deleteSnippet/restoreSnippet/getStatistics/emptyTrash、
  platform.setDockBadge/setProgressBar/requestUserAttention、pomodoro.sendNotification/mini.show/mini.isVisible 等
- 处理：UI 重做时按需接入（usage 收藏、photos 批量操作等有真实价值），其余标注「预留」或删除

### B14 TopBar 高度魔法数字 ×3
- `TopBar.vue:28` h-10、`Sidebar.vue:30` sticky top-10 + h-[calc(100vh-2.5rem)]
- 处理：Phase 3 壳子重做时改 flex 布局 + `--shell-topbar-h` 变量，三处魔法数字整体删除

### B15 examples 死订阅
- `local-shortcut-triggered` / `window-shortcut-triggered` 主进程无发送方，demo 两张卡片永无响应

### B17 Onboarding/MigrationCenter 使用未定义的「幽灵 Tailwind 类」（已修复）
- 根因：两视图按未落地的 token API（`bg-bg-base` / `text-text-primary` / `border-border-subtle` /
  `ring-focus` 等）编写类名，但 tailwind.config.js 从未定义 `bg` / `text` / `border` 色组，
  全部类静默失效 → 引导页/迁移页样式实际是裸的
- 修复：重写为 v2 token（`fg-*` / `surface-*` / `line-*` / `shadow-ring-focus`）

### B18 photos 页原生对话框 + 跑偏配色（已修复）
- `photos/index.vue` 用原生 `alert()` / `confirm()`（Electron 中观感差、阻塞渲染进程）；
  筛选按钮用 `bg-blue-500`（脱离品牌色板）；`height: 100vh` 未扣除 TopBar 高度
- 修复：UToast（成功/失败反馈）+ UModal 二次确认 + UTabs 筛选 + token 化高度与底色

### B19 wallpaper 模块界面/交互问题（已修复）
- `index.vue` 自维护 Toast 状态机 + 局部 Toast 组件 → 改为全局 `useToast`（局部 Toast.vue 已删除）
- 分页回顶用 `window.scrollTo`（window 不可滚，实际无效）；`LocalFileLibrary` 用
  `querySelector('.overflow-y-auto')` 会命中页面上任意第一个滚动容器 → 均改为定位真实容器
  （`.app-scroll` / scoped ref）
- 手搓 switch（`switch-slider` + 硬编码 `#4a90e2`）→ USwitch；原生 input/select → UInput
- 非品牌色 `bg-blue-500/600`、`bg-gray-*` 全量替换为 v2 token
- 播放模式由原生 radio 改为 UCheckbox 时需保持单选语义：仅在勾选时 emit（否则写入 false 非法值）
- 死引用 `categoryBarRef`（声明未使用）已删除

### B20 snippets 模块界面/交互问题（已修复）
- `Editor.vue` 全局样式写死 `.CodeMirror { background-color: white !important }` ——
  暗色主题下编辑器仍是白底（主题类已切换但被该规则覆盖）→ 改为 `var(--surface-1)` 等 token
- `SnippetList` / `Sidebar` 的原生 `confirm()` → 应用内 UModal 二次确认
- 右键菜单 document 监听在组件卸载时不清理（`showSnippetContextMenu` /
  `showFolderContextMenuHandler`）→ 保存句柄并在 onBeforeUnmount 移除（B12）
- `Editor.vue` 搜索框换组件后 `searchInputRef` 不再指向 DOM，脚本 `focus()` 失效 → 保留原生 input
- 三个组件约 2500 行硬编码 CSS（`#e0e0e0` / `#1976d2` / `#fafafa` 等）全量替换 v2 token

### B21 番茄钟主题适配在 auto 模式下失效（已修复）
- 根因：`TaskEditDialog` / `HourHeatmap` / `ProjectDonut` 用
  `html[data-theme='light']` 打浅色补丁，但默认主题是 `auto`（`data-theme='auto'`），
  补丁不生效 → 浅色系统下对话框沿用深色值（白字浅底）、图表文字不可见
- 修复：改为「基础样式=浅色 + `html.dark` 覆盖深色」，覆盖 dark 与 auto+深色系统两种情况
- 连带：番茄钟引用的 11 个 CSS 变量（`--pomo-dialog-*` / `--pomo-input-*` /
  `--pomodoro-drawer-*`）从未定义，仅靠单一主题 fallback → 全部收归 tokens.css 并按 .dark 切换
- 该模块 60 处存量硬编码色（`#6b7280` / `#4a90e2` / `#1f2937` 等）已替换为新增的
  `--pomo-text-muted/soft/faint`、`--pomo-accent`、`--pomo-panel*` 等语义 token

### B22 录屏模块幽灵渐变 + 主题/布局问题（已修复）
- **`bg-gradient-primary` 被 13 处引用但从未定义**（Tailwind 与 CSS 均无）→ 录屏页背景为空，
  而其上元素多为 `text-white` / `bg-white/10`，浅色主题下白字白底不可读
  → 定义 `--gradient-primary`（浅/深成对）并接入 `tailwind.config.js` 的 backgroundImage
- Layout 用 `h-screen`：位于 AppShell 的 main 内，多出顶栏高度导致内容裁切/双滚动条 → 改
  `calc(100vh - var(--shell-topbar-h))`
- 导航标签依赖深色渐变的白字 → 改为主题感知（品牌色激活态 + 下划指示条）
- 6 个未定义 CSS 变量（`--bg-primary` / `--bg-secondary` / `--bg-hover` / `--border-color` /
  `--primary-color` / `--primary-hover`）仅带深色 fallback → 剪辑时间轴/转场选择器在浅色下
  强制深色，现按主题定义
- `RecordingExportDialog` 的 `recommendedBitrate` computed 的 switch 缺 default →
  分辨率不在预设列表时返回 `undefined`，会写入 API 请求 → 补 default 兜底 5000
- `Layout.vue` 用 `as EventListener`（纯类型，运行时不存在）→ 去掉断言（eslint no-undef）
- ClipPage 空态白字 → UEmpty

### B1 贴图窗口空白（修过 → 2026-09-23 连同功能一起撤销）
- 根因（当时）：`PinService` 加载 `#/screenshot/pin`，但路由表无此路由 → Vue Router 无匹配，窗口永远空白；
  `pin:setImage` / `pin:setRotation` 推送无组件接收，`pin:setShortcuts` 连 preload 封装都没有
- 当时的修复：新增 `views/screenshot/pages/PinPage.vue` + `/screenshot/pin` 路由（hideInSidebar）；
  preload 补 `onSetShortcuts`，并让 `onSetImage` / `onSetRotation` 返回取消订阅函数
- **为什么又撤了**：① 这条链其实从来没有入口 —— `registerPinHandlers()`（`src/main/ipc/pin.ts`）
  当时全仓零调用方，也就是说补上路由之后 `pin:create` 依然会 reject（与 §HANDOFF 里
  「注册函数零调用方」是同一类缺陷）；② 2026-09-23 截图改由上游 `electron-screenshots` 承担后，
  上游工具栏没有贴图按钮，用户当场拍板「不要这贴图、钉图的功能」。
  于是 `PinService.ts` / `ipc/pin.ts` / `PinPage.vue` / `/screenshot/pin` 路由 / preload 的 `pin.*`
  一并删除（HANDOFF §11）。
- 留一条判据：**主进程 URL 里出现 `#/…` 字面量，路由表必须有同名 `path`；反之路由表里有 path，
  也得确认真的有人 `loadURL` 它**，两头都要核。

### B23 截图主页为 demo 级页面（已重做）
- 旧版仅一个标题 + 一个硬编码 `#1890ff` 按钮，且所有样式写死
- 现提供：主 CTA、截图总数/占用空间/保存目录概览、最近截图宫格（悬浮操作：打开 / 在访达中显示）、
  存储用量与目录设置、截图完成后自动刷新列表
- 注意（当时的坑）：`screenshot.onCapture` 未返回取消函数，重复进出会叠加监听 → 用模块级标记保证只注册一次
- **2026-09-23 撤销**：这一页与整套树内截图编辑器一起删除（截图改由上游 `electron-screenshots`
  承担，HANDOFF §11）。主应用内不再有截图页；`views/screenshot/` 与 `screenshot.html` 入口、
  preload 的 `SCREENSHOT:*` 覆盖层协议全部移除。截图库（`shot_index` + 启动器内联页
  `ShotsIndexPage.vue`）不受影响，它读的是目录扫描 + OCR，与编辑器无关

### B8 录制新旧双轨（已收敛；剩余项已登记）
- 现状澄清：RecordingHistory 的**读取早已走新通道** `recording.list`（带 JSON fallback），
  早期审计结论有误；真正仍走旧通道的是：写入登记、删除、统计
- 已改：
  - 写入：`useScreenRecorder` 在录制开始时调 `recording.start()` 登记 SQLite 记录，
    保存成功后 `recording.finalize()` 落库（任一环节失败静默，旧链路不受影响）
  - 删除：优先 `recording.remove()`，查不到（legacy JSON 记录）时回退旧通道
  - 统计：改为基于新数据源本地计算（旧实现读 JSON，与新数据源数量/大小对不上）
- 仍走旧通道（新通道无对应能力，保留）：`openFile` / `showInFolder` / `updateThumbnail` /
  `clearHistory` —— 需要主进程补充 shell.showItemInFolder、缩略图生成、批量删除等新通道后
  才能进一步收敛

### B10 通知回调契约（已修复）
- 删除 `index.d.ts` 中 5 处 `onClick` / `onClose` 字段（共 10 个），
  `NotificationOptions` 中标记为 `never` 并注明原因
- 新增事件模型：`NotificationService.onNotificationEvent()` → IPC 层广播
  `notification:event`（`{ id, kind: 'click' | 'close' }`）→ preload 暴露 `notification.onEvent()`

### B13 死通道（已清理 + 预留登记）
- 删除：`ping`（electron-vite 脚手架残留）、`platform:quit`（preload 从未暴露，
  Dock/托盘菜单在主进程直接 app.quit()）
- 保留为预留 API（渲染端尚未接入，不删除以免误伤）：`usage.toggleFavorite/isFavorite/
  clearRecent/removeFavorite`、`photos.*` 10 个、`snippet.deleteSnippet/restoreSnippet/
  getStatistics/emptyTrash`、`tag.getTagById/updateTag`、`folder.getFolderById/
  getFoldersByParentId`、`platform.setDockBadge/setProgressBar/requestUserAttention`、
  `pomodoro.*` 若干、`screenshot.history.*` 若干、pin 除 create 外全部
- 建议：随各模块 UI 重做顺手接入（如 Home 加星标按钮即可用上 usage.toggleFavorite）

### B24 截图覆盖层硬编码色（已 token 化）
- 背景：截图工具条 / 延时选择器 / 窗口选择器 / 历史面板 / OCR 结果等悬浮在截图之上，
  **必须恒定深色**以与任意截图内容形成对比（同 macOS 截图 UI）——不能改成主题 token，
  否则浅色主题下会变成白面板盖在截图上
- 处理：新增一组恒定深色的 `--shot-*` token（panel / panel-raised / panel-hover / border /
  text / text-dim / text-muted / text-faint / accent / accent-soft / shadow），
  覆盖层组件 6 个 + 画布组件 2 个的硬编码全部替换
- 保留为数据色（非样式，不应 token 化）：`ScreenshotsColor` 的调色板数组
  `['#ee5126', '#fceb4d', ...]` —— 这是供用户选择的颜色值

### B16 lint-css-changed 静默跳过已暂存文件（Phase 1 中发现并已修复）
- 根因：`scripts/lint-css-changed.mjs` 固定 `line.slice(3)` 解析 porcelain 行；文件处于已暂存状态
  （`M ` 前缀，行内少一个分隔空格）时截掉路径首字符 → `existsSync` 失败 → 该文件被静默排除，
  严格 CSS 检查形同虚设
- 修复：改为 `^(..)\s+(.+)$` 正则解析，兼容未暂存/已暂存/未跟踪三种形态
- ⚠ 2026-09-24 校正：就门禁整体而言上面「已修复」**不成立** —— 修复件从未入库，随
  2026-09-22 事故从磁盘消失，`lint:css:changed` 此后一直 MODULE_NOT_FOUND；连 stylelint
  配置也一并丢失，`lint:css` 靠 `|| true` 吞掉 ConfigurationError。同日按本条契约重建
  脚本与配置（三态正则解析保留），登记恢复件台账（rebuildLedger.test.ts），过程与
  与原件的声明差异见 HANDOFF §10.11

## 死通道核查中确认无问题的项
- 渲染层调用但 preload 未暴露：无
- 主→渲染推送频道名拼写：全部一致
- screenshot ready/ok/cancel/save、region-overlay、appMenu 跳转链路：闭环 ✅
- router beforeEach 3s 超时兜底：settled 互斥正确，无 next() 双调 ✅

## 修复排期
- B3/B14 → Phase 3 壳子重做时根治
- B2/B4/B5/B6/B7 → Phase 5
- B1 → Phase 4 截图模块重做时决定功能去留
- B8 → Phase 4 录屏重做时切换新通道
- B9/B10/B11/B12 → Phase 5
- B13/B15 → 随各模块重做顺手处理

## 2026-09-28 发现（挂账）

### B25 AI 端点守卫 × Clash fake-ip/TUN：公网 AI 端点被 fail-closed 拦截（发现未修，待产品决策）
- 发现：2026-09-28，`aiEndpointGuard` 冒烟测试在本机变红——`example.com` 被整机 DNS（Clash
  TUN fake-ip 模式，含 dig 直查同样返回）解析为 `198.18.1.72`（RFC 2544 保留段），
  `classifyIpRisk` 判 blocked（`src/main/launcher/netGuard.ts:80` benchmark 段），守卫按设计拒绝
- 影响面：fake-ip 模式代理用户（含作者本人）配置任何公网 AI baseUrl 都会报
  「AI baseUrl 指向受限地址 198.18.x.x」——网络层实际可通（fake-ip 正是代理的转发机制），守卫误伤合法场景
- 为什么没当场修：改放行面=产品决策（守卫信任模型注释明言「只硬阻断元数据/链路本地/保留段」），
  且 AI 功能已冻结（2026-09-28 路线决策）；先挂账
- 候选修法：①守卫对「域名解析结果全部落 198.18/15」给独立可诊断 reason（提示 fake-ip 代理环境），
  不改放行面；②对 https 域名端点放行 198.18/15；③维持现状
- 测试侧已适配：冒烟测试改为双环境断言——先探针本机解析，落受限段则断言 fail-closed（守卫该行为），
  否则断言放行；任何环境都有真实语义

### B26 剪辑页入口断链：历史页进剪辑永远拿不到视频（2026-09-28 审计发现 → 同日已修）
- 现象：历史 → 剪辑进入 ClipPage，ClipEditor 收到 `video-path=""`，编辑器永远空白
- 根因：Layout.vue:70-71 在 router-view 上监听 `@play-video` / `@clip-video`，但全仓零 emit
  （grep 仅命中监听两行）；HistoryPage 的「剪辑」入口是无参 router-link
  （HistoryPage.vue:85-89）→ `handleClipVideo`（Layout.vue:195-220）整段死代码，
  `playbackVideoPath` 恒 null（HistoryPage 同为重建件，入口接法是重建期臆造）
- 修复候选：HistoryPage 剪辑按钮改为带参跳转或 emit 事件，接回 Layout 的既有赋值段；
  顺带清 ClipPage 声明未用的 `playbackVideoInfo` prop（提示原件可能直接喂给 ClipEditor）
- 姊妹病（同批审计发现，非重建引入）：Proxy 直过 IPC 结构化克隆三处——
  ClipEditor.vue:203 `updateClip(id, clipForm.value)`、useVideoClip.ts:169
  `exportClips(... clips: clips.value)`、useVideoClip.ts:141 `previewClip(clip)`，
  按 HANDOFF.md:803-804 与 BUGS B10 同款家族病会抛 DataCloneError（表先例修法 toRaw）

### B27 ExportDialog 手填输出路径与主进程白名单实锤相抵（2026-09-28 审计发现 → 同日已修）
- 现象：用户在导出对话框手打输出路径点导出，必被 main 拒绝「导出路径未经主进程签发」
- 根因：重建模板增补了手填 outputPath 输入框（ExportDialog.vue:213-219，原件模板不可考），
  而 `clip:exportClips` 只接受 `clip:selectSavePath` 对话框签发过的路径（ipc/clips.ts:41-44，
  安全设计）；更糟的是单测把这个手填流程钉成了组件契约（exportDialog.test.ts:71-82）
- 修复候选：模板去手填框只留「浏览…」（保 main 白名单安全口径），同步改单测契约

### B28 PreviewPanel 画中画 stale ref：摄像头流永远挂不上（2026-09-28 审计发现 → 同日已修）
- 机制：画中画 video 挂 `v-if="showPipCamera"`（PreviewPanel.vue:16），而 RecordPage 对
  expose 的同步是一次性 watch（RecordPage.vue:580-590）——挂载时 showPipCamera=false 同步进
  useStreamManager 的 pipCameraRef 是 null，之后 v-if 创建的新元素无人重新同步，
  useStreamManager.ts:373-375 的 `if (pipCameraRef.value)` 恒假
- 修复候选：RecordPage watch showPipCamera 后重新同步 expose，或 useStreamManager 收 getter；
  单测测不出（测试挂载时 showPipCamera 恒 true，previewPanel.test.ts:66）

## 2026-09-28 修复注记（B26/B27/B28 同日修复）
- B26：HistoryPage 补 defineEmits（play-video/clip-video，形状 = Layout handler 入参契约），
  剪辑 router-link 改按钮 emit clip-video，缩略图接 play-video；修法走 router-view
  attrs 透传（监听挂在 Layout 的 <router-view> 上，HistoryPage emit 即达）。
- B27：模板去手填框改只读展示，路径只能经「浏览…」（selectSavePath 白名单口径不动）；
  exportDialog.test.ts 的手填流程契约同步改为 chooseOutput 走真路径。
- B28：PreviewPanel 画中画 v-if → v-show（ref 从挂载起就非空，一次性同步语义成立）；
  新增 B28 回归钉（关态挂载 pipCameraRef 非空）+ 旧存在性断言改可见性断言
  （happy-dom 的 isVisible() 对 video 不可靠，断言 v-show 内联 display）。
- 姊妹病（Proxy 过 IPC 三处）：ClipEditor updateClip / useVideoClip previewClip /
  exportClips 全部 toRaw（同 HANDOFF.md:803 家族病修法）。
- 【未跑】剪辑链真机端到端（录一段→历史→剪辑→导出）——e2e 对该 UI 零覆盖，
  下次录屏模块真机验证轮补。

## 2026-09-28 发现（挂账）· 二

### B29 亮度调节在 macOS 26 被系统 API 断路（实证死路两条，未实现）
- 目标：Raycast parity 的亮度调节（系统命令五档/增减）——2026-09-28 parity 包清单项
- 实证一：文档化路线 `osascript -l JavaScript` + CoreDisplaySetBrightness（SO 78620179，
  Sonoma 14 可用）在本机 darwin 25.5（macOS 26）失效——**CoreDisplay.framework 已从
  /System/Library/PrivateFrameworks 移除**（替换为 BrightnessControl.framework），
  JXA 桥不暴露任何候选符号；dlsym 探测 BrightnessControl 五个候选名全 nil
- 实证二：IOKit 公共路线（IOMainPort/IOServiceMatching("IODisplayConnect")/
  IODisplayGet|SetFloatParameter，lux 的路线）符号全在，但本机 IOServiceGetMatchingService
  返回 0——**macOS 26 的内建屏不再走 IODisplayConnect 服务**
- System Events key code 113/107 注入无报错但效果不可验证（无读取 API），不采信
- 结论：亮度需要 ①对 BrightnessControl 私有框架做符号逆向（成本高、随系统更新再碎），
  或 ②外接显示器走 DDC/CI（m1ddc 路线，只覆盖外接屏），或 ③等上游生态给出 macOS 26 方案
- 建议：暂不做；若做，外接屏 DDC 路线优先（符号稳定）

## 2026-09-29 发现（全库审计，B30 起）

> 审计方式：6 个子系统（安全/IPC、launcher、插件链、录制剪辑截图、数据层服务层、渲染层）
> 并行深审 + 关键发现逐条人工复核 + 门禁实证（当时 132 文件 1086 用例全绿——绿门禁
> 之下仍有下述实锤，测试盲区清单见各条）。以下只登记动过或需要决策的；同批审计
> 还产出约 25 条 P2/P3（性能/边界/纵深），完整清单在审计会话记录，随修随登记。

### B30 savePath 单例 × 签发撤销叠加：同会话第二段录制必丢（2026-09-29 审计发现 → 同日已修）
- 现象：默认操作流（开始→停止→再开始→再停止）下第二段录制只弹「保存失败: refused:
  path was not issued by the main process」，录像内容全部丢弃
- 根因：两个安全收敛的叠加——①渲染端 `savePath` 是模块级单例，只在为 null 时申请
  （useScreenRecorder.ts:204-209），onstop 收尾重置了一切唯独不重置它；②主进程在
  endWrite/saveFile 成功即 `revokeRecordingSavePath`（screenRecorderSave.ts:89）。
  于是第二段 beginWrite 必被「未签发」拒绝，渲染端仅 console.warn 后静默降级内存
  攒满模式，保存同样被拒 → MediaRecorder 已停，数据全丢
- 修复：onstop 收尾与 startRecording 失败 catch 两处复位 `savePath=null`（每次录制
  重新签发；getDefaultSavePath 自带时间戳+防撞序号，语义成立）；回归钉
  useScreenRecorder.savePath.test.ts（两轮 start/stop 断言第二次必须重新签发）
- 教训：B27 的「签发即撤销」与旧有的「路径单例」各自都对，叠加成新病——安全机制
  落地时要扫一遍既有消费方的生命周期假设

### B31 冷启动后全局热键全灭（只剩 ⌘⇧M）（2026-09-29 审计发现 → 同日已修）
- 现象：每次冷启动 Alt+Space 等全部可配置热键失效，直到去设置页重设一次；e2e 测不到
  （launch-smoke 走 `launcher:toggle` IPC，不走真热键）
- 根因（逐环复核过）：whenReady 回调是同步块（index.ts:279-555）——356 行
  registerLauncher → launcher/index.ts:28 **同步** registerAllHotkeys 注册主热键/截图/
  命令/chord；而 hotkeys 的 restorer 走动态 import 异步挂入（hotkeys.ts:337-341）；
  同块 522 行 registerAppGlobalShortcuts → globalShortcuts.ts:31 `unregisterAll()` 清光
  全部注册后遍历 shortcutRestorers 重挂——此刻集合里只有番茄钟（静态 import，同步挂入），
  hotkeys 的 restorer 因微任务语义不可能已入集。注册成功时主热键重试路径不武装，无人救场
- 修复：hotkeys.ts 改静态 import addShortcutRestorer（已核实无循环依赖：
  globalShortcuts → launcher/window，不回指 hotkeys）；startupWiring.test.ts 补接线断言
  （restorer 必须同步挂入 + 动态 import 旧写法回潮即红）。该接线自 9-22 基线即存在
- 测试盲区注记：startupWiring 只有静态 grep 断言，恰好没有「注册先后 + restorer 挂载
  时机」这条；hotkeys.ts 零行为测试

### B32 「路径白名单必须主进程签发」纪律六处缺口（2026-09-29 审计发现 → 同日收口）
- 同族病盘点（B27 是首例）：全仓写盘/读文件通道逐一对照，六处绕过签发/白名单口径——
  1. `recording.export.start`：outputPath 原样递 ffmpeg `-y`，可覆盖任意 .mp4/.webm/.gif
     （recording.ts，渲染端当前零调用，补闸零破坏）
  2. `video:readFile`：白名单数据源（录制历史）本身可被 addHistory 污染——addHistory 对
     路径只做 existsSync，两次 IPC 读走任意文件；且文件头承诺的 128MB 上限未实现
  3. `recording.recovery.discard/recover`：只校验 .partial.mp4 后缀+存在性，不校验目录围栏，
     任意目录同名文件可被删/改名
  4. `recording-history:generateThumbnail`：任意路径喂 ffmpeg `-i`（解析探针）+ `-y` 写同名 .jpg
  5. `recording-history:showInFolder`：同文件 openFile 有 safeOpenablePath、它没有（漏改）
  6. `shotidx:pastePath`：任意路径图片进剪贴板并向前台注入 ⌘V
- 修复（一次收口）：export.start 套 resolveGrantedRecordingPath（clips.ts 同口径）；
  addHistory 只认主进程当前签发过的路径（历史行作为白名单数据源不再可污染，主进程内部
  直调 Service 不受影响）；readFile 补 128MB 上限；recovery 变异入口补 realpath 落
  candidateDirs 子树校验；generateThumbnail/showInFolder 只认历史行；pastePath 只认
  截图扫描目录子树。守卫回归钉 recordingHistoryGuards.test.ts 七条 + openPathGuard
  补 `~/` 展开用例
- 同批顺带：safeOpenablePath 统一展开 `~/` 前缀（插件 sandbox 页无 process 拿不到 HOME，
  宿主是唯一知道 HOME 的一方——quickfolders 的 `~/Desktop` 目录此前根本打不开）

### B33 dataSync push 整包覆盖远端：新设备先 push 可致他机未改动数据真删（审计发现 → 同日已修）
- 事故链：pushDataSync 直接全量覆盖远端 bundle + sync_state 刻意不同步（墓碑不过网）→
  新装机设备配置 WebDAV 后先点「推送」→ 远端 bundle 只剩新设备数据 → 老设备下次拉平把
  「远端缺席」当删除，未改动的片段/笔记/提醒/番茄任务被真删（syncMerge copy 表全中招）
- 缓解面（当时）：pull 前有本地快照（5 份）；渲染端尚无 UI 调用 syncdata:push/pull
  （仅 preload 暴露）——接线前修最便宜
- 修复：push 改「合并后发布」——远端 bundle 存在且 latest.exportedAt 比本地 lastApplied 新
  时先 mergeBundle 再构建上传（latest 读不到时保守走合并）；真链路回归
  dataSync.chain.test.ts 新用例（新设备先 push，老设备数据必须在）
- 遗留（挂账见 B38）：墓碑不过网的半失败态（bundle 上传成功但 latest.json 失败 → exportedAt
  不前移）与远端版本保留（对齐 cloudBackup KEEP_REMOTE）未做

### B34 幽灵类系统性风险：无 Tailwind 生成管线，B17 持续繁殖（部分修复 + 门禁落地）
- 根因确认：main.css 是 2026-09-22 的编译产物静态转储（4577 行），无 tailwind.config、
  无构建步——之后新增的任何工具类静默失效。B17 修的 2 例只是当时 grep 到的；本轮
  全量扫描（ghostClasses.test.ts 门禁）实测 **154 个**「模板在用、事实源没有」的类
- 比审计更重的发现：`/NN` 透明度颜色变体（bg-brand-500/10 等约 17 个、90 处使用）
  **全应用裸奔**——dump 只编译过实色族；另有番茄钟统计面板/任务抽屉（stats-/export-/
  summary-/timeline-/drawer- 前缀族）、FocusShield（shield- 族）、Markdown 呈现
  （markdown-/presentation-/controls- 族）等**整族样式在重建事故中丢失**（组件按当前
  DOM 裸奔，与 B23 截图页 demo 化同源的重建损伤）
- 本轮已修：
  - UModal `max-h-[70vh]` 幽灵 → 内联样式（长内容弹窗 footer 被顶出屏幕且不可滚，
    全应用二次确认都走它，功能性坏死）
  - `text-fg-faint`（token 族里没有 faint）11 处 → 既有的 `text-fg-tertiary`
  - recovered-css-gap.css B34 批量补口约 73 类：间距/尺寸集（pb-2、max-h-56、min-w-44、
    space-y-1.5、ring-2 等）、brand 透明度全族（color-mix 随主题）、语义色/中性色透明度、
    任意值类（逐字符反斜杠转义，与门禁转义器同口径）——取值全部按 Tailwind 标度与
    dump 既有同族规则推导，注释注明依据
  - 门禁落地：ghostClasses.test.ts——静态扫描全部 .vue 的 class/:class 字面量，逐 token
    `.` 锚定查证于 main.css + gap 文件 + 全部 SFC style + remixicon；基线 80 条受控
    存量（重建丢失的组件样式族，待清台账）；新幽灵即红；哨兵断言防扫描器自身退化
- 遗留：基线 80 条 = 需要按设计重建的整族样式（约 6 个组件群），见 B39 排期

### B35 插件作者 0→1 面三连坑（2026-09-29 审计发现 → 同日已修）
- quickfolders（内置 21 插件里唯一重度用 db 的，恰是作者示范位）：
  ① db.get 包络误判——`Array.isArray(stored)` 判的是 {id,data} 包络恒 false，每次打开
  都用默认目录覆盖写回，用户添加的目录全丢；② `process.env.HOME` 在 sandbox 插件页
  主世界无 process，可能整页白屏。修复：读 `stored.data`；去 process 依赖（`~/` 由宿主
  safeOpenablePath 统一展开，见 B32）；manifest 补 defaultFolders 偏好声明（此前读的是
  未声明偏好必回失败），版本 1.0.1→1.0.2 并同步 plugins.json（pluginManifestAudit 钉住）
- 官方示例教错 alert：example-plugin 传 `actions:['好','算了']`（字符串数组），宿主清洗要求
  `{id,title,style?}` 字符串全被剔除 → 按示例写永远收不到动作 id。修复：示例改对象形状；
  launcher-api.d.ts 同步（alert actions、schedule.list 返回数组、schedule.add 返回 {ok,id?}、
  db.get 包络 {id,data} 无 updatedAt——四处与实现对齐）
- 「调试」按钮不存在：PLUGIN_DEV.md:362-366 承诺的调试入口渲染端零调用（主进程
  pluginDevtools 链路 2026-09-23 就绪，只差 UI）。修复：插件管理页补「调试」按钮——
  视图已开直接挂 DevTools，未开先跑首个命令再退避重试挂载（兑现文档承诺行为）

## 2026-09-29 发现（挂账，未修）

### B36 菜单栏项搜索的「前台应用」永远是 Frond 自己（1d53913 新落地功能实锤坏死 → 同日已修）
- 机制：MenuBarPage 挂载即 refresh，此刻胶囊窗持有焦点；menuBarLogic 的 list/click 脚本
  都取 `first application process whose frontmost is true`——查到的永远是 Frond。
  项目自己的 frontmostCache.ts:5-7 早就记载过这个语义坑；commit 自述点击动作真机未跑
- 影响：用户搜到并触发的只是 Frond 自己的菜单栏项，永远触达不到目标应用；极端情况下
  会对 Frond 自身菜单执行 click（如「隐藏/退出」）
- 修复：list/click 脚本支持按 `unix id` 寻址；pid 快照复用 frontmostCache 的「隐藏期
  轮询」机制并扩展缓存 {name, pid}，胶囊真 hide 后 600ms 补拍一拍（压掉轮询最长 5s
  的陈旧窗口）；trigger 用「列表所属应用的 pid」而非执行时刻 frontmost——列表与点击
  之间切走应用也不再误点（顺带修掉缓存跨应用切换隐患）；in-flight list 去重（关页再开
  页不再并发第二个深遍历）。无快照（首启/缓存未热）回退旧 frontmost 行为
- 【未跑】真机验证（需辅助功能授权 + 真实多应用切换场景），与 1d53913 一直欠着的
  真机轮一起补

### B37 ClipService 导出分辨率语义写反：720p/4K 必败，其余档位尺寸与标签不符（→ 同日已修）
- 位置：ClipService.ts:474 把枚举值当**宽度**：`-s ${resolution}x${resolution*9/16}`，
  UI 选项「1280×720 / 1920×1080 / 2560×1440 / 3840×2160」（value 720/1080/1440/2160）。
  720→720x405（奇数高，libx264 yuv420p 拒绝）、2160→2160x1215 同败；1080/1440 能出片
  但尺寸与标签不符且非 16:9 源被硬拉变形
- 修复：参数构建提为模块级纯函数 buildClipFinalExportArgs（同 RecordingExportService
  可单测先例），`-s WxH` 改 `-vf scale=-2:H`（保源宽高比 + 宽度偶数化）；有 BGM 时
  -vf 与 -filter_complex 互斥，缩放并入 filter_complex 首段并映射 [0v]。
  回归钉 clipExportArgs.test.ts 三条（无 BGM / 4K 档 / BGM 互斥）

### B38 dataSync/cloudBackup 域遗留三件
- 墓碑不过网（sync_state 刻意不同步）：删除传播靠「远端缺席」推断，B33 只堵了误删口，
  正向的删除语义在双端并发删改时仍靠 conflict 副本兜底；修法 = bundle 携带墓碑段
- 半失败态：pushDataSync bundle 上传成功但 latest.json 失败 → exportedAt 不前移，
  其他设备永不拉；修法 = 上传顺序补偿或远端保留 N 版
- dataSync 的 WebDAV 调用全部没包超时（dataSync.ts，对照 sync.ts 的 withTimeout 注释
  「所有 WebDAV 请求包一层」）——网络挂起时同步 IPC 永不 resolve，按钮永久转圈

### B39 重建丢失的组件样式族（B34 基线 80 条，需按设计重建）
- 六个组件群：FocusShield（shield- 8 类）、Markdown 呈现双件（markdown-/presentation-/
  controls-/preview-/code-block 等 15 类）、番茄钟统计面板（stats-/export-/range-/dual-grid
  等 12 类）、任务抽屉（summary-/timeline-/drawer-/action-/hint- 等 25 类）、胶囊内联页
  （dict-content/system-info-content/kp-list/mb-list/ws-list/sched-group 等 8 类）、
  Onboarding/杂项（frond-onboarding/z-modal/snippets-main/app-scroll 等）
- 性质：2026-09-22 重建事故的隐性损伤（与 B23 同源），组件 DOM 在、样式没恢复，
  用户看到的是无样式的裸结构
- 修法：按 DESIGN_TOKENS + 同期截图逐群重建；每清一群从 ghostClasses BASELINE 删除

### B40 安全域挂账（本轮未修，均为被攻陷渲染进程假设下的纵深项）
- mcp:setServers 接受渲染端 command/args 并 spawn：store.ts:6「command 不进渲染端」的
  书面不变量被 setServers 打穿（sanitize 只挡空格/换行，`/bin/sh`+`-c` 形态可过）；
  修法 = 差分确认（复用 pluginConfirm 系统模态）或 command 写入权收回主进程
- AI 端点守卫 check-then-fetch 无 DNS 钉住：守卫过即裸 fetch，连接层重新解析可被
  rebinding 打内网/云元数据（带 Bearer）；修法 = AI 三处 fetch 换 pinningAgentSelector()
  （插件代理已有现成件）。与 B25（fake-ip fail-closed）同域，可一次改
- TrashService.emptyTrash/listTrash 主进程同步 rmSync/statSync：回收站上 GB 时冻结全部
  IPC 数十秒到分钟级；修法 = fs.promises + 进度可取消
- BrowserTabsService.activateTab 渲染端数字裸拼 AppleScript（需 Number.isInteger 校验）；
  removePlugin 未过 isValidPluginId（`../..` 可递归删任意目录）；卸载不清 prefs.* 命名空间
  （旧 API key 重装复活）；recording-history:generateThumbnail 之外的三个修复注记见 B32
- 迁移失败后半开句柄复用（database.ts:60-67，this.db 先赋值后迁移，失败不回滚）：
  应用带伤运行无日志；electron-store 损坏 JSON = 启动炸裂（conf 10 clearInvalidConfig=false）
  且 recordingSettings.ts:33-38 的「降级实例」super() 打开同一坏文件必二次抛错

### B41 性能挂账（量级触发点见审计记录）
- ClipboardHistoryService.persist 每条新条目全量重加密+重序列化+同步写盘（贴过 5MB 文本
  后每次 ⌘C 卡顿）；大图驻留时每秒全尺寸 readImage 做指纹
- 片段搜索全表解密（SnippetRepository.search，千条级每键数十 ms）
- LogService 每写一条跑一次 5000 行裁剪 DELETE（日志风暴时放大）
- useStreamManager：cleanup 与建流竞态（卸载后 rAF 循环复活/屏幕流无人释放）、
  micExtraStreams 只进不出（关麦克风后系统指示灯常亮）、document.hidden 时合成录制出静帧
- video:readFile 兜底通道仍是整文件进内存（B32 已加 128MB 闸）；PlaybackPanel 应改走
  video:// 流式（ClipEditor 已是）
- 其他：热键互斥检测缺失、⌘⇧M 游离热键体系外、enrichAliases 重复 append、
  WindowSwitcher/KillProcess 空列表 NaN（MenuBarPage 修了没同步两页）、窗口 id 非唯一、
  AutoUpdate 预发布版本 NaN、AI Key/WebDAV 口令解密后明文回传渲染端、CSV 不转义、
  ReminderService uncomplete 不清 notified_at（重启后永不再通知）

## 2026-09-29 修复注记 · 二（B38/B40/B41 部分清账）
- B40 已修五件半：removePlugin 过 isValidPluginId（`../..` 递归删任意目录的口封死，
  pluginStore 层守、IPC try/catch 兜）；activateTab 的 windowId/tabIndex 卡正整数
  （裸拼 AppleScript 的注入面）；数据库迁移失败关句柄+置空重开（半迁移库不再被幂等
  短路复用——应用从「带伤运行无日志」变回「显式失败」）；TrashService list/empty 全部
  改 fs.promises（上 GB 回收站/万条目不再冻结主进程全部 IPC）；AI 三处 fetch 与
  favicon 换 node-fetch v2 + pinningAgentSelector——**全局 undici fetch 会静默忽略
  agent 选项**，此前 AI 通道的 DNS 钉住根本没有生效面；favicon 顺带修掉 redirect:'error'
  死代码（3xx 直接 reject，逐跳复检永远走不到），改 'manual' 让手工跳转真正生效
  。AI 流式 reader 经 Readable.toWeb 适配（消费形态不变）；【未跑】AI 真机冒烟
  （域冻结中，下次 AI 解冻轮补）
- B38 部分已修：dataSync 全部 WebDAV 调用包 withTimeout（挂起不再永久转圈）；
  墓碑段与半失败态仍挂账
- B41 已修一件：LogService 裁剪按每 100 条节流（原每条一次 5000 行 DELETE，
  日志风暴时放大风暴）；其余（剪贴板全量重加密、片段全表解密、useStreamManager
  三竞态等）仍挂账
- B40 仍挂账：mcp:setServers 确认闸（差分确认复用 pluginConfirm）——动 UX，待拍板

## 2026-09-29 修复注记 · 三（B41 再清一批）
- useStreamManager 三竞态：①micExtraStreams 只进不出（关麦克风后系统指示灯
  常亮）折回 releaseCachedAudio 统一释放；②cleanup × ready-wait 竞态致 rAF
  循环复活——combineStreams 加代际号，stale 即作废；③后台 rAF 停摆致合成录制
  出静帧——visibilitychange 驱动双通道调度（可见 rAF / 隐藏 setTimeout 500ms），
  拆除统一走 stopDrawLoop
- ClipboardHistory：高频路径 persist 改 300ms 尾随防抖（will-quit flush 兜底）
  + 单条文本 512K 字符上限；大图驻留每秒全尺寸 readImage 指纹一项仍挂账
- ReminderService.uncomplete 补 resetNotified；MarkerService CSV 标准 "" 转义；
  WindowSwitcher/KillProcess 两页补空列表 NaN 守卫

## 2026-09-29 修复注记 · 四（B39 清账完成：基线 80→0）
四批按 v4 事实源重建全部丢失样式族（每批带门禁划账）：
- 第一批（19 条）：FocusShield 内层（自持深色板 + --brand 兜底）、胶囊内联页六页
  内容容器（dict-content/system-info-content/mb-list/ws-list/kp-list/sched-group）、
  日历 has-reminder、FocusAssets 最长纪录档、Onboarding 层级（z-modal 死类摘除）；
  app-scroll/snippets-main 认定 JS 标记类进 ALLOWLIST
- 第二批（16 条）：Markdown 排版进 gap 全局段（v-html 内容 scoped 管不到——
  h1-6/列表/引用/行内码/代码块/表格/链接全族 + external ↗ + CodeMirror 容器）；
  MarkdownPresentation 全新演示壳（fixed/控制条/页码/缩放）；Preview 工具条补齐
- 第三批（13 条）：番茄钟统计面板壳层（分段式区间切换/导出工具条/spinner/
  dual-grid 双列图卡），token 对齐 TrendChart 兄弟口径
- 第四批（30 条）：任务抽屉内容层（优先级色条/摘要网格含超预估红调/操作行/
  时间线按 record.type 映射 --pomo-work/short/long/引导虚线卡/自由番茄区）
- 门禁基线注释改记机制（空集待用）；划账提示逻辑修正为「样式已补上或不再使用」
- 【未跑】重建样式的真机目检（九个组件群的观感核对）——静态门禁只能证明
  「类有定义」，视觉是否到位需要一轮过一遍；e2e 不覆盖视觉

## 2026-09-29 修复注记 · 五（交互决策四项落地，B40 清账完毕）
用户拍板的四个方案当日落地（回归门禁 139 文件 / 1122 用例全绿）：
- 热键互斥「保存时拒绝」：findHotkeyConflict 纯函数（hotkeyConflicts.ts）做
  setMain/setScreenshot/setCommand 前置校验，撞主热键/截图热键/⌘⇧M 直接拒并
  提示换一个；setCommand 契约补 ok:false 变体，设置页如实报冲突
- 片段搜索「明文搜索列」→ 登记为 B42（见上）：迁移 032 + search_text 投影列 +
  搜索下沉 SQL LIKE；隐私取舍（内容明文列在本地库）由用户拍板接受
- 凭证「脱敏回传」：syncGetConfig/ai:getConfig 回传掩码（值恒空 + has* 标记，
  预设逐个标注），写入端「留空 = 保持原值」、显式 clearPassword 才真清；
  syncTest 留空按已存口令连接；设置页占位「已保存（留空保持不变）」
- MCP「差分确认弹窗」：connectById 在当前配置哈希 ≠ mcp.confirmedServers 快照
  时弹系统模态列新增/移除/变更（含 command/args/env 值变化），默认拒绝，确认
  记账后走快路径；E2E 旁路与 pluginConfirm 同口径；纯逻辑 mcpConfirm.ts 可单测
- 【未跑】MCP 确认弹窗与脱敏表单的真机走查（设置页改配置 → 连接 → 弹窗 → 允许
  → 再连不弹；改口令留空保存 → 连接仍通）

## 2026-09-29 发现（用户实感 · 三）

### B43 Frond 启动后整台电脑键鼠发卡（用户报告 → 当日已修，实测归因）
- 现象：dev 启动 Frond 后全机卡顿；启动日志 10 秒内 10 条 `hook_event_proc: CGEventTap timeout!`
- 归因链（代码侧取证 + 重启采样实证）：
  ① `textExpansion.start()` 只要开关 enabled 就订阅 globalKeyHook——uiohook 的
  CGEventTap 覆盖键盘+鼠标移动**全套**系统事件（uiohook-napi 默认全事件 mask，
  每次鼠标移动都跨 N-API 进主进程 emit）；② 本机用户库实况：扩展开关开着
  （sys.expansion:config = {"enabled":true}）但带触发词的片段 0 条——常驻 tap
  纯付房租零收益；③ 主进程被拖慢（dev 模式 + 无障碍树常开等）→ tap 回调超时
  → macOS 对超时的活动 tap 限流**全系统**输入 → 全机键鼠发卡
- 修复：applyConfig 改「enabled 且确有触发词」才订阅（前置 loadTriggers）；
  invalidateTriggers 在片段增删改时重评估（跨 0↔N 边界自动订阅/退订）；
  ExpansionBuffer 补 hasTriggers()。重启实证：CGEventTap 超时 0 次、uiohook
  未加载、主进程 CPU idle；订阅状态机回归钉四条
- 附带发现：globalKeys.ts 的 maybeStop/ensureStarted 交错有「新监听器全聋」窗口
  （2026-09-29 审计 P2 项），与本文无因果但同属全局钩子域，仍挂账
- 【未跑】用户侧确认：装新版本后正常使用一段时间验证卡顿消失（机器级体感只能用户判）

## 2026-09-29 重塑并账（外部评审 P 编号体系并入，此后 B 编号为唯一挂账源）

> 背景：2026-09-29「demo→大厂级重塑」阶段 1 审计对三套挂账口径做了合并核查
> （见 docs/REDESIGN_AUDIT_2026-09-29.md §6）。外部评审
> （.workbuddy-ai/review/2026-09-23-consolidated-review.md）13 条中 11 条已修复或被
> 2026-09-24 校订证伪（P0-1 门禁缓存化、P0-4 env 顶层、P1-1 锁版本+守卫、P1-2 权限
> handler、P1-4 typedHandle 全量、P1-5 db 测试、P1-6 打包件、P1-8 CI 去重、P1-9 trace 等，
> 均已逐条到代码核实）。开着的两条以 B 编号入账如下，**P 编号体系自此退役**。

### B44 重建件渲染面 UI 行为断言缺失（原评审 P1-3「依然成立」部分）
- 现状：录屏剪辑数据链路已有 e2e，但渲染件本身的 UI 断言（时间轴非空、导出对话框
  默认参数正确等）仍未补；重建件密度最高的视图层验证最薄
- 关联：C-代码-05（六个千行文件零直接测试）、C-代码-06（e2e 零覆盖界面恰在重塑动线）
- 计划：重塑批 7 落地（先补网后动刀原则）
- 【未修】

### B45 恢复工具链健康度待核（原评审 P1-7，未复核）
- 现状：评审称「恢复工具链里有一条已经死了，而它被文档列为权威口径」，2026-09-24
  校订未覆盖此条，本次审计未复核（scripts/recovery/ 存在，逐条可用性未验证）
- 计划：重塑批 0 顺手核（低优先）
- 【未修】【待核】

## 2026-09-30 发现（重塑批 2a 弹量实测）

### B46 Repository 类型化战役：no-unsafe-* 家族 2,447 条（type-aware 层启用的前置）
- 实测：recommendedTypeChecked 全量跑（2026-09-30，审计配置），no-unsafe-call 1,057 /
  no-unsafe-member-access 990 / no-unsafe-assignment 320 / no-unsafe-return 46 /
  no-unsafe-argument 34，合计 2,447 条
- 根因：better-sqlite3 的 .get()/.all() 返回 any/unknown 行，全仓 11 个 Repository
  （SnippetRepository 144 / PomodoroRepository 141 / NotesRepository 87 / fileIndex/db 79…）
  及消费链整体无类型
- 修法：各 Repository 以泛型 `db.prepare<Row>().get/all` 或手写 Row 接口逐个类型化，
  随批 2c 启用 no-unsafe-* 为 error；启用前以 warn + 数量棘轮测试钉住「只减不增」
- 【未修】【重塑批 2c/7 推进】

## 2026-10-03 发现（全库调研：主进程 / 渲染端 / 横切 / 性能四路并行审计）

> 方法：4 路 Explore 并行扫描 + 对全部 P1 逐条到代码人工复核（行号均已核实）。
> 基线：typecheck 0 错；lint 在跑过 e2e 的本地会崩（见 B51）；e2e 101/101（前次）。

### B47 fileIndex watcher 启动竞态 + rearmOnce 裸奔（worker 可整体退出）【P1】【未修】
- ① 竞态：`service.ts:300-304` 的 `.then((stop) => { if (this.stopWatch) stop(); else this.stopWatch = stop })`
  条件写反——`stopWatcher()`（:313-315）先 stop 再把 stopWatch 置 null，故「启动期间被取消」
  与「从未启动」在 then 里同为 null，走 else 把**旧范围 watcher 收养为当前**；随后第二个
  pending watcher 的 then 见 stopWatch 非空，把**新范围 watcher 杀掉**。交错序列
  startWatcher#1 → stopWatcher → startWatcher#2 → then#1 收养旧 → then#2 杀新，改范围/
  重建/rearmOnce（:269-270 stop 后立即 start）叠加即可触达。修法：watch() 前捕获局部
  cancelled 标志，stopWatcher 置位，then 里按 cancelled 分流。
- ② 裸奔：`rearmOnce`（:244-272）由 setInterval `void this.rearmOnce()`（:233）驱动，
  `await fullScan(...)`（:258）无 try/catch，fullScan 末尾 buffer.flush 在 per-root catch
  之外（scanner.ts:188）；worker 未安装 unhandledRejection 处理器，DB/磁盘故障 =
  utilityProcess 退出 → 客户端退避重启 5 次后整体降级 mdfind（全库索引作废）。
  同文件 runFullScan/compensateMissed/flushPending 均有兜底，唯独 rearmOnce 漏。
- 关联：rebuild RPC 10s 超时 vs 分钟级扫描（client.ts:37 RPC_TIMEOUT_MS；worker 侧
  await 扫描完才回包）——管理页 10 秒后被告知成功、日志留假错误，用户再点一次会
  scanGeneration++ 打断后台仍在跑的那趟。修法：worker 侧 rebuild 立即回包、状态轮询。

### B48 录屏导出：activeExports 成功路径泄漏 + getInfo 探测口未挂白名单【P1/P2】【未修】
- 泄漏：`recording.ts:363` set 后，`.then` 成功分支（:394-424）从不 delete，仅 .catch
  （:428）与 cancel（:450）清——常驻进程每次成功导出泄漏一条 {AbortController, recordingId}。
- 探测口：`recording.export.getInfo`（:455-461）对任意 filePath 跑 ffmpeg probe，同文件
  generateThumbnail 有 isKnownRecordingPath 守卫、video:readFile/showInFolder 只认历史行，
  此条漏网（任意路径存在性/格式探测）。修法：同一守卫。

### B49 whenReady 回调无 catch 且 installDatabase 裸奔：迁移失败 = 半初始化僵尸【P2】【未修】
- `index.ts:280` `void app.whenReady().then(...)` 无 .catch；:295 `installDatabase()` 无
  try/catch（下方 runDataMigrations 反而有）。schema 迁移失败时 ensureOpen 刻意重抛
  （database.ts:81 防带伤运行），异常被全局兜底只写一行日志——应用活着但无窗口无托盘
  无 IPC。修法：whenReady 整体 try/catch + dialog.showErrorBox + app.exit(1)。

### B50 渲染端异步回调缺 seq/token 守卫（家族账）【P1】【未修】
- 已逐条证实：SnippetList.vue:98-123 loadSnippets 无请求序号（切文件夹/搜索时旧响应覆盖
  新结果，append 可拼进新列表尾）；PlaybackPanel.vue:212-269 watch(videoPath) 无 token
  （旧 readFile 回写覆盖新选，且可 revoke 掉正在播放的 blob URL → 黑屏）；
  FloatingNote.vue:95-107 selectNote 不 flush 800ms 防抖 saveTimer（:121-127）→ A 的最后
  一笔编辑静默丢失（真数据丢失）；useMarkers.ts:17-33 loadMarkers 无守卫，快速换片乱序回写。
- 相关已知：useUnifiedSearch.ts:232-239 清空查询不递增 token；useStreamManager.ts:219-245
  getScreenStream 并发泄漏屏幕捕获轨道。
- 修法方向：抽 useAsyncGuard（递增 seq + 过期丢弃）一次性收口，四处模式完全一致。

### B50a-c 渲染端三处独立小 bug【P2】【未修】
- a. useFolders.ts:31-37 「只拉一次」守卫 `let loaded = false` 写在函数体内，每次 setup
  重置——每次进页都重拉 getFolders+getFolderTree 两个 IPC，与注释意图相反。loaded 提模块级。
- b. useScreenRecorder.ts:32,58-60 `loading` 声明后从未置 true，启动无防重入：
  RecordPage.vue:456-586 长异步链（设置读取+combineStreams 最长 10s ready-wait+200ms sleep）
  内二次触发，epoch 作废路径返回已 stop 的轨道，可录出空/坏文件。入口加同步 starting 标志。
- c. useEditor.ts:23-30 loadSettings 的 Object.assign 触发 9 个 watch → 防抖后把刚读到的
  值原样写回（每次挂载多一次 IPC 写）。加 isLoading 标志，watcher 内跳过。

### B51 lint 门禁在 e2e 过的本地必崩【P1（工程门禁）】【未修】
- eslint.config.mjs:14 ignores 缺 `test-results/**`：跑过 e2e 后该目录下第三方插件模板
  （com.frond.example-react/src/main.tsx 等）被 typed-lint 规则扫到 →
  `pnpm lint` exit 2（Error while loading rule '@typescript-eslint/await-thenable'）。
  CI fresh clone 不复现，本地跑完 e2e 必踩。修法：ignores 补 `test-results/**`（连同
  `playwright-report/**` 如有）。

### B52 渲染端日志通道缺失 + comment-only catch 残余【P2】【未修】
- 渲染端 172 处裸 console.*（约 50 文件）全部蒸发：preload 的 log 命名空间只有
  export/getMode/setMode（preload/index.ts:442-445），无 renderer→main 转发，主进程
  LogService 环形缓冲+导出对渲染端不可见。修法：补一条 log IPC + console 桥接。
- 批 7b 只清了 main：renderer 域 74 处「仅注释、连默认值都不赋」的 catch（热点
  SettingsView.vue 6 处裸 /* ignore */、AIChatPage 8、launcher/index 7）——升 log.debug
  与 main 口径对齐（AI 域冻结部分可缓）。

### B53 性能优化账（按性价比排序，均有代码证据）【未修】
1. 应用索引零磁盘持久化：每次冷启动 5-15s system_profiler（applications.ts:607-651），
   胶囊内应用行每次启动都「5-15s 后才可搜」→ 持久化 + stale-while-revalidate
2. 剪贴板 poll 每秒无条件 spawn osascript 查前台应用（ClipboardHistoryService.ts:444），
   指纹没变也查 → 先比对指纹、变了才查（省 ~8.6 万次/天子进程）
3. 根搜索每击键全量拉剪贴板历史（200 条含全文，单条上限 512KB）+ 全库片段（含逐行 AES
   解密全部命中行，无 LIMIT）（useUnifiedSearch.ts:68,110；SnippetRepository.ts:237,253-258）
   → 主进程侧过滤 + LIMIT 3 + 不投影 contents
4. 文件搜索零结果才串行回退 mdfind（fileSearch.ts:184→203），自家实测短查询 450-540ms
   → 索引与 mdfind 并行发起，命中即弃后者
5. DB ≥50MB 后每次启动整库 copyFileSync+quick_check 无任何节流（database.ts:59,87-119）
   → 按时间/版本节流，挪到 whenReady 后 idle 时点
6. 胶囊启动关键图含 sanitize-html 378KB（DetailPanel.vue:9 静态 import）+ pinyin-pro
   452KB（enrichAliases onMounted 即触发，useCommandSources.ts:71-89）→ 动态 import/延后
7. scanner.ts:233,244 rescanDir 子项比对 O(N²)（循环内 dbChildren.find）→ 建 Map，5 行改
8. notes:list 全量返回正文（NotesRepository.ts:142 SELECT *）+ 每次防抖保存后全列表重拉
   重渲（NotesPage.vue:257-271）→ 列表投影掉 content + 保存后原地更新该行
9. 主窗口启动即创建隐藏常驻（index.ts:488），首屏交互只在胶囊窗 → 惰性建窗省 ~80-150MB
   （代价中高，核对所有直接持 mainWindow 的路径，建议后置）
10. scanner.ts:175 全量扫描逐目录 markDir 独立事务（10 万+ 次）→ 并入 RowBuffer 批事务
11. LogService.ts:134-137 每条日志同步 prepare+run 无语句缓存 → stmt 缓存 + 批量落库
12. fileSearch.ts:180 每查询无条件 ensureStarted 且 client 无「已启动」短路 = 每查询 2 条
    RPC（client.ts:166-173）→ 已启动即短路

### B54 散装弹层 a11y/交互一致性（家族账）【P2】【未修】
- CommandPalette.vue:176-206：无 role=dialog/aria-modal，Tab 可走进背景页面
- SnippetList.vue:372-454 与 Editor.vue:664-681 两处自建右键菜单：无 Esc 关闭、无
  role=menu、fixed+clientX 定位无视口翻转（靠右/下缘被裁剪）——UDropdown 的
  computePlacement 没有复用
- pomodoro/index.vue:204-245 两个声景/特殊休息浮层：无外点关闭无 Esc，
  :817-828 onDocumentClick 是明确 no-op 存根却仍挂摘 document 捕获监听
- 修法方向：抽 useDismissablePopup（Esc + 外点 + 焦点陷阱 + 视口翻转）与 B50 的
  useAsyncGuard 同批收口

### 旧账核销与再确认（2026-10-03）
- **B45 划账**：scripts/recovery/ 5 脚本全在，4 个可执行脚本实测 exit 0
  （snapshot-readings 441 源文件/156 测试/34 迁移/433 IPC 通道；scan-vue-imports 0 缺；
  scan-main-imports 剩 1 条 ?asset 已记录；scan-doc-citations exit 0），文档引用路径
  逐一比对全部对得上，恢复工具链健康，本条目过时。HANDOFF.md「剩下的账」四条过期
  （entitlements 四件套已在/release:preflight 已接 package.json:34/根 LICENSE 已在/
  三杂文件已不在 git），仅「docs/modules/INDEX.md 缺」一条仍成立。
- **B41 再确认（均未恶化）**：剪贴板大图驻留期间每秒全量 readImage 仍在
  （ClipboardHistoryService.ts:472-474，指纹侧已缩略图化属半改善）；WindowSwitcher
  id `${appName}-${pid}-${title}` 同名窗口必撞（WindowSwitcherService.ts:75）仍在。
- **globalKeys 全聋窗口仍在**：ensureStarted（globalKeys.ts:66-76）只单飞并发 start，
  无 pending-stop 串行化，stop 进行期间新订阅者聋到下次重订。
- 横切面健康：src 内 TODO/FIXME 0 条（挂账全部集中本文件）；@ts-ignore 全仓 2 处；
  eslint-disable 14 处全部带理由；no-floating-promises 已是 error 门禁且 0 豁免。

### 2026-10-03 批6 修复核销（当晚，8 commit）
- **B51 已修**（5425cbf）：ignores 补 test-results/playwright-report；顺带清掉被崩溃
  掩盖的 watcher.ts floating promise。lint 实证 0 error。
- **B47 已修**（73a3127 + 728ab5f）：watcher 启动竞态改「轮次」判定；rearmOnce
  try/catch 记账下轮重试、账单补扫成功后才移出；rebuild 专用 30min 超时。
  回归钉四条（service.test.ts + rpc.test.ts）。
- **B48 已修**（e04ba7a）：activeExports 成功路径补 delete；getInfo + export.start
  sourcePath 挂录制历史白名单（RecordingRepository.findByFilePath 新增）。回归钉四条。
- **B49 已修**（becd9ee）：whenReady 链尾 .catch + showErrorBox + app.exit(1)。
- **B50/B50a-c 已修**（ee2c7e0）：useAsyncGuard 原语 + 四处迁移（SnippetList/
  PlaybackPanel/useMarkers/useUnifiedSearch 清空）；FloatingNote 切换前 flush 防抖；
  useFolders 守卫提模块级；录屏启动 claimRecordingStart 防重入闸；useEditor 加载挂闸；
  getScreenStream epoch 收 video 轨。回归钉 9 条，四个组件级用例先 RED 实证后修。
- **B53-7 已修**（9758158）：rescanDir 子项比对 O(N²)→Map。**B53-12 已修**（728ab5f）：
  ensureStarted worker 存活即短路。
- 未动：B52（渲染端日志通道）、B54（散装弹层 a11y）、B53-1~6/8~11（性能账大件）——
  留下批按性价比推进。
### 2026-10-03 批7 修复核销（同晚，2 commit）
- **B52 已修**（b5b8ffc）：log:add 主进程 handler（四级别路由+未知级别拒绝）+
  preload 暴露 + consoleBridge（console 五方法 → 主进程 LogService 环形缓冲；
  5s/40 条限流、Error 序列化、幂等可摘），主应用+胶囊双入口接线——172 处既有
  console.* 从此随诊断包导出，不必逐点改写。comment-only catch 热点收口：
  SettingsView 7 处裸 /* ignore */ 与 router 引导态查询升 console.debug（经桥进通道；
  AI 域冻结部分按账缓办）。回归钉 7（logIpc 3 + consoleBridge 4）。
- **B54 已修**（f0a469a）：useFocusTrap（Tab 循环+焦点保存/归还，从 UModal/UDrawer
  手写陷阱提炼；UModal/UDrawer 本体暂不回迁——行为已被现有测试钉死，回迁留重构批）
  + useDismissablePopup（Esc+外点+ignore 开关按钮）；迁移 CommandPalette
  （role=dialog/aria-modal/焦点陷阱）、SnippetList 与 Editor 两处右键菜单
  （Esc/外点/role=menu/menuitem/视口钳制；Editor 手写监听机退役）、pomodoro 两浮层
  （外点+Esc；no-op onDocumentClick 存根移除）。回归钉 7（原语 6+ignore 1）。
- 门禁终态：typecheck 0；lint 0 error；unit 1258 passed（+14）；e2e 全量 100 过 +
  capsule-animation 1 条时序抖动（独立复跑 3/3 绿，同一文件套跑时 :90/:144 交替抖，
  与 B51 时代归因一致：负载敏感，非代码回归）。
### 2026-10-03 批8 修复核销（同晚，3 commit）
- **B53-2 已修**（f7ec359）：剪贴板 poll 指纹先行——内容不变不 spawn osascript
  （≈8.6 万次/天子进程消失）；屏蔽语义保持（P1-6），指纹记为已见与「同内容重复
  复制不重复入账」一致。回归钉三条。**注**：B41 的「大图驻留每秒 readImage」
  仍在（需 changeCount 级方案，独立于本条）。
- **B53-1 已修**（e3a4800）：应用索引落盘 userData/applications-cache.json +
  启动装载——应用行从「每次冷启动 5-15s system_profiler 后才可搜」降到 <100ms，
  过期走既有 stale-while-revalidate。回归钉六条（纯函数 load/save）。
- **B53-4 已修**（9f8f2e3）：文件搜索并行回退——mdfind 与索引同时起跑，
  延迟从串行之和降到 max（短查询 450-540ms 的等待大头吃掉）；NO_FALLBACK
  钩子纯索引口径不变。回归钉三条。
- **B53-5 已修**（9f8f2e3）：启动备份按 7 天节流（最新备份未满跳过整库拷贝 +
  quick_check；滚动 3 份历史仍在）。回归钉五条。
- 门禁终态：typecheck 0 / lint 0 error / unit 1275（批7 后 +17）/ file-index e2e 全绿。
### 2026-10-03 批9 修复核销（同晚，3 commit）——B53 全清
- **B53-3 已修**（260bc4e）：根搜索下沉——cliphist:search（主进程侧过滤+LIMIT 3+
  text 截 60 字符+files 只带 firstPath）+ snippet:quickSearch（LIMIT+只投影
  id/title/language，不做逐行 AES 解密）；每击键不再整包拉 200 条含 512KB 全文。
  回归钉 6（均先 RED）。
- **B53-6 已修**（9d4a270）：sanitize-html 378KB 动态 import 移出胶囊启动关键图
  （DetailPanel+PluginListPage 两处；异步渲染+轮次守卫+空闲预热）；pinyin-pro
  452KB 拼音 enrich 延到 requestIdleCallback（用户自定义别名仍即时）。实测：
  launcher.html 对 sanitize chunk 的引用归零。
- **B53-10/11 已修**（389e687）：dirs 水位行并入 RowBuffer 批事务（home 级全扫
  10 万+ autocommit 消失）；log_entries INSERT 语句缓存 + info 微批 25 条/事务、
  warn/error 即时落、退出前 flush。回归钉 5。
- 门禁终态：typecheck 0 / lint 0 error / unit 1286（批8 后 +11）/ **e2e 全量
  101/101 全绿**（含此前两个已知抖动位）。
### 2026-10-03 批10 修复核销（同晚，4 commit）
- **B41-2 已修**（c20d5d5 + 2990669）：窗口 id 去重（assignUniqueIds：重复窗口
  追加 #2/#3，回归钉 3）+ WindowInfo.occurrence → windows:activate 第 N 参 +
  AppleScript matchCount 精确 AXRaise 第 N 个同名窗口（渲染端已接线）。
- **B41-1 已修**（ee80cc3）：大图 readImage 轮询节流——Electron 无 changeCount，
  formats 签名变化立即重读、签名不变按 5s 节流（静态大图全量拷贝 1/s → ≤0.2/s，
  同格式换图入账延迟最坏 5s）。回归钉两条。**节流非根治**：真 changeCount 需
  原生依赖，1.0 内不做。
- **globalKeys 全聋窗口已修**（8bb1ec0）：start/stop 串行过单操作队列，到队首
  重查状态——①stop 在飞 + 新订阅不再误判已启动（新监听器不再全聋）；②start
  在飞期间订阅者全退订 → 完成后立即 stop（无人监听的系统级钩子不驻留）。
  回归钉三条（聋窗复现 / 不驻留 / 正常周期），textExpansion/hotkeys 域 141 用例全绿。
- 门禁终态：typecheck 0 / lint 0 error / unit 1294（批9 后 +8）/ e2e 全量 100 过 +
  a11y.spec:78 一条负载抖动（独立复跑 3/3 绿）。
### 2026-10-03 批11 修复核销（B46 战役开打，3 commit）
- **B46 棘轮落地**（4e3fce3）：scripts/unsafe-ratchet.mjs + lint-unsafe-baseline.json
  （2564 条基线，115 文件，按文件×规则计数，任何上涨 exit 1；`pnpm lint:ratchet`
  校验 / `--update` 钉新低 / `--report` 看分布）。**实测根源**：better-sqlite3 v13
  无 bundled types 且 @types 未跟进——TS 从 lib/*.js 推断，prepare/run/get/all 全 any。
- **战役核心件 typedSql**（40845a3）：裸转换全仓收口到一个文件（eslint 豁免 +
  理由 + 4 条行为测试：错误照抛/undefined/语句缓存/语句错用照抛），两种形态——
  prepareRun/Get/All 直调 + prepareStmt/runStmt/getStmt/allStmt 语句缓存 +
  sqlFacade（Repository 的 this.db 整体替换，链式写法保持，泛型在调用点标注）。
  首仓迁移 fileIndex/db.ts（84→0）。
- **NotesRepository**（832b288）：facade 化（87→0）。基线 2564 → 2414。
- 剩余 2414 条按分布推进（SnippetRepository 153 / PomodoroRepository 139 /
  dataSync.test 127 / preload 122 / RecordingRepository 69 / FolderRepository 67 …），
  棘轮保证只减不增；全部清零后可把 no-unsafe-* 升为 error（B46 完成判据）。
- 门禁终态：typecheck 0 / lint 0 error / unit 1298（批10 后 +4）/ 棘轮 2414。
### 2026-10-03 批12 推进核销（六仓 facade 化，1 commit）
- **B46 推进**（c735be1）：六仓 facade 化——SnippetRepository 153 / PomodoroRepository
  139 / RecordingRepository 69 / FolderRepository 67 / ReminderRepository 61 /
  TagRepository 44 全部归零；SqlDb.transaction 签名补参数透传（对齐
  better-sqlite3 泛型）。**棘轮 2414 → 1895（累计 2564 起净降 26%）**，
  单测 1298 全绿。
- 剩余大头：dataSync.test 127 / preload 122 / dataMigrations 63 / docStore 49 /
  database.ts 48 / ShotIndexRepository 47 / dataSync.ts 47 / MarkerRepository 49 /
  migrations 若干。facade+typedSql 模式已覆盖全部形态，逐文件机械推进即可。
### 2026-10-03 批13 修复核销（B46 关账，2 commit）
- **B46 完成**（6acd26a）：根源修复 = 项目内 better-sqlite3 ambient 声明
  （src/main/types/better-sqlite3.d.ts，形状按运行时实测；Result 默认 unknown，
  cast 合法不触发 no-unsafe）——**一次净降 1647 条**；typedSql 语句类型对齐真实
  Statement；ensureOpen 改返回非空句柄（真类型启用可空检查后暴露的窄化缺口，
  严格性收益）；Marker/ShotIndex 两仓 facade。**11 个 Repository + fileIndex db +
  database.ts 全部类型化——B46 字面范围完成**。棘轮 1895 → 248（自 2564 累计
  -90%），单测 1298 全绿。
- **新增 B55（承接 B46 残余）**：全仓 no-unsafe-* 清零并升 error——余 248 条
  （preload 122：桥接函数参数需逐通道从 ipc-contract 取型；dataMigrationsRecording
  22；其余为 renderer v-html/window API/marked 等 ≤10 条的散点，与 sqlite 无关）。
  棘轮脚本守门不变。
### 2026-10-04 批14 推进核销（B55 散点清零，1 commit）
- **B55 推进**（1961cff）：248 → 137——新增 sanitize-html / dom-to-image 两个
  项目内 ambient 声明（各消灭一簇 type-could-not-be-resolved 连带污染）；
  sanitize-html-wrapper 摘 @ts-ignore；dataMigrationsRecording `let db` 显式类型；
  15 处散点收口（ffmpeg require / statSync / JSON.parse 群 / AI 流 reader /
  axios 拦截器 / CodeMirror searchcursor / 事件形参）。单测 1298 全绿。
- **B55 余量 = preload/index.ts 122**（桥接函数参数逐通道从 ipc-contract 取型）
  + 15 条单点，棘轮守门不变。
### 2026-10-04 批15 修复核销（B55 关账，1 commit）
- **B55 完成**（3973577）：preload 122 条桥接参数全量类型化——TS 编译器 API
  codemod 两轮（86 个简写参数注解 `IpcRequest<'通道'>['字段']`；28 个整对象直通
  注解 `IpcRequest<'通道'>`）；`IpcRequestInput` 从 typedIpc 导出复用；渲染端 7 处
  「显式 undefined 属性」调用点按线格式语义收口（`Parameters<typeof window.api…>`
  断言，不引 main 类型，层次安全）；尾段 8 条清零（focus-shield:info 载荷收型、
  LauncherApp barHeight、themeFile String() 等）。
- **no-unsafe-* 五规则升为 error**（B55 完成判据）：eslint.config.mjs，any 再
  出现即编译期拦截；棘轮 2564→0，退位为 0 基线守门。
- 门禁终态：typecheck 0 / lint 0 error 0 unsafe / unit 1298 / e2e 全量 100 过 +
  a11y:78 一条负载抖动（独立复跑 3/3 绿）。
### 2026-10-04 批16 修复核销（B44 关账，1 commit）
- **B44 完成**（d0ed987）：重建件 UI 行为断言补网——RecordingSettingsDialog 4 条
  （打开装载持久化设置=「默认参数正确」判据、预设切换激活态迁移、save 载荷携带
  预设、取消只发 close 不发 save）+ MarkersPanel 5 条（recordingId 变化拉取渲染 +
  时间戳排序、跳转按钮发 jumpToMarker(timestamp)、删除走 useConfirm 二次确认后
  removeMarker(recordingId, markerId)、空态文案、导出触发 exportToCSV）。
  断言口径与 exportDialog.test 一致：盯事件与状态、不盯样式类名。
  录屏域 43 用例全绿，单测 1307（+9）。
- 覆盖剩余缺口：Layout / SourceSelector / ClipEditor / RecordPage 主体（动线骨架
  由 e2e 承接，单元层收益递减）——随重塑批 7 动刀前再按改动面补。
### 2026-10-04 批17（用户实测反馈：Home 页退役）
- **Home 落地页删除**（用户拍板「直接删掉」，Raycast 式）：/ 重定向 /settings；
  goHome 链路全清；⌘K 面板提升 App 层（/settings 无壳路由也要能用）；
  SettingsView 切「高级」页签刷新自动化列表（开机即挂 /settings 后插件后建任务
  的可见性修复——e2e plugin-schedule ③ 抓出）。单测 1307 / e2e 101 全绿。
- **B 系列活账清零。** 此后新问题走「发现即挂账」流程。- **B 系列活账清零。** 此后新问题走「发现即挂账」流程。- **B 系列活账只剩 B44**（重建件 UI 断言，随重塑批 7「先补网后动刀」落地）。- **B 系列活账**：B44（重塑批 7）、B55（仅剩 preload 主体 + 15 单点）。- **B 系列活账**：B44（重塑批 7）、B55（新开，见上）。- **B 系列活账只剩**：B44（重建件 UI 断言，重塑批 7 范围）；B46 转入战役推进
  （机制已立，机械推进）。- **B 系列活账只剩**：B44（重建件 UI 断言，重塑批 7 范围）；B46 转入战役推进
  （机制已立，机械推进）。- **B 系列活账只剩**：B44（重建件 UI 断言，重塑批 7 范围）、B46（Repository
  类型化 2447 条，重塑批 2c/7 范围）。- **B53 全清，B 系列活账只剩**：B41（剪贴板大图 readImage 需 changeCount 级方案、
  WindowSwitcher id）、B44（重建件 UI 断言）、B46（Repository 类型化 2447 条，
  重塑批 2c/7 推进）、globalKeys 全聋窗口（审计 P2）。- **B53 余账**：3 根搜索下沉 / 6 胶囊包体（sanitize-html 378KB + pinyin-pro 452KB）/
  8 notes 列表投影 / 9 惰性主窗（省 80-150MB，代价中高）/ 10 markDir 批事务 /
  11 LogService 批落。- **未动**：B53 性能账大件（1 应用索引持久化 / 2 剪贴板 osascript 前移 / 3 根搜索
  下沉 / 4 mdfind 并行 / 5 DB 备份节流 / 6 胶囊包体 / 8 notes 投影 / 9 惰性主窗 /
  10 markDir 批事务 / 11 LogService 批落）。
- 门禁终态：typecheck 0；lint 0 error；unit 1244 passed（+24）；e2e 全量 99 过 +
  capsule-animation / plugin-arg-slots 各 1 条时序抖动（已知负载敏感域，spec 头注
  明失败签名；独立/重跑均绿，file-index 全绿；当晚机器有 PyCase dev 全套 + ZCode
  会话两路额外负载）。

## 2026-10-04 发现（用户实测：代码片段模块专项，四路并行审计 24 条）

> 背景：用户保留片段模块（Raycast 无此形态），反馈「一堆 bug」。四路 Explore 并行
> （页面主链路 / 编辑器 / 主进程数据链路 / 胶囊与多窗一致性）+ 去重，B56 编号。
> 修复批建议顺序：B56-1（编辑器真相回流，消除两条 P0）→ B56-2/3/4 → P1 族 → P2 收尾。

### B56-1【P0】编辑器「编辑真相不回流」——contents 整体写回滚已落库编辑（数据丢失）
- 防抖 flush（useSnippetUpdate.ts:96-99）写库后不回写 props/父状态；Editor 的
  saveEditorContent/addContent/removeContent/updateLanguage 等（Editor.vue:793-810,422,449,502）
  构造 payload 时非当前 content 一律取旧 props 值 → 主进程全量 DELETE+INSERT
  （SnippetRepository.ts:383-400）把已落库的 tab A 编辑抹掉。
- 同根 P0：切 tab 回填走 props（Editor.vue:262-271,397-406），500ms 内切走切回
  输入消失，再敲键以旧值为基准覆盖 DB。
- 派生：复制按钮读 props 旧值（:557-564）100% 复制错内容；纯打字后列表预览/排序
  不更新（flush 不 emit）。修法：flush/saveEditorContent 完成后回写父状态，
  编辑器实时值作为唯一真相。

### B56-2【P0】收件箱过滤死参数——收件箱视图=全部视图
- SnippetList.vue:116 传 folderId: props.folderId ?? undefined（null→undefined），
  repo 门槛 folderId !== undefined 永假（SnippetRepository.ts:218-225），isInbox
  从未生效。模块默认视图就是收件箱（index.vue:10）——用户开门第一屏即错。
- 修法：库视图显式传 folderId: null；repo 层补组合集成测试。

### B56-3【P0】Sidebar 用 window.prompt 建/改名文件夹——Electron 直接抛异常
- Sidebar.vue:69,76。文件夹创建/重命名整体不可用（本仓其余处已 UModal 化，仅此漏网）。

### B56-4【P0】全 UI 无新建片段入口——空态引导「新建一个片段」但渲染端零调用 addSnippet
- 唯一调用方是 e2e 直调 API（snippets-crud.spec.mjs:108）。主链路断头。

### B56-5【P1 族】选中态无单一真相（六连）
- 右键收藏/移动不回写选中（SnippetList.vue:172-191）；恢复不清选中（:214-222）；
  切文件夹/筛选不清选中（:269-275）→ Editor 悬空显示；名称/描述 blur 无条件写库
  （Editor.vue:1011,1086→583-598）→ updatedAt 跳顶 + 选中弹回。

### B56-6【P1】防抖写队列三漏——关窗不 flush、失败静默、先出队后等结果
- useSnippetUpdate.ts:58-104：无 beforeunload flush（对照 NotesPage 有）；catch 仅
  console.warn；delete(key) 在 settle 之前。Cmd+Q 丢最后 500ms 编辑。

### B56-7【P1】标签功能死路——候选集恒空，加不了标签
- Editor.vue:623-631 候选=已挂标签；TagInput 再滤已选 → 恒空。全 renderer 无 addTag 调用。

### B56-8【P1】quickSearch 泄漏回收站片段进胶囊搜索
- SnippetRepository.ts:269-278 无 deleted_at 过滤（注释声称同口径不实——业务入口
  经 SnippetDataStore 强制 isDeleted:false，quickSearch 直连 repo 绕过）；
  actionHandlers.ts:125-130 执行端也不设防。

### B56-9【P1】文件夹双源真相——新建文件夹不进「移动到」菜单
- Sidebar 直连 IPC 只 emit 回父 props；SnippetList 读 useFolders 模块级闩锁
  （每会话只拉一次）；props.folders 声明后零读取。新建文件夹直到重启才出现在
  移动菜单/行内徽标。

### B56-10【P2 族】数据卫生四件
- duplicateSnippet 丢 contentType（rich 副本降级 text）与 trigger
  （SnippetRepository.ts:459-464）；硬删除不清 snip_tags 无外键 junction
  （:425,449）；updateSnippet 不同步遗留 content/language 列（:368-381，胶囊
  quickSearch 副标题语言过期）；listSnippets limit/offset 无运行时钳制（ipc/snippets.ts:25-27）。

### B56-11【P2 族】编辑器体验七件
- 删除重命名中 tab 不复位 editingTabIndex（错位到隔壁 tab）；tab 删除零确认不可恢复；
  保存失败零提示（六处仅 console.error）；代码预览/Markdown 切换不先保存（陈旧预览+
  旧值回填）；软删/收藏 bump updated_at 污染排序；列表无 ↑↓/Enter 键盘导航；
  错误态渲染成空态（catch 后 snippets=[]）。

### B56 修复核销（批20/21，两轮 3 commit）
- **批20**（1200d57）：P0×4 全修 + P1×8 + P2×7，共 19 条（详见上）。
- **批21**（1cfe1a8）：剩余 5 条全清——键盘导航（↑↓ 选择 Enter 复制，容器级监听）、
  触发词冲突检测（findTriggerConflict + Editor 提示）、updated_at 语义分离
  （归档动作不 bump，内容修改保留）、IPC 入参校验（白名单 + 验型 + isDeleted 强制）、
  snippets:changed 失效广播（全部变异通道推双窗，胶囊片段页订阅即时重拉）。
  **B56 全部 24 条清账**。回归钉：repo 10 + composable 5 + inbox/键盘 6 + IPC 校验随域。
- ⚠️ 全量 e2e 的 plugin-arg-slots 仍有轮转失败（本批跑两次各红一条不同用例）——
  已知负载敏感抖动位（见 memory），独立复跑各自绿。
- **B56-1 补刀**（4e66739）：e2e 实测发现终版守卫仍有缝隙——switchContent 的 flush
  里条目在广播后才出队，「队列有条目」守卫误判在途键入并吞掉同步 → 切 tab 回填
  旧空值。修正为「编辑器实时值 ≠ ack 回流值」对比（flush 快照后键入才跳过）。
  新增 e2e/snippets-ui.spec.mjs 五条真实 UI 链路验证（收件箱过滤/新建/切 tab 不丢/
  文件夹 UModal/键盘导航），CodeMirror 断言走 getValue 真值面。
- 门禁终态：typecheck 0 / lint 0（我的域）/ unit 1357 / e2e 片段域 13/13 全绿
  （UI 5 + CRUD 8）+ 全量 100 过 + 1 已知抖动。- ⚠️ 全量 e2e 的 plugin-arg-slots 仍有轮转失败（本批跑两次各红一条不同用例）——
  已知负载敏感抖动位（见 memory），独立复跑各自绿。### B56-12【P2 族】周边三件
- 胶囊 SnippetsPage 非 immediately 回根模式下陈旧数据（无失效广播）；
  触发词冲突无检测（命中方随 updatedAt 抖动，expansionBuffer.ts:95-107）；
  死代码（useSnippetViewModes/useSnippetSearchOverlay 零引用）与双关闭通道。

### 健康面（核实无误）
写链防抖+按片段串行+事务、分页排序稳定性、LIKE 转义、canMoveFolder 环检测、
加解密容错、invalidateTriggers 五通道覆盖、quickSearch 与主列表排序一致——均扎实。
病灶集中在「编辑真相不回流」与「契约两端语义漂移」两个系统性根因。

### B56 第一轮修复（1200d57，19 条落库）
- P0×4 全修：①编辑真相回流（onSnippetSynced 广播 + 结构操作/切 tab 前排空队列，
  useSnippetUpdate 5 钉 + Editor 订阅）；②收件箱显式 null（契约钉 3 条）；③prompt→UModal；
  ④新建片段按钮（创建即选中）。
- P1 修 8：quickSearch 排回收站（repo 2 钉）、选中态单一真相（回写/清空三口径）、
  blur 脏检查、flush-on-exit（卸载/失焦/隐藏 + 失败保留队列）、标签通道（全量候选 +
  新建行）、文件夹双源收口（Sidebar 同步共享 store）、复制实时值、列表预览经回流自愈。
- P2 修 7：duplicate contentType/trigger、legacy 列同步、snip_tags 清理、limit 钳制、
  tab 删除确认+索引复位、预览切换先落盘、错误态区分、胶囊片段页唤起重拉、死代码清理。
- **B56 剩余**：列表键盘导航、触发词冲突检测、updated_at 语义分离、snippet:* 入参校验、
  胶囊 SnippetsPage 失效广播的规范化（focus 重拉为过渡方案）。
- ⚠️ 本轮与**并行会话的 B57（录屏专项）**同仓并行：各自文件不重叠，全量门禁暂被
  B57 的 RED 测试占用（screenRecorderPermission/chunkFlush），B56 域测试全绿
  （repo 6 + composable 5 + inbox 3 + snippets 域 41）。病灶集中在「编辑真相不回流」与「契约两端语义漂移」两个系统性根因。

## 2026-10-04 发现（用户实测：录屏模块专项，四路并行审计）

> 背景：用户反馈「录屏的功能一堆的 bug」。三路并行（核心状态机自查 + 主进程
> services/ipc 全量 + 渲染层页面组件全量）+ 单测基线确认（录屏相关 4 文件 13 测试
> 全绿 → 下列全部处于测试盲区），B57 编号。
> **修复进展（2026-10-04 同日）**：B57-5 ✅（丢尾竞态 → 在途链确定性收尾 + draining
> 直写 + 会话复位，附带修掉跨会话缓冲污染；useScreenRecorder.chunkFlush.test.ts 2 钉）；
> B57-10 ✅（预览产物 openPath 打开 + 防重入 + toast；跳转录制中隐藏入口、无视频时
> toast 指引；clipEditor.preview 2 钉 + markersPanel 2 钉）；B57-12 部分 ✅（win32
> 误开麦克风设置页 → openPermissionSettingsOutcome 平台分支纯函数，不再打开无关
> 面板；screenRecorderPermission 2 钉。kiosk 跨屏与混合 DPI 待真机验证后修）。
> **P1 管线切换落地（同日，RECORDING_MEDIABUNNY_DESIGN.md §7.2）**：新模块
> useRecordingPipeline.ts（WebCodecs/Mediabunny fMP4 引擎，engine 特性开关默认关），
> 门面 useScreenRecorder 经 PipelineHost 委托（体量棘轮拆分 1100→731 行）；
> settings.engine + 路径签发扩展名参数；设置对话框「录制引擎」开关；管线回归钉 6 条
> （pipeline.test.ts），全量 1342 测试/typecheck/lint 绿。核销映射：P1 真机回归后 →
> B57-5（新引擎无自研攒批）+ B57-2 前半（管线时长单一真相）。
> **P2 恢复重写落地（同日，设计文档 §7.3）**：RecoveryManager 按 D4 重写——scan 主源
> 改 DB 孤儿行（status recording/paused 且文件存在，webm/mp4 通吃；.partial.mp4 目录
> 扫描降为历史兜底）；recover 改 fMP4 box 边界扫描 + 原地截断（不 rename，消灭静默
> 覆盖 P0-1；先文件后 DB，消灭「文件消失」P0-2）；discard 改行级精确删除
> （recordingId/精确路径，消灭 basename 跨目录误删 P0-4）；findMp4RecoveryPoint
> 纯函数可测、GB 级文件 O(片段数) 次读。集成钉 15 条（真实 sqlite + 临时目录 +
> fMP4 夹具），全量 1357 测试/typecheck/lint 绿。**B57-1 核销**（kill -9 真机演练
> 归入 P1 真机回归批）。
> **P3 清理落地（同日，设计文档 §7.4）**：B57-4 全链封死（ensureExtension 绕过 +
> intro/outro/BGM 输入白名单）；B57-14 契约收敛（deleteFile 兑现、addHistory 白名单
> 跟随引擎 webm/mp4/gif、beginWrite res.path 删除、getInfo 收敛、region 取消转
> {canceled:true} + 补 scaleFactor、数值运行时校验）。新增 9 钉，全量 1366 测试绿。
> **B57-4 核销、B57-14 核销**。B57-8 中 endWrite 失败 revoke 缺口仍在旧引擎路径
> （待旧引擎退役批处理）；转码链保留至旧引擎退役（双轨现实的诚实修订），
> Conversion API 评估结论=剪辑转码暂不换。
> **第三批修复（同日，TDD 11 钉，全量 1377 测试/typecheck/lint 绿）**：
> B57-3 ✅（closeCamera 只停视频轨+音轨 removeTrack 摘除、combineStreams 按
> readyState 检查存活并重装死轨；useStreamManager.audio.test.ts 2 钉）；
> B57-2 后半 ✅（recording.finalize 时长单一真相 = segments 聚合优先，渲染端自报
> 仅作无段兜底，file_size 以磁盘 statSync 为准；recordingDelete.test.ts 2 钉）；
> B57-9 ✅（repo.open 前自动收口该录制全部遗留 open 段，任一时刻至多一个 open，
> totalDurationMs 不再随挂机虚增；SegmentService.dedup.test.ts 4 钉真实 sqlite）；
> B57-7 ✅（useMarkers 按 recordingId 键控单例 store，回放页时间轴与标记面板共享
> 单一真相；useMarkers.singleton.test.ts 3 钉；B50 乱序防护用例迁移到新契约：
> 视图跟随 recordingId，守卫意图不变）。
> **第四批修复（同日，TDD 10 钉，全量 1387 测试/typecheck/lint 绿）**：
> B57-6 ✅（最后一个 P1）——录制动作从 RecordPage 组件闭包提取到模块级控制器
> recordingActions.ts（依赖的单例 composables 注入，快捷键响应与组件生命周期解耦），
> 监听器统一挂 useRecordingShortcuts（Layout 常驻层）：快捷键/倒计时/光圈推送在
> 任意标签页有效；P2-1 附带修复（window 监听器同步挂载 + disposed 标记，attach IPC
> 期间卸载不再永久泄漏）。RecordPage 653→296 行。B57-11 部分 ✅——isStarting 置位：
> 启动链二次触发 toast 提示（不再静默丢弃）、loading 点亮（PreviewPanel「准备中」
> 生效、canRecord 失效）、启动期间换源/关摄像头被守卫。
> **第五批修复（同日，P2 体验族 17 件，全量 1392 测试/typecheck/lint 绿）**：
> B57-17 ✅（设置对话框：码率/分辨率/音频码率钳制；setConfig 异常捕获+toast 不再
> 卡死弹窗；重置完整覆盖系统音频/快捷键/倒计时；预设连点 seq 守卫；**附带发现并修
> 掉 systemAudio 状态从不回读**——重开对话框显示关闭、再保存即静默关闭系统音频；
> recordingSettingsDialog.test.ts +5 钉）；B57-15 ✅（历史页：加载失败独立错误态
> 不再伪装空态；删除/清空失败 toast、clearHistory 服务端回滚回执 + 契约 void→boolean；
> openFile 失败提示；缩略图 @error 回退占位图标）；B57-18 ✅（时间轴右键/中键不再
> 建选区拖边界；新增片段 endTime clamp 进时长；表单 NaN/负数/越界拦截）；
> B57-19 三件 ✅（'M' 键忽略 ⌘/⌃/⌥ 修饰——不再劫持系统最小化；ExportDialog 导出中
> 禁 ESC/遮罩关闭；useCursorHighlight start 失败不再吞 rejection+误置 active）；
> B57-20 部分 ✅（画中画摄像头 contain 缩放居中，16:9 不再硬拉正方形）。
> **第六批修复（同日，P2 收尾 12 件，全量 1392 测试/typecheck/lint 绿）**：
> B57-16 ✅（回放器：解码失败/文件缺失错误覆盖层可见化（此前黑屏+console）、
> blobUrl watch 补 epoch 守卫（对照 readFile watch 的 B50 守卫）、duration=0 时
> 标记跳转挂起待元数据就绪后应用（不再静默失效）、时间轴点击 seek（scrubber）、
> 倍速控件 0.5~2x；此批为 UI 级修复，未加组件钉——真机回归时验证）；
> B57-13 ✅（导出：并发导出拒绝（activeChild 单例防覆盖+cancel 语义不再破坏）、
> ffmpeg 非零退出/spawn 失败清理半截输出、totalSec 探测失败按已转码时长展示活动
> （不再恒 0 像卡死）、'slide' 转场映射 xfade slideleft（四处硬编码 fade 消亡））；
> B57-19 余件 ✅（protocols decodeURIComponent+容错 + ClipEditor 按段 encodeURIComponent
> —— #/? 路径不再截断 404；设备热插拔 loading 期挂 pending 在 loadSources 收尾重放
> （不再永久丢失）；权限错误不再无手势自动弹系统设置；SourceSelector 取消跨屏回传
> 'cancel' → actions 清区域回全屏源（旧实现只翻转本地布尔沿用旧区域）；倒计时遮罩
> 加 ESC+取消按钮（主进程事件丢失不再永久遮罩）；CursorTracker.stop 审计误报——
> IPC handler 本就传 e.sender.id，现码正确无需修改）。
> 系统性根因四个：① MediaRecorder 只产 webm → 转码/授权/恢复/契约链连锁病灶；
> ② 共享音轨所有权无单一真相（addTrack 进多流，任一方全轨 stop 即互毁）；
> ③ 双 finalize 双真相（主进程 segments 算时长 vs 渲染端自报，互踩）；
> ④ 事件监听挂错层（挂在会被卸载的页面组件）。

### B57-1【P0 族】崩溃恢复整体脱节 + 自身四账不平
- RecoveryManager 扫 `.partial.mp4`（RecoveryManager.ts:24,62），但全管线只产 `.webm`
  （授权白名单 recordingSavePathGrants.ts:42 默认仅 webm，MediaRecorder 亦只产 webm）
  → 真实崩溃（kill -9/断电）残留永远不被扫描，恢复面板对实际场景空转。
- recover 时 renameSync 静默覆盖已存在成品（:113-114，POSIX 无条件覆盖）；
  rename 成功后 DB 更新失败无回滚 → 文件「消失」且 scan 再也扫不到（:113-126）。
- discard/recover 按文件名全局匹配 DB 行（:183-194，不校验目录），重名时 hardDelete
  删错行（级联 markers/segments）。

### B57-2【P0】cleanup 路径时长归零 + 双 finalize 互踩
- cleanup()（useScreenRecorder.ts:513-521）同步置 isRecording=false、accumulatedMs=0
  后，MediaRecorder stop 事件才异步到达 → onstop 的段累计（:275-277）不成立，
  totalSeconds=0 写入历史。录制中切走模块（最后消费者卸载）→ 自动停录且时长 0:00。
- 渲染端 void finalizeNewRecording(totalBytes)（:334，自报 durationMs）与主进程
  endWrite→finalizeSavedFile（screenRecorderSave.ts:44-59，按 segments 扣暂停）先后
  写同一行，最终值取决于完成顺序；B57-2 前半条件下正确时长被 0 覆盖。

### B57-3【P0】关摄像头杀共享麦克风轨 → 之后录制全程无声
- combineStreams 把 stream.value 的音轨 addTrack 进 canvasStream（useStreamManager.ts:531-533，
  同一 track 对象）；closeCamera 对 canvasStream 全轨 stop（:716-717）→ 共享 mic 轨
  ended；此后 combineStreams 只判 getAudioTracks().length===0（:420，轨死但仍在流上）
  不重新装配 → 画中画开麦→关摄像头→再录制 = 无声视频。

### B57-4【P0】导出链路任意文件读取（安全）+ 路径授权绕过
- introPath/outroPath/backgroundMusic.path 仅 existsSync（RecordingExportService.ts:139-141），
  无白名单校验（对照 sourcePath 有，recording.ts:360-365 注释自述防 B48 任意文件
  经 ffmpeg 拼进产物回读）→ B48 防线对三个输入形同虚设。
- outputPath 校验的是原始路径（recording.ts:357），export 内 ensureExtension 按 format
  重写（RecordingExportService.ts:117,291-295）→ 实际写盘路径 ≠ 签发路径，revoke 对不上。

### B57-5【P1】分片写盘丢尾竞态（文件尾部损坏）
- ondataavailable 的 event.data.arrayBuffer() 异步链（useScreenRecorder.ts:265）可能在
  onstop flushPendingChunk 之后才到 bufferChunk → 新建 pendingChunk + 500ms 定时器；
  而 endWrite 在 50ms 硬等待（:306）后已执行、chunkedWritePath 置 null → 定时器到期
  flushPendingChunk 直接 return → 最后一批数据永久丢失。
- 在途 appendChunk Promise 未被 await（flushPendingChunk 不返回 Promise），50ms 等
  IPC FIFO 不可靠（慢主进程 >50ms 即丢尾）。

### B57-6【P1】全局快捷键在非「录制」标签页完全失效
- 监听挂在会被卸载的 RecordPage（RecordPage.vue:349-352 onMounted 注册），切
  历史/回放/剪辑标签即随组件卸载 → 设置面板宣传的 ⌘⇧⌥R/⌘⇧⌥P 静默无效；
  倒计时结束事件 frond:recording-start-after-countdown 同挂 RecordPage，倒计时中
  切标签则录制永不开始。附：Layout attachShortcuts 先 await IPC 后 addEventListener
  （Layout.vue:243-252），await 期间卸载 → detach 已先行 → window 监听器永久泄漏。

### B57-7【P1】回放页时间轴标记永不更新
- useMarkers 非单例：PlaybackPanel.vue:187 与 MarkersPanel.vue:235-245 各持独立实例，
  各自 loadMarkers（重复 IPC）；面板增删改后 PlaybackPanel 时间轴 overlay 不刷新
  （直至重新选片），也未监听 markerAdded。

### B57-8【P1 族】写盘会话授权四账不平
- endWrite 失败路径（screenRecorderSave.ts:205-218）：session 已删，endStream/statSync
  抛错直接返回 → revokeRecordingSavePath 永不执行（grant 泄漏靠 32 条 LRU 淘汰），
  半截 webm 无历史、无恢复入口（叠加 B57-1）。
- grant 的 `.webm` 变体（recordingSavePathGrants.ts:24-26）revoke 只删精确路径（:51-55）
  → 变体永久可写（覆盖写风险）。
- LRU MAX_GRANTS=32：反复预取默认路径可挤掉活跃授权 → beginWrite refused。
- beginWrite 同路径旧会话：静默截断重开 + endStream 错误被吞（screenRecorderSave.ts:151-156）
  → fd 泄漏、无 abort 语义。

### B57-9【P1】段管理漏关 → 时长随挂机时间无限虚增
- openSegment 不防重复、close 只关 findOpen 最新一条（SegmentService.ts:36-58）；
  遗留 open 段按 now()-started_at 累计 totalDurationMs（RecordingSegmentRepository.ts:111-121）
  → 写进历史时长的持续增长。

### B57-10【P1】半成品交互两处（点了无任何可见结果）
- ClipEditor「预览」按钮：previewClip 真实跑片段渲染后仅 console.log（ClipEditor.vue:251-260）。
- RecordPage 标记「跳转」：录制/非录制两分支都只 console.log（RecordPage.vue:632-643）。

### B57-11【P1】启动链 10s 窗口 UI 未锁定
- claimRecordingStart 拦截二次启动但静默 return（RecordPage.vue:462），无提示；
  loading ref 只读无写（useScreenRecorder.ts:32）→ PreviewPanel「准备中」永不亮；
  启动链期间换源/关摄像头只挡 props.isRecording（此刻仍 false，RecordPage.vue:160,184,234,266）
  → 停掉正在装配的流，录出黑屏/坏文件。

### B57-12【P1】区域浮层跨屏疑似失效 + 平台错误
- 跨屏虚拟 bounds 拼好后 setKiosk(true)（RegionOverlay.ts:224,293-310）——kiosk 收敛
  到所在单屏，跨屏框选可能只选到一屏（需真机多屏验证，疑似）。
- 混合 DPI 副屏选区错位：只按 primary scaleFactor 换算（:299-308）。
- Windows 分支打开 ms-settings:privacy-**microphone**（screenRecorder.ts:154）——
  麦克风设置页，与屏幕录制无关（复制粘贴错误）。
- 权限刚授权未重启应用时 checkPermission 误报 granted（:174-191，与 permissions.ts:134
  自述「macOS 授权后需重启」矛盾）。

### B57-13【P2 族】导出五件
- transition='slide' 四处硬编码 fade（RecordingExportService.ts:474-490）；导出失败不清理
  半截输出（:259-261，GifEncoderService 同）；并发导出 activeChild 模块级单例被覆盖，
  service 级 cancel 杀错进程；totalSec 探测失败进度恒 0%（:235）；export.getInfo 契约
  承诺 width/height/error 未实现（ipc-contract.ts:429-438 vs recording.ts:464-475）。

### B57-14【P2 族】IPC 契约漂移五件
- recording.delete 忽略 deleteFile 参数（契约 ipc-contract.ts:244 有，handler recording.ts:130-141
  不读）→ 物理文件永不删；addHistory 白名单只认 .webm（recordingHistory.ts:42）→
  mp4/gif 导出产物登记被拒；beginWrite 契约 res.path 从不返回；region 取消抛
  Error('canceled') 信封、契约未定义形状；码率/fps/分辨率数值无运行时校验（负码率
  可拼进 ffmpeg 参数）。

### B57-15【P2 族】历史页反馈缺失五件
- load 失败置空 → 伪装「还没有录制记录」空态（HistoryPage.vue:193-203）；deleteHistory
  false 静默；clearHistory 不查返回值本地先清（:223-225）；文件被外部删除点播放黑屏；
  缩略图无 @error 兜底 + 点击区是无 tabindex 的 div（:51-64，键盘不可达）。

### B57-16【P2 族】回放器五件
- 解码失败/文件缺失仅 console（黑屏无提示，PlaybackPanel.vue:464-497）；时间轴无
  scrubber 不可点击/拖动 seek；duration=0（metadata 未载入）时标记跳转静默失效（:532-545）；
  无倍速控件；blobUrl watch 无 epoch 守卫（:278-393，对照 readFile watch 有）。

### B57-17【P2 族】设置对话框四件
- 分辨率/码率 number 输入无校验（负数/0/NaN 清空直存，RecordingSettingsDialog.vue:504-548）；
  「重置默认」只重置 localSettings，系统音频/快捷键配置残留旧值一并写入（:551-558）；
  handleSave 中 await shortcutApi.setConfig 不在 try 内 → unhandled rejection 弹窗卡死；
  质量预设连点乱序（await IPC 竞态，:431-442）。

### B57-18【P2 族】时间轴/剪辑表单四件
- mousedown 不检查 event.button → 右键也建立选区并在 mouseup 触发 add-clip/seek
  （ClipTimeline.vue:65-70,134-142）；mouseleave 当松手立即提交，无法轨道外微调；
  新增片段 endTime=当前+10 不 clamp 超时长（ClipEditor.vue:175-183）；表单 NaN/负数
  直提交（仅校验 start>=end）。

### B57-19【P2 族】周边交互九件
- ExportDialog 导出中可被 ESC/遮罩关闭（UModal 默认，导出后台裸奔无恢复入口）；
  倒计时全屏遮罩无取消途径不响应 ESC（Layout.vue:8-17）；'M' 键不查修饰键且
  preventDefault → ⌘M 最小化被劫持（MarkersPanel.vue:397-408）；SourceSelector 跨屏
  开关取消分支不回传（UI 无选中但实际沿用旧区域，SourceSelector.vue:45-78）；
  `video://`+encodeURI 不转义 #/?（ClipEditor.vue:274）→ 特殊路径剪辑页黑屏；
  设备热插拔在 loading 期永久丢失 + 显示器列表只拉一次（useSourceSelection.ts:44-49）；
  权限类错误 500ms 后自动开系统设置（:90-95，无手势侵入）；CursorTracker.stop 无参
  清全局（多窗互踢）；useCursorHighlight.start 吞 rejection 且失败仍置 active。

### B57-20【P2 族】画质两件
- 画中画摄像头 drawImage 硬画正方形（useStreamManager.ts:622，16:9 源被拉伸变形）。
- 鼠标光圈仅区域模式绘制（:591 `cursorScreenPos && captureRegion`），全屏录制无光圈，
  行为不一致。

### 健康面（核实无误）
claimRecordingStart 原子防重入闸、combineEpoch 代际号防 rAF 复活、分片写盘内存 O(1)
设计、visibilitychange 后台 2fps 降级、音频缓存与混音 ctx 清理链、单例消费者引用
计数——主体架构已吸收 B 系列修复成果。病灶集中在上述四个系统性根因。

### 第三方调研结论（2026-10-04，回应「换现成模块」）
- 整体替换不可行：无成熟可嵌入的 Electron 录屏模块——Kap/aperture（macOS AVFoundation
  路线）近年基本停滞且仅 macOS；npm 上 electron-screen-recorder 类均为玩具级。
- 核心管线可换：**Mediabunny**（github.com/Vanilagy/mediabunny，mp4-muxer/webm-muxer
  统一后继，零依赖纯 TS、活跃维护）= WebCodecs 编码 + MP4/WebM mux，浏览器端直出
  MP4（免 ffmpeg 转码）、流式写盘、支持 fragmented MP4（崩溃恢复有据可依），另有
  Conversion API 可承接部分剪辑/转码。Screenity v4.6（2026 中）已用 WebCodecs+Mediabunny
  全面替换 MediaRecorder/webm 路线，管线成熟度经过同体量验证。根因①可由此消亡。
- 小件可换：gifenc（活跃）替代自研 GIF 编码逻辑。区域浮层/倒计时/全局快捷键无现成
  库，保留自研（按 B57-12 修）。

## 2026-10-05 发现（PM 产品评审：片段模块断头路 + 细节正确性，B58 编号，同日修复）

> 背景：B56 后用户要求「以 PM 视角评审片段模块并优化细节」。三条链路盘点（管理/
> 快取/扩展）后发现三个「后端全链就绪、UI 零入口」的断头路 + 若干正确性细节。
> 批A（断头路收口）+ 批B（正确性细节）当日全修，测试钉死。

### B58-1【P0】导入/导出幽灵功能——IPC 全链就绪、渲染端零调用
- snippet:exportAll / snippet:importFile（ipc/snippets.ts）含对话框绑定、幂等去重、
  20MB 上限，SnippetTransferService 纯逻辑完备——但 preload 之外无任何调用方，
  备份/迁移不可达。✅ 列表头加导入/导出入口 + toast 反馈（新增/跳过计数），
  e2e 钉入口存在性（回收站视图隐藏）。

### B58-2【P0】标签只写不读——编辑器可打标，无任何消费入口
- TagInput 完整可用，但侧栏/列表无标签筛选，search_text 也不含标签名。
- 连带真 bug：tagId JOIN 变体 `ORDER BY rowid` 歧义列（snip_tags 同名 rowid）——
  此路径此前无调用方，加筛选即崩（snippetTagSearch.test.ts 首个消费者抓出）。
  ✅ 侧栏标签分区（与文件夹/库互斥）+ 列表 tagId 过滤 + 搜索 EXISTS 命中标签名
  （buildSnippetQuery/quickSearch，FROM 统一 s 别名 + s.rowid 限定）。

### B58-3【P1】触发词冲突检测死代码——repo.findTriggerConflict 无消费者
- 同触发词片段谁生效全看 DB 顺序，静默失效。✅ 新增 snippet:findTriggerConflict
  IPC（契约+preload），编辑器输入 300ms 防抖实时提示冲突方名称（保存仍允许）。

### B58-4【P1】formatCode 读 props 陈旧值——防抖窗口内格式化丢输入
- B56-1 同族（copyCode 修了、formatCode 漏了）：⌘⇧F 在 500ms 窗口内会把刚键入
  字符用旧内容格式化结果顶掉并落库。✅ 先 flushPendingContentWrites 再取编辑器实时值。

### B58-5【P1】snippets:changed 广播死代码——delete/restore 永不广播
- broadcastSnippetsChanged() 写在 return 之后（delete/restore 两处不可达），
  胶囊页 onSnippetsChanged 收不到通知；importFile 成功路径也缺广播。
  ✅ 三处移正/补齐。

### B58-6【P2】细节族
- 新建片段不继承 folder.defaultLanguage（死字段）：✅ 文件夹对话框补默认语言
  USelect（SNIPPET_LANGUAGES 抽 @shared/snippetLanguages 双方共用）+ createSnippet 继承。
- 编辑器无删除入口：✅ 头部加「移入回收站」（confirm + snippetDeleted 事件驱动列表重建）。
- 触发词提示只列 3 个占位符：✅ 补 {datetime}/{cursor}/{{参数}}，清 2026-09-23「待核」重建注释。
- 调试残留：✅ SnippetList [probe] console.log、Editor 空 watch、snippets-ui.spec.mjs
  5 处死变量（lint error 源）。
- updateTrigger 无值不变 guard（blur 即写库 updatedAt 跳顶）：✅ 补齐（同 name/description 口径）。

### B58 批C（2026-10-05 同日续，用户选定延后账全做）——延后账五件全清
- 胶囊多块不可达 + 唤起全库解密重路径：✅ SnippetsPage 重构——列表走
  `snippet:getIndex` 轻路径（不解密 contents，块数子查询就地位）；内容全文匹配
  改靠 `snippet:quickSearch`（SQL search_text 明文投影，覆盖反而比旧的 80 字符
  首块预览更全）；详情按需 `getSnippetById` + 缓存，块 chips + ⌘←/→ 切换，
  复制/粘贴取活动块（此前永远只有第一块可达）。
- 回车仅复制不粘贴：✅ `snippet:pasteToForeground` IPC（写剪贴板 → 收起胶囊 →
  PASTE_DELAY_MS 后注入 ⌘V，复用 cliphist:pasteBack 范式），胶囊 ⇧↵ 接线；
  无辅助功能授权时注入失败但内容已在剪贴板，保留窗口供手动粘贴。
  真实 ⌘V 注入不在 e2e 驱动范围（会打进测试机前台应用），e2e 只钉接线错误路径。
- 回收站保留期：✅ `purgeExpiredTrash(30)`（junction 随清、事务），启动时执行；
  保留期暂硬编码 30 天（TRASH_RETENTION_DAYS），设置 UI 待产品需要再加。
- 语言清单：✅ +Go/Rust/C/C++/Kotlin/Swift/Ruby/PHP（SNIPPET_LANGUAGES 扩至 23，
  CodeMirror 补 clike/go/rust/swift/ruby/php mode）；顺手修 java 在下拉里有选项
  但 modeMap 无映射（恒无高亮）的潜伏缺失。
- 余留（下次排批候选）：根搜索 snippetItem 仍只复制首块（胶囊页是多块入口）；
  保留期无设置 UI；胶囊页搜索本地模糊 + SQL 合并的排序未做使用频次加权。

### 门禁终态（B58 批C）
typecheck 0；lint 0 error；unit 1402 passed（+capsuleIndex 3）；e2e 29/29
（snippets-ui 5 + deep 6 + crud 8 + b58 5 + capsule-actions 5）+ 胶囊页新增
snippets-capsule-b58c 3/3（内容全文可搜、⌘→ 切块 Enter 复制活动块读真实剪贴板、
粘贴接线错误路径）。

## 2026-10-05 发现（用户真机测试：点录屏落设置页）

### B58【P1】route-taken「让位回 Hub」在 Home 退役后坠入设置页（已修）
- 链路：主窗正显示模块路由 → 胶囊点同模块 → 沉浸窗接管 → 主进程发
  `app:route-taken` → 主窗 useAppMenu 让位 `router.push('/')`（useAppMenu.ts:44）
  → Home 退役后 `/` 重定向 `/settings` → 主窗永久停在无返回的设置页。
  用户猜测方向正确：「设置页没有返回按钮，就一直是设置页」。
- 修复：让位改 `app:hideMainWindow`（新增 IPC，Raycast 式主窗退后台）；
  SettingsView 补 ESC 兜底（有历史 back / 无历史隐藏窗口）+ 右侧内容区
  max-w 520→720（用户同步诉求）。
- 待办（用户提议，未实施）：设置页改弹窗形态——涉及多入口（tray/深链/⌘K/
  独立 800×786 窗）的 IA 决策，待与用户对齐后实施。

## 2026-10-05 发现二（用户真机复测：录屏预览死亡 + 界面重设计）

### B59【P1】过期窗口源点选 → 预览「无法播放媒体」且无恢复（已修）
- 根因：源列表只在挂载时拉一次（B57-19 姊妹问题）——其他应用窗口关闭后，
  其窗口源仍留在列表里；点选 → getUserMedia 拿到即刻死亡的轨道 →
  video 报 Chromium 原生「无法播放媒体。」，无提示无恢复。
- 诊断过程：新鲜档案与用户档案冷启动均**无法复现**（预览正常 3840px），
  隐藏/显示循环、摄像头→屏幕切换序列均正常——确认为「长会话 + 过期源」状态病。
- 修复：①录屏窗口重新聚焦时自动刷新源/设备列表（录制与启动链期间不打断，
  Layout 常驻层接线）；②预览 video error → 可见错误覆盖层（B57-16 回放器
  同款处理）；③选源失败 catch 后自动刷新源列表清掉过期项。
- 附带发现：主窗 document.title 不随路由更新（录屏页标题残显「设置」）——低危，
  暂挂账不修。

### 录屏页 UI 重设计（用户反馈「界面太丑」，已实施）
- 调研基准：Cap（cap.so）/ Screenity / Screen Studio / CleanShot 的共同范式 =
  预览为主角 + 悬浮控制坞 + 大圆录制键，而非多栏仪表盘。
- 实施（纯视觉层，props/emits/expose 零变动）：三栏灰盒 dashboard →
  「横向源带（段控+区域 chips+缩略横滚）+ 深色预览舞台（空态构图/错误覆盖层/
  状态徽章）+ 控制坞（56px 大圆 REC 键，录制中变形为方块停止键，暂停/保存/
  设置图标键）」两列布局（标记侧栏收窄为玻璃卡）；PreviewPanel 契约钉同步
  （图标键以 aria-label 为断言口径，badge 保留中文状态词）。

## 2026-10-05 发现（用户实测截图：片段模块裹着「设置」壳）

### B59【P1】重型模块套壳——片段页挂着 logo/全局搜索/设置图标，窗口标题错标「设置」（已修）
- /snippets 无 meta.window → 缺省 shell → AppShell 顶栏全套；且 SettingsView 的
  `document.title = '设置'` 跨路由滞留，片段页标题也挂「设置」。
- ✅ /snippets 改 overlay 全出血（三栏管理面即整个窗口），高度 h-screen
  （沿用 --shell-topbar-h 会留 40px 死空间）；⌘1-9 模块快捷键与主题初始化上移
  App.vue（去壳路由不挂 AppShell，留在壳里会在模块页失灵）；Toast/Confirm 容器
  上移 App.vue 根层——与 CommandPalette 同一解耦道理（e2e 抓出去壳后确认弹窗
  消失的回归）；窗口标题 App.vue 按 route.name 接管（ROUTE_TITLES 表）。
- 同根候选（本轮未动）：/screenRecorder、/pomodoro 仍在壳里；若同样反馈再收。

### B59a（2026-10-05 用户实测续：三栏偏宽 + 录屏/番茄钟同病 + 标题仍错）
- 三栏收窄：库 250→210 / 列表 280→240（编辑器吃回余量）。
- 录屏 / 番茄钟同批去壳：/screenRecorder meta 挂父级（子路由经 matched 合并
  继承）、/pomodoro 单页 overlay；Layout.vue 高度改 h-screen（壳内语义的
  calc(100vh-顶栏) 在无壳下留 40px 死空间）；pomodoro .zf-root 本就是 height:100% 免改。
- 标题「设置」滞留真因：首版 ROUTE_TITLES watcher 把 route 声明放在 watcher
  之后，immediate getter 同步求值踩 TDZ 静默炸掉（Vue 错误处理吞掉，app 照常
  渲染，标题从此不更新——用户截图实锤）。route 前置修复，e2e 钉
  `main.title()==='代码片段'` 断言（snippets-ui-b58 用例1）。
- 门禁：typecheck 0 / lint 0 error / snippets+pomodoro+recording-clip e2e 31/31。

### B59b（2026-10-05 用户实测续：模块窗口太大）
- 「代码片段/番茄钟/录屏窗口太大」根因两层：① 独立窗吃 createWindow 的
  1450×950 全局默认（胶囊/⌘K 的 create-new-window 沉浸窗）；② 片段页 ⌘↵ /
  动作面板 / 菜单栏的 launcher:openModule / appMenu 入口挤主窗（1450×950）。
- ✅ HEAVY_MODULE_WINDOW_SIZES 尺寸表（snippets 1040×660 / screenRecorder
  1040×680 / pomodoro 900×620，shared 加 HEAVY_MODULE_IDS 单一真理）；
  windowSizeForRoute 前缀匹配（含 ?immersive=1）；openHeavyModuleWindow 复用
  优先 + usage 转投新窗 + 主窗 route-taken 让位。三入口全接：
  launcher:openModule / appMenu.openModuleItem / create-new-window。
  渲染端 ⌘1-9 重型模块改走 openModule IPC（不再 router.push 挤主窗）。
- e2e/heavy-module-window.spec.mjs 2 钉（紧凑尺寸 / openModule 开独立窗不挤主窗）；
  顺手修 e2eConfigIntegrity 误报（title() 断言改渲染端 document.title）。
- 门禁：typecheck 0 / lint 0 error / unit 1403 / 目标 e2e 28/28。

## 2026-10-05 决策（用户指令：录屏功能整体移除）

> 用户终裁：「直接移除录屏的功能」。此前 B57 全域修复 + Mediabunny 管线迁移 +
> 两轮 UI 重设计（41d5537/55220ba 等 8 笔提交）后仍不满意，功能按贴图先例整体下线。
>
### 移除清单（本次提交）
- 模块表/路由/HEAVY 集合/TopBar 与 loadingVariant 分支/TaskDetailDrawer 跳转目标
- renderer：views/screenRecorder 整目录 + composables×7（useScreenRecorder/
  useStreamManager/useSourceSelection/useCursorHighlight/useMarkers/recordingActions/
  useRecordingShortcuts/useRecordingPipeline/useVideoClip）
- main：ipc×8（screenRecorder/screenRecorderSave/recording/recordingHistory/
  recordingSettings/recordingSavePathGrants/markers/clips）+ services/recording 整目录
  + MarkerService/RecordingHistoryService + repos×5 + dataMigrationsRecording
- preload 六个 API 块 + 录制域推送监听；契约五组通道段与相关类型内联清理
- 门禁同步：ipcContract 下界 391→340、rebuildLedger 33→24、sourceSizeRatchet
  preload/index.ts 出榜（降回 1000 行内）、testIsolation 候选集断言放宽
  （electron-store 仅剩 SearchHistoryService 且无直测引用）
- **数据不动**：rec_recordings/rec_segments/rec_markers 表保留（历史数据无损），
  用户磁盘上的录像文件不动，recording-history.json 不删——将来若复刻录屏，
  老记录仍可读
### 验证
单测 171 文件/1253 全绿 · typecheck 双侧 0 · e2e 113 通过+1 skipped ·
lint/ratchet/ghostClasses 绿 · 幽灵 API 引用清零。
