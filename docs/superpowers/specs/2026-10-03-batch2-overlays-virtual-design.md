# 批 2 设计：弹层收编 + UOptionPills/UTextarea + 虚拟滚动

- 日期：2026-10-03
- 状态：已批准（用户选定「全量批 2」）
- 前置：批 1 原语库补齐已完成（6b4e27f / e9bab67）；本批证据来自同日探索盘点

## 1. 范围

1. **弹层收编**：5 个真模态换 UModal 壳（ExportDialog、ClipEditor 表单弹窗、MarkersPanel 编辑框、pomodoro TaskEditDialog、pomodoro SettingsDialog）+ MarkersPanel 删除确认换 useConfirm。**明确不收编**：CommandPalette（顶部输入型）、倒计时 HUD（纯展示盾）、OnboardingView（强制向导）、TaskDetailDrawer（侧滑抽屉，留待 UDrawer 原语）。
2. **UOptionPills**（新原语）：统一 5 处分段选择器，选中态统一品牌蓝，消掉全仓唯一的 emerald-500 异色。
3. **UTextarea**（新原语）：SettingsView 5 处表单 textarea 机械迁移。
4. **虚拟滚动**：HistoryPage + KillProcessPage 两处（行高固定、全量加载），用已装 @vueuse/core useVirtualList。
5. **死代码清理**：删除 RecordingHistory.vue（注释自认死代码、零引用）。

**不做（挂账）**：SnippetList 后端分页（主进程仓库无 LIMIT，属主进程改造）、UDrawer 原语、SnippetList/TaskListPanel 虚拟化、编辑器主体 textarea（Editor/FloatingNote/NotesPage/FormPage/TaskEditDialog 内部控件）。

## 2. 约定

沿用批 1 全部约定（typed Props/withDefaults、v-model、semantic token 类、中文 JSDoc 头、attrs 透传保 data-test 钩子、无任意值类新增）。

## 3. UOptionPills 规格

- Props：`modelValue`（泛型 T extends string | number）、`options: { label; value; disabled? }[]`、`variant: 'rect' | 'pill'`（rect=rounded-lg 带边框档位；pill=rounded-full 胶囊）、`size: 'sm' | 'md'`（sm=px-2.5 py-1 text-[12px]；md=px-3 py-1.5 text-sm）、`disabled`、`label`。
- A11y：容器 `role="radiogroup"`，每项 `role="radio"` + `aria-checked` + roving tabindex；ArrowLeft/Right/Up/Down 循环导航。
- 选中态 `bg-brand-500 text-white`；未选 `bg-surface-2` + hover；attrs 透传容器。
- 迁移 5 处：RecordingSettingsDialog 倒计时（rect/md，消 emerald）、SettingsView 密度（rect/sm）、玻璃档位（rect/sm，保 data-testid="glass-picker"）、AI 服务方（pill/sm）、模型列表（pill/sm，接受去 mono 统一）。

## 4. UTextarea 规格

- Props：`modelValue: string`、`placeholder`、`label`、`disabled`、`error`（aria-invalid/describedby 同 UInput）、`rows`（默认 3）、`mono`（font-mono text-[12px]，JSON 场景）、`resize: 'none' | 'y'`（默认 none）、attrs 透传原生 textarea。
- 迁移 SettingsView 5 处：系统提示词（rows2）、MCP JSON（rows7/mono/resize-y）、屏蔽应用（rows2/mono）、屏蔽网站（rows2/mono）、定时任务 JSON（rows8/mono/resize-y）。

## 5. 弹层收编规格

- 只换壳：遮罩/居中/Esc/焦点陷阱/焦点归还由 UModal 承担；内部控件与业务逻辑不动；z-index 混战（z-[1200]/[2000]/[1100]）随收编消除。
- 宽度规则：取最接近 sm(384)/md(512)/lg(672) 档位，±32px 视觉差异属预期收敛；ExportDialog 520→md。
- MarkersPanel L223 删除确认 → `confirm({ danger: true })`。
- pomodoro 两弹窗换壳后内部 .field 旧样式控件不动。
- ExportDialog 换壳后 `exportDialog.test.ts` 必须保持绿（事件/禁用态契约）。

## 6. 虚拟滚动规格

- HistoryPage：`useVirtualList(history, { itemHeight ≈88 })`（执行时实测），行结构不变。
- KillProcessPage：同法，固定单行。
- 仅在原滚动容器内启用；容器高度行为不变。

## 7. 验收

- UOptionPills/UTextarea 单测；`exportDialog.test.ts` 绿；typecheck/lint（触达文件 0 error）/全量单测/`pnpm build`/e2e 冒烟 5 套件。
- 三个提交：① UOptionPills+UTextarea+迁移；② 弹层收编；③ 虚拟滚动+死代码删除。
