# Raycast 对标执行计划 V4（实机差距 → 实施）

> 事实源：`docs/RAYCAST_GAP_ANALYSIS_V3.md` + 2026-09-07 实机对照（Raycast v2.2.0.0）。
> 本计划只含**本轮可落地项**；AI 平台化（MCP/@browser/Screen Awareness）单独立项，不在本轮。

## 批次与验收标准

### B0 · 无障碍地基（P0，已完成于派工前）
- [x] `app.setAccessibilitySupportEnabled(true)`（main/index.ts whenReady 常驻开启）
- 验收：VoiceOver/AX 浏览器可见主窗与胶囊 UI 树；对齐 Raycast「全 UI 可 AX 驱动」

### B1 · 启动器交互（渲染层，对齐 5.3）
- [x] **数字直达**：根搜索结果列表 1-9/0 直达执行（对齐 Raycast 数字徽章）
- [x] **Pop to Root**：胶囊闲置 60s 自动回根（清 query/pageStack）；唤起时已有复位保持不变
- [x] **搜索历史 ↑ 恢复**：空查询按 ↑ 逐条回填最近搜索（复用既有 searchHistory IPC）
- [x] **Tab Quick AI**：输入框右侧常驻 `Quick AI ⇥` 按钮 + Tab 键直达 AI 页（携带当前 query）
- [x] **底部动作栏（最小版）**：常驻显示主动作提示（↵ 执行）与 ⌘K 动作面板入口提示
- 验收：typecheck:web 过；手工核对各交互

### B2 · 剪贴板页重构（渲染层，对齐 5.2）
- [x] **List-Detail 双栏**：左列表（按 今天/昨天 分组）+ 右详情面板（来源应用/类型/字符数/复制时间）
- [x] **类型筛选**：All Types 下拉（全部/文本/链接/图片/文件）
- [x] 行为保持：置顶、搜索、复制、删除、依次粘贴不受影响
- 验收：typecheck:web 过；数据字段全部来自现有 ClipboardHistoryItem

### B3 · 系统命令补齐 + 片段导入导出（主进程 + preload 契约，唯一 preload owner）
- [x] 补 8 类系统命令（对齐 Raycast System Actions 23 条清单）：媒体控制（播放/暂停、上一首、下一首）、音量（0/25/50/75/100% + 自定义）、Quit All Apps（±保留前台）、Hide All Except Frontmost、Show Desktop、Dismiss Notifications、Eject All Disks、Show Screen Saver
- [x] **Snippet Import/Export**：导出为 JSON 文件（对话框选路径）/ 从文件导入（去重合并）
- [x] **扩展完成音效**：文本扩展成功后播放系统提示音（mac `afplay` 系统音效 / win SoundPlayer），可关
- [x] 同步 shared/ipc-contract + preload/index.ts + index.d.ts（本批次唯一可动 preload 的批次）
- 验收：typecheck 双端过；纯逻辑（音量档位映射等）补单测

### B4 · 系统集成（主进程 launcher 侧，不碰 preload）
- [x] **frond:// URL Scheme**：`setAsDefaultProtocolClient('frond')` + `open-url` 路由（`frond://launcher` 唤起胶囊 / `frond://settings` 打开设置）
- [x] **Quicklinks 复用已有标签页**：打开 quicklink 前经 BrowserTabsService 查精确 URL 匹配，命中则激活标签而非新开（设置项默认开，可关）
- 验收：`open frond://launcher` 实测唤起；quicklink 命中标签时聚焦

### B5 · 视觉/后续（本轮不做，登记）
- 毛玻璃真机人工验收（V3 ⏳ 项）
- Window Management Gap/Cycling/六分位（几何工程，单独排期）
- 命令三件套统一、AI 平台化

## 执行分工（并行代理，文件所有权互斥）
| 代理 | 范围 | 可动文件 |
| --- | --- | --- |
| L1 | B1 | renderer launcher 层 |
| L2 | B2 | renderer ClipboardPage |
| L3 | B3 | main modules/systemCommands、services/textExpansion、shared/ipc-contract、preload/*（唯一 owner） |
| L4 | B4 | main/index.ts、modules/protocols.ts、launcher/{ipc,runtime,window}.ts |
| 主线 | B0 + 计划落盘 + 终验提交 | docs、main/index.ts（B0 先行提交后 L4 进场） |
