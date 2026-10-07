# Frond · 桌面工具集

> Tools that breathe with your day.

Frond 是一款本地优先的桌面工具集：**启动器（Alt+Space 胶囊）+ 插件系统 + 番茄钟 + 代码片段 + 剪贴板历史**，对标 Raycast 的体验。数据全部存在本地（SQLite，无账号、无云端）。

与同类产品相比，Frond 把功夫花在四处：

- **中文优先**：拼音 / 拼音首字母匹配、触发词文本扩展，为中文输入习惯而生；
- **本地优先**：无账号、无强制遥测；崩溃收集默认关闭，开了也只在本机、发不发由你决定；
- **BYOM AI + MCP**：自带 Key 接任意 OpenAI 兼容端点（含 Ollama 本地模型），MCP 工具直接进根搜索；
- **MIT 开源**：代码全公开，IPC 有类型化契约与静态守卫。

## 功能一览

| 模块 | 能力 |
| --- | --- |
| 启动器 | Alt+Space 呼出胶囊窗、统一命令注册表、剪贴板历史 / 文件搜索 / 日历 / 提醒 / AI Chat / 窗口管理 / 词典 / 回收站等 25 个内联页；拼音与容错模糊匹配、命令级全局热键、两段式直达（chords） |
| 插件系统 | BrowserView 沙箱运行时、声明式 List 协议、静态市场、devServer 热重载；内置 21 个官方插件 |
| 剪贴板与文件 | 剪贴板四类历史（文本 / 图片 / 文件 / 链接）+ OCR + 二维码识别；文件名 FTS5 全文索引（独立索引进程，不占主线程） |
| AI | BYOM 流式聊天（DeepSeek / 通义 / Ollama 预设）、MCP 客户端（工具注册进根搜索、启动前确认） |
| 番茄钟 | 三模式计时、任务/项目、统计热力图、白噪音、专注护盾（应用屏蔽）、迷你悬浮窗 |
| 代码片段 | 多文件夹管理、触发词文本扩展（动态占位符）、导入导出 |

> 上面的数字是**量级**，别当成权威口径 —— 要准确值跑
> `node scripts/recovery/snapshot-readings.mjs`（会给出源文件数 / 单测文件数 /
> 迁移数 / 重建件数 / e2e spec 数 / IPC 契约通道数）。

## 平台支持

- **macOS**：主要支持平台，功能完整（全局热键、文本扩展、专注护盾依赖辅助功能授权）。发布产物提供 macOS 双架构（dmg / zip，Apple Silicon 与 Intel 各一份）。
  - Apple Silicon (M1+)：功能完整。
  - Intel (x64)：截屏采集暂不可用（截图采集库无 x64 预编译，入口已禁用并提示），截图库、番茄钟、代码片段等其余功能不受影响。
- **Windows / Linux**：源码可构建（`pnpm build:win` / `build:linux`），但系统级深度功能未做真机验证，暂不提供官方安装包——跨平台发布策略见 [docs/ROADMAP.md](./docs/ROADMAP.md)。

## 性能基线

数字来自 `e2e/perf-baseline.spec.mjs` 与 `e2e/perf-results.spec.mjs` 端到端实测
（Apple Silicon 真机、全新实例；方法与明细见 [docs/PERF_BASELINE.md](./docs/PERF_BASELINE.md)）：

- **冷启动 674ms**（进程拉起 → 主窗口 DOM 就绪）
- **胶囊热唤起 3.8ms**（e2e 硬断言 < 200ms）
- **键入响应 154–161ms**（含 150ms 防抖；同步打分 + 首绘约 4–11ms）
- **内存约 729 MiB / 7 进程**（Electron 全进程 workingSet 合计口径）

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
| `pnpm test:e2e` | Playwright e2e（需先 `pnpm build`；受限环境见 CONTRIBUTING 的「E2E 写法约定」） |
| `pnpm test:e2e:smoke` | e2e 冒烟子集（CI 与本地跑同一份） |
| `pnpm lint` / `pnpm lint:css:changed` | ESLint / 增量 CSS design-token 检查 |
| `pnpm typecheck` | 主进程 + 渲染层双 typecheck |
| `pnpm release:preflight` | 发布前自检（目标/版本/token/签名/发布资产），`--strict` 有阻塞则 exit 1 |
| `pnpm build:mac` / `build:win` / `build:linux` | electron-builder 打包 |
| `node scripts/recovery/snapshot-readings.mjs` | **权威读数**（迁移数 / 重建件数 / 通道数…），文档里的数字以它为准 |

## 项目结构

```
src/
├── main/        # 主进程：ipc/ 注册器、services/ 业务、stores/、db/（SQLite + 迁移）、security/ 导航与权限守卫
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
