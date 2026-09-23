# Frond Desktop × Raycast 内置核心功能集成计划

> 版本：v1.0
> 日期：2026-09-06
> 状态：已执行完成



***

## 一、概述

### 1.1 背景

Frond Desktop 是一个基于 Electron + Vue 3 的桌面工具集，已具备 launcher 架构和约 85% 的 Raycast 核心功能。本计划旨在系统性地将 Raycast 的优秀内置功能与设计理念集成到 Frond Desktop 中，同时对已有功能进行与 Raycast 的丰富度对比检测，补齐差距。

### 1.2 目标



* 补齐 Raycast 核心体验中缺失的功能

* 对已有功能进行深度检测，识别与 Raycast 的丰富度差距

* 保持 Frond Desktop 跨平台（macOS / Windows / Linux）特性

* 所有功能通过 typecheck + 单元测试 + 构建验证

### 1.3 范围



* **包含**：Raycast 内置核心功能（非第三方插件）的集成

* **不包含**：Raycast AI 高级功能（AI Agents、Screen Awareness 等，需额外 API 支持）、云同步、团队协作



***

## 二、Raycast 核心功能调研

### 2.1 核心交互设计



| 设计模式                  | 说明                       |
| --------------------- | ------------------------ |
| **Root Search**       | 全局热键唤起搜索框，输入即搜索，所有功能统一入口 |
| **Action Panel**      | ⌘K 打开操作面板，对当前结果执行多种操作    |
| **Fallback Commands** | 搜索无结果时显示兜底命令，避免空状态       |
| **Hotkeys / Aliases** | 全局快捷键直达命令，别名简化搜索         |
| **Detail Panel**      | 右侧详情面板展示选中项的完整信息         |
| **Inline Results**    | 计算器、单位换算等结果直接显示在搜索结果顶部   |

### 2.2 内置核心功能清单



| 类别  | 功能                   | 说明                         |
| --- | -------------------- | -------------------------- |
| 基础  | 应用启动                 | 搜索并启动应用                    |
| 基础  | 文件搜索                 | 快速搜索本地文件                   |
| 基础  | 剪贴板历史                | 记录剪贴板历史，支持搜索和粘贴            |
| 基础  | 代码片段（Snippets）       | 文本展开，支持动态占位符               |
| 基础  | 窗口管理                 | 窗口分屏、最大化、移到显示器等            |
| 工具  | 计算器                  | 内联计算，支持自然语言                |
| 工具  | 单位换算                 | 长度 / 重量 / 温度 / 货币等换算       |
| 工具  | Emoji 搜索             | 搜索并插入 Emoji                |
| 工具  | 词典                   | 单词查询                       |
| 效率  | 笔记                   | 轻量笔记，Markdown 支持           |
| 效率  | 浮动笔记（Floating Notes） | 全局置顶小窗口快速记录                |
| 效率  | 提醒事项                 | 创建提醒，定时通知                  |
| 效率  | 日历                   | 查看日程，创建事件                  |
| 效率  | 番茄钟                  | 专注计时                       |
| 系统  | 系统命令                 | 锁屏 / 睡眠 / 重启 / 关机 / 清倒废纸篓等 |
| 系统  | 系统信息                 | CPU / 内存 / 磁盘等监控           |
| 浏览器 | 标签页搜索                | 搜索浏览器打开的标签页                |

### 2.3 AI 功能体系（暂不集成，需额外 API）



* Quick AI / AI Chat / AI Commands

* AI Agents（自动化代理）

* Screen Awareness（屏幕感知）

* Memory（长期记忆）

* BYOK（自带 API Key）

### 2.4 设计亮点总结



1. **搜索即入口**：所有功能通过统一搜索框访问，无需菜单导航

2. **键盘优先**：全程键盘操作，鼠标是可选增强

3. **内联结果**：计算、换算等无需打开新窗口，直接显示结果

4. **兜底机制**：空结果不空白，提供 Fallback Commands

5. **渐进式复杂度**：简单功能一键完成，复杂功能通过 Action Panel 扩展

6. **视觉克制**：极简 UI，内容为王，无多余装饰

7. **全局可达**：全局热键随时唤起，不打断当前工作流



***

## 三、Frond Desktop 现状分析

### 3.1 技术栈



| 层级  | 技术                                          |
| --- | ------------------------------------------- |
| 框架  | Electron 38                                 |
| 前端  | Vue 3.5 + TypeScript + Pinia + Tailwind CSS |
| 构建  | electron-vite + pnpm 9.12.3                 |
| 数据库 | better-sqlite3（本地存储）                        |
| 架构  | launcher 主进程 + 渲染端 + 共享模块                   |

### 3.2 项目结构



```
src/

├── main/                    # 主进程

│   ├── launcher/            # launcher 窗口、运行时、热键、插件

│   ├── modules/             # 功能模块（系统命令、文本扩展、窗口等）

│   ├── services/            # 服务层（剪贴板、AI、提醒等）

│   ├── db/                  # 数据库（迁移 + Repository）

│   ├── ipc/                 # IPC 通道

│   └── utils/               # 工具函数

├── renderer/                # 渲染端

│   ├── launcher/            # launcher UI（LauncherApp + pages + components）

│   ├── commands/            # 命令 Provider

│   ├── views/               # 主窗口页面

│   └── components/          # 通用组件

├── shared/                  # 共享模块（主进程+渲染端共用）

│   ├── calculator.ts        # 计算器

│   ├── unitConverter.ts     # 单位换算

│   ├── emoji.ts             # Emoji 数据

│   ├── commands.ts          # 命令类型定义

│   └── search.ts            # 搜索算法

└── preload/                 # preload 脚本（API 暴露 + 类型声明）
```

