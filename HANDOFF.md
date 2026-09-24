# 交接文档：项目全景与历史决策

> 写给下一个接手的 AI。本文档自包含：读完即可继续，无需上游会话历史。
> 写作时间：2026-09-19；**最近校订：2026-09-24**（评审整改批次 1-3 落库后）。
>
> ⚠ **本文档里的数字分两类，别混**：
> - **历史读数**（例如 §10 各处「836 passed / 8 failed」）记的是**当时那一刻**的状态，
>   是诚实的现场记录，**不要改写它们**——那会让「哪一步把什么修好了」失去依据。
> - **当前读数**一律不要手抄，跑这条命令拿：
>   ```bash
>   node scripts/recovery/snapshot-readings.mjs          # 静态读数（秒级）
>   node scripts/recovery/snapshot-readings.mjs --tests  # 附带单测用例数（约 1 分钟）
>   ```
>   2026-09-24 校正时它报的是：src 源文件 402 / 单测文件 122 / 迁移 31 /
>   重建件 34 / e2e spec 31 / IPC 契约通道 **428** / 主进程裸 `ipcMain.handle` 8。
>   本文档此前多处写「391 通道」「836 用例绿」——都已过时。
>
> ⚠ **标题原先断言「IPC 单对象约定已全仓库接线」，这句当时是假的**：2026-09-22 基线重建
> 时 preload 按单对象重建、主进程 handler 保留位置参数，**39 条通道因此静默失效**
> （打开外链、回收站、云备份、录屏写盘、迁移中心还原/删除备份…），2026-09-24 才补齐。
> 详见下面的「校订说明」。

---

## 校订说明（2026-09-24，建议先读这段）

上一轮评审（`.workbuddy-ai/review/2026-09-23-consolidated-review.md`）的整改结果，
以及**评审本身被证伪的几条**——后者同样重要，避免下一个人照着错的结论再走一遍：

| 评审条目 | 实测结论 |
| --- | --- |
| P1-4「20+ 处裸 `ipcMain.handle`」 | 方向对，数量错：实测 **141 处**。其中 **39 条真的错位**（preload 发对象、handler 读位置参数），已全量转 `typedHandle` 并加门禁。 |
| P1-2「导航层完全没有设防」 | **不成立**。守卫早已存在三处（`src/main/index.ts` 全局、`launcher/runtime.ts` 插件视图、`modules/windows.ts` 主窗）。真实缺口是 `setPermissionRequestHandler` 缺失（Electron 不注册它时**默认放行**权限请求）→ 已补，且**必须放行第一方 `media`**，否则录屏全废。 |
| P1-9「固定 sleep 换轮询」 | **基本不需要做**。已有 105 处 `expect.poll` + 193 处显式 timeout，≥300ms 固定等待只剩 11 处且全是刻意用法（负向断言 / 动画时序定位 / perf 协议）。真正坏的是另一半：`trace: 'on-first-retry'` + `retries` 默认 0 = **trace 永远不会产生**。 |
| P1-6「只差证书」 | **不成立**。还差 `build/entitlements.mac.plist`（被 yml 引用而 `build/` 目录不存在 → mac 打包直接失败）、图标、根 `LICENSE`。 |
| P2-13「弱断言 193 行」 | **前提不成立**。当前 `toBeDefined()` 仅 6 处且都在 `expectIpcOk()` 的正确模式里。 |
| P1-1 自建 reconciler | 处置 = **锁版本 + 升级守卫**（`react-reconciler` 钉 `0.34.0` + `hostconfig-contract.test.ts` 运行时量实参），不降级、不换方案。 |

> 这些误判的**共同成因是同一个**：评审当时用的 `grep -rn` 在本机环境里**静默失败**
> （无匹配 exit 1、有匹配也可能空输出）。本仓一切「全仓零命中」类结论都应当用
> 内置 Grep 或 `node -e` 复核后再写进文档。


## 0. 结论（TL;DR）

表单回传 flake **已修复**，但根因与本文档上一版的判断**相反**，记录以免再走弯路：

- 真根因：SDK 的 `commitUpdate` host config 沿用了旧版 5 形参签名
  `(instance, updatePayload, type, prevProps, nextProps)`，而 react-reconciler 0.34
  的实际调用是 `commitUpdate(stateNode, type, oldProps, newProps, finishedWork)`
  （**已无 updatePayload**，见 `cjs/react-reconciler.production.js` 的 `commitHostUpdate`）。
  错位一位 → 第 5 个实参 **fiber 被赋进 `HostNode.props`** → 下一次 `resetAfterCommit`
  序列化时 `sanitizeValue` 沿 `stateNode>props>stateNode>…` 无限递归 →
  `RangeError: Maximum call stack size exceeded`（未捕获，root 被打坏）→
  **此后所有 `nav.push` 的视图提交静默消失**。胶囊停在旧视图，就是「表单渲染间歇失败」。
- 被证伪的假设：`supportsMicrotasks: true` + 同步 `scheduleMicrotask(fn){fn()}` 会自递归爆栈。
  实测不成立——React 的 microtask 回调里有 `executionContext & (RenderContext|CommitContext)`
  判断，effect 内发起的更新会转交 Scheduler 而非同栈执行；把 `scheduleMicrotask` 改回
  同步执行，回归单测仍然通过。故该行**保持原样未改**（不是本次问题，别顺手改）。
- 第二处缺口在 **e2e 自身**：`runPluginAction(plugin, 0, 1)` 打的是「当时声明视图」的
  条目动作；上一步 `nav.push(Detail)` 已把视图换成详情占位条目（无动作），第二次调用
  就落在不存在的动作上、连 Callback 都不发。快机器上抢在详情落地前发出所以「绿」——
  这正是 solo 绿/套跑红的来源。已把 spec 拆成两个用例并按视图状态串行等待。

**本轮另一件大事**：IPC「单对象入参」全仓库迁移完成（**当时 391 通道**进登记册、两端编译期强制、
d.ts 顺手拆掉十余处手抄/擦除）——落点、两个必踩过的坑、闸口都在 §8 第 4 条。
> ⚠ 2026-09-24 校正：「全仓库迁移完成」这句当时**不成立**——主进程那一侧有 39 条通道
> 仍是位置参数写法，静默失效了近两个月。现登记册是 **428 条**，且加了「契约 req 非 void
> ⇒ 必须 `typedHandle`」的门禁。详见 §12。

诊断手段（本轮用过后已撤销）：主进程 `console-message` 转发插件页 console +
`sanitizeValue` 打键路径。**下一步若要复现同类问题，直接照 §3 的链路图加这两处**。

---

## 1. 项目背景

仓库：`/Users/xiaoye/Desktop/publish/frond`（Electron 启动器「Frond」，对标 Raycast，macOS+Windows）。
> ⚠ 2026-09-24 校正：此前这里写的是 `/Users/xiaoye/Desktop/electron-tools` —— 那是
> 2026-09-22 桌面删除事故前的旧路径，仓库早已搬走。照旧路径找会一头雾水。
> 判据：以 `git rev-parse --show-toplevel` 的输出为准，别信文档里写死的路径。
本轮工作主题：按 Vicinae/ueli 两个开源项目的借鉴清单落地功能，共 **12 项全部完成**
（清单与每项状态：`docs/REFERENCE_VICINAE_UELI.md`；审查记录都在 commit message 里）。

技术栈：electron-vite + Vue3（宿主渲染端，无 React）+ better-sqlite3 + TypeScript。
插件体系：第三方插件是 sandbox BrowserView（隔离世界 preload 暴露 `launcherApi`），
宿主原生渲染插件 UI（插件不写 CSS/DOM）。

## 2. Git 与产物状态

**本地 main 无 remote 配置，未推送。** 三个必须知道的产物事实：

- `example-react/dist/main.js` **入库**（插件导入即用它，e2e 也用它）。改 SDK 或 example
  源码后必须重跑：`cd packages/frond-plugin-sdk && npm run build` → `cd example-react &&
  npm run build` → `npx electron-vite build`，否则测的是旧字节码（本仓库踩过两次）。
- `packages/frond-plugin-sdk/dist/` 被 `.gitignore` 的 `dist` 规则排除、**不入库**，
  但 `__tests__/sdk.test.ts` 直接 import 它 —— 全新 clone 后 `pnpm test` 会因缺产物失败，
  需先构建 SDK。遗留 Minor，未修。
- `out/` 是 electron-vite 产物，跑 e2e 前必须重建。

## 3. 已修复：表单提交值回传间歇 flake

### 症状（修复前）
React 插件（example-react）表单流：列表渲染 ✓ → 触发表单动作 ✓ → 表单渲染
**间歇性**失败（`.form-input` 不出现，15s 超时）。solo 跑常绿，批量套跑间歇挂。
上一轮修的是后台节流冻结提交调度（rAF → queueMicrotask + backgroundThrottling:false，
commit `84fb0a6`），**方向对但不完整**——它解决的是「Callback 后 detail 永不到达」，
本次这个 RangeError 静默断链是另一条独立故障。

### 链路图（哪段断了对着日志找）
```
胶囊 FormPage 提交
  → launcher:plugin-form-submit IPC
  → main submitPluginFormValues（runtime.ts:180+）
  → sendHook Callback（executeJavaScript → frondPluginHooks.emit）
  → 插件页 SDK 桥（index.ts installCallbackBridge）
  → registry.dispatchCallback → onSubmit(values)
  → nav.push(Detail) → React commit → serializeForm/serializeList
  → renderView → plugapi:renderView
  → main setDeclaredView（list/form 分支）
  → 胶囊渲染（PluginListPage / FormPage）
```

### 定位与修复（2026-09-19）
1. 抓栈：主进程 `console-message` 转发只有 message 没有栈帧，于是在 SDK 里临时挂
   `window.addEventListener('error')` 打 `error.stack` + 在 `sanitizeValue` 里打键路径。
   一跑就中：**栈帧全是 `sanitizeValue`，键路径 `stateNode>props>stateNode>props…`**
   ——即 React fiber 被当成视图 props 递归（fiber 的 `stateNode` 是 HostNode/容器，
   容器 `props` 又是 fiber 数组 → 成环）。
2. 顺藤到 `commitUpdate` 形参错位（见 §0），改签名即修好；同时删掉 0.34 根本不调用的
   `prepareUpdate`（全仓 grep 零命中）。
3. 判异性：把 dist 里 `instance.props = nextProps` 改回 `arguments[4]`，新增的回归单测
   立刻复现同一句 `RangeError`；改回即绿。反过来把 `scheduleMicrotask` 改回同步执行，
   所有测试仍然绿 → microtask 假设被证伪，未采纳。
4. 剩余红是 e2e 抢跑（§0 第三条）→ spec 拆两用例，第二个用 `openPlugin` 重建插件页回到
   列表，再走 表单 → 填 marker → ⌘↵ → 断言 **marker 出现在回推详情正文里**（真回传，
   不是只看表单渲染出来了）。
5. 验证：三联套跑 6 轮全绿、trace 零 RangeError；trace 里可见
   `form onSubmit {"kind":"建议","content":"回传-…"}` → `submit detail`。

### 遗留（本轮未动）
- `dispatchCallback` 命中不到 id 时静默返回 false（原设计如此，插桩期未见 MISS）。
  若日后出现「点了没反应」，这是第一个要看的位置。
- `runPluginAction(plugin, itemIndex, actionIndex)` 对**当前**声明视图取索引，越界静默
  no-op；写 e2e 时必须先确认视图状态（本轮 flake 的一半原因就在这）。

## 4. 验证命令（精确顺序）

```bash
cd packages/frond-plugin-sdk && npm run build && cd ../..   # SDK dist（单测/e2e 同源）
cd example-react && npm run build && cd ../..             # example-react/dist/main.js（入库）
pnpm typecheck                          # 双端 tsconfig，0 error
pnpm test                               # 830+ 单测（含 SDK 4 个 + 表单解析 5 个）
npx electron-vite build                 # 必须在跑 e2e 前执行（out/ 是产物）
npx playwright test e2e/react-view.spec.mjs e2e/launcher.spec.mjs e2e/file-index.spec.mjs --reporter=line
npx playwright test                     # 全套（pomodoro-manual 已加守卫默认跳过）
```

