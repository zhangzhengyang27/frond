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
| `pnpm test:e2e` | Playwright + Electron 烟雾测试（仅本地；sandbox EPERM） |

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