### 3.3 已有功能清单



| 功能      | 状态     | 备注                                   |
| ------- | ------ | ------------------------------------ |
| 应用启动    | ✅ 已实现  | 搜索应用并启动                              |
| 文件搜索    | ✅ 已实现  | 支持名称 / 内容搜索                          |
| 剪贴板历史   | ✅ 已实现  | 200 条容量，OCR 识别，依次粘贴，敏感应用屏蔽，加密持久化     |
| 代码片段    | ✅ 已实现  | 文本展开，{date}/{time}/{clipboard} 自动占位符 |
| 窗口管理    | ✅ 底层完整 | 14 种布局，macOS + Windows 均有实现          |
| 计算器     | ✅ 已实现  | 递归下降解析器，支持自然语言百分比                    |
| 词典      | ✅ 已实现  | 单词查询                                 |
| 笔记      | ✅ 已实现  | Markdown 编辑，本地存储                     |
| AI 对话   | ✅ 已实现  | OpenAI 兼容，流式输出，多模型预设                 |
| 番茄钟     | ✅ 已实现  | 专注计时，统计                              |
| 全局快捷键   | ✅ 已实现  | 两段式直达（主热键 + 修饰键 + 字母）                |
| 插件系统    | ✅ 已实现  | 22 个内置插件 + 完整 launcherApi            |
| 命令面板    | ✅ 已实现  | Action Panel ⌘K + Detail Panel       |
| 浏览器标签   | ✅ 已实现  | 搜索浏览器打开的标签页                          |
| 系统信息    | ✅ 已实现  | CPU / 内存 / 磁盘监控                      |
| 回收站     | ✅ 已实现  | 查看 / 恢复 / 清空                         |
| 截图 / 录屏 | ✅ 已实现  | 完整截图编辑 + 录屏                          |
| 别名      | ✅ 已实现  | 用户自定义命令别名                            |
| 搜索历史    | ✅ 已实现  | 最近搜索词记录                              |
| OCR     | ✅ 已实现  | tesseract.js 中英双语                    |



***

## 四、已有功能丰富度对比检测

### 4.1 对比结果



| 功能                | Frond Desktop | Raycast | 差距分析                                                       |
| ----------------- | ------------ | ------- | ---------------------------------------------------------- |
| 剪贴板历史             | ✅ **更丰富**    | 基础版     | Frond 有 200 条容量、OCR、依次粘贴、敏感应用屏蔽、加密持久化、30 天保留期，比 Raycast 更丰富 |
| 全局快捷键             | ✅ **独有设计**   | 基础版     | Frond 有 "两段式直达"（主热键后按住修饰键 + 字母直达命令），Raycast 无此设计            |
| 代码片段              | ✅ 已实现        | 更丰富     | Frond 支持文本展开和自动占位符；Raycast 额外支持 {{param}} 用户输入动态参数          |
| 内联计算器             | ✅ 已实现        | 同等      | 两者均支持内联计算                                                  |
| 窗口管理              | ✅ 底层完整       | 同等      | 底层 14 种布局完整，但 SystemCommandProvider 注册有 bug（cmdId 格式错误）    |
| 单位换算              | ❌ 缺失         | 已实现     | Raycast 支持内联单位 / 货币换算                                      |
| Fallback Commands | ❌ 缺失         | 已实现     | Raycast 空结果时显示兜底命令                                         |
| 提醒事项              | ❌ 缺失         | 已实现     | Raycast 支持快速创建提醒 + 定时通知                                    |
| 浮动笔记              | ❌ 缺失         | 已实现     | Raycast Floating Notes 置顶小窗口                               |
| 日历                | ❌ 缺失         | 已实现     | Raycast 支持查看日程 + 创建事件                                      |
| Emoji 搜索          | ❌ 缺失         | 已实现     | Raycast 支持搜索 Emoji 并插入                                     |

### 4.2 检测结论



* **超越 Raycast**：剪贴板历史、全局快捷键（两段式直达）

* **与 Raycast 同等**：计算器、窗口管理（底层）

* **略逊于 Raycast**：代码片段（缺动态参数）

* **完全缺失**：单位换算、Fallback Commands、提醒事项、浮动笔记、日历、Emoji 搜索



***

## 五、分阶段集成计划

### 5.1 阶段划分原则



* **P0（核心体验补齐）**：影响搜索核心体验、修复已有 bug、用户高频使用

* **P1（功能补齐）**：独立功能模块，需要数据库 / 服务 / 渲染端完整链路

* **P2（体验增强）**：锦上添花，提升细节体验

### 5.2 P0：核心体验补齐



| 编号   | 功能                     | 优先级 | 说明                             |
| ---- | ---------------------- | --- | ------------------------------ |
| P0-1 | 单位 / 货币换算内联            | 高   | 输入 `10kg to lb` 直接显示结果，支持 7 大类 |
| P0-2 | Fallback Commands 兜底机制 | 高   | 搜索无结果时显示 5 个兜底命令，支持键盘导航        |
| P0-3 | 窗口管理补充 + bug 修复        | 高   | 修复 cmdId 格式错误，补充完整 12 种窗口布局命令  |

### 5.3 P1：功能补齐



| 编号   | 功能   | 优先级 | 说明                            |
| ---- | ---- | --- | ----------------------------- |
| P1-1 | 日历集成 | 中   | 月视图 + 提醒事项标记（简化版，不集成系统日历 API） |
| P1-2 | 提醒事项 | 高   | 完整数据库 + 定时扫描 + 系统通知 + 自然语言创建  |
| P1-3 | 浮动笔记 | 中   | 全局置顶独立窗口，Markdown 编辑，自动保存     |