**改 SDK/example 源码后不重建产物 = 测的是旧字节码**，本仓库为此踩过两次。
插件页 console 现在不再转发到主进程；要看得开 `openPluginDevtools`。

## 5. e2e 环境机制（不理解会踩坑）

- 每个 spec 用**独立 userData**：`FROND_USER_DATA_DIR`（playwright.config 注入，
  spec 内按 spec 名覆盖）——规避单实例锁 + 不污染真实数据
- `FROND_E2E=1`：插件导入确认闸旁路
- `FROND_FILE_INDEX_SCOPES`：文件索引范围覆盖（避免 home 全量扫描）
- `FROND_SKIP_BUILTIN_PLUGINS=1`：跳过内置插件自动安装
- `pomodoro-manual.spec`：CDP 连接已运行实例的手动版，已加守卫默认跳过
- electron.launch 的 env 是**顶层选项**（launchOptions.env 无效——历史 bug）

## 6. 仓库约定

- **TDD**：先写失败测试再实现（本仓库 837+ 测试全部如此）；vitest colocated
- **验证电池**：typecheck → vitest → eslint → electron-vite build → e2e，全绿才提交
- commit 风格：`feat:/fix:/docs:` + 中文详述（看 git log 学样例）
- **不要动**：`references/`（Vicinae/ueli 克隆，gitignored，供源码借鉴）、
  `src/renderer` 的视觉令牌值（Decision-010 拍板过）、`src/shared/plugin-protocol.ts`
  的 fail-closed 清洗语义
- eslint：宿主 strict；SDK 的 reconciler.ts 有 no-empty-function 文件级豁免
  （host config 惯例）

## 7. 关键文件地图

| 文件 | 职责 |
| --- | --- |
| `packages/frond-plugin-sdk/` | React 插件 SDK（reconciler/组件/回调注册表/导航） |
| `src/shared/plugin-protocol.ts` | 插件协议：v1 renderList + v2 视图/表单 + fail-closed 清洗 |
| `src/main/launcher/runtime.ts` | 插件运行时：BrowserView 生命周期 / setDeclaredView / sendHook / declaredForm |
| `src/main/launcher/ipc.ts` | 全部 launcher:/plugapi: 通道 |
| `src/preload/plugin.ts` | 插件 preload（launcherApi + frondPluginHooks + HookType） |
| `src/renderer/src/launcher/LauncherApp.vue` | 胶囊主组件（pluginForm/declaredList 接线） |
| `src/renderer/src/launcher/pages/FormPage.vue` | 表单页（⌘↵ 提交，e2e 用 Meta+Enter 驱动） |
| `src/main/modules/fileIndex/` | 文件自建索引（db/scanner/service/excludes/skeleton/content/**paths**/**watcher**） |
| `src/shared/themeSchema.ts` / `themeFile.ts` | 主题数据层（Phase 1）/ 用户主题文件解析派生（Phase 2） |
| `src/main/modules/userThemes.ts` | `userData/themes/*.json` 读取与导入（dir 参数化版可单测） |
| `packages/frond-raycast-api/` | `@raycast/api` 兼容别名层（#11 M3），插件侧 alias 指过来 |
| `docs/REFERENCE_VICINAE_UELI.md` | 借鉴清单 12 项状态（唯一进度事实源） |
| `docs/REACT_API_DESIGN.md` / `docs/FILE_INDEX_DESIGN.md` | 两份设计文档 |

## 8. 上一轮清单的落点（2026-09-19 批次，全部已提交）

| 原待办 | 结果 |
| --- | --- |
| 表单回传 flake | 已修（§3：commitUpdate 形参错位）；**升级 react-reconciler 小版本时必须重跑 §3 的判异性检查**，host config 形参会漂移 |
| 插件 props 环状对象 | 已修：`sanitizeValue` 加路径 WeakSet + 深度 24 上限，重复处置 null 并 warn 出键路径（不再整棵视图静默不提交） |
| 水位表启动期补偿 | 已实现：`compensateStaleDirs` 一趟每目录一次 stat，mtime 变了才 rescanDir；消失目录连水位一并清。边界：**原地改文件内容**不动目录 mtime，这类漂移不回补 |
| 「Fuse 单实例复用」 | **核实后不做**：实测 `fuzzyEngine` 每探测约 2µs，复用实例只省 11%（约 0.1ms/次按键），换来共享可变实例的重入风险。数字在这里，别再去改一遍 |
| ↳ 2026-09-20 重量（P-6④）| 结论仍是不做，但**换成端到端口径支撑**：真胶囊里「敲键到第一次 DOM 变」十个查询全在 153-161ms，而防抖就吃 150ms → 打分 + 首屏总共 3-11ms，没有可省的空间。短查询那 450-540ms 的尾巴全在第一次突变之后（文件搜索 IO 晚到），改 Fuse 碰不到它。数据与做法见 `docs/RAYCAST_PARITY_PLAN_V5.md` P-6.4 与 `e2e/perf-results.spec.mjs` |
| plugin-changed 双份 IPC | 已修，且真身比描述严重：`launcher:plugin-list` 与快照重复推同一份列表；而快照**从不带 declaredForm**（d.ts 却早声明了）→ 任何一次状态推送都把胶囊里的 React 表单清成 null。现合并为单一快照，两条死通道删除 |
| NavigationRoot context 重渲染 | 已修（useMemo 固定 nav 引用 + 回归单测） |
| Windows 文件索引 | 已实现（@parcel/watcher 后端 + `fileIndex/paths.ts` 路径归一 + `source` 分层）。**Windows 运行时未实机验证**，两条 file-index e2e 仍 skip，有机器时去掉守卫跑一遍 |
| 用户主题文件 | 已实现（#12 Phase 2，PLUGIN_DEVELOPMENT 无关；用法见 docs/DESIGN_TOKENS.md「用户主题文件」一节） |
| @raycast/api 兼容别名 | 已实现（`@frond/raycast-api`，映射表与缺口清单见 PLUGIN_DEV.md） |

同日补做的四项（也已提交）：trigram 中缀影子索引（≥3 字可命中）、外接卷未挂载不再
拖垮整个索引（逐根隔离 + 管理页点名）、回调 id 失效给出原因、老单测吃 dist 的构建前置。

仍然开着的：
1. **推送远端**：仓库无 remote 配置，需要 URL。
2. **Windows 侧实机验证**：@parcel/watcher 后端 + 路径归一只过了单测与审查，
   两条 file-index e2e 在 Windows 上仍 skip（守卫注释写了原因）；有机器时去掉守卫跑一遍。
3. 已知边界（都不是 bug，别再当问题查）：水位补偿是**秒级**粒度（同秒变更漏判）；
   **2 字中文**中缀查不到（trigram 要 ≥3 字符，由 mdfind/PowerShell 回退承接）；
   用户主题不联动模块命名空间与 `--brand-500`（Decision-010）。
4. **已完成**：IPC 全仓库统一「单对象入参」（2026-09-19 拍板 → 当日迁完）。
   415 个 preload 通道里所有 request/response 通道（391 条）都进了 `IpcContract`，
   两端强制接线：主进程 `src/main/ipc/typedIpc.ts` 的 `typedHandle`/`typedHandleLogged`，
   preload 的 `typedInvoke`；`const api: API` 再把 d.ts 钉住 —— 形状不符编译期就红。
   迁移策略兑现了「渲染端与插件面零改动」：`window.api.X(...)` / `window.launcherApi.X(...)`
   的 JS 签名一字未动，位置参数→对象的折算全部在 preload 内完成。
   余下 11 条是 `ipcMain.on(...)` 的一次性推送（launcher:toggle / search-input /
   subscribeSnapshot / ping），没有 response，按设计不入册。
   旧的 `registerHandlers` / `registerPrefixedHandlers` 注册助手（object-literal + 位置参数
   转发）迁完即全仓无调用方，已连文件带 `ipc/index.ts` 再导出一起删掉，ipcContract 的
   静态抽取器也只认 `ipcMain.handle/on` 与 `typedHandle(typedHandleLogged)` 两种形态。
   新增两条闸口（`src/main/__tests__/ipcContract.test.ts`）：
   已登记通道不得再被裸 `ipcRenderer.invoke` 调用；登记条目数只增不减（现 391）。
   **两个必须知道的坑**（都实测踩过，别再踩）：
   (a) sandbox 化 preload 只能 require 内置模块。`plugin.ts` 与 `index.ts` 一旦共用
       `./typedIpc`，rollup 就抽成 `./chunks/*.js`，Electron 报「Unable to load preload
       script: module not found」→ 整个 `window.api` 消失（表现是 e2e 一片红 +
       `Cannot read properties of undefined (reading 'pomodoro')`）。故 plugin.ts 内联
       一份 typedInvoke，注释已写明原因，别「顺手」合并回去。
   (b) `import type` 也会把被引模块编进 web 程序（typecheck:web）。登记册引
       `PomodoroIntegrationService` 曾因 NotificationService 的 `resources/icon.png?asset`
       直接编不动 → 纯线格式类型挪到 `src/shared/pomodoroIntegration.ts`（service 重导出，
       调用面不变），并在 `src/renderer/src/env.d.ts` 补了 `declare module '*?asset'` 兜住
       其余主进程类型引用。
   顺带被编译器揪出并修掉的 d.ts 类型谎言（不是顺手改的，每一条都是登记册接上后报红的）：
   hotkey spec 的 `kind: string`、recording.list 的 `status: Array<string>`、
   clip.getVideoInfo 多声明的 format/size、reminders 手抄的 10 字段 Reminder 与
   `filter: Record<string, unknown>`、ai 家族三处 `Record<string, unknown>` 擦除
   （saveSession 还把必填的 id/createdAt/updatedAt 抄成了可选）、notification 的
   `type: string` 与 options 丢掉 `actions` 能力、clipHist 条目少抄 3 个真实字段、
   quicklinks 读侧承诺 `{id,name,url}` 而写侧只校验 url（已补写侧校验）。
   还修了一个真 bug：`notification:pomodoro('remind')` 类型允许、渲染端真的在发，
   但 NotificationService 的 switch 没有这条 case，标题退化成「番茄钟」——已补。
5. 可选项（都不阻塞）：#9 剩余 M3 的 spellfix1 拼写容错、索引体积统计可视化。
   断连卷的「重挂后自动补扫」已实现（跳过范围 60s 轮询补扫 + watcher 整组重启），
   但其定时器与接线只有运行时观察、无自动化覆盖（本机无法插拔卷）。

## 9. 提交清单（bf2238c 之后，新→旧）

```
609002f refactor(ipc): 最后 70 通道（AI/日历/迁移/备份/回收站/词典/窗口/屏幕录制等）单对象入参
62b5dfd refactor(ipc): 录制历史/系统/通知/剪贴板历史/悬浮窗/专注屏蔽（70 通道）单对象入参
153b4fc refactor(ipc): 标签/统计/提醒/笔记/片段/剪辑 五家族（68 通道）单对象入参
e5a5fb4 refactor(ipc): 启动器家族（66 通道）单对象入参；plugapi 面同样登记
883760a refactor(ipc): pomodoro 家族（52 通道）单对象入参 + preload 必须走 typedInvoke 的门禁
aaa512a chore(ipc): IPC 登记册去掉 11 条虚构通道与错误签名 + 测试闸口
ab33039 feat(file-index): 被跳过的范围重新可读后自动补扫
a435012 fix(sdk): 回调 id 失效时给出原因，不再静默 no-op
32b4013 fix(file-index): 单个范围读不到不再拖垮整个索引（外接卷未挂载场景）
850a5fa feat(file-index): trigram 中缀影子索引，主路径零结果时兜底（#9 M3 部分）
3708f95 feat(file-index): Windows 自建索引后端（@parcel/watcher）+ 索引内部路径归一
457285b test(e2e): 启动补偿用例显式拉开目录 mtime，去掉秒级粒度带来的偶发红
f64e276 feat(sdk): @frond/raycast-api 兼容别名层（#11 M3）
3d0055b feat(theme): 用户主题文件解析派生 + 设置页选择 + 运行时注入
3c11fb7 feat(file-index): 启动期目录水位补偿
636f7f2 build(test): vitest 全局前置构建 SDK 产物，全新 clone 的 pnpm test 可跑
eb6c626 fix(launcher): 插件视图合并为 plugin-changed 单一快照，修表单被后续推送清空
42734b7 fix(sdk): props 成环在重复处切断 + NavigationRoot context 引用稳定
c266445 test(e2e): 番茄钟 spec 去掉外部 dev server 依赖 + 补 userData 隔离
707ab1d fix: React SDK commitUpdate 形参错位（flake 真根因）+ 撤诊断插桩
b8d7ade wip+docs: 表单回传诊断插桩 + HANDOFF
0da1fa8 docs: PLUGIN_DEV 增补 React 视图 API 与表单章节（#11 M2）
71ca4be feat: React SDK Form 组件族（#11 M2）——表单视图协议 + 胶囊 FormPage 复用
84fb0a6 fix: react-view 套跑 flake 根因——隐藏 BrowserView 的后台节流冻结提交调度
73eccb3 feat: 主题 Schema Phase 1（#12）——ThemeDefinition 数据层，CSS 值零变化
85b52b8 fix: React SDK 审查修复——4C+5I + flake 根因（隐藏页 rAF 冻结）
cf6561c feat: React 级扩展 API M1（#11）——SDK + 视图协议 v2 + example-react 闭环
bea0122 fix: 代码审查修复——文件索引 1C+9I + 安全守卫 + 快速 Minor
d4ed4ea feat: 文件自建索引 M1（#9）——FSEvents + sqlite FTS5，摆脱 Spotlight 制约
963de96 fix(e2e): electron.launch env 顶层传参 + FROND_USER_DATA_DIR 隔离 + playwright 1.63
eb19521 fix: 内置插件目录按启动形态解析 + e2e 可跳过自动安装
d6695e6 feat: 借鉴清单落地——模糊容错/多参数命令/pop-to-root 三态/热键冲突/剪贴板关键词/统一动作执行端
```

