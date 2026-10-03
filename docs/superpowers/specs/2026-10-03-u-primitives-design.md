# U 原语库补齐设计（批 1：原语 + 高价值迁移）

- 日期：2026-10-03
- 状态：已批准（用户确认批次范围 = 「原语 + 高价值迁移」）
- 前置调研：2026-10-03 UI 层盘点 + Element Plus 引入必要性调研（结论：不引入 EP，补齐自建原语）

## 1. 背景与目标

项目 UI 层现状（2026-10-03 盘点）：`components/ui/` 已有 9 件套原语（674 行），但存在三类缺口：

1. **缺件**：USwitch / UInput / UCheckbox / URadio / USlider / UTabs / UDropdown 全部缺失，各视图裸手写且重复（SettingsView 同文件两套尺寸的 switch；RecordingSettingsDialog 798 行零封装）。
2. **碎片**：UModal 全项目仅 1 处使用且无焦点陷阱；12 处原生 `confirm()` 分布在 7 个文件（均为删除/清空类危险操作）。
3. **不一致**：表单控件样式随写随定，无统一交互与 a11y 基线。

**本批目标**：补齐 7 个缺失原语 + UModal 焦点陷阱 + 统一确认弹窗机制，并完成三处高价值迁移。

**非目标（明确不做，留给后续批次）**：7+ 处手写弹层收编、长列表虚拟滚动（届时用已装依赖 @vueuse/core 的 useVirtualList）、全面 a11y 补课、launcher 域内组件迁移（launcher 有独立玻璃主题，刻意偏离全局设计语言）。

## 2. 约定基线（所有新原语必须遵守）

沿用现有 9 件套已验证的约定：

- `<script setup lang="ts">` + 组件头部中文 JSDoc（`组件名 · 一句话` + 特性 bullet）。
- `interface Props` + `withDefaults(defineProps<Props>(), {...})`；typed emits（`defineEmits<{ 'update:modelValue': [value: T] }>()`）。
- 受控组件一律 `v-model`（`modelValue` + `update:modelValue`）。
- size 档位 sm / md / lg，对齐 UButton 的 h-7 / h-9 / h-11 节奏。
- 样式只用 semantic token 类：`bg-surface-1`、`text-fg-primary`、`border-line-default`、`focus-visible:shadow-ring-focus`、`duration-fast` 等；**不用任意值类**（B17 家族教训：静默失效风险）。
- 不依赖 preflight（Tailwind 4 管线过渡期契约：只引 theme + utilities 层）。
- 图标：remixicon `<i class="ri-*">` 或内联 SVG，装饰性图标一律 `aria-hidden="true"`。
- 组件放 `src/renderer/src/components/ui/`，测试放同级 `__tests__/`。

## 3. 新增原语（7 个）

### USwitch
- Props：`modelValue: boolean`、`size?: 'sm' | 'md'`（两档即可，目标是终结 SettingsView 内 h-[22px]w-[38px] 与 h-[28px]w-[46px] 两套手写尺寸）、`disabled?: boolean`、`label?: string`。
- 实现：`<button>` + `role="switch"` + `aria-checked` + `aria-labelledby`（有 label 时）；旋钮位移用 `duration-fast` 过渡；焦点环 `focus-visible:shadow-ring-focus`。
- 事件：`update:modelValue`。

### UInput
- Props：`modelValue: string`、`type?: 'text' | 'password' | 'number'`、`placeholder?`、`label?`、`disabled?`、`error?: string`。
- 插槽：`#prefix` / `#suffix`（放 remixicon 图标）。
- 实现：原生 input + 自绘容器边框（对齐 USelect 的边框/焦点样式）；`error` 存在时 `aria-invalid="true"` + `aria-describedby` 指向错误文案节点。
- 事件：`update:modelValue`。

### UCheckbox
- Props：`modelValue: boolean`、`label?`、`disabled?`。
- 实现：原生 `<input type="checkbox">`（可访问性白得）+ `appearance-none` 自绘勾选态（内联 SVG 勾）。
- 事件：`update:modelValue`。

### URadioGroup
- Props：`modelValue: string | number`、`options: { label; value; disabled? }[]`（对齐 USelect 的 options 形态）、`disabled?`、`label?`、`direction?: 'vertical' | 'horizontal'`。
- 实现：容器 `role="radiogroup"` + `aria-label`；单项原生 radio + 自绘圆点；方向默认 vertical。
- 事件：`update:modelValue`（还原原始类型，复用 USelect 的 `data-value` 技巧）。

### USlider
- Props：`modelValue: number`、`min?: number`、`max?: number`、`step?: number`、`disabled?`、`showValue?: boolean`、`formatValue?: (v: number) => string`。
- 实现：原生 `input[type=range]` + 自绘轨道/滑块（`aria-label` 取 label prop）；showValue 时右侧渲染格式化值。
- 事件：`update:modelValue`。

### UTabs
- Props：`tabs: { id: string; label: string }[]`、`modelValue: string`、`variant?: 'underline' | 'segment'`（segment 对应录屏 Layout 的按钮组风格，underline 对应常规页签）。
- 实现：`role="tablist"` / `role="tab"` + `aria-selected`；ArrowLeft / ArrowRight（RTL 不做）键盘导航 + Home/End；受控组件不做内部状态。
- 事件：`update:modelValue`。