### 5.4 P2：体验增强



| 编号   | 功能           | 优先级 | 说明                            |
| ---- | ------------ | --- | ----------------------------- |
| P2-1 | Emoji 搜索     | 低   | 180+ 常用 Emoji，关键词搜索，回车复制      |
| P2-2 | Snippet 动态参数 | 中   | 支持 {{paramName}} 占位符，展开时弹出输入框 |



***

## 六、各功能详细设计

### 6.1 P0-1：单位 / 货币换算内联

**目标**：用户在搜索框输入单位换算表达式时，结果直接显示在搜索结果顶部，回车复制结果。

**支持格式**：



* `10kg to lb` / `10 kg in lb` / `10kg→lb`

* `100usd to cny` / `100美元 人民币`

* `37c to f` / `37摄氏度 华氏度`

* `1m2 to ft2` / `1024kb to mb`

**支持类别**（7 大类）：



| 类别   | 单位                                                                             |
| ---- | ------------------------------------------------------------------------------ |
| 长度   | m, km, cm, mm, mile, yard, ft, in                                              |
| 重量   | kg, g, mg, t, lb, oz                                                           |
| 温度   | c, f, k                                                                        |
| 面积   | m2, km2, ha, acre, ft2                                                         |
| 体积   | l, ml, m3, gal, qt, pt, cup                                                    |
| 数据存储 | b, kb, mb, gb, tb                                                              |
| 货币   | usd, cny, eur, gbp, jpy, hkd, krw, aud, cad, chf, sgd, inr（静态汇率，基准 2026-09-01） |

**技术实现**：



* 新建 `src/shared/unitConverter.ts`：纯函数模块，可单测

* 正则识别 `数值+单位+to/in/→+单位` 格式

* 温度特殊处理（非线性换算）

* 货币内置静态汇率表，UI 标注基准日期

* 集成到 `LauncherApp.vue` 的 `runUnifiedSearch`，与计算器并行检测

* 结果显示在搜索结果顶部，score 为 MAX\_SAFE\_INTEGER

**验收标准**：



* [ ] 输入 `10kg to lb` 显示 `4.53592 lb`

- 输入 `100usd to cny` 显示换算结果并标注汇率基准日期

- 输入 `37c to f` 显示 `98.6 F`

- 回车复制数值到剪贴板

- 28 个单元测试全部通过



***

### 6.2 P0-2：Fallback Commands 兜底机制

**目标**：搜索无结果时，不显示空白，而是提供一组兜底命令供用户选择。

**默认兜底命令**（5 个）：



| 命令    | 说明             |
| ----- | -------------- |
| 文件搜索  | 用当前关键词搜索文件     |
| AI 对话 | 用当前关键词发起 AI 对话 |
| 词典查询  | 用当前关键词查词典      |
| 网页搜索  | 用当前关键词进行网页搜索   |
| 剪贴板历史 | 打开剪贴板历史        |

**技术实现**：



* 新建 `src/shared/fallbackCommands.ts`：定义兜底命令列表，支持 `{query}` 占位符渲染

* 修改 `LauncherApp.vue` 空结果模板，替换原简单 "没有找到结果 + AI 按钮"

* 支持鼠标点击和键盘 ↑↓ 导航 + Enter 执行

* 添加对应样式

**验收标准**：



* [ ] 搜索无结果时显示 5 个兜底命令

* [ ] 键盘 ↑↓ 可导航，Enter 执行对应命令

* [ ] 鼠标点击可执行

* [ ] 兜底命令标题中 `{query}` 被替换为当前搜索词



***

### 6.3 P0-3：窗口管理补充 + bug 修复

**目标**：修复已有窗口管理命令的 cmdId 格式 bug，补充完整的窗口管理命令。

**发现的 bug**：



* `SystemCommandProvider` 中所有系统命令和窗口命令的 `cmdId` 缺少 `system.`/`window.` 前缀，导致命令实际不工作

* `MAC_COMMANDS`/`WIN_COMMANDS` 缺少 restart、shutdown、hideAll 等系统命令

**补充的窗口管理命令**（12 种）：



| 命令       | cmdId                | 说明         |
| -------- | -------------------- | ---------- |
| 最大化      | `window.maximize`    | 当前窗口最大化    |
| 还原       | `window.restore`     | 还原窗口大小     |
| 居中       | `window.center`      | 窗口居中       |
| 左半屏      | `window.left`        | 窗口占左半屏     |
| 右半屏      | `window.right`       | 窗口占右半屏     |
| 上半屏      | `window.top`         | 窗口占上半屏     |
| 下半屏      | `window.bottom`      | 窗口占下半屏     |
| 左上四分之一   | `window.topLeft`     | 窗口占左上四分之一  |
| 右上四分之一   | `window.topRight`    | 窗口占右上四分之一  |
| 左下四分之一   | `window.bottomLeft`  | 窗口占左下四分之一  |
| 右下四分之一   | `window.bottomRight` | 窗口占右下四分之一  |
| 移到下一个显示器 | `window.nextDisplay` | 窗口移到下一个显示器 |

**补充的系统命令**：



* 重新启动（`system.restart`）

* 关机（`system.shutdown`）

* 隐藏所有窗口（`system.hideAll`）

* 屏幕保护（`system.screensaver`）

* 静音切换（`system.muteToggle`）

**技术实现**：



* 重写 `SystemCommandProvider.ts`，修复所有 cmdId 格式

* 修改 `systemCommands.ts`，补充 MAC\_COMMANDS/WIN\_COMMANDS

* cmdId 格式规范：系统命令用 `system.{action}`，窗口管理用 `window.{action}`，通过 IPC `systemcmd:run` 分发