## 10. 全量缺口清单（2026-09-22 19:10 实测 · 渲染层 typecheck 解盲之后）

**这不是计划，是账。** 三轴扫出来的：主进程在不在、preload 桥在不在、渲染端等不等。
每条都带复现命令，改完请回来划掉——不要凭印象更新这一节。

测量口径（随时可重跑）：

```bash
npm run typecheck:web   # 58 条（2026-09-23 C 类回灌后；本会话起点 146 → A/E/F 批 122 → C 类回灌 58）
npm run typecheck:node  # 30 条
npx vitest run src/shared/__tests__/renderer-api-parity.test.ts   # 2 处幽灵 API 调用
npx vitest run   # 836 用例绿 / 8 红（红的全是结构性缺件：ipcContract 6 + renderer-api-parity 1 + mergeCommands 1）
```

### A 类 · 主进程在、preload 桥没了 —— 补桥即恢复（**代价最低、功能量最大**）

> **2026-09-23 进展**：这一类做掉三格 —— ①**通知**（8 个通道，`notifications.ts` 被恢复成
> 全量迁移**前**的旧副本：按位置参数收，而 preload 早发单对象 → 通知整条静默不响）
> ②**录屏崩溃恢复的两个动作** `recording.recovery.recover/discard`（RecoveryManager 的实现一直在，
> 只有注册没了：对话框列得出孤儿文件、按钮按下去永远 reject）
> ③**截图桥 21 个方法**（选区覆盖层协议 `SCREENSHOT:ready/ok/save/cancel` + 推送 capture/reset
> + 12 个 `screenshot:history:*`）。
> 读数：幽灵 API **28 → 2**；dead handler **35 → 17**；无监听推送 **5 → 3**；
> `typecheck:web` 146 → 143；`typecheck:node` 43（本批 0 新增）。
> **2026-09-23 第三轮（`573c4e1`）**：钉图桥已接回 —— `screenshot.pin.*` 的 10 个 handler 与
> PinService 的 3 条推送都上了桥，dead handler **17 → 7**、无监听推送 **3 → 0**、幽灵 API **2 → 1**。
> 上面那句「连创建钉图窗口的代码都不在树里」是**错的**：`src/main/ipc/pin.ts` 与
> `src/main/services/PinService.ts` 一直在，PinPage.vue 也照着 `window.api.screenshot.pin` 写了监听，
> 缺的只是 preload 那一层。
> 剩下 7 条**不是缺桥**：`platform:{setDockBadge,setProgressBar,requestUserAttention}` 与
> `recording.markers:{list,add,remove,rename}` 是主进程里的**第二套无人调用的实现** ——
> 标记走另一套 `marker:*`（preload 与主进程都在），角标由 PomodoroIntegrationService 直接调。
> 删掉还是并成一套要拍板；本轮没有为了让测试变绿去造调用方。
> 最后 1 条幽灵 `window.api.video.readFile`（PlaybackPanel 读录像文件）需要「只允许读历史里记过的路径」
> 这类守卫，属设计决定，没顺手写。
>
> ~~剩下的 17 条不是同一种病~~ 当时的判断：`pin:*`（10 个 handler + 3 个推送）连**创建钉图窗口的代码都不在树里**，
> 归 C 类；`platform:{setDockBadge,setProgressBar,requestUserAttention}` 与
> `recording.markers.{list,add,remove,rename}`（4 条）才是同型的缺桥。
> 另有 3 条 preload 写了、主进程没有：`pomodoro:dispatchShortcut`、`region-overlay:submit/cancel`
> （后两条与 `RegionOverlay.ts` 的 `frond-region://` 协议撞车，先判哪条是正的再动）。

| 功能域 | 缺的调用 | 证据 |
| --- | --- | --- |
| 截图库 | 16 处：`screenshot.history.{list,recent,openFile,showInFolder,storageUsage,setSaveDirectory,getSaveDirectory,delete}`、`screenshot.{startCapture,captureWindow,endCapture,getWindowList}` | 主进程 `src/main/ipc/screenshotHistory.ts` + `src/main/modules/screenshot.ts` 共注册 14 个 `screenshot:*` handler —— **已接回**（本行留作判定样例）。**2026-09-23 变更**：`screenshot.history.*` 那 10 个从来没注册过（`registerScreenshotHistoryHandlers` 零调用方），且渲染端已无消费方，整条待清理（§11 待清账 1）；`screenshot.{startCapture,endCapture}` 现在打到上游 `electron-screenshots`；`{getWindowList,captureWindow}` 留在 `services/windowSources.ts` 但渲染端无入口 |
| （已修，同类参照） | 密度档 / 玻璃档 / 紧凑模式 9 个方法 | `f63fd57` 就是这一类的先例：store 与 ipc-contract 都在，只有 handler + preload 那截没了 |

涉及渲染端文件：`views/screenshot/{index.vue,components/HistoryPanel.vue,components/WindowPicker.vue,pages/CapturePage.vue}`。
**（2026-09-23 追注：这四个文件连同整套树内截图编辑器已删，见 §11.1 —— 本行只留作判定样例，别再照它去「复原」。）**
**现在的症状不是报错列表，是「界面画得出来、一点就 TypeError」**——所以它比 146 条类型错更靠近用户。

### B 类 · 两头都没 —— 要按现存调用点重建两侧协议

| 缺 | 用在哪 | 说明 |
| --- | --- | --- |
| ~~`screenshot.{ready,ok,cancel,save,onCapture,onReset,removeListeners}`~~ **已解决（2026-09-23）→ 同批又删掉（§11.1）** | `views/screenshot/pages/CapturePage.vue`（已删） | 原判「两头都没」是**错的**：主进程一直有这些通道，只是名字叫**大写** `SCREENSHOT:ready/ok/save/cancel` 与推送 `SCREENSHOT:capture/reset`（`ScreenshotService.ts`）。桥已按真名接回 preload |
| `screenshot.pin.create` | `views/screenshot/components/Screenshots.vue` | 钉图 |
| `video.readFile` | `views/screenRecorder/components/PlaybackPanel.vue` | 录屏回放读文件 |

### C 类 · 2026-09-23 **翻盘**：dev-server 缓存里捞回 522 个原始件

原判「全盘无副本、只能重写」是**错的**。`~/Library/Application Support/frond-desktop/Cache/Cache_Data/`
（909 个 entry，50MB）里存着开发期 vite dev server 的响应体，**其中 522 条带内联
`//# sourceMappingURL=…base64` 且 `sourcesContent` 是原始 `.vue` / `.ts` 全文**。
`_compiled-from-cache/` 那份转储只留下了 `?vue&type=style` 的样式分片，所以此前误判为「无副本」。

取法（可重跑，一条命令）：对每个 entry 取 `createHotContext("/src/…")` 里的 URL 当真实路径
（`__vite__id` 只有样式分片才有，两者互斥），再把内联 map 的 `sourcesContent[0]` 解出来。
按这个办法落盘到 `/tmp/cache-dump/src/`，**128 个原始件**（含 `.vue` 与 `.ts`；同一模块被访问过多次时取最长的那份）。

已回灌的（都是缓存里的原件，不是重写）：

| 类别 | 数量 | 明细 |
| --- | --- | --- |
| 启动器页组件 | **10 全部回来** | AIChat/BrowserTabs/Calendar/Dictionary/Notes/Reminder/Settings/SystemInfo/Trash/WindowSwitcher；另有老名 `FocusStatsPage` `SnippetsPage`（注册表仍引用） |
| 缺的 `.vue` 组件 | 8 | `ui/{UBadge,UButton,UEmpty,UProgress,UToastProvider,UTooltip}`、`RouteLoading`、`shell/TopBar`、`EmojiSuggest` —— **缺 `.vue` 在 typecheck 里是静默的**（`declare module '*.vue'` 兜住了），只在 build 时才炸，所以 §10 之前只数到 10 个页组件 |
| 截图区组件 | 7 | `CaptureModeBar` `CountdownDisplay` `ScreenshotsMagnifier` `operations/{Ok,Redo,Save,Undo}` |
| 「机械还原」件换回原件 | 7 | `useCommandPalette` `useModuleShortcuts` `useTrackpadGesture` `utils/routePerf` `operations/Brush/draw` `utils/composeImage` `utils/getBoundsByPoints` —— 类型标注全回来了 |
| 顶格 `~~~ 第 N 行未留存 ~~~` 占位件换回原件 | 6 | `AppIcon`（19 处洞）`FilesPage`（94 处）`DelaySelector`（44）`WindowPicker`（54）`ScreenshotsTextarea/index`（29）`operations/Text/index`（59） |
| 录屏 composable | 2 | `useMarkers` `useVideoClip`（`_recovered-usable` 之外在 `partials--zcode-older` 里有完整副本） |
| 掐头件重建 | 2 | `FormPage.vue`（盘上那份从 `<template>` 中段开始）← 缓存原件 374 行；`ClipboardPage.vue` 手工缝合：删掉被贴了两遍的 `pinSelected`/`removeSelected` 与孤立的 `copySelected` 尾巴，`aiProcess`/`openLink`/`moveSelection` 三件套换回原件 |
| 丢的渲染层类型模块 | 2 | `types/system.ts` `types/log.ts` —— **写成对 `@preload/index.d` 的转发**，不手抄字段（该文件自己的注释就说过手抄副本漂过一次） |

读数：`typecheck:web` **122 → 58**；幽灵 API 仍是 2（新装的页没引入新幽灵）；
单测 **836 passed / 8 failed**（失败集不变）；`prettier --check` 对新装文件全过。

#### 10.1 第二轮（同日，接上）：主进程与渲染层都跑通到 build

补装/重建：`RecordingSettingsDialog`（zcode-older 完整 796 行，**清单此前把它记成「无副本」是错的**）、
`ui/USkeleton`（同作者另一 electron-vite 项目 `~/Desktop/leaf-library` 里有完整件，本树 token 已具备）、
`views/AboutView.vue` 与 `views/pomodoro/index.vue`（zcode-older）、`useMultiPomodoroTimer.ts`
（盘上那份是 **12 行桩**，缓存里是 628 行原件 —— 番茄钟引擎整个是空的）、
`operations/Rectangle/index.vue`、`ScreenshotsOperations.vue`（两份都是「盘上短、缓存长」）。
另新建 6 个重建件：`BackgroundSwitch` + 5 个统计组件（`TrendChart`/`ProjectDonut`/`HourHeatmap`/
`TaskCompletionStats`/`ProjectChip`）—— 缓存与所有池内都无副本，形状按调用点与 store 类型对齐，
文件头已写明「重建件」。`CodeScreenshot.vue` 的五档渐变改成 `--code-shot-*` 变量发布，重建的
`BackgroundSwitch` 靠继承取同一组色值，不抄第二遍。

