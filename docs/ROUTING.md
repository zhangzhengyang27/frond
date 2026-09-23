# Frond · 路由与窗口约定（ROUTING）

> **重生说明**：本文件原件在 2026-09-22 的桌面删除事故中丢失，各备份池无副本（`HANDOFF.md:695-697`），
> 2026-09-23 **从代码重新生成**。与 `docs/SIGNING_MAC.md` 同批。
>
> **本文的事实来源**（本轮逐行读过，结论后均给 `文件:行号`）：
> `src/renderer/src/router/index.ts` · `src/renderer/src/App.vue` · `src/renderer/src/main.ts` ·
> `src/main/modules/windows.ts` · `src/main/modules/miniWindow.ts` · `src/main/modules/floatingNote.ts` ·
> `src/main/launcher/window.ts` · `src/main/launcher/hotkeys.ts` · `src/main/modules/focusShield.ts` ·
> `src/main/index.ts` · `src/shared/modules.ts` · `src/shared/commands.ts` ·
> `src/renderer/src/constants/modules.ts` · `src/renderer/src/utils/commandRunner.ts` ·
> `src/renderer/src/composables/useAppMenu.ts` · `src/renderer/src/composables/useModuleShortcuts.ts` ·
> `electron.vite.config.ts` · `src/renderer/{index,launcher,shield,screenshot}.html` ·
> `src/renderer/src/{main,launcher-entry,shield-entry}.ts`
>
> **分工**：信息架构的唯一真理源是 `docs/IA_V2.md`——它在 `IA_V2.md:4` 与 `IA_V2.md:66` 两处把
> 「窗口语义细节」指给本文。本文只写**路由表 / 入口页 / 窗口装载**的实现约定，
> 不重述门-家分层、命令注册表、侧边栏分组语义（去哪看见 §9）。
> **快捷键不在本文**，归 `docs/SHORTCUTS.md`。

---

## 0. 一分钟版

| 事实 | 证据 |
| --- | --- |
| 路由表**只有一份**，属于主应用入口 `index.html`；hash 模式 | `router/index.ts:45`（`createWebHashHistory`），入口挂载 `main.ts:7,11` |
| 一条路由属于四类窗口语义之一，由 `meta.window` 声明，缺省 `shell` | `router/index.ts:16-23`（类型声明与缺省注释 `:18`） |
| 主进程可以用 URL hash **直接开出某个路由**的独立窗口，不需要为它写第二个 HTML | `miniWindow.ts:55-61`、`floatingNote.ts:137-143`、`windows.ts:109-119` |
| 有三个渲染端入口页；只有 `index.html` 带路由表 | `electron.vite.config.ts:86-90` 的 `build.rollupOptions.input`；`launcher-entry.ts`/`shield-entry.ts` 均无 `router` import。（曾有第四个 `screenshot.html`，随树内截图编辑器于 2026-09-23 删除，见 §5） |
| 导航可见性不由路由表决定，由 `src/shared/modules.ts` 决定 | `router/index.ts:8-10`、`IA_V2.md:62` |
| 启动守卫：onboarding 未完成 → 除白名单外一律重定向 `/onboarding`，带 3s 超时放行 | `router/index.ts:161-203` |

---

## 1. 四类窗口语义（`meta.window`）

类型定义与语义注释在 `router/index.ts:5-23`（`IA v2「路由与窗口语义正式化」`），
枚举为 `'shell' | 'overlay' | 'floating' | 'capsule'`（`router/index.ts:19`），缺省 `shell`（`:18`）。

