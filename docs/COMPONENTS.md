# Leaf · 12 个核心组件规范

> 所有组件以 **`L` 前缀**（Leaf）：`LButton`、`LInput`、`LCard`、`LModal`、`LToast`、`LTooltip`、`LSwitch`、`LSelect`、`LProgress`、`LNav`、`LTag`、`LAppShell`。
>
> 实现位置：`src/renderer/src/components/leaf/`（新建目录）。

---

## 8.1 LButton

### 变体表

| Variant   | Padding | Radius | Font   | Background       | Text         | Hover BG       |
| --------- | ------- | ------ | ------ | ---------------- | ------------ | -------------- |
| Primary   | 8 / 16  | 12     | 14/600 | `--brand-500`    | white        | `--brand-600`  |
| Secondary | 8 / 16  | 12     | 14/600 | transparent      | `--gray-700` | `--gray-100`   |
| Ghost     | 8 / 12  | 12     | 14/500 | transparent      | `--gray-700` | `--gray-100`   |
| Danger    | 8 / 16  | 12     | 14/600 | `--color-danger` | white        | `#B91C1C`      |
| Accent    | 8 / 16  | 12     | 14/600 | `--accent-500`   | white        | `--accent-600` |

### 尺寸

| Size | Padding | Font |
| ---- | ------- | ---- |
| sm   | 6 / 12  | 13   |
| md   | 8 / 16  | 14   |
| lg   | 12 / 24 | 16   |

### 状态

| 状态     | 行为                                     |
| -------- | ---------------------------------------- |
| default  | 默认                                     |
| hover    | 颜色变化 80ms                            |
| active   | 颜色加深一档                             |
| disabled | opacity 0.5 + cursor not-allowed         |
| loading  | 左侧 spinner + 文案替换为 `loading-text` |

### API

```ts
defineProps<{
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'accent' // 默认 primary
  size?: 'sm' | 'md' | 'lg' // 默认 md
  disabled?: boolean
  loading?: boolean
  loadingText?: string
  block?: boolean // 全宽
  icon?: Component // 前置 icon
  iconRight?: Component
}>()
```

---

## 8.2 LInput

### 视觉

- 高度：md=36 / lg=44
- 边框：`--gray-200` 1px
- focus：`--brand-500` + 3px ring（`--shadow-ring-focus`）
- placeholder：`--gray-400`
- 错误状态：边框 `--color-danger` + 下方 caption 红色

### API

```ts
defineProps<{
  modelValue?: string
  size?: 'md' | 'lg'
  placeholder?: string
  error?: string // 设置后变红
  helperText?: string
  prefixIcon?: Component
  suffixIcon?: Component
  clearable?: boolean
  type?: 'text' | 'search' | 'password' | 'number'
}>()
```

### 扩展

- `LInputNumber`（带 stepper）
- `LTextarea`（自动增高，最多 8 行）
- `LInputOtp`（用于快捷操作识别）

---

## 8.3 LCard

### 视觉

- 圆角 12
- padding: 16 24
- 背景 white（亮色） / `--gray-100`（暗色）
- 边框 1px `--gray-200`
- hover：shadow `xs → sm`
- 模块卡片变体：左侧 4px brand 色条

### API

```ts
defineProps<{
  variant?: 'default' | 'module' // module 显示左侧色条
  hoverable?: boolean // 默认 true
  padding?: 'default' | 'none' | 'compact'
}>()
defineSlots<{
  default: () => any
  header?: () => any
  footer?: () => any
}>()
```

---

## 8.4 LModal

### 视觉

- 遮罩：`rgba(0,0,0,0.4)` + `backdrop-blur(2px)`
- 卡片宽度：sm=400 / md=520 / lg=720
- 阴影：`shadow-lg`，圆角：20
- 动画：`scale 0.96 → 1 + opacity`，280ms

### API

```ts
defineProps<{
  modelValue: boolean
  size?: 'sm' | 'md' | 'lg'
  title?: string
  closeOnBackdrop?: boolean // 默认 true
  closeOnEsc?: boolean // 默认 true
}>()
defineEmits<{ 'update:modelValue': [boolean] }>()
defineSlots<{
  default: () => any
  footer?: () => any
}>()
```

---

## 8.5 LToast

### 视觉

- 位置：bottom 24，水平居中
- 类型：`success` / `warning` / `error` / `info`
- 动画：`translateY 20 → 0 + opacity`
- 自动关闭：`success/info` 3s；`error` 5s；`warning` 4s

### 全局 API

```ts
// composables/useToast.ts 暴露
toast.success('壁纸已设置')
toast.error('下载失败', { duration: 6000 })
toast.info('已复制到剪贴板')
toast.warning('正在轮换中…')
```

### 单个 API

```ts
defineProps<{
  type: 'success' | 'warning' | 'error' | 'info'
  message: string
  duration?: number
}>()
```

---

## 8.6 LTooltip

### 视觉

