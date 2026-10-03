# 批 4 设计：UDrawer + FTS 死重清理 + 编辑器保存刷新

- 日期：2026-10-03
- 状态：已批准
- 前置：批 1-3 已完成（原语库 19 件套；片段列表已分页化）

## 1. UDrawer 原语 + TaskDetailDrawer 收编

- **UDrawer**（components/ui/，对齐 UModal 模式）：`v-model`、`side: 'left' | 'right'`（默认 right）、`size`（sm=w-80 / md=w-120=480px / lg=w-160，内联 max-width:92vw 兜窄窗）、Teleport 到 body、遮罩点击/Esc 关闭、焦点陷阱 + 焦点归还（同 UModal 实现）、**侧滑动画**（scoped transition，right 起始 translateX(100%)、left 反向；TaskDetailDrawer 现状无动画，属补齐）。attrs 透传到面板（aria-label/title 定制由此进）。无 title 时不渲染内置 header（内容自带 header 的场景用）。
- **TaskDetailDrawer**：删 aside 壳 + 遮罩 + 对应 CSS（.task-drawer/.drawer-overlay），`close()`/自定义 header 保留；`@update:model-value="emit('close')"` 映射；aria-label 经 attrs 传入。壳表面从 --pomodoro-drawer-bg 收敛到全局 token（换壳接受收敛）。无 Esc/焦点管理 → 新增能力。

## 2. FTS5 死重清理（迁移 034）

- 034：`DROP TRIGGER IF EXISTS snip_snippets_fts_ai/ad/au` ×3 → `DROP TABLE IF EXISTS snip_snippets_fts`（顺序关键：触发器挂在 snip_snippets 上，不先删则写操作炸 no such table；影子表自动级联）。001/005 历史迁移不改。
- 同步：删 5_6b.snippet.test.ts 的 FTS 用例（L74-95，唯一活引用；语义已被 search_text 写入可搜覆盖）+ 更新该重建件头部注释；清理 SnippetRepository.ts 内 4 处 FTS 陈旧注释。reminders_fts/notes_fts/files_fts 仍用，不碰。

## 3. 编辑器保存后列表顺序刷新

- **Editor.saveEditorContent**：改为 `await enqueueContentsWrite(props.snippet.id, updatedContents)`（同一条按 snippetId 串行写入链）→ emit 服务端新对象。删除本地拼旧 updatedAt + 丢弃返回值的防抖路径，顺带修掉防抖窗口内切换片段丢更新的隐患。
- **SnippetList**：watch `props.selectedSnippet`，仅当 id 不变而 updatedAt 变化（=编辑保存）时 `loadSnippets('refresh')`（按已加载量重拉、服务端重排）；id 变化（切换选中）不触发。

## 4. 交付与验收

三个提交：① UDrawer + TaskDetailDrawer；② FTS 清理；③ 编辑器保存刷新。门禁：typecheck / lint（触达文件 0 error）/ 全量单测 / build / e2e 冒烟。UDrawer TDD：Teleport、v-model、Esc、遮罩点击、焦点陷阱/归还、side 定位类、attrs 透传。
