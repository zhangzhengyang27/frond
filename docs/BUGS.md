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