- 出现延迟 300ms
- 位置：`top`（默认）/ `bottom` / `left` / `right`
- 圆角 6，阴影 `shadow-md`
- 内 padding 4 / 8，font 12

### API

```ts
defineProps<{
  content: string
  placement?: 'top' | 'bottom' | 'left' | 'right'
  delay?: number // 默认 300
}>()
```

---

## 8.7 LSwitch

### 视觉

- 宽度 36，高度 20
- on：`--brand-500` 底 + 白圆点右
- off：`--gray-300` 底 + 白圆点左
- focus：`shadow-ring-focus`
- disabled：opacity 0.5

### API

```ts
defineProps<{
  modelValue: boolean
  disabled?: boolean
  size?: 'sm' | 'md' // 默认 md
}>()
```

---

## 8.8 LSelect / LCombobox

### 视觉

- 触发器基于 `LInput`：36/44 高 + 右侧 chevron
- 下拉面板：`shadow-md` + `radius-md`，最大 320px 高
- 选项高度 36px，选中态 `--brand-50` 底 + `--brand-700` 字
- Combobox 带搜索框（在顶部）+ 键盘上下/Enter 选中

### API

```ts
// LSelect
defineProps<{
  modelValue: string | number | null
  options: { label: string; value: string | number; disabled?: boolean }[]
  placeholder?: string
  clearable?: boolean
}>()
```

```ts
// LCombobox（异步）
defineProps<{
  modelValue: string | null
  fetchOptions: (query: string) => Promise<...>
  placeholder?: string
}>()
```

---

## 8.9 LProgress

### Linear

- 高度 6
- 圆角 6
- 进度条 `--brand-500`
- 背景 `--gray-200`（亮）/ `--gray-700`（暗）
- indeterminate 态：水平移动的 shimmer

### Circular

- 直径：sm=60 / md=120 / lg=180
- 圆环粗 4 / 6 / 8
- 当前进度 `--brand-500`，背景 `--gray-200`

### API

```ts
defineProps<{
  value: number // 0-100
  variant?: 'linear' | 'circular'
  size?: 'sm' | 'md' | 'lg'
  indeterminate?: boolean
  showLabel?: boolean // 居中 % 文字
}>()
```

---

## 8.10 LNavItem

### 视觉

- 高度 48
- padding: 0 / 12
- 圆角 12（hover/active 状态）
- 默认态：transparent 底 + `--gray-700` 字 + 24 icon
- hover：`--gray-100` 底
- active：4px brand 色左边条 + `--brand-50` 底 + `--brand-700` 字 + 24 icon brand
- 含快捷键提示：`⌘1`，字号 12，灰色

### API

```ts
defineProps<{
  icon: Component
  label: string
  shortcut?: string // "⌘1"
  to?: string // router-link
  active?: boolean // 手动指定
}>()
```

---

## 8.11 LTag

### 视觉

- 圆角 6
- padding: 2 / 8
- font 12/500
- 类型：neutral / brand / success / warning / danger / info
- 关闭按钮 14px

### API

```ts
defineProps<{
  type?: 'neutral' | 'brand' | 'success' | 'warning' | 'danger' | 'info' // 默认 neutral
  closable?: boolean
  size?: 'sm' | 'md'
}>()
```

---

## 8.12 LAppShell

### 结构

```
┌───────────────────────────────────────┐
│  TopBar (40px)                         │
├──────┬────────────────────────────────┤
│      │                                 │
│ Side │   <slot> route content         │
│ Nav  │                                 │
│ 60px │                                 │
│      │                                 │
└──────┴────────────────────────────────┘
```

- `LAppShell` 在 `App.vue` 中包裹 `<router-view>`
- 接受 `topBar` 与 `sideNav` 两个 slot
- 内部 slot 接收模块页面
- topBar sticky；sideNav 60px（折叠）/ 240px（hover 展开）

### API

```ts
defineSlots<{
  topBar: () => any
  sideNav: () => any
  default: () => any // route content
}>()
```

---

## 实施清单

| 组件              | 实现方式                          | 优先级 |
| ----------------- | --------------------------------- | ------ |
| LAppShell         | 后续替换 App.vue                  | P0     |
| LButton           | 替换 Leaf 当前直接按钮            | P0     |
| LInput            | 替换 Home.vue 等的 input          | P0     |
| LCard             | Hub 卡片 / 模块卡片               | P0     |
| LModal            | 替换现有模态（SettingsDialog 等） | P0     |
| LToast            | 引入 useToast 替代 alert()        | P0     |
| LSwitch           | 设置页开关                        | P1     |
| LSelect/LCombobox | 命令面板、设置选项                | P1     |
| LProgress         | 番茄钟圆环、上传进度              | P1     |
| LNavItem          | 侧边栏导航                        | P0     |
| LTag              | 标签、徽章                        | P1     |
| LTooltip          | 命令面板、按钮 tooltip            | P2     |

> **不允许新页面再用未在此清单中的自定义视觉。** 后续新增组件必须先在 `docs/COMPONENTS.md` 起草 → 评审 → 加入清单。
