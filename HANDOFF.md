# 交接文档：IPC 单对象约定已全仓库接线 + 项目全景

> 写给下一个接手的 AI。本文档自包含：读完即可继续，无需上游会话历史。
> 写作时间：2026-09-19（IPC 全量迁移完成后更新；flake 结论见 §0/§3，迁移落点见 §8 第 4 条）。

---

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

**本轮另一件大事**：IPC「单对象入参」全仓库迁移完成（391 通道进登记册、两端编译期强制、
d.ts 顺手拆掉十余处手抄/擦除）——落点、两个必踩过的坑、闸口都在 §8 第 4 条。

诊断手段（本轮用过后已撤销）：主进程 `console-message` 转发插件页 console +
`sanitizeValue` 打键路径。**下一步若要复现同类问题，直接照 §3 的链路图加这两处**。

---

## 1. 项目背景

仓库：`/Users/xiaoye/Desktop/electron-tools`（Electron 启动器「Leaf」，对标 Raycast，macOS+Windows）。
本轮工作主题：按 Vicinae/ueli 两个开源项目的借鉴清单落地功能，共 **12 项全部完成**
（清单与每项状态：`docs/REFERENCE_VICINAE_UELI.md`；审查记录都在 commit message 里）。

技术栈：electron-vite + Vue3（宿主渲染端，无 React）+ better-sqlite3 + TypeScript。
插件体系：第三方插件是 sandbox BrowserView（隔离世界 preload 暴露 `launcherApi`），
宿主原生渲染插件 UI（插件不写 CSS/DOM）。

## 2. Git 与产物状态

**本地 main 无 remote 配置，未推送。** 三个必须知道的产物事实：

- `example-react/dist/main.js` **入库**（插件导入即用它，e2e 也用它）。改 SDK 或 example
  源码后必须重跑：`cd packages/leaf-plugin-sdk && npm run build` → `cd example-react &&
  npm run build` → `npx electron-vite build`，否则测的是旧字节码（本仓库踩过两次）。
- `packages/leaf-plugin-sdk/dist/` 被 `.gitignore` 的 `dist` 规则排除、**不入库**，
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
  → sendHook Callback（executeJavaScript → leafPluginHooks.emit）
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
cd packages/leaf-plugin-sdk && npm run build && cd ../..   # SDK dist（单测/e2e 同源）
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

- 每个 spec 用**独立 userData**：`LEAF_USER_DATA_DIR`（playwright.config 注入，
  spec 内按 spec 名覆盖）——规避单实例锁 + 不污染真实数据
- `LEAF_E2E=1`：插件导入确认闸旁路
- `LEAF_FILE_INDEX_SCOPES`：文件索引范围覆盖（避免 home 全量扫描）
- `LEAF_SKIP_BUILTIN_PLUGINS=1`：跳过内置插件自动安装
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
| `packages/leaf-plugin-sdk/` | React 插件 SDK（reconciler/组件/回调注册表/导航） |
| `src/shared/plugin-protocol.ts` | 插件协议：v1 renderList + v2 视图/表单 + fail-closed 清洗 |
| `src/main/launcher/runtime.ts` | 插件运行时：BrowserView 生命周期 / setDeclaredView / sendHook / declaredForm |
| `src/main/launcher/ipc.ts` | 全部 launcher:/plugapi: 通道 |
| `src/preload/plugin.ts` | 插件 preload（launcherApi + leafPluginHooks + HookType） |
| `src/renderer/src/launcher/LauncherApp.vue` | 胶囊主组件（pluginForm/declaredList 接线） |
| `src/renderer/src/launcher/pages/FormPage.vue` | 表单页（⌘↵ 提交，e2e 用 Meta+Enter 驱动） |
| `src/main/modules/fileIndex/` | 文件自建索引（db/scanner/service/excludes/skeleton/content/**paths**/**watcher**） |
| `src/shared/themeSchema.ts` / `themeFile.ts` | 主题数据层（Phase 1）/ 用户主题文件解析派生（Phase 2） |
| `src/main/modules/userThemes.ts` | `userData/themes/*.json` 读取与导入（dir 参数化版可单测） |
| `packages/leaf-raycast-api/` | `@raycast/api` 兼容别名层（#11 M3），插件侧 alias 指过来 |
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
| @raycast/api 兼容别名 | 已实现（`@leaf/raycast-api`，映射表与缺口清单见 PLUGIN_DEV.md） |

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
f64e276 feat(sdk): @leaf/raycast-api 兼容别名层（#11 M3）
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
963de96 fix(e2e): electron.launch env 顶层传参 + LEAF_USER_DATA_DIR 隔离 + playwright 1.63
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
> **剩下的 17 条不是同一种病**：`pin:*`（10 个 handler + 3 个推送）连**创建钉图窗口的代码都不在树里**，
> 归 C 类；`platform:{setDockBadge,setProgressBar,requestUserAttention}` 与
> `recording.markers.{list,add,remove,rename}`（4 条）才是同型的缺桥。
> 另有 3 条 preload 写了、主进程没有：`pomodoro:dispatchShortcut`、`region-overlay:submit/cancel`
> （后两条与 `RegionOverlay.ts` 的 `leaf-region://` 协议撞车，先判哪条是正的再动）。