| 值 | 语义（注释原文位置） | 运行时消费点 | 现表中的路由 | 怎么被加载 |
| --- | --- | --- | --- | --- |
| `shell` | 主窗口页面，`AppShell` 包裹；导航可见性由 `MODULES` 决定（`router/index.ts:9-10`） | `App.vue:31-33` 判定显壳；`App.vue:54-56` 判定 app 级单例只装主窗 | `/`、`/migration`、`/about`、`/launcher`、`/pomodoro`、`/snippets`、`/screenRecorder{,/record,/history,/playback}`（`router/index.ts:60-157`） | 主窗口 `createAppWindow()`（`main/index.ts:483` → `windows.ts:31`） |
| `overlay` | 主窗口内的沉浸式覆盖层，无壳（`router/index.ts:11`） | 同上（`App.vue:32` 的 `!== 'shell'` 分支） | `/settings`（`router/index.ts:71`）、`/screenRecorder/clip`（`:154`） | 同一主窗口进程内导航 |
| `floating` | 主进程创建的独立悬浮窗，以 hash 直接加载（`router/index.ts:12-13`） | **无**（见下方警示） | `/mini-timer`（`:108`）、`/floating-note`（`:115`）、`/screenshot/pin`（`:122`） | 独立 `BrowserWindow` + `index.html` 带 hash |
| `capsule` | 启动台胶囊窗：独立入口 `launcher.html`，**无对应路由**，列出仅为语义完整（`router/index.ts:14`） | **无** | 无 | `launcher/window.ts:55-61` |

**代码可证实的一条警示**：全仓 `meta.window` 只有 `App.vue:32` 与 `App.vue:56` 两个读取点，
两处判的都是「是不是 `shell`」。因此 `floating` 与 `capsule` 目前**是声明性标记，运行时不产生任何分支**；
`overlay` 与 `floating` 在 `App.vue` 里走同一条去壳逻辑。是否打算让代码真的按四类分派——未证实（无对应 TODO）。

**另一个易混点**：`window` 语义与「无壳」不是同一件事。`App.vue:32` 同时看 `route.query.immersive !== '1'`，
而 `?immersive=1` 由胶囊 / 全局热键打开模块时注入（`commandRunner.ts:47-52`、`launcher/hotkeys.ts:140`、
`main/index.ts:367-385` 的 `create-new-window`），走的仍是 `shell` 路由（`IA_V2.md:108-111`）。
**结论：无壳 ≠ overlay；判据只有 `meta.window` 与 `immersive` 两个来源。**

---

## 2. 启动守卫（onboarding）

`router.beforeEach` 在 `router/index.ts:161-203`，执行顺序即代码顺序：

| 步 | 行为 | 证据 |
| --- | --- | --- |
| 1 | 起路由计时 `startRouteTiming(to)` | `:162` |
| 2 | **白名单放行**：`to.path === '/onboarding'` 或 `to.meta.bypassOnboarding` 为真 → 直接 `next()` | `:167-170` |
| 3 | 挂 3s 超时兜底，IPC 挂起则强制放行（`settled` 双写保护） | `:173-179` |
| 4 | 状态未知（`null`）才问主进程 `window.api.preferences.isOnboardingCompleted()`，结果写回单例 | `:183-187`；桥 `preload/index.ts:257`；主进程 handler `ipc/preferences.ts:138`；存储判据 `PreferencesDataStore.ts:121-122` |
| 5 | 仅当状态**明确为 `false`** → `next({ path: '/onboarding', replace: true })` | `:191-194` |
| 6 | IPC 抛错 → 不阻断，放行 | `:195-200` |
| 7 | `afterEach` 收尾计时（导航失败则 cancel） | `:205-212` |

状态单例与三个操作函数：`onboardingState`（`:32`，三态 `false` / `true` / `null`，注释 `:25-31`）、
`resetOnboardingState()`（`:35-37`，被 `SettingsView.vue:149` 调，即「重新开始引导」）、
`markOnboardingCompleted()`（`:40-42`，被 `OnboardingView.vue:134` 调）。

**现状（可证实）**：`bypassOnboarding` 全表只有 `/onboarding` 自己声明了它（`router/index.ts:79`），
而该条已被 `to.path === '/onboarding'` 覆盖（`:167`）→ **目前没有任何路由靠这个 meta 放行**。
它是给「引导期就该可见的非引导路由」预留的口子（声明处注释 `:20`），§8 坑 3 是它目前唯一的用武之地。

---

## 3. hash 历史：为什么主进程能「按路由直接开窗」

`createWebHashHistory()`（`router/index.ts:45`）⇒ URL 形如 `<base>/index.html#/mini-timer`，
**同一份 `index.html` 服务任意路由**，所以主进程无需为新窗口新增构建入口。

写法（新窗口照这个抄）：