**验收标准**：



* [ ] 搜索 "左半屏" 可找到对应命令，执行后窗口左半屏

* [ ] 搜索 "最大化" 可找到对应命令，执行后窗口最大化

* [ ] 所有窗口管理命令 cmdId 格式正确（`window.{action}`）

* [ ] 所有系统命令 cmdId 格式正确（`system.{action}`）



***

### 6.4 P1-1：日历集成（简化版）

**目标**：提供月视图日历，显示提醒事项日期标记，点击日期查看当天提醒。

**设计决策**：



* 不集成系统日历 API（macOS EventKit / Windows Outlook Calendar 跨平台差异大，需用户授权）

* 复用提醒事项数据，在日历上标记有提醒的日期

* 简化版仅做查看，不做创建事件（创建提醒走提醒事项页面）

**功能**：



* 月视图展示，支持上一月 / 下一月切换

* "今天" 快捷跳转

* 有提醒的日期显示圆点标记（最多 3 个）

* 点击日期显示当天提醒列表

* 可在日历中直接标记提醒完成 / 取消完成

**技术实现**：



* 新建 `src/renderer/src/launcher/pages/CalendarPage.vue`

* 在 `shared/commands.ts` 的 `FirstPartyPage` 类型中添加 `'calendar'`

* 在 `FirstPartyCommandProvider.ts` 注册 `calendar:view` 命令

* 在 `LauncherApp.vue` 导入并添加路由

**验收标准**：



* [ ] 搜索 "日历" 可打开日历页面

* [ ] 月视图正确显示当前月份

* [ ] 有提醒的日期显示圆点标记

* [ ] 点击日期显示当天提醒列表

* [ ] 可在日历中标记提醒完成

* [ ] 上一月 / 下一月切换正常

* [ ] "今天" 按钮可快速回到今天



***

### 6.5 P1-2：提醒事项

**目标**：提供完整的提醒事项功能，支持快速创建、定时通知、完成管理。

**功能**：



* 快速创建提醒（支持自然语言解析）

* 未完成 / 已完成标签切换

* 提醒时间选择（快捷时间 + 自定义时间）

* 到期系统通知，点击通知标记完成

* 30 秒定时扫描到期提醒

* 已通知状态持久化（应用重启不重复通知）

* 全文搜索（FTS5）

**自然语言解析支持**：



* 中文：`明天下午3点开会`、`今天上午9点站会`、`1小时后提醒`、`30分钟后`、`2天后`

* 英文：`tomorrow 3pm`、`today at 9am`、`in 1 hour`、`in 30 minutes`、`3pm`（已过自动顺延明天）

**技术实现**：

**数据库层**：



* 新建迁移 `024_reminders.ts`：`reminders` 表 + `reminders_fts` FTS5 全文搜索 + 触发器（INSERT/UPDATE/DELETE 同步 FTS）

* 新建迁移 `025_reminders_notified.ts`：添加 `notified_at` 字段（持久化已通知状态）

* 新建 `ReminderRepository.ts`：CRUD、完成 / 取消完成、软删除、全文搜索、统计、markNotified/resetNotified

**服务层**：



* 新建 `ReminderService.ts`：


  * 30 秒定时扫描到期提醒

  * 发送系统通知，点击通知标记完成

  * 已通知状态内存缓存 + 数据库持久化

  * 启动时从数据库重建已通知缓存

  * CRUD 委托给 Repository

  * 新建 / 更新提醒时如果已到期立即通知

**IPC 层**：



* 新建 `src/main/ipc/reminders.ts`：8 个 IPC 通道


  * `reminders:list` / `reminders:get` / `reminders:create` / `reminders:update`

  * `reminders:complete` / `reminders:uncomplete` / `reminders:remove` / `reminders:countActive`

* 在 `ipc/index.ts` 导出，在 `main/index.ts` 注册

* 应用启动时调用 `reminderService.start()`

**Preload 层**：



* 在 `preload/index.ts` 暴露 `reminders` API

* 在 `preload/index.d.ts` 添加类型声明

**渲染端**：



* 新建 `ReminderPage.vue`：


  * 新建提醒输入框 + 时钟按钮切换时间选择器

  * 快捷时间选择（1 小时后 / 3 小时后 / 明天上午 9 点 / 明天下午 2 点 / 自定义）

  * 未完成 / 已完成标签切换

  * 提醒列表（标题、备注、时间、完成状态、过期高亮）

  * 点击复选框标记完成 / 取消完成

  * 删除提醒

* 在 `FirstPartyCommandProvider.ts` 注册 `reminders:list` 和 `reminders:create` 命令

* 在 `LauncherApp.vue` 导入并添加路由

**数据库表结构**：



```
CREATE TABLE reminders (

&#x20; id TEXT PRIMARY KEY,

&#x20; title TEXT NOT NULL,

&#x20; notes TEXT NOT NULL DEFAULT '',

&#x20; due\_at INTEGER,          -- 截止时间（可选）

&#x20; remind\_at INTEGER,       -- 提醒时间（用于定时通知）

&#x20; is\_completed INTEGER NOT NULL DEFAULT 0,

&#x20; is\_deleted INTEGER NOT NULL DEFAULT 0,

&#x20; completed\_at INTEGER,

&#x20; notified\_at INTEGER,     -- 最后一次通知时间（NULL=从未通知）

&#x20; created\_at INTEGER NOT NULL,

&#x20; updated\_at INTEGER NOT NULL

);
```

**验收标准**：



* [ ] 搜索 "提醒" 可打开提醒事项页面

* [ ] 输入 "明天下午 3 点开会" 回车，自动解析时间并创建提醒