主进程侧三个缺口（`electron-vite build` 实测出来的，typecheck 看不见）：
`src/main/modules/pomodoroShortcuts.ts`（重建：全局键 + `pomodoro:shortcut` 只发主窗 +
顺手把幽灵通道 `pomodoro:dispatchShortcut` 的主进程半边接上）、
`src/main/utils/imageConvert.ts`（重建：`sips` 转 HEIC，与 `ipc/applications.ts` 同一手法，按
「路径+mtime+size」缓存）、`src/preload/index.d.ts` 里 `from './mcp'` 改指 `../shared/mcp`
（`McpToolCommand` 真身在那儿，`preload/mcp.ts` 从来不存在）。
**main 与 preload 现在已经能 build**，卡在渲染层。

读数（第二轮）：`typecheck:web` **58 → 26**（补语法 JSON 后再降到 **15**）、`typecheck:node` **30 → 27**、
单测 **846 passed / 8 failed**（失败集仍是结构性缺件那 8 条 + 3 个收集错误文件）。

#### 10.2 剩下多少，怎么量（这两条命令是权威口径，别再凭 §10 旧表推算）

```bash
node scripts/recovery/scan-vue-imports.cjs   # 全树里 import 了但不存在的 .vue → 现在 0 个
node scripts/recovery/scan-vue-parse.cjs     # @vue/compiler-sfc 解析不过的 .vue → 现在 1 个
npx electron-vite build                      # main 229 / preload 3 模块已过；renderer 卡在那 1 个
```

**2026-09-23 第三轮末的实测**：缺件 11 → **0**（`TagInput` `CodePreview` `TransitionSelector`
`snippets/Sidebar` 与番茄钟那 7 个都已按调用点重建，文件头都标了「重建件」）；
解析不过 22 → **1**（只剩 `views/snippets/components/SnippetList.vue`，13 行掐头件，全树最大的一格）。
`typecheck:web` 15 → **6**。build 第一次跑到 renderer 深处（main + preload 全绿）。
（脚本已收进 `scripts/recovery/`，还有一个 `scan-main-imports.cjs` 管主进程侧；口径：前者按 alias 表把 `from '*.vue'` 解析到磁盘路径、再看缓存有没有原件；
后者逐个 `parse()` 报第一个语法错。**别只看 typecheck —— 缺 `.vue` 被 `declare module '*.vue'` 兜住，
截断的 `.vue` 在 vue-tsc 里也常不出错，只有 build 会炸**。）

- **缺组件 11**：`CodePreview` `TagInput`（都只被 `snippets/Editor.vue` import，模板里没有 —— 该文件的
  模板被削掉 0…N 行，见下）、`TransitionSelector`（`ExportDialog.vue` 的整个 `<template>` 块没了）、
  `snippets/components/Sidebar.vue`（真用，带 4 个 v-model/props）、
  以及 `views/pomodoro/` 的 7 个（`FocusAssets` `FocusRecordPanel` `ModeSelector` `SettingsDialog`
  `TaskEditDialog` `TaskListPanel` `TimerRing`）—— **这 7 个是回灌老版 `views/pomodoro/index.vue`
  之后才暴露的**：盘上现存的那批 pomodoro 碎片（`PomodoroDetailPanel` 14 行、`TaskList` 24 行、
  `TodayStatsBar` 60 行）与它们同属一代。`FocusAssets.vue` 本会话早些时候当死代码删过，
  它唯一的调用方就是这代页面 —— 删早了。
- **解析不过 22**：`FocusShield` `LaserPointer` `MarkdownPresentation` `MarkdownPreview`
  `ui/UModal` `ui/USelect` `MigrationCenterView` `shell/Sidebar` `views/launcher/index.vue`
  `pomodoro/{PomodoroDetailPanel,TaskDetailDrawer,TaskList,TodayStatsBar}`
  `screenRecorder/{ClipEditor,ClipTimeline,PreviewPanel,RecordingHistory,SourceSelector,ClipPage}`
  `screenshot/OcrResult` `snippets/{Editor,SnippetList}`。形态是**掐头或去尾**：
  例如 `TodayStatsBar` 从模板中段开始、`FocusShield` 的 `<style scoped>` 被切在半条规则里、
  `Editor.vue` 停在第 1099 行的一个 `<span>` 上。缓存里只有 `shell/Sidebar.vue` 与
  `views/launcher/index.vue` 两份原件。
- 二进制资产：`resources/icon.png` 整个目录不在树里（`tray.ts` / `windows.ts` / 协议图标 3 处 import）。
  本机只有同作者 `leaf-library` 那份 512×512 脚手架默认图，**我把它当占位放进了 `resources/`（未提交）**，
  换不换、用哪张图待拍板。
- **10 份 `textmate/*.tmLanguage.json` 已补回**（`src/renderer/src/components/editor/grammars/textmate/`，
  2026-09-23）：js/ts/css/html/python 取 `node_modules/.pnpm/codemirror-textmate@1.1.0` 自带 demo
  （消费方就是 codemirror-textmate，用它自己的样例最稳），json/markdown/yaml/shell-unix-bash/sql
  取本机 `/Applications/Visual Studio Code.app/Contents/Resources/app/extensions/*/syntaxes/`
  （仓库原来的文件名 `shell-unix-bash.tmLanguage.json` 与 VS Code 一致，说明当初就是这么来的）。
  十份的 `scopeName` 逐个核过，与 `languages.ts` 声明的一致（yaml 要挑 `yaml.tmLanguage.json`，
  同目录那几份 `yaml-1.x` 的 scope 是 `source.yaml.1.0` 之类，不匹配）。
  重跑命令：见本节上面几行的路径，`cp` 到 `grammars/textmate/` 并改小写名即可。
- ~~`example-plugin/` 目录仍缺~~ **已重建（`13f06e1`）**：清单 + 演示入口 + `launcher-api.d.ts`，
  两条插件审计（manifest / api-parity）共 50 条全绿。顺带修掉 5 个内置插件把 `onEnter` 载荷读成
  `data.command` 的错（runtime 发的是 `cmd`，见 `c2f76b0`）——那条 bug 的表现是「第二条命令打不开」。


#### 10.4 build 首次跑通，以及 e2e 目录自己的两处损坏

`npx electron-vite build` **exit 0**（out/{main,preload,renderer} 14MB）—— 事故后第一次。
补齐的是 vite 配置里那三个 Node 模块替身（`path` / `url` / `source-map-js` alias 指向的文件
只剩 fs-polyfill.ts 还在），见 `bf180b0`。

e2e 侧另有一类损坏，**不是渲染层的**：
- `e2e/user-theme.spec.mjs`：同一个 helper + 同一个 test 被贴了两遍（第二份是 prettier 后的形态），
  `node --check` 直接 SyntaxError → 整个 spec 收集失败。删掉第一份，2 条 test 保留。
- `e2e/launcher.spec.mjs`：**基线提交里它就只有 1 行，而那行是某次会话把工具回执当成文件内容写了进去**
  （原文 `Wasted call — file unchanged since your last Read…`）。reconstructed/e2e、_recovery-* 各池、
  git 全历史都没有第二份 → 没有可回灌的东西。现在改成一条显式 `test.skip` 并写明原因，
  不写「看起来会过、其实什么都没测」的替身。启动器链路目前由 capsule-*/command-palette/
  plugin-arg-slots 那几个 spec 覆盖。
- 自查命令：`for f in e2e/*.mjs; do node --check "$f" || echo FAIL $f; done`。
  （spec 数量别写死：`ls e2e/*.spec.mjs | wc -l`。2026-09-24 校正时是 **31** ——
  此前这里写的 32 含批次 1 清掉的 `zz-scratch*` 草稿 spec。）

（上面这张「剩 12 个」的旧表已被 10.2 取代：`BackgroundSwitch`、5 个统计组件、`USkeleton`、
`RecordingSettingsDialog` 都已到位，同时暴露出更大的盘面。）

#### 10.3 两处「账外」的坑（2026-09-23 同日清掉，记法以防再被误判）

1. **`src/assets/main.css` 不是死副本，是放错层的唯一 CSS。** 三个入口
   （`main.ts` / `launcher-entry.ts` / `screenshot-entry.ts`）都 `import './assets/main.css'`
   → 真身路径是 `src/renderer/src/assets/main.css`，而盘上那份在 `src/renderer/assets/main.css`
   （上一轮从 dev 缓存的 `__vite__css` 里取出时放高了一层），`src/assets/main.css` 则是**同一次
   转储留下的编译后 JS 模块却叫 `.css`**（开头是 `import { createHotContext … }`）。
   后果：**整个渲染层无样式** —— 这也解释了为什么这一轮之前任何「看界面」的验证都不成立。
   现在：`git mv` 到真身路径 + 删掉那个假 `.css`。
   留一笔：这份 main.css 是 **P-6 拆 tokens 之前**的版本（`styles/tokens.css` 的每条非空行都
   能在它里面找到，即 tokens ⊆ main.css），所以两份现在重复定义同一组值；
   要收尾就把 main.css 里的 token 段删掉、改成 `@import './styles/tokens.css'`（当前没有任何文件
   import tokens.css，只有注释提到它）。
2. **`src/` 下那批与真身同名的死副本已删（46 个文件）**。逐个解析过全仓 import/`import()`/配置串
   （按 `electron.vite.config.ts` + `tsconfig.web.json` + `vitest.config.mts` 三套 alias 表实解）：
   **0 处引用**，46 个全部在 `src/renderer/src/**` 有对应真身，无一是唯一副本，也没有哪个导出只在
   浅层有。它们不在 `tsconfig.web.json` 的 include 里，也不在 vite 解析路径上。
   （原先记成「待拍板」的那段 ↓ 已作废）

~~**另记一笔待拍板**：`src/` 下与渲染层真身同名的那批**已提交**副本（`src/composables/`、`src/commands/`、
`src/launcher/`、`src/router/`、`src/stores/`、`src/utils/`、`src/views/`、`src/constants/`、`src/components/`）
既不在 `tsconfig.web.json` 的 include 里、也不在 vite 的解析路径上（真身是 `src/renderer/src/**`），
是基线快照带进来的**死副本**——要不要清掉归用户定，本轮没动。


### D 类 · ✅ **已做完（`8f4dc68`）** —— 回拷 19 个内置插件

`~/Library/Application Support/frond-desktop/launcher-plugins/` 里的 **21 份已安装副本**已回拷进
`plugins/`（每份只有 plugin.json + index.html，安装流程不塞 node_modules）。
回拷前逐条核过版本：与静态市场索引 `plugins.json` 21/21 相符；**唯一例外 `com.frond.regex` 没被覆盖**
（索引与仓库源都是 1.1.0、带 P-1.6b 的三参数声明，而已安装副本是旧的 1.0.1——覆盖就白做）。
反倒 `com.frond.quickfolders` 是仓库这份坏的：缺入口 `index.html` 且停在 1.0.0，按已安装的 1.0.1 补齐。
读数：`pluginManifestAudit` 从 `expected 2 to be greater than 15` + 2 条断言红 → **9/9 全绿**；
全量单测 789 → 792 通过、47 → 44 失败。

### E 类 · 实现里少了测试点名的导出（**测试就是规格**，逐个补即可）