| 写法 | 出现处 |
| --- | --- |
| `is.dev` 用 `loadURL(…/#/xxx)`，否则 `loadFile(index.html, { hash: '#/xxx' })` | `miniWindow.ts:55-61`、`floatingNote.ts:137-143` |
| ~~生产分支自己拼 `file://…/index.html#/xxx`~~ | 原先只有贴图窗一处（旧 `PinService.ts`，已删），该功能 2026-09-23 整体撤销，本仓已无此写法；新增浮窗请走上一行 |

主窗 / 沉浸窗走公共装载器 `windows.ts:109-119`：dev 拼 `#${route}`（`:111`），prod `loadFile(..., { hash: route })`（`:118`），
注释 `:116-117` 说明「直接带目标 hash，避免沉浸窗先闪一帧 Hub」，`navigate-to-route` 退为兜底。

同文件另两条约定：
- **route → 窗口复用登记表** `routeWindows`（`windows.ts:25-29`）：同 route 已有存活窗口则 `focus()` + 发 `navigate-to-route` 做进程内导航，不再新建渲染进程（`:38-46`）。
- 渲染端接收点：`main.ts:41-46` 把该 IPC 直接转成 `router.push(route)`（`:44`）。

---

## 4. 四个渲染端入口页

入口清单的唯一真理源是 `electron.vite.config.ts:86-91`（注释 `:83-85` 逐个点名四页用途）。

| 入口页 | rollup input（行） | 谁加载它 | dev / prod 两条路 | 有路由表？ |
| --- | --- | --- | --- | --- |
| `index.html`（主应用，`<title>Frond</title>` `index.html:5`） | `electron.vite.config.ts:87` | `windows.ts:109-119`；主窗由 `main/index.ts:483` 创建（`autoShow=false`，注释 `:482`） | dev `ELECTRON_RENDERER_URL` / prod `loadFile` | **有**（`main.ts:7,11`） |
| `launcher.html` | `:88` | `launcher/window.ts:55-61`（`loadLauncherPage`） | `loadURL(…/launcher.html)` / `loadFile('../renderer/launcher.html')` | 无（`launcher-entry.ts:11-23`，只 `createApp(LauncherApp)`） |
| `shield.html` | `:89` | `focusShield.ts:290` | **只有 `loadFile` 一条**，无 dev 分支（该行未判 `ELECTRON_RENDERER_URL`）；加载失败即关窗退化，注释 `:291-293` | 无（`shield-entry.ts:5-8`） |
产物实盘（2026-09-23 跑过 `npx electron-vite build`）：`out/renderer/{index,launcher,shield}.html`。
`launcher.html` / `shield.html` 各自带独立 CSP `<meta>`。

> 第四个入口页 `screenshot.html`（连同 `screenshot-entry.ts`、`views/screenshot/` 整套移植副本）
> 已在 2026-09-23 删除，见 §5。它当年为 tesseract.js 放行过 `jsdelivr`/`unpkg`/`tessdata`；
> 现在 OCR 在主进程跑（`ScreenshotIndexService.ts:218`），不再有页面需要这条 CSP。

---

## 5. 截图这一层现在归上游 `electron-screenshots`（2026-09-23 起）

结论：**本仓库不再有截图编辑器代码**。树内那套移植副本（`views/screenshot/` 60 个文件 +
`screenshot.html` / `screenshot-entry.ts` 独立入口 + `src/main/services/ScreenshotService.ts`
覆盖层类 + preload 的 `SCREENSHOT:*` 协议）整体删除，截图与标注改由 npm 包
`electron-screenshots`（内含 `react-screenshots` 预构建页）承担；贴图/钉图
（`PinService` / `ipc/pin.ts` / `PinPage.vue` / `/screenshot/pin` 路由）按同一次拍板**整体撤销**。
决策与验收记录见 `HANDOFF.md` §11。

不变的那条判断仍然成立，而且现在是上游在遵守：**截图覆盖层不进路由表**。
`node_modules/electron-screenshots/lib/index.js:174` 把 `BrowserView` 用 `setBrowserView()`
挂到一个无边框 kiosk 承载窗上，加载的是 `require.resolve('react-screenshots/dist/electron.html')`
——一个自带产物、不经 Vue Router、也不在本仓构建入口里的页面。原因和当年一样：
覆盖层要「秒开」，路由表 + 全局守卫 + AppShell 全是纯开销（`electron-screenshots/lib/index.js:36-42`
的 `SCREENSHOTS:ready` 一次性握手，`startCapture()` 在 `:57` 等它）。