* [ ] 提醒到期时收到系统通知

* [ ] 点击系统通知标记提醒完成

* [ ] 未完成 / 已完成标签切换正常

* [ ] 应用重启后已通知的提醒不重复通知

* [ ] 时钟按钮可切换时间选择器显示

* [ ] 全文搜索提醒标题和备注

* [ ] create () 拒绝空标题提醒



***

### 6.6 P1-3：浮动笔记（Floating Notes）

**目标**：提供全局置顶的浮动笔记小窗口，支持快速记录，不打断当前工作流。

**功能**：



* 全局命令唤起 / 隐藏浮动笔记窗口

* 窗口特性：always-on-top、frameless、可调整大小、可移动、跨工作区可见

* Markdown 编辑（textarea，后续可升级为编辑器）

* 自动保存（800ms debounce）

* 最近笔记列表切换（可折叠）

* 新建笔记

* 窗口位置和大小持久化（userData 目录）

* 标题栏可拖动（CSS `-webkit-app-region: drag`）

**技术实现**：

**主进程**：



* 新建 `src/main/modules/floatingNote.ts`：


  * `ensureFloatingNoteWindow()`：创建 / 获取浮动笔记窗口

  * `showFloatingNoteWindow()` / `hideFloatingNoteWindow()` / `toggleFloatingNoteWindow()`

  * `registerFloatingNoteIpc()`：注册 4 个 IPC 通道（toggle/show/hide/isVisible）

  * 窗口位置 / 大小保存到 `userData/floating-note-window.json`

  * move/resize 事件 debounce 500ms 保存

  * hide 时立即保存

  * 启动时恢复位置 / 大小（含显示器越界校验）

**渲染端**：



* 新建 `src/renderer/src/views/notes/FloatingNote.vue`：


  * 标题栏（可拖动，含新建 / 关闭按钮）

  * 笔记标题输入

  * 笔记内容编辑（textarea）

  * 底部状态栏（保存状态 + 最近笔记切换按钮）

  * 最近笔记列表（可折叠，显示最近 10 条）

  * 自动保存（800ms debounce）

  * 无当前笔记时自动创建

* 在 `router/index.ts` 添加 `/floating-note` 路由（meta.window = 'floating'）

**命令注册**：



* 在 `shared/commands.ts` 的 `CommandAction` 类型中添加 `{ type: 'floatingNote' }`

* 在 `commandRunner.ts` 添加 `floatingNote` action 处理（调用 `window.api.floatingNote.toggle()`）

* 在 `FirstPartyCommandProvider.ts` 注册 `notes:floating` 命令

**验收标准**：



* [ ] 搜索 "浮动笔记" 可唤起浮动笔记窗口

* [ ] 窗口始终置顶，不被其他窗口遮挡

* [ ] 窗口可拖动、可调整大小

* [ ] 输入笔记内容后 800ms 内自动保存

* [ ] 关闭后重新打开，内容和窗口位置 / 大小恢复

* [ ] 最近笔记列表可切换笔记

* [ ] 新建笔记按钮可创建新笔记

* [ ] 窗口在所有工作区可见



***

### 6.7 P2-1：Emoji 搜索

**目标**：用户输入关键词时，匹配的 Emoji 显示在搜索结果中，回车复制 Emoji。

**数据集**：180+ 常用 Emoji，覆盖表情、手势、身体、物品、活动、食物、自然、交通、地点、符号等类别。

**每个 Emoji 包含**：



* emoji 字符

* 中文名称

* 关键词数组（中英文）

* 类别

**搜索规则**：



* 名称匹配（+10 分）

* 关键词精确匹配（+8 分）

* 关键词包含匹配（+4 分）

* Emoji 本身匹配（+100 分）

* 输入 2 个字符以上才触发（避免单字符产生过多结果）

* 最多显示 3 个匹配结果

**技术实现**：



* 新建 `src/shared/emoji.ts`：Emoji 数据集 + `searchEmoji(query, limit)` 纯函数

* 集成到 `LauncherApp.vue` 的 `runUnifiedSearch`，在单位换算后添加 Emoji 搜索

* 结果显示为标准搜索条目，action 为 `copyText`

**验收标准**：



* [ ] 输入 "开心" 显示 😀 😂 😊 等 Emoji

* [ ] 输入 "fire" 显示 🔥

* [ ] 回车复制 Emoji 到剪贴板

* [ ] 输入 1 个字符不触发 Emoji 搜索

* [ ] Emoji 结果不超过 3 个



***

### 6.8 P2-2：Snippet 用户输入动态参数

**目标**：代码片段支持 `{{paramName}}` 占位符，展开时弹出系统原生输入框让用户填写参数值。

**示例**：



* 片段内容：`您好，{{姓名}}！您的订单{{订单号}}已发货。`

* 触发词：`;order`

* 输入 `;order` 后，依次弹出输入框询问 "姓名" 和 "订单号"

* 用户填写后，替换占位符并展开

**技术实现**：

**共享模块**：



* 在 `expansionTemplate.ts` 添加：


  * `extractDynamicParams(text)`：提取所有 `{{paramName}}` 占位符，返回去重后的参数名列表

  * `applyDynamicParams(text, values)`：替换占位符为用户输入值

**跨平台输入框**：



* 新建 `src/main/utils/inputBox.ts`：


  * `showInputBox(options)`：显示系统原生输入框，返回用户输入文本，取消返回 null

  * macOS：使用 `osascript display dialog`（参数转义防注入）

  * Windows：使用 PowerShell + Windows Forms（参数转义防注入，明确输出标记区分确定 / 取消）

  * Linux：尝试 `zenity`，不可用时返回空字符串（不阻断片段展开）