| 少的导出 | 谁要 | 归属 |
| --- | --- | --- |
| ~~`diffPermissions`~~ **已补（2026-09-23）** | `pluginConfirm.test.ts` 6/6 绿 | P-3④：连带把「更新时重一档问法」的分支也接回 `confirmPluginImport`（`!fresh && added.length>0` → warning + 按钮「保留当前版本/仍要更新」且默认拒绝） |
| ~~`mapAuthStatus` / `extractAndSortMeetings`~~ **已补** | `CalendarService.test.ts` 5/5 绿 | **这是条活 bug 不是缺测试**：`CalendarService` 解析侧仍写 `parsed.status !== 2`，而 JXA 那边 gate 的是 3 —— 已授权用户走进去被判 notDetermined 且 events 返空，日历整块空。改完两处共用同一个映射函数，单位也统一（raw 存秒，不再一处 *1000） |
| ~~`argPrefixMatch`~~ **已补** | `searchArgPrefix.test.ts` 5/5 绿 | P-1.6b：连带 `searchEntries` 的接入（只给 `acceptsArgs` 条目吃前缀命中、整条匹配排前面） |
| ~~`BUILTIN_COMMANDS`~~ **已了结** | `scratch-score-perf.test.ts` | 全盘无踪迹：真名是 `buildStaticCommands()`。该文件自己写着「一次性测量脚本（跑完即删）」——**不为此多造一个重复导出**，改测试指向真函数 |
| ~~`applyDbFile`（连带 `validateSqliteFile`）~~ **已补** | `cloudBackup.restoreFullDb` 生产 import | 从 `importDb` 抽出「关连接→备份现库→清 WAL/SHM→覆盖→延后重启」两处共用；**必须同步**（云端还原在 `finally` 里就删临时文件，异步复制会踩空） |
| ~~`migrate{Ai,Clips,Markers,RecordingSettings}FromLegacyStore`~~ **已补** | 4 个 `dataMigrations*.test.ts` → **24/24 绿** | AI 密文原样搬运（apiKey 是 `enc:`，跨机搬不动）；clips 整坨；录屏设置**整份**搬（按 repo 投影挑字段会把 systemAudio 这类静默丢掉）；markers 秒→毫秒且保留 id。幂等各记各的 frond_meta 标志，失败下次启动重试 |
| ~~`renderExpansionWithCursor`~~ **已补 + 4 条新用例** | `textExpansion.renderTemplate` 生产 import | 补之前 `{cursor}` **全树无人处理**（`expansionTemplate.ts` 里连 'cursor' 字样都没有）。索引按**码点**算：消费方是 `[...payload].length - cursorIndex`，两边不同尺子时 emoji 开头的模板会把光标删进正文 |

### F 类 · 掐头件（同一文件头被吞，`TS18004` + `TS2304` 是签名）

~~`composables/useMarkdown.ts`、`composables/useTags.ts`~~ **已按签名重建（2026-09-23）**：
两个都只剩「签名 + return」，而**那份签名就是规格**（`scale: ShallowRef<string|undefined>`、
`getTagsByIds(ids) => Promise<Tag[]>`），实现照 `window.api.tag.*` 通道与
`MarkdownPreview` 既有的缩放口径（0.5–2、±0.1）填。缩放是我选的口径，
所以补了 4 条用例钉住（`useMarkdown.test.ts`，该文件此前零测试）。
`typecheck:web` 138 → **122**（这两文件与它们的消费方全部干净）。

**同型但没救回来的一条**：`views/screenshot/components/ScreenshotsCanvas.vue` 引用
`useDispatcher`，全盘无此模块 —— 那不是掐头，是整件丢了，归 C 类。**先按 recovery 记忆里的三步查**：source map 解码 → `=== X ===` 拼接缝 → 池内副本。

### G 类 · 通道登记册不一致（不是缺功能，是账不平）

`ipcContract.test.ts`：`system:frontmostContext` 在主进程注册了但登记册里没有。
顺带说明 P-4⑤「Screen Awareness」的**主进程半边可能已经存在一半**，动它之前先读这条通道是谁注册的。

### H 类 · 纯断言不符 —— **2026-09-23 逐个判完（5 条：3 条真回归、2 条测试侧）**

| 条目 | 判定 | 处置 |
| --- | --- | --- |
| `market.isUpdatable` | **真回归**（我 P-3② 的活被回退成「字符串不等即可更新」，正是当初修掉的「20 个内置插件长期显示可更新」） | 改回 `compareSemver(...) === 1`；两侧任一解不出 semver 才退回「不等即可更新」宁多不漏 → **47/47 绿** |
| `ScreenshotIndexService.parseShotQuery` | **真回归**（`text: total` 这类「冒号后带空格」的写法整条匹配不上，掉进自由文本分支） | 正则加 `\s*` 分支（引号 / 空格后接值 / 紧贴值三种），读数口径不变 → 7/7 绿 |
| `capsuleGlass` 玻璃档 | **真回归**（`setProperty(name, null)` 是「显式设成非法值」，带 fallback 的 `var()` **不会**用 fallback，整条声明 IACVT —— 玻璃档切回「无」时胶囊变成透明而非默认底色） | 改为 `removeProperty` + 注释写明为什么不能用 null → 7/7 绿 |
| `windowGeometry` 六分右列 | **测试侧**（基线 8446ff2 起就红，测试文本没被谁动过：实现算 `5×(1000/6)`=833.33…3，断言写 `1000−1000/6`=833.33…4，差 1 ULP，消费方一律 `roundRect` 取整后同为 833） | 断言拆成逐字段：`width/y/height` 精确等、`x` 用 `toBeCloseTo(...,6)`。探针（把 `5*sixth` 改成 `4*sixth`）确认仍会红 |
| `hyperKey` | **测试环境**，非行为不符：`vi.mock('electron')` 对外部化的 `electron` 无效，命名导出取不到 → 拿不到 mock 的 `BrowserWindow` | **未动生产代码**。要修得先配 vitest 的 `deps.optimizer`/alias 让 electron 可 mock，属测试基建，另排 |

**顺带被照出来的真重复（2026-09-23 已拍板并清掉，见下）**：`mergeCommands.test.ts` 原本断言的是不存在的
`STATIC_COMMANDS`，改成 `buildStaticCommands()` + 「firstParty 每条都必须在结果里」之后，
`ai:translate` / `ai:summarize` / `ai:rewrite` 报为重复 ——
`src/shared/commands.ts:332/340/348`（`FIRST_PARTY_COMMANDS`）与
`src/renderer/src/commands/FirstPartyCommandProvider.ts:30/40/50` **各一份**，
而两个源都注册在 `CommandLoader`。⌘K 里是不是真出现两行要看装载时的去重顺序，
而 `electron-vite build` 仍被 C 类缺页挡住跑不了 e2e —— **改命令表等于改用户可见面，先记账**。

**H 类判完的读数**：单测 836 passed / **8 failed**（红文件 107 绿 / 3 红）。
剩下 8 条**全是结构性缺件**，不在 H 类：`ipcContract` 6 条（G 类幽灵通道 + C 类缺页组件）、
`renderer-api-parity` 1 条（C 类）、`mergeCommands` 1 条（上面那条重复）。


**命令表重复的处置（2026-09-23 拍板：命令以 Provider 为准，模块行以 `MODULES` 为准）**：
`ai:translate` / `ai:summarize` / `ai:rewrite` 从 `FIRST_PARTY_COMMANDS` 删掉（Provider 那三份留，
图标名 `ri-translate`→`translate-2`、`file-list`→`text-wrap`、`edit`→`edit-line` —— 那个前缀重复会让
`AppIcon` 拼成 `ri-ri-translate` 渲染成空；副标题取静态清单里更具体的那条）；
`firstparty:ai`（与 `ai:chat` 同标题同动作）、`recording:start`（与 `module:screenRecorder` 同标题同动作，
且它的 action 本来就是模块导航，注册顺序还压掉了模块行）两条整条删除。
`mergeCommands.test.ts` 的「真数据不许有重复」现在 **5/5 全绿**，它的作用变成防止再长回来。

#### 10.5 缓存里连 html 都有，外加一个让 `.ts` 配置空转的地雷（`79d4835`）

**截图窗的入口页整页不存在**：`ScreenshotService` 生产的
`file://…/renderer/screenshot.html` 和开发的 `:5173/screenshot.html` 都指向空气，
所以事故后截图标注 UI 从没被构建校验过。原件在 `Cache_Data` 里（键
`http://localhost:517X/screenshot.html`，响应体就是 vite 加工后的 html，**不需要 sourcemap**）：
去掉注入的 `/@vite/client` 那行即可原样回灌，连 OCR 走 CDN 的 CSP 注释都在。
枚举「还有哪些页丢了」用这条（只找到 launcher / screenshot 两页被 HTTP 请求过，其余走 file:）：

```bash
cd "$HOME/Library/Application Support/frond-desktop/Cache/Cache_Data" && python3 -c "
import os,re,collections
hits=collections.Counter()
for n in os.listdir('.'):
    if not (n.endswith('_0') or n.endswith('_1')): continue
    for m in re.finditer(rb'http://localhost:\d+/([A-Za-z0-9_\-./]+\.html)', open(n,'rb').read()):
        hits[m.group(1).decode()]+=1
print(dict(hits))"
```

**地雷：未被跟踪的 `electron.vite.config.js` 抢在 `.ts` 前面**（electron-vite 找配置是
js→mjs→cjs→ts 的顺序）。它是 09-22 恢复时按 `.ts` 格式化出来的副本，此后所有对 `.ts` 的
改动全部空转 —— 表现就是「input 明明加了四页，build 只出三页 html」且不报任何错。
副本留在 `/tmp/electron.vite.config.js.shadowing-copy` 备查；**下次 build 页数对不上，先 `ls electron.vite.config.*`**。

**iconfont 是唯一确认拿不回来的东西**：`views/screenshot/icons/`（`.less` + woff2/woff/ttf）
不在 git、不在任何池、字体二进制也不在缓存。类名与「类→字形」的对应从缓存里 `Screenshots.vue`
的已编译样式（`__vite__css`）逐条还原，11 个 `.icon-*` 全部改用本入口已加载的 remixicon 码点。
原件那条 `[class^='icon-']` 通配**故意没搬**：它会连到无关的 `.icon-btn`（TaskDetailDrawer 在用）。

**semantic 层首次全放行后露出的 23 条 `typecheck:node`** —— 全部文件当时都 `clean@HEAD`，
即**存量缺陷而非本轮改出来的**（此前被一个语法错整层屏蔽）。逐条：

| 位置 | 真相 | 处置 |
| --- | --- | --- |
| `ipc/shotIndex.ts:45-118` | 尾部粘着 `recordingSettings.ts` 的整份字节相同副本（接缝没切干净） | 切除；真件在 `ipc/recordingSettings.ts`，router 注册的是它 |
| `ipc/markers.ts` `clearMarkers`/`exportToCSV` | 契约与 preload 都发单对象，这两个还挂在裸 `ipcMain.handle` 的位置参数上（且 `ipcMain` 根本没 import）| 转 `typedHandle`，与其它四个一致 |
| `cliphist:setKeywords` | handler 调 `clipboardHistory.setKeywords`，服务侧没这方法 → 每次调用必 TypeError；而**两处渲染层搜索都在读 `item.keywords`** | 补 `keywords?: string[]` 字段 + setter（JSON 索引 `...i` 落盘，无需迁移）。**写侧 UI 仍无人调，见下** |
| `ipc/log.ts` | `log.export()` 写失败返回 null，直接塞进 `detail` / `showItemInFolder` | null 早返回 |
| `automation/store.ts` | 按另一套 logger 签名写的（`info(msg)` / `error(scope, {obj})`） | 改 `info('automation', msg)` / `error('automation', msg, err)` |
| `automation.test.ts` | harness 的 `run` 默认实现 0 参，`TickDeps.run` 是 2 参 | 参型对齐，调用点不动 |
| `dnsPinning.test.ts` ×9 | 没 import `LookupAddress`，回调类型与 `net.LookupFunction` 不一致 | 类型补全 |
| `syncMerge.test.ts:104` | `MergeRow = Record<string, unknown>` → `copy.id.startsWith` 打在 unknown 上 | `String(copy.id)` |
| `SnippetTransferService` / `renderer-api-parity` | 死常量 `CONTENT_TYPES`（内联三元已做同判据）/ 未用 `statSync` | 删 |
| `SnippetRepository.syncFts` | `@ts-expect-error` 守着一个 0 引用的 no-op「留位」方法 | 整删（web 程序里 `noUnusedLocals` 关着，故 directive 变「多余」） |
| `ScreenshotsCanvas.updateBounds` | 在事件回调里调 `useDispatcher()`（inject 型 composable 只能 setup 期跑）—— 原件为此用 `(store as any).dispatcher` 绕 | 提到 setup 顶层，`any` 与注释一并去掉 |