| 功能域 | 缺的调用 | 证据 |
| --- | --- | --- |
| 截图库 | 16 处：`screenshot.history.{list,recent,openFile,showInFolder,storageUsage,setSaveDirectory,getSaveDirectory,delete}`、`screenshot.{startCapture,captureWindow,endCapture,getWindowList}` | 主进程 `src/main/ipc/screenshotHistory.ts` + `src/main/modules/screenshot.ts` 共注册 14 个 `screenshot:*` handler —— **已接回**（本行留作判定样例） |
| （已修，同类参照） | 密度档 / 玻璃档 / 紧凑模式 9 个方法 | `f63fd57` 就是这一类的先例：store 与 ipc-contract 都在，只有 handler + preload 那截没了 |

涉及渲染端文件：`views/screenshot/{index.vue,components/HistoryPanel.vue,components/WindowPicker.vue,pages/CapturePage.vue}`。
**现在的症状不是报错列表，是「界面画得出来、一点就 TypeError」**——所以它比 146 条类型错更靠近用户。

### B 类 · 两头都没 —— 要按现存调用点重建两侧协议

| 缺 | 用在哪 | 说明 |
| --- | --- | --- |
| ~~`screenshot.{ready,ok,cancel,save,onCapture,onReset,removeListeners}`~~ **已解决（2026-09-23）** | `views/screenshot/pages/CapturePage.vue` | 原判「两头都没」是**错的**：主进程一直有这些通道，只是名字叫**大写** `SCREENSHOT:ready/ok/save/cancel` 与推送 `SCREENSHOT:capture/reset`（`ScreenshotService.ts`）。桥已按真名接回 preload |
| `screenshot.pin.create` | `views/screenshot/components/Screenshots.vue` | 钉图 |
| `video.readFile` | `views/screenRecorder/components/PlaybackPanel.vue` | 录屏回放读文件 |

### C 类 · 2026-09-23 **翻盘**：dev-server 缓存里捞回 522 个原始件

原判「全盘无副本、只能重写」是**错的**。`~/Library/Application Support/leaf-desktop/Cache/Cache_Data/`
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
node scripts/recovery/scan-vue-imports.cjs   # 全树里 import 了但不存在的 .vue → 11 个
node scripts/recovery/scan-vue-parse.cjs     # @vue/compiler-sfc 解析不过的 .vue → 22 个
```
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
- `example-plugin/` 目录仍缺（`plugin-manifest.test.ts` 收集错）。


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

`~/Library/Application Support/leaf-desktop/launcher-plugins/` 里的 **21 份已安装副本**已回拷进
`plugins/`（每份只有 plugin.json + index.html，安装流程不塞 node_modules）。
回拷前逐条核过版本：与静态市场索引 `plugins.json` 21/21 相符；**唯一例外 `com.leaf.regex` 没被覆盖**
（索引与仓库源都是 1.1.0、带 P-1.6b 的三参数声明，而已安装副本是旧的 1.0.1——覆盖就白做）。
反倒 `com.leaf.quickfolders` 是仓库这份坏的：缺入口 `index.html` 且停在 1.0.0，按已安装的 1.0.1 补齐。
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
| ~~`migrate{Ai,Clips,Markers,RecordingSettings}FromLegacyStore`~~ **已补** | 4 个 `dataMigrations*.test.ts` → **24/24 绿** | AI 密文原样搬运（apiKey 是 `enc:`，跨机搬不动）；clips 整坨；录屏设置**整份**搬（按 repo 投影挑字段会把 systemAudio 这类静默丢掉）；markers 秒→毫秒且保留 id。幂等各记各的 leaf_meta 标志，失败下次启动重试 |
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

### 建议的处理顺序

~~D 已做完~~ → **A（screenshot 桥，照 `f63fd57` 的打法）→ E（少导出）** 是当前性价比最高的两格→ E（少导出，用例即规格，含我这两次被回退的 `diffPermissions`/`mapAuthStatus`）→ F → B/C。
C 类里的 10 个页组件是**唯一会同时卡住 build 与 e2e 的一格**；它不归谁"顺手"做，得单独排。