### UDropdown
- Props：`items: { id; label; icon?; danger?; disabled?; divider? }[]`、`align?: 'start' | 'end'`、`side?: 'bottom' | 'top'`。
- 分隔线规则：`divider: true` 的项渲染为 `<hr>` 分隔线，忽略其余字段且不可聚焦。
- 插槽：默认插槽承载触发器（组件包裹渲染）。
- 实现：`relative` 包裹 + `absolute` 面板；展开时按触发器 `getBoundingClientRect` 与视口做边界翻转（约 30 行，见决策点 B）；点击外部关闭（document click 监听）+ Esc 关闭 + ArrowUp/Down 在 menuitem 间移动 + 打开时聚焦首项。
- A11y：`role="menu"` / `role="menuitem"`、触发器 `aria-haspopup="menu"` + `aria-expanded`。
- 事件：`select: [id: string]`。

## 4. UModal 增强（不破坏现有 API）

现有行为保留（Teleport、Esc、遮罩点击、rAF 聚焦面板、MigrationCenterView 已在用）。新增：

- **焦点陷阱**：打开时监听 Tab / Shift+Tab，将焦点循环限制在面板内（查询可聚焦元素：`a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])`）。
- **焦点归还**：打开时记录 `document.activeElement`，关闭时归还。
- API 不新增必填项，MigrationCenterView 零改动。

## 5. 统一确认弹窗

- 新增 `src/renderer/src/composables/useConfirm.ts`：模块级单例状态（对称 useToast 先例）。Promise API：

  ```ts
  const ok = await confirm({
    title: '彻底删除片段？',
    message: '该操作不可撤销。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
  ```

- 新增 `components/ui/UConfirmProvider.vue`：AppShell 挂载一次；内部复用 UModal（size sm）+ UButton；`danger: true` 时确认键用 danger 变体、Esc/遮罩关闭视为取消。
- Resolve 后清空 pending 状态；同一时刻只允许一个 pending confirm（后到覆盖先到并 resolve(false)）。

## 6. 迁移面（本批三处）

### 6.1 RecordingSettingsDialog.vue（`src/renderer/src/views/screenRecorder/components/`）
- 9 个裸 radio → URadioGroup（按现有分组拆）。
- 5 个裸 checkbox → UCheckbox。
- 4 个裸 number input → UInput（type=number）为默认；仅当个别控件语义为连续量（适合滑块）时个案替换为 USlider，替换清单在实施计划中逐个列出，不做的保持 UInput。
- 1 个裸 select → USelect。
- 手写遮罩弹层 → UModal。
- 8 个裸 button → UButton。
- 预期净减 200+ 行；功能与视觉（token 不变）无回归。

### 6.2 SettingsView.vue（`src/renderer/src/views/`）
- 4 处手写 `role="switch"`（L980 / L1019 / L1326 / L1629）→ USwitch（md 档为主，行高紧凑处用 sm）。
- 同页散落的裸 text / password input → UInput。

### 6.3 12 处 `confirm()` → useConfirm
- `views/launcher/index.vue` L1255、L1362（launcher 主窗视图，非玻璃主题页面，可迁）。
- `views/snippets/components/SnippetList.vue` L189、L201。
- `views/screenRecorder/components/ClipEditor.vue` L215、L227。
- `views/snippets/components/Sidebar.vue` L82。
- `views/screenRecorder/components/RecordingHistory.vue` L40。
- `views/screenRecorder/pages/HistoryPage.vue` L205、L212。
- `views/pomodoro/components/TaskListPanel.vue` L126。
- 全部为删除/清空类危险操作，统一 `danger: true`；文案沿用现有。

### 不动清单
- `launcher/pages/FormPage.vue` 的 switch（launcher 独立玻璃主题）。
- 7+ 处手写 `fixed inset-0` 弹层（RecordingSettingsDialog 的遮罩除外——它随 6.1 顺路收编）。
- CommandPalette、EmojiSuggest 等专用弹层。

## 7. 测试

- 每个新原语一个测试文件（`components/ui/__tests__/`）：渲染、v-model 双向、disabled 态、关键键盘行为（UTabs 方向键、UDropdown 方向键/Esc、USwitch Space 切换）。
- `UModal` 焦点陷阱测试：Tab 循环、关闭归还焦点。
- `useConfirm` 测试：resolve(true)/resolve(false)/pending 覆盖语义。
- 基建：vitest + happy-dom + @vue/test-utils（已有），遵循 `__tests__` 目录惯例。

## 8. 验收门禁

1. `pnpm typecheck`、`pnpm lint`、`pnpm test` 全绿。
2. `pnpm dev` 手测：录屏设置弹窗、设置页、snippets/录屏/番茄钟的删除确认流。
3. 幽灵类门禁（ghostClasses.test.ts）通过——新组件只用静态 token 类，产物 diff 应接近 0。

## 9. 已定决策记录

- **决策点 A（确认机制）**：选 Provider + Promise API 模式（对称 useToast），弃「每视图手挂 UModal」——12 处迁移点样板代码差 3 倍，且 useToast 已验证该模式。
- **决策点 B（UDropdown 定位）**：手写翻转定位（getBoundingClientRect + 视口判断，零新依赖），弃 `@floating-ui/dom`——当前 3 个使用场景不足以引入依赖；接口预留升级空间。
- **整体路线**：2026-10-03 调研后确定「补齐自建原语库」而非引入 Element Plus（macOS Native 设计语言冲突、Tailwind 4 preflight 冲突、适用面窄）。

## 10. 交付切分

- **提交 1**：7 个新原语 + UModal 焦点陷阱 + useConfirm/UConfirmProvider + 全部单测。
- **提交 2**：三处迁移（6.1 / 6.2 / 6.3）。