**读数（同日，配置地雷排除后）**：`typecheck:web` 与 `:node` **双 0 error**（事故后第一次），
单测 **110 文件 / 866 例**绿，`electron-vite build` **exit 0 且产出 4 个 html**。
`scan-vue-imports` / `scan-vue-parse` 均 **0**；`scan-main-imports` 剩 1 条是 `?asset` 查询串
（`windows.ts:3` 的 `resources/icon.png?asset`，文件在、env.d.ts 有声明）—— 扫描器不去查询串，假阳性。

**上一轮 e2e 读数不作数**：那 39 分钟是在 `.js` 配置空转下跑的（没有 screenshot 页，
`4 passed / 1 skipped / 9 did not run`，且 `playwright.config.mjs` 里 `FROND_SKIP_BUILTIN_PLUGINS`
+ `FROND_FILE_INDEX_SCOPES` 两行被贴了两遍 —— 已去重）。全量重跑读数待补在下一节。

**e2e 里目前唯一没被排除的窗口**：`e2e/launcher.spec.mjs` 内容在基线之前就被毁（见 §10.4），
显式 `test.skip`，不是「测过了」。

#### 10.6 「重建件台账」—— 37 个文件不是原件，别当原件信（2026-09-23）

恢复出的文件分两种，混在一起就会把重建件当原件信：
**找回原件**（可当原件用，只是 prettier 后可能有格式差）与**重建**（只按调用方契约对齐过，
没逐字还原过，行为细节可能是我猜的）。标记方式是文件头一行 `2026-09-23 重建件（…）`。

权威口径（别凭记忆数）：

```bash
grep -rl "2026-09-2[23] 重建" src --include="*.vue" --include="*.ts" --include="*.less" | wc -l
# 37 —— 渲染层 34 / 主进程 3
```

**本轮补的漏**：番茄钟那 7 个重建组件（`TimerRing` `ModeSelector` `FocusRecordPanel`
`TaskListPanel` `TaskEditDialog` `SettingsDialog` `FocusAssets`）**原先一点标记都没有**，
在树上与原件长得一样 —— 是我上一批重建的，却漏了记号。已按同格式补上。
这 7 个只按 `views/pomodoro/index.vue` 的 props/emits 绑定核对过（`@create` 在 357 行、
`:default-project-id` 在 353 行），**没跟事故前画面对过**。

**这 37 个里最该逐条真跑的（按「一旦我猜错就用户立刻看得见」排序）**：
截图标注整条链（首次进构建，见 §10.5）、录屏剪辑三件（`ClipEditor` / `ClipTimeline` /
`ExportDialog`）、`PreviewPanel`、`MigrationCenterView`、`OcrService`（新写）、`iconfont.less`（字形是我选的）。

**边界**：带标记 ≠ 行为与原件有差；**没标记也 ≠ 一定是原件** —— 见到漏标的按同格式补，
别默默当原件用。

#### 10.7 截图标注「所有工具按下去都没反应」的根因（2026-09-23，`e2e/screenshot-overlay.spec.mjs` 抓出）

`views/screenshot/` 里 7 处写成 `const dispatcher = (store as any).dispatcher`
（`useOperation` `useCursor` `useHistory` `useBounds` + `operations/{Ok,Save,Undo,Redo}.vue`）。
但 provider（`Screenshots.vue:145-151`）给的 context 是 `{ store, dispatcher }` **两件平级**，
store 上从来没有 `dispatcher` 这个键 → 取到的永远是 `undefined`，
于是 `setOperation` / `setHistory` / `setCursor` **全部静默空转**：
点矩形/椭圆/箭头/画笔/马赛克/文字不进模式，撤销/重做/确定前清选中态也不生效。
另两处同类伤：`useOperation`/`useCursor`/`useBounds` 返回的是 `xxx.value` **那一刻的快照**
（`useHistory` 早已改成 getter，注释还写着为什么必须用 getter —— 这三件被漏了），
所以即便写通了，工具按钮的选中态也永远不会亮。

**这不代表是我们弄坏的**：缓存里事故前那一份同样写着 `(store as any).dispatcher`
（`/tmp/cache-dump/src/views/screenshot/composables/useOperation.ts` 与树上只差注释与 `: void`）。
也就是说这条链在**删除事故之前就是死的**，而它此前从没被构建校验过（见 §10.5 入口页缺失），
所以也从没被测出。修法统一：改 `useDispatcher()`（与 `ScreenshotsBackground` 一致），
并把 computed 交出去让消费者的 `checked` 是活值。

**判据（新增断言的判别性已核）**：`e2e/screenshot-overlay.spec.mjs` 第 3 条
「选工具 → 在选区内画一个矩形 → 撤销从禁用变可用 → 点撤销又变回禁用」。
把 `useHistory` 的 dispatcher 那一行退回 `(store as any).dispatcher` 重算一遍：第 3 条红、
第 1/2 条不受影响（撤销按钮停在 `screenshots-button-disabled`）→ 断言咬的就是这一处。

**同一条 spec 还顺手抓到我自己的一处错**：`iconfont.less` 初版用 Less mixin 传 `'\eb7f'`，
Less 把它当关键字传参，编译出来 `content` 是空串 → 11 个工具按钮全是不占宽的空白
（`span` 宽 0）。改成「一类一行、不用 mixin」后 `content` 解析为真字符（私有区码点）。
`[class^='icon-']` 那条通配依旧刻意不搬。

#### 10.8 根目录那 11 个未跟踪的旧散件（2026-09-23 已移出仓库）

`commands/ composables/ launcher/ utils/`（仓库根，未跟踪，mtime 全部 2026-09-22 08:46）
是更早一次恢复会话把 `src/renderer/src/**` 按「去掉前缀」写歪到根目录的残渣，共 11 个文件。
**每一个都比树上的同名文件旧**，其中两条值得单记：

- `commands/SystemCommandProvider.ts` 散件 204 行 / 树上 51 行 —— 不是树上少了，
  树上那份是 P-7② 的重做（头注释写着：以前是 340 行手写清单，同一批命令在
  `SYSTEM_CMD_META` 又写一遍，导致音量五档这类成对出现）；散件正是**被淘汰的那一版**。
- `commands/FirstPartyCommandProvider.ts` 散件 353 行 / 树上 343 行 —— 差的就是 09-23
  从静态清单里删掉的 `ai:translate` / `ai:summarize` / `ai:rewrite` 那三条（§10 H 类）。

**处置**：整体移出仓库（没有就地删），落在
`~/Documents/frond-desktop-baseline-2026-09-22/recovery-material/root-scratch--2026-09-23/`，
11 个文件全在。移出前核过：tsconfig / eslint / vitest / playwright / electron-builder
没有任何一处引用这四个根目录路径；移出后 `git status` 未跟踪项归零，已跟踪文件一处未动。
复现口径（下回再有这类残渣）：`git status --porcelain -unormal | grep '^??'`。

#### 10.9 五个重建件「永远不会有原件」，以及它们里面对不上的写法

在 `Cache_Data` 里按 `createHotContext("…")` 数过一遍：`ClipEditor` `ClipTimeline`
`ExportDialog` `PreviewPanel` `MigrationCenterView` **五个都没有被 dev 服务过的记录**
（那段开发期没人打开过录屏剪辑/导出/预览/迁移中心这几页）。
所以它们只能照调用点重建，§10.6 那格里这五行**不是「还没找」而是「不可能再找回来」**，
别再花时间去扫缓存/池子。

对不上的一处写法：`ClipEditor.vue`（9 处）与 `ExportDialog.vue`（1 处）用 `alert(...)` 报
成功/失败，而本项目既有口径是 `useToast`（6 个 .vue 在用）。`alert()` 在 Electron 渲染端
能出原生对话框、但会阻塞该渲染进程，且与全应用的提示风格不一致。
**没有证据说明原件用的是哪一种**（原件不存在），所以本会话没有擅自改 —— 要统一到 toast
是 2 个文件 10 处的收敛，属产品决定。

同一类「重建时的猜测点」一并列在这（都按调用方契约对齐过，没跟事故前画面对过）：
`ExportDialog` 的默认导出参数（1080p/30fps/cut）、`ClipTimeline` 的时间轴刻度密度、
`PreviewPanel` 的空态文案、`MigrationCenterView` 的步骤顺序、`OcrService` 复用 worker 的策略
（`OcrResult.vue` 的注释里写明「不销毁单例」，这条有存证依据）。

#### 10.10 两类「静态检查看不见」的缺陷形状（本轮各咬到一次，记成检查项）

1. **`(x as any).<键>` 取一个不存在的键** → 拿到 `undefined`，配 `?.` 就静默空转。
   本轮 7 处这样的写法让截图标注的六个工具与撤销/重做全线失效（§10.7）。
   扫法：`grep -rn "as any)\.[a-zA-Z]" src/renderer/src src/main`（现存 3 条命中都是注释或
   合法写法：`Screenshots.vue:158` 往自己那份非响应式 store 上写 `url`，
   之所以没出事是因为覆盖层每次是整页重载 —— 这一点没有守卫，改覆盖层生命周期时要记得）。
2. **组合式函数把 `xxx.value` 那一刻的快照交出去** → 消费者的 `computed` 永不重算。
   `useHistory` 早就用 getter 修过并写了为什么，同一批的 `useOperation`/`useCursor`/`useBounds`
   被漏了。扫法：找 `return [` 里直接放 `.value` 的行（本轮扫过全渲染层，除这三件外无其它）。

共同的下一层守卫：这两类都不是类型错也不是断链，**只有「真跑一次并断言副作用」能抓到**。
`e2e/screenshot-overlay.spec.mjs` 第 3 条（画一个矩形让撤销解锁）就是为形状 1 与 2 各配一枚
断言写的，且它的判别性已核（退回形状 1 的写法只有第 3 条红）。

#### 10.11 `lint-css-changed` 与 stylelint 配置：两个「从未入库」的门禁件（2026-09-24 重建）

增量 CSS 门禁在事故后实际处于**三层全断**状态，且每一层都是静默的：

1. `scripts/lint-css-changed.mjs` 丢失且 `git log --all` 无任何提交史 —— package.json 的
   `lint:css:changed` 一直 MODULE_NOT_FOUND（README / CONTRIBUTING / ci.yml:39 四处调用点
   全在指向一个不存在的文件，ci.yml lint job 首跑必红）。
2. stylelint 配置同样从未入库、随事故从磁盘消失 —— `pnpm exec stylelint <任何文件>` 一直抛
   `ConfigurationError`（2026-09-24 实测复现）。
3. `lint:css` 尾巴上的 `|| true` 把 2 吞掉 —— 全量 CSS lint 事故后从未真正运行过。

这与 B16「lint-css-changed 静默跳过已暂存文件」同类：**静默跳过比失败更危险**。
（`docs/BUGS.md` B16 写「已修复」指的只是事故前磁盘上那份，修复件从未进 git。）

两个文件已按可考的调用点契约重建（原件永远找不回来，性质同 §10.9）：

- `scripts/lint-css-changed.mjs`：契约 = B16 的 `^(..)\s+(.+)$` 三态解析 + ci.yml:36-39 的
  增量零容忍 + CONTRIBUTING 的 .css/.less/.vue 范围。**与原件的声明差异**：新增 CI diff 口径
  （push 与 `event.before`、PR 与 base 的 merge-base）与 `--base` 参数 —— 原件只有 status
  口径，在 CI 的干净工作区下什么也查不到，「增量零容忍」只有 diff 口径才成立。
- `stylelint.config.mjs`（仓库根）：规则按文档契约重定 —— `color-no-hex` warning 级
  （存量容忍、增量由 STRICT_CSS_LINT=1 拦停）；**未** extends stylelint-config-standard，
  避免触碰旧文件时被与本次改动无关的存量 error 拦住，存量清账后再收紧。
- 两件均已登记恢复件台账（`rebuildLedger.test.ts` 的 RECOVERED_WITHOUT_MARKER）；重建契约
  固化在 `scripts/__tests__/lintCssChanged.test.ts`（B16 staged 截断是首条回归用例）。
- 配套：ci.yml lint job 的 checkout 补 `fetch-depth: 0`、lint:css:changed 步骤补
  `STRICT_CSS_LINT=1`；package.json `lint:css` 去掉 `|| true`。
  【未跑】CI 本身仍无远端可跑；diff 口径的 push/PR 路径只经注入式单测与本地 `--base` 验证，
  真实 GITHUB_ACTIONS 环境未跑过。

