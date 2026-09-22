# Leaf · 桌面工具集

> Tools that breathe with your day.

Leaf 是一款本地优先的轻量桌面工具集：**启动器（Alt+Space 胶囊）+ 插件系统 + 录屏剪辑 + 番茄钟 + 代码片段**，对标 Raycast 的体验，数据全部存在本地（SQLite，无账号、无云端）。

## 功能一览

| 模块 | 能力 |
| --- | --- |
| 启动器 | Alt+Space 呼出胶囊窗、统一命令注册表、⌘K 命令面板、剪贴板历史 / 文件搜索 / 提醒 / 日历 / AI Chat 等 17+ 内联页 |
| 插件系统 | BrowserView 沙箱运行时、声明式 List 协议、静态市场、devServer 热重载；内置 21 个官方插件 |
| 录屏 | 区域录制、回放、时间线剪辑、GIF 导出、摄像头画中画、崩溃恢复 |
| 番茄钟 | 三模式计时、任务/项目、统计热力图、白噪音、专注护盾（应用屏蔽）、迷你悬浮窗 |
| 代码片段 | 多文件夹管理、触发词文本扩展（动态占位符）、导入导出 |

## 平台支持

- **macOS**：主要支持平台，功能完整（全局热键、文本扩展、专注护盾依赖辅助功能授权）。发布产物目前仅提供 macOS（dmg / zip）。
- **Windows / Linux**：源码可构建（`pnpm build:win` / `build:linux`），但系统级深度功能未做真机验证，暂不提供官方安装包——跨平台发布策略见 [docs/ROADMAP.md](./docs/ROADMAP.md)。

## 快速开始

环境要求：**Node.js ≥ 20**、**pnpm ≥ 9**（`corepack enable` 可直接启用）。

```bash
pnpm install          # postinstall 会触发 electron-builder install-app-deps，
                      # 首次安装需编译 better-sqlite3 原生模块（耗时属正常）
pnpm dev              # 开发模式
```

> macOS 首次使用全局热键 / 文本扩展 / 专注护盾时，需在系统设置中授予「辅助功能」权限。

## 常用脚本

| 命令 | 说明 |
| --- | --- |
| `pnpm dev` | 开发模式（electron-vite dev） |
| `pnpm build` | 类型检查 + 生产构建 |
| `pnpm test` | Vitest 单元测试 |
| `pnpm test:e2e` | Playwright e2e（需先 `pnpm build`；CI 上由 xvfb 包装） |
| `pnpm test:e2e:smoke` | 仅核心启动冒烟 |
| `pnpm lint` / `pnpm lint:css:changed` | ESLint / 增量 CSS design-token 检查 |
| `pnpm typecheck` | 主进程 + 渲染层双 typecheck |
| `pnpm build:mac` / `build:win` / `build:linux` | electron-builder 打包 |

## 项目结构

```
src/
├── main/        # 主进程：ipc/ 注册器、services/ 业务、stores/、db/（SQLite + 25 个迁移）
├── preload/     # contextBridge 暴露的白名单 API（index.ts 应用 API、plugin.ts 插件 API）
├── renderer/    # Vue 3 界面：主窗口 / 胶囊启动台 / 专注护盾 三入口
└── shared/      # 主渲染共享：命令注册表、模块清单、IPC 契约、插件协议
plugins/         # 21 个内置插件（纯 HTML/JS，零构建）
example-plugin/  # 插件起步模板
docs/            # 架构决策、DB schema、插件协议、发布清单等
```

## 参与开发

- 开发环境、脚本、提交规范见 [CONTRIBUTING.md](./CONTRIBUTING.md)。
- 插件开发：[PLUGIN_DEV.md](./PLUGIN_DEV.md)（10 分钟上手）→ [docs/PLUGIN_DEVELOPMENT.md](./docs/PLUGIN_DEVELOPMENT.md)（协议全集）→ [example-plugin/](./example-plugin)。
- 发布流程：[docs/RELEASE.md](./docs/RELEASE.md)。
- 架构与设计决策：[docs/IA_V2.md](./docs/IA_V2.md)（信息架构）、[docs/DB_SCHEMA.md](./docs/DB_SCHEMA.md)、[docs/DECISIONS.md](./docs/DECISIONS.md)。

## License

[MIT](./LICENSE)