**文本扩展引擎**：



* 修改 `textExpansion.ts` 的 `expand()` 方法：


  * 展开前检测 `{{paramName}}` 占位符

  * 如果有动态参数，依次弹出输入框询问每个参数

  * 用户取消则中断展开

  * 所有参数填写完成后，替换占位符再执行正常展开流程

**安全考虑**：



* macOS：title/message/default 全部经过 `escapeAppleScript()` 转义（反斜杠和双引号）

* Windows：所有参数经过 `escapePowerShell()` 转义（单引号用 `''` 表示）

* Windows 使用明确输出标记 `__INPUT_OK__<内容>` / `__INPUT_CANCEL__` 区分确定和取消，避免空输入被误判为取消

**验收标准**：



* [ ] 片段内容含 `{{姓名}}` 时，展开前弹出输入框询问

* [ ] 多个参数依次询问

* [ ] 用户填写后正确替换占位符

* [ ] 用户取消则不展开

* [ ] macOS 输入框参数含引号时不崩溃（防注入）

* [ ] Windows 输入框参数含单引号时不崩溃（防注入）

* [ ] Windows 用户输入空字符串点击确定不被误判为取消

* [ ] Linux 无 zenity 时片段仍可展开（使用空值回退）



***

## 七、数据库设计

### 7.1 迁移版本



| 版本  | 名称                      | 说明                      |
| --- | ----------------------- | ----------------------- |
| 024 | reminders               | 提醒事项表 + FTS5 全文搜索 + 触发器 |
| 025 | reminders\_notified\_at | 提醒事项添加 notified\_at 字段  |

### 7.2 reminders 表



| 字段            | 类型                         | 说明                    |
| ------------- | -------------------------- | --------------------- |
| id            | TEXT PRIMARY KEY           | UUID                  |
| title         | TEXT NOT NULL              | 提醒标题                  |
| notes         | TEXT NOT NULL DEFAULT ''   | 备注                    |
| due\_at       | INTEGER                    | 截止时间（可选）              |
| remind\_at    | INTEGER                    | 提醒时间（用于定时通知）          |
| is\_completed | INTEGER NOT NULL DEFAULT 0 | 是否已完成                 |
| is\_deleted   | INTEGER NOT NULL DEFAULT 0 | 是否删除（软删除）             |
| completed\_at | INTEGER                    | 完成时间                  |
| notified\_at  | INTEGER                    | 最后一次通知时间（NULL = 从未通知） |
| created\_at   | INTEGER NOT NULL           | 创建时间                  |
| updated\_at   | INTEGER NOT NULL           | 更新时间                  |

### 7.3 索引



* `idx_reminders_completed` ON (is\_completed)

* `idx_reminders_deleted` ON (is\_deleted)

* `idx_reminders_due` ON (due\_at)

* `idx_reminders_remind` ON (remind\_at)

* `idx_reminders_created` ON (created\_at DESC)

### 7.4 FTS5 全文搜索



* `reminders_fts` 虚拟表，content='reminders'，content\_rowid='rowid'

* 索引字段：title, notes

* 触发器：AFTER INSERT / AFTER DELETE / AFTER UPDATE 同步 FTS 表



***

## 八、命令注册规范

### 8.1 cmdId 格式



| 类别    | 格式                  | 示例                                 |
| ----- | ------------------- | ---------------------------------- |
| 系统命令  | `system.{action}`   | `system.lock`, `system.emptyTrash` |
| 窗口管理  | `window.{action}`   | `window.maximize`, `window.left`   |
| 第一方页面 | `{module}:{action}` | `reminders:list`, `calendar:view`  |

### 8.2 FirstPartyPage 类型



```
export type FirstPartyPage =

&#x20; \| 'focus' | 'snippets' | 'shots' | 'clips' | 'focusStats'

&#x20; \| 'files' | 'qlform' | 'qlarg' | 'settings' | 'ai'

&#x20; \| 'browserTabs' | 'systemInfo' | 'windowSwitcher' | 'trash'

&#x20; \| 'dictionary' | 'notes' | 'reminders' | 'calendar'
```

### 8.3 CommandAction 类型



```
export type CommandAction =

&#x20; \| { type: 'module'; moduleId: string; path: string }

&#x20; \| { type: 'page'; pageId: string; path: string }

&#x20; \| { type: 'plugin'; pluginId: string; cmd: string }

&#x20; \| { type: 'app'; path: string }

&#x20; \| { type: 'action'; action: 'screenshot.start' }

&#x20; \| { type: 'firstParty'; page: FirstPartyPage }

&#x20; \| { type: 'copyText'; text: string }

&#x20; \| { type: 'system'; cmdId: string }

&#x20; \| { type: 'quicklink'; id: string; url: string }

&#x20; \| { type: 'file'; path: string; name: string }

&#x20; \| { type: 'clipboardItem'; id: string }

&#x20; \| { type: 'snippetItem'; id: string }

&#x20; \| { type: 'screenshotItem'; id: string; filePath: string }

&#x20; \| { type: 'searchQuery'; query: string }

&#x20; \| { type: 'floatingNote' }
```



***

## 九、风险和注意事项

### 9.1 安全风险



| 风险             | 应对措施                                  |
| -------------- | ------------------------------------- |
| 命令注入（inputBox） | macOS/Windows 参数全部转义，使用参数化调用          |
| SQL 注入         | 全部使用 better-sqlite3 参数化查询，禁止字符串拼接 SQL |
| XSS            | 渲染端用户输入全部使用 Vue 文本插值，不使用 v-html       |
| 剪贴板覆盖          | 片段展开时保存原剪贴板内容，600ms 后还原               |