代码为证（本仓侧只剩这三处）：

| 位置 | 事实 |
| --- | --- |
| `src/main/modules/screenshot.ts:72` | `new Screenshots({ singleWindow: true, lang: LANG })` —— 全仓唯一实例化点 |
| `src/main/index.ts:404` | `registerScreenshotHandlers()` 在启动序列里（这一行是补回来的：它此前全仓零调用方） |
| `src/main/launcher/hotkeys.ts:280` | ⌥⇧S 走 `triggerScreenshot()`，延迟 import |

被删掉的那套「为什么不走路由表」的老证据（旧 `ScreenshotService.ts` 的设计契约、
`screenshot-entry.ts` 的头注释、`CapturePage.vue` 的组件挂载、
`e2e/screenshot-overlay.spec.mjs` 的按 `screenshot.html` 找窗）随代码一起没了；
替代它的运行时验收是 `e2e/screenshot-upstream.spec.mjs` 四条（handler 注册 → 起的是上游那层 →
拖选点「确定」后落进截图库并被索引 → 点「取消」不落盘）。


## 6. 什么情况该用 `floating` 而不是 `shell`

| 判据 | 走 `floating` 的代码事实 | 走 `shell` |
| --- | --- | --- |
| 必须跨窗口 / 跨工作区常驻置顶 | `miniWindow.ts:52-53`、`floatingNote.ts:134-135`（`setAlwaysOnTop(…, 'floating')` + `setVisibleOnAllWorkspaces`） | 主窗无置顶语义，且启动即不自动显示、只作后台支撑（`main/index.ts:482-483`） |
| 不该进任务栏 / 程序切换列表 | `skipTaskbar: true` + `minimizable/maximizable/fullscreenable: false`（`miniWindow.ts:37-40`、`floatingNote.ts:121-124`） | shell 页天然受 AppShell 约束 |
| 无边框、全透明底的小窗（形状自己画） | `frame:false, transparent:true, backgroundColor:'#00000000', hasShadow:false`（`miniWindow.ts:34,42-44`） | — |
| 生命周期归**主进程服务**拥有，渲染端不决定何时创建 | `ensureMiniWindow()`/`showMiniWindow()`/`toggleMiniWindow()`（`miniWindow.ts:21-94`）、`floatingNote.ts:110-148`，IPC 开关 `miniWindow.ts:100-114` | shell 页由 `router.push` 驱动 |
| 需要被侧边栏 / ⌘K / dock / tray「导航进去」 | ✗ 做不到（不在 `MODULES` 就不进导航，`router/index.ts:9-10`） | ✓ 只需在 `shared/modules.ts` 有条目（`modules.ts:44-81`） |
| 需要持久工作区（历史 / 收藏 / 草稿） | ✗ | ✓（`IA_V2.md:29-36` 的「家」侧职责） |

反例，别误用：`/settings` 只是**不想要壳**，用的是 `overlay`（`router/index.ts:71`）而不是 floating；
想「无壳」不等于想「独立窗口」。**新窗口是否需要进路由表，唯一判据是：主进程加载的 URL 里有没有 `#/`——有就必须有同名 `path`（§8 坑 1）。**

---

## 7. 新增一个页面要走哪几步

导航真理源两份，分工明确：

| 文件 | 内容 | 消费方 |
| --- | --- | --- |
| `src/shared/modules.ts` | `ModuleMeta.path` / `routeName`（字段声明 `:25-28`）、`MODULES`（`:44-81`）、`PENDING_MODULES`（`:130-140`）、`findModule`（`:84`）、`findModuleByRoute`（`:89`）、`getModulesByCategory`（`:107`） | 侧边栏 `Sidebar.vue:4,54`、⌘K/胶囊命令源 `BuiltinCommandProvider.ts:13,26-33`、⌘数字 `useModuleShortcuts.ts:17,43-50`、dock/tray/应用菜单 `appMenu.ts:15,174,236`（tray 与 dock 均由 `buildTemplate('tray' \| 'dock')` 出，`dockMenu.ts:12` 调进来） |
| `src/renderer/src/constants/modules.ts` | **只是 re-export 门面**，头注释 `:1-6` 直说「真理源在 `src/shared/modules.ts`」 | 让渲染端统一 `import` 路径 |

