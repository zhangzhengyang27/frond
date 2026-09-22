# Leaf · Roadmap

> 决策真理源。所有战略方向变更必须落到本文档的「决策记录」，并与 `docs/POSITIONING.md` 同步。
> 生成于 2026-09-11 战略决策会，取代散落在 GAP/STAGE 系列文档中的临时结论（已归档至 `docs/archive/`）。

## 当前状态

- **v0.1.0 已打标**（首个版本标签）。发布前置项（远端仓库 / secrets / publish 占位替换）见 [RELEASE.md](./RELEASE.md)。
- 代码规模约 8.2 万行，550 单测 / 双 typecheck / lint / build 全绿。
- 插件系统基建完备，21 个内置插件；第三方插件 0。

## 决策记录（2026-09-11）

### D1 · AI 定位：深化模块融合

**决策**：从「仅保留基础 AI」调整为「把 AI 深化融入现有模块」。仍然**不做**平台化（AI Extensions / MCP / Screen Awareness 维持不做，见 POSITIONING）。

候选融合点（按投入产出排序，均为 1-2 天量级/项）：

| 候选 | 说明 | 前置依赖 |
| --- | --- | --- |
| 截图 OCR 后处理 | OCR 结果一键 AI 润色/翻译/纠错（AIService 已就绪，仅差 UI 串联） | 无 |
| 笔记/片段摘要 | 胶囊内选中笔记生成摘要与标签建议 | 无 |
| 剪贴板智能整理 | 剪贴板历史按语义自动归类/去重建议 | 数据量大时需考虑成本 |
| 番茄钟日报生成 | 基于当日统计生成自然语言复盘 | 无 |

**执行约束**：每项独立成 PR，先做一个（建议 OCR 后处理，链路最短）验证体验，再决定后续节奏。发布后仍以用户反馈校准优先级。

### D2 · 插件生态：先修内功

**决策**：暂不开放社区生态（不建提交渠道、不做推广）。先把官方 21 个插件验证到可用、补齐开发体验，市场保持内部静态索引。

内功清单：

- [x] 插件 API 奇偶校验测试（`src/shared/__tests__/plugin-api-parity.test.ts`，防幽灵 API 回归）
- [x] 修复 16/21 插件的 `getClipboardText` 静默失败（v0.1.0 前修复）
- [x] 插件清单（plugin.json）静态审计测试（必填字段 / 入口文件存在 / id 与目录一致；2026-09-20 落在
  `src/main/launcher/__tests__/pluginManifestAudit.test.ts`，另加「未知权限/参数类型会被宿主静默剔除」
  与「版本号须与市场索引一致」两条；首跑即抓到 20 个插件清单 1.0.1 vs 索引 1.0.0 的漂移与
  `com.leaf.quickfolders` 漏登记，已一并修正）
- [ ] **21 个插件逐个真机验证**（清单见 [PLUGIN_QA_CHECKLIST.md](./PLUGIN_QA_CHECKLIST.md)）
- [x] 调试体验补全：插件视图 devtools 打开方式（2026-09-17：插件管理页「调试」按钮 + launcher:pluginDevtools）
- [x] 卸载插件时清理其 KV 数据（2026-09-17 已接线，本行漏勾：`pluginStore.ts:318` 调
  `docStore.deleteByPlugin(pluginId)`）

### D3 · 跨平台：macOS 优先发布

**决策**：发布产物仅 macOS（dmg/zip）。Windows/Linux 源码可构建但不官方分发。

- 依据：深度功能（mdfind 文件搜索、osascript 专注护盾、辅助功能文本扩展）均为 macOS 专属；Windows 构建从未真机验证。
- 落点：`release.yml` 矩阵已裁剪为 mac；CI 三平台**单测矩阵保留**（低成本的跨平台回归信号）；重启跨平台时恢复 matrix 的 win/linux 项即可。
- 代价接受：重启跨平台发布时需补一轮真机验证。

### D4 · 文档治理：归档 + 索引

**决策**：`docs/` 只留活文档（真理源），历史沉积移入 `docs/archive/`，新增 [docs/README.md](./README.md) 索引页。

## 里程碑

| 里程碑 | 内容 | 状态 |
| --- | --- | --- |
| v0.1.0 | 发布链路打通、安全加固批次、插件 API 修复 | 已打标，待建远端仓库后推送 |
| v0.1.x | 内功批次：插件真机验证、清单审计、卸载清理（2026-09-17 已做：卸载清空 launcher_docs 命名空间 KV）、WebDAV 扩展到 SQLite 主数据 | 部分开始 |
| v0.2 | AI 深化第一批（OCR 后处理）、preload 契约登记册扩面（2026-09-19 已完成前置：`shared/ipc-contract.ts` 的 11 条虚构通道与错误签名清零 + 测试闸口，实测 47 条登记 vs 415 条真实使用；**扩到全覆盖前需先拍板「单对象入参」约定**，老通道多为位置参数，不拍板只能登记出猜的类型） | 部分开始 |
| v1.0.0 | 真实用户反馈循环跑通 ≥1 个迭代、崩溃上报接入、签名公证完成 | 未开始 |

## 明确不做（2026-09-20 收缩后）

**维持不做**：多语言（1.0 仅中文，Decision-011 的唯一维持项）、移动端（长期观望）、跑未改动的 Raycast 商店扩展（生态走自建远程索引分发）。

**已解除不做**：AI 平台化、账号系统、双向云同步、Calendar 集成、自定义主题（用户主题文件已落地，待联动启动器）——理由与硬约束见 Decision-011，完整清单见 [POSITIONING.md](./POSITIONING.md)，执行分解见 [RAYCAST_PARITY_PLAN_V5.md](./RAYCAST_PARITY_PLAN_V5.md)。