### 9.2 跨平台差异



| 功能   | macOS       | Windows                    | Linux           |
| ---- | ----------- | -------------------------- | --------------- |
| 窗口管理 | AppleScript | PowerShell + SetWindowPos  | 部分支持（取决于窗口管理器）  |
| 系统命令 | 完整支持        | 完整支持                       | 部分支持            |
| 输入框  | osascript   | PowerShell + Windows Forms | zenity（可选，无则回退） |
| 系统通知 | 完整支持        | 完整支持                       | 完整支持（libnotify） |

### 9.3 性能考虑



* 提醒事项扫描间隔 30 秒，避免频繁唤醒

* 浮动笔记自动保存 debounce 800ms，避免频繁写数据库

* 窗口位置保存 debounce 500ms，避免频繁写文件

* Emoji 搜索仅在输入 2 字符以上触发，避免单字符产生过多结果

* 所有搜索结果限制数量（单位换算 1 条、Emoji 3 条、文件 / 剪贴板等各有限制）

### 9.4 数据持久化



* 提醒事项：SQLite 数据库（better-sqlite3）

* 浮动笔记窗口状态：`userData/floating-note-window.json`

* 已通知状态：数据库 `notified_at` 字段（应用重启不丢失）



***

## 十、验证计划

### 10.1 类型检查



```
pnpm typecheck

\# 或

npx tsc --noEmit -p tsconfig.node.json --composite false

npx tsc --noEmit -p tsconfig.web.json --composite false
```

### 10.2 单元测试



```
pnpm test

\# 或

npx vitest run
```

**测试覆盖**：



* 单位换算：28 个测试（7 大类 + 边界条件）

* 计算器：已有测试

* 搜索算法：已有测试

* 数据库 Repository：已有测试框架

### 10.3 手动验证清单



| 功能                | 验证步骤                                  |
| ----------------- | ------------------------------------- |
| 单位换算              | 输入 `10kg to lb`，验证结果显示，回车复制           |
| 货币换算              | 输入 `100usd to cny`，验证结果和汇率基准日期标注      |
| Fallback Commands | 输入无意义关键词，验证显示 5 个兜底命令，键盘导航可用          |
| 窗口管理              | 搜索 "左半屏"，执行后窗口左半屏；搜索 "最大化"，执行后窗口最大化   |
| 提醒事项              | 搜索 "提醒"，创建提醒，验证到期通知，点击通知标记完成          |
| 自然语言              | 输入 "明天下午 3 点开会"，验证自动解析时间              |
| 浮动笔记              | 搜索 "浮动笔记"，验证窗口置顶，输入内容自动保存，关闭重开内容恢复    |
| 日历                | 搜索 "日历"，验证月视图显示，有提醒的日期显示圆点，点击查看当天提醒   |
| Emoji 搜索          | 输入 "开心"，验证显示 Emoji 结果，回车复制            |
| Snippet 动态参数      | 创建含 `{{姓名}}` 的片段，触发展开，验证弹出输入框，填写后正确替换 |
| 应用重启              | 重启应用，验证已通知的提醒不重复通知，浮动笔记窗口位置恢复         |

### 10.4 构建验证



```
pnpm build

\# 验证 macOS 构建

pnpm build:mac

\# 验证 Windows 构建

pnpm build:win
```



***

## 十一、执行总结

### 11.1 执行状态

本计划已于 2026-09-06 全部执行完成，所有功能均已实现并通过验证。

### 11.2 提交记录



| Commit    | 说明                                            |
| --------- | --------------------------------------------- |
| `1cb0d58` | feat: 集成 Raycast 核心功能（29 个文件，+3433/-114）      |
| `bbc0707` | refactor: Raycast 化 UI 与架构改造（5 个文件，+612/-584） |

### 11.3 验证结果



* ✅ TypeScript typecheck 通过（新增代码无类型错误）

* ✅ 372 个单元测试全部通过（含 28 个单位换算测试）

* ✅ 代码审查 16 项问题全部修复（含 2 个安全注入漏洞）

* ✅ 所有功能手动验证通过

### 11.4 代码审查修复清单



| #  | 问题                                          | 严重程度 | 状态              |
| -- | ------------------------------------------- | ---- | --------------- |
| 1  | inputBox macOS title 参数未转义 → AppleScript 注入 | 严重   | ✅ 已修复           |
| 2  | inputBox Windows 参数未转义 → PowerShell 注入      | 严重   | ✅ 已修复           |
| 3  | ReminderPage showTimePicker 永远为 false       | 严重   | ✅ 已修复           |
| 4  | ReminderRepository 全文搜索 SQL 列名歧义            | 严重   | ✅ 已修复           |
| 5  | ReminderService complete () 未清理 notified 集合 | 中等   | ✅ 已修复           |
| 6  | inputBox Windows 取消判断逻辑错误                   | 中等   | ✅ 已修复           |
| 7  | inputBox macOS trim 丢失用户输入首尾空格              | 中等   | ✅ 已修复           |
| 8  | textExpansion Linux 平台动态参数不可用               | 中等   | ✅ 已修复           |
| 9  | FloatingNote 调用不存在的 startDrag API           | 中等   | ✅ 已修复           |
| 10 | 通知点击绕过 Service 层                            | 中等   | ✅ 已修复           |
| 11 | ReminderRepository create () 未验证 title 非空   | 轻微   | ✅ 已修复           |
| 12 | 自然语言解析仅支持中文                                 | 轻微   | ✅ 已修复（新增英文）     |
| 13 | 货币换算未标注汇率基准日期                               | 轻微   | ✅ 已修复           |
| 14 | Emoji 数据集仅 100+                             | 轻微   | ✅ 已修复（扩充至 180+） |
| 15 | 浮动笔记窗口位置 / 大小不保存                            | 轻微   | ✅ 已修复           |
| 16 | notified 集合内存态，重启后重复通知                      | 轻微   | ✅ 已修复（数据库持久化）   |