#### 10.12 主窗 sandbox 翻转落地 + e2e 基线真相核查（2026-09-24）

- **主窗 `sandbox: false → true`**（`src/main/modules/windows.ts`）—— 本仓最后一处非沙箱化
  webPreferences 消失，9 处全部 `sandbox: true`。原注释要求「真机跑完整 e2e 才翻转，不能靠
  推断」——照办了：preload 运行时依赖仅 `ipcRenderer`/`contextBridge`（其余 import 全是
  type-only，编译期擦除；`process.contextIsolated` 在沙箱 preload 可用）。
- **翻转无罪的对照证据**：翻转后全量 e2e 27 红/72 过；随后 stash 翻转、重建基线包、只跑同样
  11 个失败 spec —— 基线同样 27 红，失败集合一致，仅一对互相颠倒（`capsule-animation:93`
  翻转侧红/基线绿，`mcp-tool-search:168` 基线红/翻转侧绿；retries=0 下的 flake 互换形态）。
  结论：**27 条红全部是存量，与翻转无关**。
- **⚠ e2e 基线真相核查（比翻转本身更重要）**：HANDOFF 挂账原记「e2e 7 条红（density 2 +
  market-index 5）」，实测 **27 条红**（10.2 分钟，1 skip）——挂账严重过时。同日归因咬到
  第一个根因：**example-react/dist 是 09-22（改名前一天）构建的陈旧产物**（dist 不入库，
  dist 里 `leaf/launcher` 实证、源码已干净），react-view / capsule-animation 等 spec 拿它
  播种插件，断言等的是 frond/* 前缀 → 必红。重建 dist 后该簇转绿（27 → 23 红）。
  根治：playwright 挂 globalSetup（`e2e/global-setup.mjs`，开跑前重建 SDK → example-react，
  与 vitest.global-setup 同一模式；smoke 子集 12/12 验过接线）。
- **e2e 清红战果（2026-09-24 晚，27 → 18 红，修 9 条，eb6ae56）**：三簇根因已修——
  ①argsum 标题漂移：3d555fe 重建 manifest 时臆造标题「参数求和（内联参数槽）」，恢复原件
  spec 等的是「两格参数（内联槽）」，搜索按标题匹配 → 永远 0 行（arg-slots 3 绿）；
  ②`parsePluginView` detail 分支把 actions 硬编码 `[]`——SDK 明言「挂占位条目复用
  runPluginAction」，宿主把字段丢了（恢复期丢的行为细节；单测先红后绿钉死，P-2.6 绿）。
  ⚠ 改 shared/主进程代码后必须 `pnpm build` 再验 e2e，out/ 陈旧会让修复**假性无效**（本批实测咬过）；
  ③schedule ①断言与探针互斥（spec 期望 count=1，探针为 ② 刻意排 2 条）——按真实契约
  对齐为 count=2，且 ①②③ 一律按 `cron='*/15 * * * *'` 精确取任务（不再依赖数组顺序）。
- **剩 18 红按簇证据（新挂账）**：market-index 5（旧账，网络类）；**plugin-schedule ②③**
  ——`automationRunNow` 返回 ok 但 `lastOk` 恒 null（投递回写断链），设置页 autoTasks 行
  不渲染（`automationList()` API 有数据、UI 空——疑同一渲染端数据面）；**mcp-tool-search 4**
  ——`mcpToolCommands()` API 返回 2 但胶囊搜索无 MCP 行（① 曾单跑绿，flake/时序待查）；
  ai-action 2 / ai-byom 2 / a11y:137 / command-palette:68 / file-index:95 ——未归因，
  下一步逐簇按同法处理（先读 error-context 快照，再对照 API 层数据，分清「数据没有」
  还是「数据在、渲染丢」）。

#### 10.13 发布链路首跑五连战：v0.1.0 真实上线 + CI 首跑真相（2026-09-24）

- **发布目标落地（d5ca865）**：publish 三处换真仓库 `zhangzhengyang27/frond`
  （`electron-builder.yml` / `dev-app-update.yml` / `AutoUpdateService.ts` 头注释）；
  `scripts/lib/releasePreflight.mjs` 的 `PLACEHOLDER_PUBLISH` 保留作**回归绊网**（谁改回占位值
  就拦），单测钉住真仓库解析（`releasePreflight.test.ts`）。同批对齐 RELEASE.md 承诺：
  release.yml 补 `CSC_IDENTITY_AUTO_DISCOVERY=false`（未签名豁免，D2）、发布资产补
  `latest-mac.yml` + `SHA256SUMS`（publish job 展平产物后生成，`sha256sum` 与 mac
  `shasum -a 256 -c` 格式兼容）、Release 正文带未签名告警。
- **五跑战果（tag v0.1.0 每跑一修一重指）**：跑1 `pnpm/action-setup` 传 `version: 9` 与
  packageManager 的 sha512 钉定冲突（"Multiple versions of pnpm specified"）→ 去掉 version
  输入（11701af）；跑2 `ERR_PNPM_OUTDATED_LOCKFILE` —— **b77fdaf（P1-1）把
  frond-plugin-sdk 的 react-reconciler 钉成精确 0.34.0 却没重生成 lockfile**，本机
  node_modules 已装好从不复检，CI `--frozen-lockfile` 秒咬 → `pnpm install --lockfile-only`
  补同步，diff 恰一行 specifier（4297812）；跑3 node-gyp 9.4.1 `import distutils` 挂——
  runner 默认 Python 3.13+，且 **postinstall 的 `install-app-deps` 不受 `npmRebuild:false`
  门控**（app-builder-lib `installOrRebuild` 无此检查，packager.js 的打包路径才有），
  `@parcel/watcher` 与 rebuild:native 的 better-sqlite3 都走 node-gyp → 各 job 钉
  `setup-python 3.11`（a24187f）；跑4 **空串 CSC_LINK 被当证书路径**——secret 缺失时
  Actions 注入空串而非 unset，`getCscLink` 的 `chooseNotNull` 不把空串当 null →
  `importCertificate` 把 `resolve("")`=项目目录当 .p12 → "not a file"；
  `CSC_IDENTITY_AUTO_DISCOVERY=false` 只挡 keychain 发现、挡不住显式 CSC_LINK →
  运行前 `[ -n "${CSC_LINK:-}" ] || unset CSC_LINK`（b108a84）；**跑5 全绿**：
  v0.1.0 上线 https://github.com/zhangzhengyang27/frond/releases/tag/v0.1.0
  （Frond-0.1.0-arm64-mac.zip 164MB / frond-desktop-0.1.0.dmg 171MB / latest-mac.yml /
  SHA256SUMS，未签名说明在 Release 正文，manifest 里 name 是 frond-desktop 故 dmg 前缀如此）。
- **tag 重指史**：v0.1.0 四次 `-f` 重指（4c509ad→d5ca865→11701af→4297812→a24187f→b108a84），
  每次被指提交的运行都未产出 Release 对象、tag 无任何消费者后才重指——不算「移动已发布 tag」。
- **CI 首跑真相（新挂账，与发布分开单开）**：①ubuntu/windows 的 Install dependencies 挂在
  postinstall 重编 `uiohook-napi` —— Linux 缺 X11 头文件（libx11-dev/libxt-dev/libxtst-dev
  一族，e2e job 装的是运行库不是头文件）；windows 未拉日志未归因；②**macOS 单测 3 红
  （909 过）全在 `lintCssChanged.test.ts` CLI 集成**：浅克隆下按 push 口径 diff
  `event.before..HEAD` → "Invalid revision range"——lint job 特意加了 `fetch-depth: 0`
  （ci.yml 注释），**单测 job 漏加**，一行可修；③e2e smoke / Build(Linux) 被 needs 连坐。
  修法都便宜，但要单开一批，别混进发布验证。
- **沉淀**：①Actions secret 缺失注入的是**空串**，凡用 `process.env.X != null` 判定的库都会
  中招，belt 是运行前 unset 空值；②`--frozen-lockfile` 这类一致性检查只在**干净环境**有牙，
  本机永远验不出 lockfile 漂移——lockfile 变更必须与 manifest 同 commit；③本机推送 GitHub
  的可用姿势：直连 + `http.version=HTTP/1.1`，或 `http.proxy=http://127.0.0.1:7890`（系统
  代理 Clash 7890，git 不读 macOS 系统代理）；api.github.com 与日志 CDN 跳转域直连不稳，
  走代理 + `--http1.1`。

### 剩下的账（2026-09-23 收工口径）

- **文档层的洞（2026-09-23 已按拍板全部重生成）**：6 份被链接指向、基线 `8446ff2` 起就没有、
  各池也无副本的文档已全部从代码重写完毕 —— `docs/ROUTING.md`(232) `DB_SCHEMA.md`(243)
  `MIGRATIONS.md` `SIGNING_MAC.md`(234) `THEME_AND_VOICE.md`(279) `PLUGIN_QA_CHECKLIST.md`。
  口径：**每条结论带 `文件:行号`，没跑过的操作一律标 `【未跑】/未证实`，不许预填「已验证」**。
  复核过的两件事：① 全仓 25 份文档共 729 条 `文件:行号` 引用，逐条对真树解析**0 条越界**，
  六份新文档另抽 6 条核内容（行号真、说法也对得上）。核对已固化成
  **`scripts/recovery/scan-doc-citations.cjs`**（exit 1 即有越界）—— 我此前手搓一次性脚本
  连错两次：一次用 basename 递归 glob 兜底，把 `src/main/index.ts` 撞进 `references/ueli/`
  的同名文件，误报 34 条「编行号」；一次不认「首次给全路径、后文用简写 `miniWindow.ts:55`」
  的写法，误报 345 条。**别再用临时 glob 核引用**。
  顺带被它抓到一处真过期引用：`docs/BUGS.md` 的 B12 还列着 `snippets/Sidebar.vue` 第 201 行，
  而该文件今天 169 行且根本没有 document 监听 —— 那一腿已删。
  （B11 那一格也早已修好：ClipEditor 现在用的是具名 handler，注释里就写着 BUGS.md B11；
  文档还挂着「未修」，下次动 BUGS.md 时一并清。）
  ② 两份文件一度「agent 回报已写入但磁盘上没有」，是等它们真正回报后才落盘核实的。
  重生成过程真抓到一个用户可见缺陷（见下）。
  **仍缺的两份不在拍板范围内**：`docs/modules/INDEX.md`（`docs/README.md` 末「模块文档」指着，
  `docs/modules/` 整个目录不存在）与根 `LICENSE`（选许可证是法律决定，等人给）。
- **内置插件 `com.frond.currency` 有网也永远报「请检查网络连接」**（2026-09-23 由 QA 清单的读码复核抓到）：
  `fetchRates` 取 `res.data`，而宿主 `proxyPluginFetch` 回的是 `{ok,status,body,contentType,error}`
  —— 没有 `data` 字段，于是 `rates` 恒为 `undefined`，`index.html:156` 的守卫必然走失败分支。
  已改为 `JSON.parse(res.body)` 并校验 `rates` 存在。**改完仍未真机验过**（要一张汇率图才算数）。
  全 21 个内置插件里只有 currency 用 `api.fetch`，所以这一类形状错仅此一处（扫法：
  `grep -rn "res\.data" plugins/*/index.html`）。
- **macOS 签名的前置缺口（2026-09-23 拍板：先记账，等有证书时一并处理，今天不动）**：
  `build/` 目录整个不存在，而 `electron-builder.yml:55` 的 `entitlementsInherit` 指着
  `build/entitlements.mac.plist`，同时 `hardenedRuntime` 与 `notarize` 都开着，主 app 也没有
  `mac.entitlements`。也就是「只差证书」这句**目前还差两件**：证书 + entitlements 四件套
  （要按本应用实际用到的能力给：child_process 起 ffmpeg、uiohook 原生模块、网络、屏幕录制）。
  顺带同批记的四处账实不符（都在 `docs/RELEASE.md`，2026-09-23 由 ROUTING/SIGNING 复核发现）：
  `release:preflight` 没接进 `package.json` 的 scripts、`release.yml` 里没有 preflight 与
  SHA256SUMS 步骤、`latest-mac.yml` 不在上传 glob 里、`:63` 注释写 electron-notarize 而实为
  `@electron/notarize@2.5.0`。另有 `mac.identity`/`forceCodeSigning` 未设、mac 图标缺失
  （`buildResources: build` 那目录本身是空的）。
