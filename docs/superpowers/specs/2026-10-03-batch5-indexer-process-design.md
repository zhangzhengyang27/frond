# 批 5 设计：fileIndex 进程隔离（R2 —— Raycast v2 路线）

- 日期：2026-10-03
- 状态：已批准（用户选定 R2）
- 前置：8a822bd 已修 parent 索引；基线保存点 1ee057b（34 文件 WIP 入库）

## 1. 目标

把文件索引的全部重活（SQLite/扫描/FTS 写入/watcher）从主进程主线程迁入 **Electron `utilityProcess` 独立进程**，主进程只留 RPC 客户端——对齐 Raycast v2 的"索引重活永不进主进程"原则。主进程从此在任何索引负载下保持响应；索引进程崩溃可重启，重启超限降级到既有 mdfind 回退链。

## 2. 拓扑与切割线

```
主进程 index.js                          file-index-worker.js（新构建入口）
├─ FileIndexClient（新，含生命周期） ←MessagePort→ RPC host（process.parentPort）
├─ fileSearch.ts（index 分支改 await RPC） ├─ FileIndexService（现状状态机原样）
├─ launcher/ipc.ts 5 通道改透传           ├─ FileIndexDb / scanner / watcher(fsevents)
└─ index.ts ensureStarted → client        └─ logFileIndex（本地 logger，切 LogService）
```

- 整体搬走：service/db/scanner/watcher 的**运行时归属**（物理文件原地不动，测试按路径直 import 不受影响）。
- **切断依赖**：service/scanner 的 LogService（连着主库单例）→ 新建 `fileIndex/log.ts`（console + 可注册 sink，workerHost 注册 sink 经 RPC 事件转发主进程打印）；`import { app } from 'electron'`（仅 getPath('userData') 一处）→ userData 路径经 fork 参数传入。
- paths.ts 纯函数两端共用；contract 对 service 的引用改 type-only。

## 3. RPC 协议（MessagePort，结构化克隆直传）

- 请求：`ensureStarted / getStatus / getScopes / setScopes / rebuild / setHidden / query`；事件：`log`。envelope：`{ id, type, payload }` / `{ id, ok, result | error }` / `{ event, payload }`——纯函数 + 类型守卫（可单测）。
- 方法语义与返回形状**逐字节不变**（`getStatus` 的 status/files/scopes/lastFullScan/error/hidden/unavailable 七字段、`query` 的 null=未就绪口径、`source` 字段与 NO_FALLBACK 钩子原样）——e2e 两件套的 expect.poll 语义不动。

## 4. 生命周期与降级

- 懒启动：首个 RPC 自动 spawn（fork `out/main/file-index-worker.js`，argv 传 userData 路径，serviceName 标识）。
- 崩溃：拒绝全部 pending → 指数退避重启（1s→16s，共 5 次）→ 超限进**降级态**：`query` 返回 null（fileSearch 现成 mdfind 回退接管）、`getStatus` 返回 status:'error' + 明确 error 文案、`ensureStarted` 允许再次拉起（恢复路径）。

## 5. 构建改造

- main 段 `build.rollupOptions.input = { index, 'file-index-worker' }`（preload 双入口先例）；产物 `out/main/file-index-worker.js` CJS。
- 原生模块：externalizeDepsPlugin 默认外置 dependencies（better-sqlite3/parcel-watcher/fsevents 已覆盖），`*.node` 由 electron-builder 自动 asarUnpack——零新增配置。FROND_FILE_INDEX_SCOPES / FROND_FILE_SEARCH_NO_FALLBACK / FROND_E2E 经 fork env 显式透传。

## 6. 测试与验收

- 新增：protocol 编解码类型守卫单测；client 用注入假 spawn 的生命周期测试（正常 RPC / 崩溃重启 / 降级后 query=null）。
- 既有 6 个 fileIndex 单测零改动（模块保持可独立 import）。
- 集成锚：e2e `file-index.spec` + `file-index-catchup.spec` 必须绿；门禁全套（typecheck/lint/全量单测/build/冒烟）。
- 手段性验证：打包后 `sample` 主进程——主线程不得再出现 sqlite 调用。

## 7. 交付

三个提交：① protocol + client + 单测（纯增量，不接线）；② worker 入口 + service 去 electron 化 + fileSearch/IPC/index 切换 + 构建双入口；③ e2e 回归与门禁收尾。回滚 = revert 序列。

## 8. 不做

默认扫描范围调整（R1 的产品决策）、状态推送通道（保持拉取）、缩库/FTS 批量维护。
