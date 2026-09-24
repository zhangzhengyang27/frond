# 贡献指南（CONTRIBUTING）

## 开发环境

- Node.js ≥ 20
- pnpm ≥ 9（必须用 pnpm；lockfile 是 `pnpm-lock.yaml`）
- macOS / Linux / Windows 均可（截图/录屏在 macOS 上体验最好）

## 快速上手

```bash
pnpm install         # 装依赖
pnpm dev             # 启动 dev（Electron + HMR）
pnpm build           # 生产构建
```

## 常用脚本

| 命令 | 作用 |
| --- | --- |
| `pnpm lint` | ESLint（`.vue` / `.ts` / `.tsx`） |
| `pnpm lint:fix` | ESLint --fix |
| `pnpm format` | Prettier |
| `pnpm typecheck` | vue-tsc 全量类型检查 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm lint:css:changed` | 仅 lint 改动过的 .vue/.css 文件（增量；新代码必须 0 hex） |
| `pnpm check:light` | light-mode 兼容静态扫描 |
| `pnpm test:e2e` | Playwright + Electron 全量 e2e（需先 `pnpm build`） |
| `pnpm test:e2e:smoke` | e2e 冒烟子集（CI 与本地跑同一份：启动 + 渲染 IPC 往返 + 番茄钟） |

## E2E 写法约定

**等待一律用轮询，不要用固定 `setTimeout`** —— 本仓 31 个 spec 里已有 105 处
`expect.poll(...)` 与 193 处显式 `{ timeout }`，固定等待只剩 11 处，且每一处都是
**下面三种「固定等待才是对的」**情形之一（都在注释里写明了理由）：

1. **负向断言**：要证明「某事**没有**发生」（例如「组合态的 ↵ 没有被当成提交」
   「取消截图后没有多出文件」）。轮询只能证明「最终会变成 X」，证明不了「一直不是 X」——
   必须等够时间让错误实现有机会暴露。
2. **动画时序定位**：要的是「动画**正在飞**的那一刻」（采样淡入中途的 opacity、
   在两帧之间插入第二个 IPC）。等它结束就测不到要测的东西了。
3. **性能测量协议**：`perf-baseline` 这类用例的等待本身就是测量的一部分。

除这三种情形外，新增/修改 e2e 请用：

```js
await expect.poll(async () => (await state()).field, { timeout: 5000 }).toBe('期望值')
```

**窗口选择必须按 url**（`/\/index\.html/`），不要按 `w.title()` —— 胶囊窗 title 是
"Frond Launcher"，同样命中 `/Frond/`，选到哪个取决于窗口创建顺序。也不要回退
`app.firstWindow()`：它返回**第一个被创建**的窗口，本应用启动时先冒出
`electron-screenshots` 的截图覆盖层（没有 `window.api`）。有门禁钉这两条
（`src/main/__tests__/e2eConfigIntegrity.test.ts`）。

**受限环境（容器 / 无 GUI 沙箱）里跑 e2e** 需要两个额外动作，否则会得到一片假红：

```bash
# 1. Chromium 沙箱起不来 → app.windows() 返回 0 个窗口 → 全部超时
ELECTRON_DISABLE_SANDBOX=1 npx playwright test e2e/xxx.spec.mjs
# 2. Playwright 清理 test-results/ 会被批量删除守卫拦住（spec 自己的 rmSync 也会）
mv test-results "/tmp/tr-$(date +%s)"     # 用 mv，不要 rm
```

## 目录约定

```
src/
├── main/                # Electron 主进程
│   ├── index.ts
│   ├── ipc/             # IPC handler（一个模块一个文件）
│   ├── modules/         # 单例模块（tray / shortcut / dialog…）
│   ├── services/        # 业务服务
│   ├── stores/          # 数据存储 / Repo
│   ├── db/              # better-sqlite3 schema + migration
│   ├── utils/
│   └── preload/
│       ├── index.ts     # contextBridge API
│       └── index.d.ts   # window.api 类型
├── renderer/            # Vue 3 + Vite
│   ├── src/
│   │   ├── views/       # 路由页面
│   │   ├── components/
│   │   ├── composables/ # useXxx 单文件
│   │   ├── stores/      # Pinia
│   │   └── utils/
│   └── index.html
└── shared/              # 主进程 / 渲染进程共享（modules.ts、types…）
```

## 提交规范

使用 Conventional Commits：

- `feat: 新增 Onboarding 引导`
- `fix: 修复截图画笔越界`
- `refactor: 拆分 PlayerBar 业务逻辑`
- `chore: 升级 monaco-editor 到 0.50`
- `docs: 更新 README`
- `test: 增加 PhotoStore 单测`

提交前**必须**：

1. `pnpm lint` 无 error
2. `pnpm typecheck` 通过
3. `pnpm test` 通过
4. 新代码 `pnpm lint:css:changed` 无 error（强制 STRICT_CSS_LINT=1）

## 分支策略

- `main`：受保护；只接受 PR
- `feat/<name>`：新功能
- `fix/<name>`：bug fix
- `chore/<name>`：依赖 / 脚本 / CI

PR 标题格式与 commit 一致（Conventional Commits）。

## 模块列表

新增模块前：

1. 在 `src/shared/modules.ts` 加 `ModuleMeta`
2. 在 `src/renderer/src/router/index.ts` 注册路由
3. 在 `src/main/ipc/<name>.ts` 加 IPC handler（如果在 `src/preload/index.ts` 暴露）
4. 在 `docs/ROADMAP.md` 标注

## 设计原则

- **主进程真相**：UI 状态可来自主进程推送（`tray:xxx`），不要在 renderer 自己维护一份
- **单一 IPC handler**：每个 ipc 文件只管一个域（music/photo/clip…）
- **design token 优先**：颜色 / 间距 / 字号 走 CSS 变量（`var(--text-*)` / `var(--bg-*)` / `var(--color-*)`），不要 hex
- **类型安全**：preload 类型 (`src/preload/index.d.ts`) 改动必须同步主进程 handler