- `clipHist.setKeywords`：**读侧齐、写侧没入口**（渲染层两处搜索都消费 `item.keywords`，
  但没有任何 UI 调 `setKeywords`）。要不要给剪贴板条目加「备注关键词」的编辑入口是产品决定，
  不是恢复遗漏 —— 别顺手当 bug 修。
- 截图标注整条链路：2026-09-23 曾由 `e2e/screenshot-overlay.spec.mjs` 三条真跑过（3/3 绿，
  并抓到两处静默空转的真缺陷，见 §10.7）—— 那条面**已整体退役并删除**，验收换成
  `e2e/screenshot-upstream.spec.mjs` 四条，见 §11 末尾的接线结果。
- e2e 全量重跑（配置地雷已排除，读数要重新取）。
- `src/main/ipc/typedIpc.ts.alt-from-snapshot` 仍被跟踪在 git 里（某次恢复留下的另一份 typedIpc），
  没进编译（后缀不是 `.ts`），属清理项。
- `hyperKey` 那 5 条要真验，得先给 vitest 配 electron 的可 mock 路径（测试基建，另排）。


## 11. 2026-09-23 拍板：截图与标注改用上游模块，自研那套进入退役流程

**决定**：不再自己维护那 59 个文件 / 7354 行的移植副本，改用 **`electron-screenshots@0.6.2`**
（依赖已声明于 `a88b85a`，尚未接线）。路径是 **先并存 → 真跑通 → 一个提交删干净**。

**触发这个决定的核查**（都带行号，别再回头查）：
- 迁移 `028` 已 `DROP TABLE ss_screenshots`（`db/migrations/028_remove_screenshot.ts:21-22`），
  但 `ScreenshotRepository` 仍在读写这张表（`db/repos/ScreenshotRepository.ts:87/125/163`），
  而 `ScreenshotService` 每次确认截图都会调它落历史（`services/ScreenshotService.ts:507-517`）
  → 抛「no such table」被 try/catch 只打成日志。
- 更关键的是**两套目录本来就不搭**：自研截图存 `userData/screenshots`
  （`ipc/screenshotHistory.ts:19-26`），而截图库读的 `shot_index` 只扫**桌面 + macOS 系统截图位置**
  （`services/ScreenshotIndexService.ts:74-91`）。净效果：**用自己标注工具截的图，
  文件在盘上，但永远不进截图库、也不进 OCR**。所以「修好自研那套的历史落库」并不是终点。
- 树内这套的出身也已经坐实是移植：`ScreenshotService.ts:58/271/428` 的注释写着
  「与参考项目一一对应 / 完全对齐参考项目 startCapture」，而 11 个 iconfont 类名与码点
  （`e001`-`e00b`）与 `electron-screenshots` 上游完全同形。

**接线时已经查清的两件事**（省得再翻包）：
- 渲染端不用我们自己造：`node_modules/electron-screenshots/lib/index.js:43` 自己
  `loadURL(file:// + require.resolve('react-screenshots/dist/electron.html'))`，
  预构建页（`electron.html` + `static/`）就在 `react-screenshots` 包里。
  打包时仍要核它落得进 asar 与否（`file://` 读 asar 内页面在 Electron 里可行，路径要实跑确认）。
- 采集侧不用 `electron-rebuild`：`node-screenshots` 走平台预编译
  （`node_modules/.pnpm/node-screenshots-darwin-arm64@0.2.8/…darwin-arm64.node`，N-API 与 Electron ABI 无关）。
  但打包要把它加进 `asarUnpack`（与 better-sqlite3 / uiohook-napi 同列）。

**一个环境坑，与本次装包无关**：`pnpm install` 的 postinstall（`electron-builder install-app-deps`）
在这台机器上必失败 —— node-gyp 9.4.1 撞 Python 3.14，炸的是 `@parcel/watcher`
（这次改动之前的 `pnpm-lock.yaml` 里它就出现 39 次，且树内从未有过它的 `.node`）。
所以装包要 `--ignore-scripts`；谁在这台机器上跑 `pnpm install` 都会撞到同一处。

---

### 11.1 接线结果（2026-09-23，本批）

**已经跑通并删干净。** 验收 = `e2e/screenshot-upstream.spec.mjs` 四条真跑全绿（4-6 秒）：
① `screenshot:startCapture` 的 handler 真在启动序列里注册（`main/index.ts:404` 那行是补的）；
② 起来的是上游预构建页（`react-screenshots/dist/electron.html`）；
③ 覆盖层里**真拖一个选区、真点「确定」**，图落进 `shot_index` 扫得到的目录并被搜到
（正例 `name:Frond-` + 反例 `name:zzz-绝对不存在-xyz` 成对）；
④ 点「取消」不落盘。工具栏 11 个 `title` 断言顺带证明 `lang` 传进了上游页面。

**这一批探到的四个坑，下次别重新踩**：
- `win.getViews()` 只列新 API 的 `WebContentsView`，上游用 `setBrowserView()` 挂的是 **legacy
  `BrowserView`** → 要 `win.getBrowserViews()`。拿错访问器会得出「覆盖层没起来」的**假结论**
  （我据此误判了一轮，还写进过 commit message）。
- `view.webContents.send('SCREENSHOTS:ok', …)` 是**主 → 渲**，永远不会触发 `ipcMain.on` 上
  同名监听（上游的监听在 `electron-screenshots/lib/index.js:265`）。要让页面自己发：
  它自己的 preload 暴露了 `window.screenshots.ok/save/cancel`（`lib/preload.js:15-26`），
  或者直接点工具栏按钮 —— 后者才是真 UI 路径。
- Playwright 的 `electronApp.windows()` **把 BrowserView 的 webContents 也列成 Page**，
  所以覆盖层能 `mouse.move/down/up` 真拖、`getByTitle('确定')` 真点，不必从主进程伪造事件。
- 两个断言写法坑：`expect.poll(数组).toContain('子串')` 比的是「数组含该元素」，元素是整条
  `file://` URL → 永远假阴；`main.evaluate(() => api.x().total)` 是在 **Promise** 上取属性，
  恒 `undefined`（要 `async () => (await api.x()).total`）。

**覆盖层要等图接上才能按**：`startCapture` 之后立刻 `mousedown`，选区起点会丢（只剩放大镜、
没有尺寸）。判据取放大镜文本 `坐标:`（它来自我们传的 `lang`，顺带证 `setLang` 生效），
并且每个轮询周期要重发一次 `mousemove`。

**新增 env 覆盖 `FROND_SHOT_DIRS`**（`services/ScreenshotIndexService.ts:74-90`，套路同
`FROND_FILE_INDEX_SCOPES`）：截图落盘与索引扫描都走 `screenshotDirs()`，覆盖后两边一致。
不加这条，e2e 会**往真实桌面写图**并扫整个桌面做 OCR —— 本次接线前确实这么污染过一次
（`~/Desktop/Frond-20260923101813.png`，已移出桌面）。

**贴图/钉图按拍板整体撤销**（「不要这贴图、钉图的功能」）。顺带查清一条事实：
`registerPinHandlers()` 全仓**零调用方** → 贴图从来就没通过，`650fd1b` 补的 `/screenshot/pin`
路由只是让窗口不空白，`pin:create` 照样 reject。删的是：`services/PinService.ts`、
`ipc/pin.ts`、`views/screenshot/pages/PinPage.vue`、路由 `/screenshot/pin`、preload 的 `pin.*`
与 6 个 `Pin*Res` 类型。

**同批删除**（编辑器侧，共 67 个 git 跟踪文件）：`views/screenshot/**`（59）、`screenshot.html`、
`screenshot-entry.ts`、`renderer/src/services/OcrService.ts`、`views/screenshot/icons/iconfont.less`、
`main/services/ScreenshotService.ts`（覆盖层类）、preload 的 `SCREENSHOT:*` 协议、
`e2e/screenshot-overlay.spec.mjs`、`electron.vite.config.ts` 的第四个入口。
→ **§10 的复原账本里 `screenshot.html` / `iconfont.less` / `OcrService.ts` 这几条现在作废**，
它们是这次删的，不是又丢了 —— 别再去 dev-server 缓存里挖。

**留下来的**：`listWindowSources` / `captureWindowSource` 搬进 `services/windowSources.ts`
（上游没有「按窗口抓图」）。

**待清账（本批刻意没做）**：
1. `ipc/screenshotHistory.ts` 的 10 个 handler + `db/repos/ScreenshotRepository`：唯一调用方
   （旧覆盖层的 `ok` 分支）已删，且 `registerScreenshotHistoryHandlers` 本就零调用方 → 整条死代码，
   而它读的 `ss_screenshots` 已被迁移 028 drop。删它要连 `db/repos/index.ts` 桶导出、
   preload `screenshot.history.*`、5 个 `Shot*Res`、`docs/{DB_SCHEMA,MIGRATIONS}.md` 两行一起动 → 另开一批。
2. `shot_index` 的 OCR 把「图里没有字」记成 `failed`（`ScreenshotIndexService.ts:224`
   `text ? 'done' : 'failed'`）。e2e 那张选区图就是 `failed:1`。语义上应是 `done` + 空文本。
3. 打包：`node-screenshots*` 进 `electron-builder.yml` 的 `asarUnpack`（上面记过，**仍未做**）。
4. 能力差：上游工具栏没有「贴图」，也没有窗口截图模式 —— 按拍板这是**取消**，不是回归。

**别做这几件事**：
- 别再去「修好自研标注的历史落库」——那是给要退役的一侧续命；要修就修新链路。
- `e2e/screenshot-overlay.spec.mjs` 三条与 `views/screenshot/*` 同批退役（它钉的是被替换那套的行为：
  拖选区、工具栏字形、选工具画矩形让撤销解锁）。新链路跑通后要另立断言：
  **「⌥⇧S 能起第三方覆盖层，确认后文件落进截图库扫得到的目录」**，
  否则这次替换又是一次「构建过、没跑过」。
- ⌥⇧S 那套可配置热键与本次替换无关，**保留**（`launcher/hotkeys.ts` 的注册链就是新实现要用的入口）。

## 12. 2026-09-23 改名 Leaf → Frond（8ba2116）：搬迁已经跑过，留给下手的五条

盘上存量在真机上搬完了（`~/Library/Application Support/leaf-desktop` 整个目录已改名成
`frond-desktop`，库文件 `.frond-key` 与 21 个插件目录都跟着换），机制在
`src/main/modules/brandMigration.ts` + migration 031 + 渲染端 `main.ts` 的 localStorage 键搬迁。

1. **恢复线索按新路径找**：dev-server 缓存里那份「内联 sourcemap 的原件」现在在
   `frond-desktop/Cache/Cache_Data/`，别再按 `leaf-desktop` 去扫（§见 devserver-cache 那条经验）。
2. **`pnpm install` 在这台机器上必挂，与改名无关**：Python 3.14 删了 `distutils`，node-gyp 9
   重建 `@parcel/watcher` 报 `No module named 'distutils'`。改名只是让 install 重跑了一次
   把它暴露出来。原生模块用的仍是既有预编译件（better-sqlite3 实测可加载），要装就
   `pnpm install --ignore-scripts`；真要走重建得先给 node-gyp 补 `setuptools`。
3. **e2e 有 7 条红**（`density` 2 + `market-index` 5），已对基线 A/B：`bc7a8a8`（改名前）
   同样 7 条红，所以不是改名造成的。都卡在「等 `结果列表密度` 可见 / 进启动器管理页」这类
   导航断言上，要修得单开一条，别混进改名。
4. **两条中间提交单独 checkout 建不起来**：`fa40402` / `31d5971` 只带走了我先行的 `git mv`
   路径改名（`leafUrl.ts` → `frondUrl.ts`），没带走文本改动，`index.ts` 里还 import 旧路径。
   8ba2116 补齐了另一半，从这条往后再看历史才是自洽的。
5. **macOS 授权要重授一次**：`appId` 从 `com.leaf.app` 变成 `com.frond.app`，辅助功能
   （全局热键 / 文本扩展 / 专注护盾）与屏幕录制在系统设置里会重新出现待授权提示。