放主进程侧的注释还补了一条 why：「单一真理源，避免主进程 hardcode 与 renderer 不一致」（`modules.ts:7-11`）。

**A. 新增 shell 页（最常见）**

1. 建视图组件，`views/<域>/index.vue`。
2. 在 `router/index.ts:60-158` 加一条——**不写 `meta` 即 `shell`**（缺省见 `:18`）。
3. 要出现在侧边栏 / ⌘K / dock / tray → 加 `MODULES`（或 `PENDING_MODULES`）条目，填 `path` + `routeName`；
   不进这两份列表的页面**天然不进导航**（`router/index.ts:9-10`、`IA_V2.md:62`）。系统管理页走 `shared/commands.ts` 的 `SYSTEM_PAGES`，不要塞进 `MODULES`。
4. 要 ⌘数字 → 填 `ModuleMeta.shortcut`（字段 `modules.ts:40-41`），匹配逻辑按字段查（`useModuleShortcuts.ts:43-50`）；
   键位表与文档同步归 `docs/SHORTCUTS.md`（本文不写）。
5. 旧路径改名要留 redirect，参照 `/fastSearch → /launcher`（`router/index.ts:98`）。

**B. 新增 floating 悬浮窗**

1. **路由必须先进表**且 `meta: { window: 'floating' }`（照 `:117-123` 抄一条）——漏掉就是 §8 坑 1 那个症状。
2. 主进程新建 `BrowserWindow`，按 §3 两种写法之一带 hash 加载（`miniWindow.ts:55-61` 是模板）。
3. 补 preload 桥 + 主进程 IPC（`registerMiniWindowIpc()` 式的一对 `ipcMain.handle`，`miniWindow.ts:100-114`）。
4. 引导期是否可能被创建？会 → 给该路由加 `bypassOnboarding: true`（坑 3）。

**C. 新增 overlay（主窗内无壳）**：只加 `meta.window: 'overlay'`，`App.vue:31-33` 自动去壳，无需改主进程。

**D. 新增独立入口页（§5 那种形态）**：`src/renderer/<name>.html` + `src/renderer/src/<name>-entry.ts`
+ `electron.vite.config.ts:86-91` 的 `input` 加一项 + main 侧加载器（`focusShield.ts:290` 是最小样板）。
代价见 §5 末段：不进路由表、不过守卫。

---

## 8. 踩过的坑（都是真事，附证据）

| # | 坑 / 症状 | 事实与证据 |
| --- | --- | --- |
| 1 | **`#/screenshot/pin` 曾长期空白 → 该功能已整体撤销** | 当年主进程在加载这个 hash（旧 `PinService.ts`，已删），而路由表没有这条 → 窗口永远空白；补路由的修复在 `650fd1b`。但同一批还查出更根本的一环：`registerPinHandlers()` 全仓**零调用方**，也就是说补完路由 `pin:create` 依然 reject。2026-09-23 截图改由上游承担、上游工具栏没有贴图按钮，用户拍板「不要这贴图、钉图的功能」，`PinService` / `ipc/pin.ts` / `PinPage.vue` / 该路由 / preload `pin.*` 全部删除（HANDOFF §11）。**判据留两条**：主进程 URL 里出现 `#/…` 字面量，路由表必须有同名 `path`；反过来路由表补了 `path` 也要确认有人真的注册过那条 IPC —— 两头都核，别只核一头。 |
| 2 | ~~同类隐患仍在树里：`window.location.hash = '#/screenshot'`~~ **已修**（2026-09-23） | 该写法在 `TaskDetailDrawer.vue` 里曾是「按了没反应」：路由表无 `/screenshot`（截图模块 2026-09-17 下线，`DECISIONS.md:105` Decision-008）。现在那里改调 `window.api.screenshot.startCapture()`（`TaskDetailDrawer.vue:227-230`）；`Home.vue` 的「截图」快捷卡同一批从 `path: '/screenshot'` 改成 `action: 'screenshot'` 并走同一个调用。**判据**：入口写的是「跳转」还是「动作」，得和路由表/IPC 两头对得上。 |
| 3 | floating 窗**也过启动守卫** | 浮窗加载的都是同一份 `index.html`（`miniWindow.ts:58`、`floatingNote.ts:140`），守卫不区分窗口语义（`router/index.ts:161-203`），而 floating 路由都没设 `bypassOnboarding` → 引导未完成时创建它们，按代码会被换成 `/onboarding`。实际两者都由模块内动作触发，此路径**未复现**（未证实），新增 floating 路由时按 §7-B 第 4 步处理。 |
| 4 | 滚动复位不能声明式返回 | 存在两个自定义滚动容器 `.App-router` / `.app-scroll`，window 本身不可滚，`{ top: 0 }` / `savedPosition` 对自定义容器无效 → `scrollBehavior` 必须命令式取节点（`router/index.ts:46-59`，成因注释 `:47-49` 记为 B3 修复）。 |
| 5 | 同 route 反复开窗导致渲染进程堆积 | 复用 + 进程内导航（`windows.ts:25-46`，注释记为 BUGS.md B2），兜底导航在 `:83-92`，接收端 `main.ts:41-46`。 |
| 6 | 生产加载必须先带目标 hash | 否则会闪一帧 Hub（`windows.ts:116-117`），`navigate-to-route` 只作兜底保留（`:117`）。 |
| 7 | `/settings` 的窗口尺寸是主进程写死的 | `create-new-window` 对 `/settings` 特判 800×786，且注释提醒「route 可能带 `?immersive=1`，所以用 `startsWith`」（`main/index.ts:373-380`）；`frond://settings` 深链必须与之保持一致（`main/index.ts:203-207`）。新增需要特殊尺寸的页面时，这里是唯一改点。 |