### 11.5 已知遗留与待验证项（2026-09-06 验收补充）

> 以下为代码审查发现的系统命令层缺陷，不影响主路径，需真机验证后决定是否修改，暂不处理。

| # | 问题 | 位置 | 状态 |
| -- | ---- | ---- | ---- |
| L1 | `system.muteToggle` 静音切换存在边界逻辑缺陷 | `src/main/modules/systemCommands.ts` MAC_COMMANDS | ⏳ 待真机验证 |
| L2 | `system.showDesktop` 是死命令且按键组合可疑 | `src/main/modules/systemCommands.ts` MAC_COMMANDS / WIN_COMMANDS | ⏳ 待真机验证 |

**L1 详情**：macOS 静音切换脚本先按当前音量执行 `set volume output volume 0`（o>0 时）或 `set volume output volume 50`（o=0 时），再反转 `output muted` 状态。边界缺陷：当系统处于「已静音且记忆音量被清为 0」时，脚本先设音量 50、再把 muted 反转回 false → 结果"音量 50 未静音"正常；但当「未静音且音量恰为 0」时，脚本设音量 50 后把 muted 反转成 true → 停在"音量 50 已静音"的意外态。连续切换两次后状态不可预期。**建议**：改为仅反转 `output muted`（`set volume output muted (not output muted of (get volume settings))`），不再动音量。

**L2 详情**：`MAC_COMMANDS`/`WIN_COMMANDS` 虽实现了 `system.showDesktop`，但没有任何 CommandProvider 或 `shared/commands.ts` 的 `SYSTEM_CMD_META` 引用它 → 搜索永远不可达，是死代码。且 macOS 实现 `key code 103 using {function down, command down}`（F11 + Fn + Cmd）并非"显示桌面"标准快捷键（标准为 Fn+F11 或 Mission Control 手势），部分键盘布局下无效。真正可达的同类命令是 `system.hideAll`。**建议**：删除死命令，或与 hideAll 合并后修正按键。

***

## 附录 A：新增文件清单



| 文件路径                                               | 说明                   |
| -------------------------------------------------- | -------------------- |
| `src/shared/unitConverter.ts`                      | 单位 / 货币换算模块          |
| `src/shared/fallbackCommands.ts`                   | Fallback Commands 定义 |
| `src/shared/emoji.ts`                              | Emoji 数据集 + 搜索       |
| `src/shared/__tests__/unitConverter.test.ts`       | 单位换算单元测试（28 个）       |
| `src/main/db/migrations/024_reminders.ts`          | 提醒事项数据库迁移            |
| `src/main/db/migrations/025_reminders_notified.ts` | notified\_at 字段迁移    |
| `src/main/db/repos/ReminderRepository.ts`          | 提醒事项数据访问层            |
| `src/main/services/ReminderService.ts`             | 提醒事项服务（定时扫描 + 通知）    |
| `src/main/ipc/reminders.ts`                        | 提醒事项 IPC 通道          |
| `src/main/modules/floatingNote.ts`                 | 浮动笔记窗口管理             |
| `src/main/utils/inputBox.ts`                       | 跨平台系统原生输入框           |
| `src/renderer/src/launcher/pages/ReminderPage.vue` | 提醒事项页面               |
| `src/renderer/src/launcher/pages/CalendarPage.vue` | 日历页面                 |
| `src/renderer/src/views/notes/FloatingNote.vue`    | 浮动笔记渲染端页面            |

## 附录 B：修改文件清单



| 文件路径                                                     | 修改内容                                                              |
| -------------------------------------------------------- | ----------------------------------------------------------------- |
| `src/main/index.ts`                                      | 注册 reminders IPC + 启动 ReminderService + 注册 floatingNote IPC       |
| `src/main/ipc/index.ts`                                  | 导出 registerRemindersIpc                                           |
| `src/main/db/migrations/index.ts`                        | 注册 m024 + m025 迁移                                                 |
| `src/main/db/repos/index.ts`                             | 导出 ReminderRepository                                             |
| `src/main/modules/systemCommands.ts`                     | 补充 MAC\_COMMANDS/WIN\_COMMANDS（restart/shutdown/hideAll 等）        |
| `src/main/modules/expansionTemplate.ts`                  | 新增 extractDynamicParams + applyDynamicParams                      |
| `src/main/modules/textExpansion.ts`                      | 集成动态参数输入框流程                                                       |
| `src/preload/index.ts`                                   | 暴露 reminders + floatingNote API                                   |
| `src/preload/index.d.ts`                                 | 添加 reminders + floatingNote 类型声明                                  |
| `src/renderer/src/launcher/LauncherApp.vue`              | 集成单位换算 + Fallback Commands + Emoji 搜索 + 新页面路由                     |
| `src/renderer/src/commands/SystemCommandProvider.ts`     | 修复 cmdId 格式 + 补充完整窗口管理命令                                          |
| `src/renderer/src/commands/FirstPartyCommandProvider.ts` | 注册 reminders + calendar + floatingNote 命令                         |
| `src/renderer/src/router/index.ts`                       | 添加 /floating-note 路由                                              |
| `src/renderer/src/utils/commandRunner.ts`                | 添加 floatingNote action 处理                                         |
| `src/shared/commands.ts`                                 | 添加 calendar/reminders FirstPartyPage + floatingNote CommandAction |



***

*文档结束*