---

## 9. 与 `docs/IA_V2.md` 的分工（去重声明）

| 想问的问题 | 去哪个文件 |
| --- | --- |
| 门（胶囊）/ 家（主窗）分层与分工契约 | `IA_V2.md:6-36` |
| 统一命令注册表、搜索引擎、执行器分件 | `IA_V2.md:38-50` |
| 侧边栏三分组的语义与「非模块页不进导航」的**约定** | `IA_V2.md:52-62` |
| 「启动器 / 禁用 fastSearch」命名规范 | `IA_V2.md:69-72` |
| `meta.window` 四类清单、运行时到底谁消费、与 `?immersive=1` 的正交关系 | 本文 §1 |
| hash 直开窗口、装载器、入口页与「截图为什么不在路由表里」 | 本文 §3–§5 |
| 新增页面 / 新增浮窗的操作步骤、已踩的坑 | 本文 §7–§8 |
| 任何键位（Alt+Space / ⌘K / ⌘2-4 / 参数槽按键） | `docs/SHORTCUTS.md` |

---

## 10. 未证实清单（本文没找到代码依据的点，列明而非编）

1. `floating` / `capsule` 两个枚举值无运行时消费点（§1 表）——是否有计划让它们真正驱动分派：未证实。
2. `App.vue:27` 仍把「截图捕获」列为 overlay 举例。2026-09-23 之后截图覆盖层已不在本仓（上游 `electron-screenshots` 自带页面，不经过 Vue Router），这句例子已过时；无代码按该说法分支，留作下轮清理。
3. 坑 3 的引导期浮窗路径未实跑复现：未证实。
4. `router/index.ts:12-13` 的注释只举了 `/mini-timer` 一例，另两个 floating 窗（`/floating-note`、`/screenshot/pin`）未写进该注释——注释落后于表，语义无冲突。
5. `IA_V2.md:126` 指向 `RAYCAST_GAP_ANALYSIS.md` / `RAYCAST_PARITY_PLAN.md`，仓内实名为
   `RAYCAST_GAP_ANALYSIS_V4.md` / `RAYCAST_PARITY_PLAN_V5.md`（悬空链接；`HANDOFF.md:698` 记了「扫全仓 md
   的非 http 链接指向不存在文件，本次共 10 条悬空」）——非路由事实，仅记一句。
6. 本文与 `docs/SIGNING_MAC.md` 的原件在基线提交 `8446ff2` 里就已经不存在（`HANDOFF.md:695-697`），
   即「事故时点」与「基线时点」之间无更细的证据可引；重生成后是否与丢失前逐字一致，**无从对照**（未证实）。
