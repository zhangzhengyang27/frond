# U 原语库补齐（批 1）实施计划

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 补齐自建原语库（7 个新组件 + UModal 焦点陷阱 + 统一确认弹窗），并完成三处高价值迁移（RecordingSettingsDialog、SettingsView、12 处 `confirm()`）。

**Architecture:** 新原语全部落在 `src/renderer/src/components/ui/`，遵循现有 9 件套约定（typed Props/withDefaults、v-model、semantic token 类、中文 JSDoc 头）；确认弹窗走 Provider + Promise API（对称 useToast）；迁移不改业务逻辑只换控件实现。

**Tech Stack:** Vue 3.5（`<script setup>`、`useId`）、Tailwind 4 语义桥（`styles/tailwind.css`）、vitest + happy-dom（文件头 `// @vitest-environment happy-dom`）+ @vue/test-utils、`@components` 别名。

**规格**：`docs/superpowers/specs/2026-10-03-u-primitives-design.md`（本计划的任务与其章节一一对应）。

**提交策略（规格 §10 覆盖模板默认）**：Task 1-9 只跑测试不提交；Task 10 验收后做**提交 1**；Task 11-14 同理；Task 15 验收后做**提交 2**。共两个提交。

**测试模板约定**（自现有先例 exportDialog.test.ts 提取）：文件第一行 `// @vitest-environment happy-dom`；断言盯事件/状态/aria，不盯样式类名；工厂函数用 `// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂`。

**运行单测的统一命令**（在仓库根）：

```bash
pnpm vitest run <测试文件路径>
```

---

### Task 1: USwitch

**Files:**
- Create: `src/renderer/src/components/ui/USwitch.vue`
- Test: `src/renderer/src/components/ui/__tests__/uSwitch.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import USwitch from '../USwitch.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(USwitch, { props: { modelValue: false, ...props } })
}

describe('USwitch', () => {
  it('渲染 role=switch 与 aria-checked', () => {
    const w = setup({ modelValue: true })
    expect(w.get('button').attributes('role')).toBe('switch')
    expect(w.get('button').attributes('aria-checked')).toBe('true')
  })

  it('点击发出 update:modelValue 翻转值', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([true])
  })

  it('disabled 时不发出事件', async () => {
    const w = setup({ disabled: true })
    await w.get('button').trigger('click')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('label 进入 aria-label', () => {
    const w = setup({ label: '紧凑模式' })
    expect(w.get('button').attributes('aria-label')).toBe('紧凑模式')
  })

  it('attrs 透传到根 button（data-* 可命中）', () => {
    const w = setup({ 'data-compact-toggle': true })
    expect(w.get('button').attributes('data-compact-toggle')).toBe('true')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uSwitch.test.ts`
Expected: FAIL（找不到 `../USwitch.vue`）

- [ ] **Step 3: 写实现**

```vue
<script setup lang="ts">
import { computed } from 'vue'

/**
 * USwitch · 统一开关
 * - size: sm（紧凑行 20×36）/ md（标准行 24×44），终结各视图手写多套尺寸
 * - 选中态统一品牌蓝（D5：全站唯一 accent = brand 蓝）
 * - attrs 透传到根 button（data-* 钩子可命中）
 */
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue: boolean
  size?: 'sm' | 'md'
  disabled?: boolean
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  size: 'md',
  disabled: false,
  label: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const toggle = (): void => {
  if (!props.disabled) emit('update:modelValue', !props.modelValue)
}

const trackCls = computed(() => (props.size === 'sm' ? 'h-5 w-9' : 'h-6 w-11'))
const knobCls = computed(() => (props.size === 'sm' ? 'size-4' : 'size-5'))
const travelCls = computed(() => {
  if (!props.modelValue) return 'translate-x-0'
  return props.size === 'sm' ? 'translate-x-4' : 'translate-x-5'
})
</script>

<template>
  <button
    type="button"
    role="switch"
    :aria-checked="modelValue"
    :aria-label="label || undefined"
    :disabled="disabled"
    class="relative inline-flex shrink-0 items-center rounded-full transition-colors duration-fast focus-visible:shadow-ring-focus focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
    :class="[trackCls, modelValue ? 'bg-brand-500' : 'bg-surface-active ring-1 ring-line-subtle']"
    v-bind="$attrs"
    @click="toggle"
  >
    <span
      class="absolute left-0.5 top-1/2 -translate-y-1/2 rounded-full bg-white shadow-sm transition-all duration-fast"
      :class="[knobCls, travelCls]"
      aria-hidden="true"
    />
  </button>
</template>
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uSwitch.test.ts`
Expected: PASS 5 个用例

---

### Task 2: UInput

**Files:**
- Create: `src/renderer/src/components/ui/UInput.vue`
- Test: `src/renderer/src/components/ui/__tests__/uInput.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UInput from '../UInput.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}, slots: Record<string, string> = {}) {
  return mount(UInput, { props: { modelValue: '', ...props }, slots })
}

describe('UInput', () => {
  it('输入发出 update:modelValue', async () => {
    const w = setup()
    await w.get('input').setValue('sk-abc')
    expect(w.emitted('update:modelValue')![0]).toEqual(['sk-abc'])
  })

  it('v-model.number 修饰符发出 number', async () => {
    const w = mount(UInput, {
      props: { modelValue: 100, modelModifiers: { number: true } }
    })
    await w.get('input').setValue('1920')
    expect(w.emitted('update:modelValue')![0]).toEqual([1920])
  })

  it('v-model.number 对非数字输入回退原始字符串（对齐 Vue looseToNumber）', async () => {
    const w = mount(UInput, {
      props: { modelValue: 100, modelModifiers: { number: true } }
    })
    await w.get('input').setValue('abc')
    expect(w.emitted('update:modelValue')![0]).toEqual(['abc'])
  })

  it('error 渲染错误文案并设置 aria-invalid', () => {
    const w = setup({ error: '必填项' })
    expect(w.get('input').attributes('aria-invalid')).toBe('true')
    expect(w.text()).toContain('必填项')
  })

  it('type=password 透传', () => {
    const w = setup({ type: 'password' })
    expect(w.get('input').attributes('type')).toBe('password')
  })

  it('#prefix 插槽渲染且 attrs 透传到原生 input', () => {
    const w = setup({ 'data-hello': '1' }, { prefix: '<i class="ri-lock-line" />' })
    expect(w.get('input').attributes('data-hello')).toBe('1')
    expect(w.find('.ri-lock-line').exists()).toBe(true)
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uInput.test.ts`
Expected: FAIL（找不到 `../UInput.vue`）

- [ ] **Step 3: 写实现**

```vue
<script setup lang="ts" generic="T extends string | number | undefined = string">
import { useId } from 'vue'

/**
 * UInput · 统一文本输入
 * - 泛型 T 含 undefined：v-model 绑 string/number/可选 number ref 都能过类型检查
 * - v-model.number 修饰符：parseFloat，NaN 回退原始串（对齐 Vue looseToNumber）
 * - error 时红描边 + aria-invalid/aria-describedby；#prefix/#suffix 放图标
 * - attrs 透传到原生 input（data-test 可命中真实控件）
 */
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue: T
  type?: 'text' | 'password' | 'number'
  placeholder?: string
  label?: string
  disabled?: boolean
  error?: string
  modelModifiers?: { number?: boolean }
}

const props = withDefaults(defineProps<Props>(), {
  type: 'text',
  placeholder: '',
  label: '',
  disabled: false,
  error: '',
  modelModifiers: () => ({})
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const inputId = useId()

const onInput = (e: Event): void => {
  const raw = (e.target as HTMLInputElement).value
  if (props.modelModifiers?.number) {
    const n = parseFloat(raw)
    emit('update:modelValue', (Number.isNaN(n) ? raw : n) as T)
  } else {
    emit('update:modelValue', raw as T)
  }
}
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <label v-if="label" :for="inputId" class="text-xs font-medium text-fg-secondary">
      {{ label }}
    </label>
    <div class="relative flex items-center">
      <span
        v-if="$slots.prefix"
        class="pointer-events-none absolute left-3 text-fg-muted"
        aria-hidden="true"
      >
        <slot name="prefix" />
      </span>
      <input
        :id="inputId"
        :type="type"
        :value="modelValue"
        :placeholder="placeholder"
        :disabled="disabled"
        :aria-invalid="error ? 'true' : undefined"
        :aria-describedby="error ? `${inputId}-err` : undefined"
        class="h-9 w-full rounded-md border border-line-default bg-surface-1 px-3 text-sm text-fg-primary transition-all duration-fast placeholder:text-fg-muted focus:outline-none focus-visible:border-brand-500/50 focus-visible:shadow-ring-focus disabled:cursor-not-allowed disabled:opacity-50"
        :class="[$slots.prefix ? 'pl-9' : '', $slots.suffix ? 'pr-9' : '', error ? 'border-danger' : '']"
        v-bind="$attrs"
        @input="onInput"
      />
      <span v-if="$slots.suffix" class="absolute right-3 text-fg-muted" aria-hidden="true">
        <slot name="suffix" />
      </span>
    </div>
    <p v-if="error" :id="`${inputId}-err`" class="text-xs text-danger">{{ error }}</p>
  </div>
</template>
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uInput.test.ts`
Expected: PASS 6 个用例

---

### Task 3: UCheckbox

**Files:**
- Create: `src/renderer/src/components/ui/UCheckbox.vue`
- Test: `src/renderer/src/components/ui/__tests__/uCheckbox.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UCheckbox from '../UCheckbox.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UCheckbox, { props: { modelValue: false, ...props } })
}

describe('UCheckbox', () => {
  it('勾选发出 update:modelValue: true', async () => {
    const w = setup()
    await w.get('input[type=checkbox]').setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([true])
  })

  it('disabled 时不发出事件', async () => {
    const w = setup({ disabled: true })
    await w.get('input[type=checkbox]').setValue(true)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('label 渲染且点击 label 触发原生控件', async () => {
    const w = setup({ label: '启用音频录制' })
    expect(w.text()).toContain('启用音频录制')
    await w.get('label').trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual([true])
  })

  it('attrs 透传到原生 input（data-test 可命中）', () => {
    const w = setup({ 'data-test': 'cb-system-audio-enabled' })
    expect(w.get('input[type=checkbox]').attributes('data-test')).toBe('cb-system-audio-enabled')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uCheckbox.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现**

```vue
<script setup lang="ts">
/**
 * UCheckbox · 统一复选框
 * - 原生 input 承载可访问性与键盘行为，自绘勾选态
 * - attrs 透传到原生 input（data-test 可命中真实控件）
 */
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue: boolean
  label?: string
  disabled?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  label: '',
  disabled: false
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const onChange = (e: Event): void => {
  emit('update:modelValue', (e.target as HTMLInputElement).checked)
}
</script>

<template>
  <label
    class="flex w-fit items-center gap-2"
    :class="disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'"
  >
    <input
      type="checkbox"
      :checked="modelValue"
      :disabled="disabled"
      class="peer sr-only"
      v-bind="$attrs"
      @change="onChange"
    />
    <span
      class="flex size-4 shrink-0 items-center justify-center rounded-sm border transition-all duration-fast peer-focus-visible:shadow-ring-focus peer-focus-visible:outline-none"
      :class="modelValue ? 'border-brand-500 bg-brand-500' : 'border-line-strong bg-surface-1'"
      aria-hidden="true"
    >
      <svg v-if="modelValue" class="size-3 text-white" viewBox="0 0 24 24" fill="none">
        <path
          d="M20 6 9 17l-5-5"
          stroke="currentColor"
          stroke-width="3"
          stroke-linecap="round"
          stroke-linejoin="round"
        />
      </svg>
    </span>
    <span v-if="label" class="text-sm text-fg-primary">{{ label }}</span>
  </label>
</template>
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uCheckbox.test.ts`
Expected: PASS 4 个用例

---

### Task 4: URadioGroup

**Files:**
- Create: `src/renderer/src/components/ui/URadioGroup.vue`
- Test: `src/renderer/src/components/ui/__tests__/uRadioGroup.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import URadioGroup from '../URadioGroup.vue'

const options = [
  { label: 'VP9', value: 'vp9', description: '高质量，文件较小（推荐）' },
  { label: 'VP8', value: 'vp8' },
  { label: 'H.264', value: 'h264', disabled: true }
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(URadioGroup, { props: { modelValue: 'vp9', options, ...props } })
}

describe('URadioGroup', () => {
  it('渲染 radiogroup 与全部选项', () => {
    const w = setup()
    expect(w.get('[role=radiogroup]').exists()).toBe(true)
    expect(w.findAll('input[type=radio]').length).toBe(3)
    expect(w.text()).toContain('高质量，文件较小（推荐）')
  })

  it('选中项 checked 且切换发出对应 value', async () => {
    const w = setup()
    expect(w.findAll('input[type=radio]')[0].element.checked).toBe(true)
    await w.findAll('input[type=radio]')[1].setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual(['vp8'])
  })

  it('option 级 disabled 不可选', async () => {
    const w = setup()
    await w.findAll('input[type=radio]')[2].setValue(true)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('group 级 disabled 全部不可用', async () => {
    const w = setup({ disabled: true })
    await w.findAll('input[type=radio]')[0].setValue(true)
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('number value 原样发出（不做 string 化）', async () => {
    const w = mount(URadioGroup, {
      props: { modelValue: 30, options: [{ label: '30', value: 30 }, { label: '60', value: 60 }] }
    })
    await w.findAll('input[type=radio]')[1].setValue(true)
    expect(w.emitted('update:modelValue')![0]).toEqual([60])
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uRadioGroup.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现**

```vue
<script setup lang="ts" generic="T extends string | number | undefined = string">
import { computed, useId } from 'vue'

/**
 * URadioGroup · 统一单选组
 * - 泛型 T 含 undefined：可选字段（如 audioCodec: 'aac' | 'opus' | undefined）直绑过类型检查
 * - 原生 radio 承载可访问性，自绘圆点；option 级/group 级 disabled
 * - value 直接从 options 发出，number 不经 DOM string 化
 * - direction: vertical（默认，含两行文案）/ horizontal（紧凑一行）
 */
interface Option {
  label: string
  value: T
  description?: string
  disabled?: boolean
}

interface Props {
  modelValue: T
  options: Option[]
  disabled?: boolean
  label?: string
  direction?: 'vertical' | 'horizontal'
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  label: '',
  direction: 'vertical'
})

const emit = defineEmits<{ 'update:modelValue': [value: T] }>()

const groupId = useId()

const onSelect = (opt: Option): void => {
  if (!props.disabled && !opt.disabled) emit('update:modelValue', opt.value)
}

const wrapCls = computed(() =>
  props.direction === 'horizontal' ? 'flex flex-wrap items-center gap-4' : 'flex flex-col gap-1'
)
</script>

<template>
  <div role="radiogroup" :aria-label="label || undefined" class="flex w-full flex-col gap-1.5">
    <span v-if="label" class="text-xs font-medium text-fg-secondary">{{ label }}</span>
    <div :class="wrapCls">
      <label
        v-for="opt in options"
        :key="opt.value"
        class="flex items-start gap-2.5"
        :class="[
          direction === 'vertical'
            ? 'rounded-md p-2 transition-colors hover:bg-surface-hover'
            : 'cursor-pointer py-1',
          opt.disabled || disabled ? 'cursor-not-allowed opacity-50' : 'cursor-pointer'
        ]"
      >
        <input
          type="radio"
          :name="groupId"
          :checked="modelValue === opt.value"
          :disabled="opt.disabled || disabled"
          class="sr-only"
          @change="onSelect(opt)"
        />
        <span
          class="mt-0.5 flex size-4 shrink-0 items-center justify-center rounded-full border transition-all duration-fast"
          :class="modelValue === opt.value ? 'border-brand-500' : 'border-line-strong bg-surface-1'"
          aria-hidden="true"
        >
          <span v-if="modelValue === opt.value" class="size-2 rounded-full bg-brand-500" />
        </span>
        <span class="min-w-0">
          <span class="block text-sm font-medium text-fg-primary">{{ opt.label }}</span>
          <span v-if="opt.description" class="mt-0.5 block text-xs text-fg-tertiary">
            {{ opt.description }}
          </span>
        </span>
      </label>
    </div>
  </div>
</template>
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uRadioGroup.test.ts`
Expected: PASS 5 个用例

---

### Task 5: USlider

**Files:**
- Create: `src/renderer/src/components/ui/USlider.vue`
- Test: `src/renderer/src/components/ui/__tests__/uSlider.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import USlider from '../USlider.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(USlider, { props: { modelValue: 0.5, min: 0, max: 2, step: 0.1, ...props } })
}

describe('USlider', () => {
  it('拖动发出 number', async () => {
    const w = setup()
    await w.get('input[type=range]').setValue('1.5')
    expect(w.emitted('update:modelValue')![0]).toEqual([1.5])
  })

  it('min/max/step 透传', () => {
    const w = setup()
    const el = w.get('input[type=range]').element as HTMLInputElement
    expect(el.min).toBe('0')
    expect(el.max).toBe('2')
    expect(el.step).toBe('0.1')
  })

  it('showValue 显示格式化值', () => {
    const w = setup({ showValue: true, formatValue: (v: number) => `${v.toFixed(1)}x` })
    expect(w.text()).toContain('0.5x')
  })

  it('label 进入 aria-label', () => {
    const w = setup({ label: '温度' })
    expect(w.get('input[type=range]').attributes('aria-label')).toBe('温度')
  })

  it('disabled 时不发出事件', async () => {
    const w = setup({ disabled: true })
    await w.get('input[type=range]').setValue('1')
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uSlider.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现**

```vue
<script setup lang="ts">
import { computed } from 'vue'

/**
 * USlider · 统一滑块
 * - 原生 input[type=range] 承载键盘/拖动，自绘轨道填充
 * - showValue + formatValue 展示格式化值
 */
interface Props {
  modelValue: number
  min?: number
  max?: number
  step?: number
  disabled?: boolean
  label?: string
  showValue?: boolean
  formatValue?: ((v: number) => string) | undefined
}

const props = withDefaults(defineProps<Props>(), {
  min: 0,
  max: 100,
  step: 1,
  disabled: false,
  label: '',
  showValue: false,
  formatValue: undefined
})

const emit = defineEmits<{ 'update:modelValue': [value: number] }>()

const onInput = (e: Event): void => {
  if (props.disabled) return
  emit('update:modelValue', Number((e.target as HTMLInputElement).value))
}

const display = computed(() =>
  props.formatValue ? props.formatValue(props.modelValue) : String(props.modelValue)
)

const fillPct = computed(() => {
  const span = props.max - props.min
  if (span <= 0) return 0
  return Math.min(100, Math.max(0, ((props.modelValue - props.min) / span) * 100))
})
</script>

<template>
  <div class="flex w-full flex-col gap-1.5">
    <div v-if="label || showValue" class="flex items-center justify-between">
      <label v-if="label" class="text-xs font-medium text-fg-secondary">{{ label }}</label>
      <span v-if="showValue" class="text-xs tabular-nums text-fg-tertiary">{{ display }}</span>
    </div>
    <input
      type="range"
      :min="min"
      :max="max"
      :step="step"
      :value="modelValue"
      :disabled="disabled"
      :aria-label="label || undefined"
      class="u-slider w-full"
      :style="{ '--u-slider-fill': `${fillPct}%` }"
      @input="onInput"
    />
  </div>
</template>

<style scoped>
.u-slider {
  -webkit-appearance: none;
  appearance: none;
  height: 6px;
  border-radius: 9999px;
  outline: none;
  background: linear-gradient(
    to right,
    var(--brand-500) var(--u-slider-fill, 0%),
    var(--surface-hover) var(--u-slider-fill, 0%)
  );
}
.u-slider::-webkit-slider-thumb {
  -webkit-appearance: none;
  appearance: none;
  width: 16px;
  height: 16px;
  border-radius: 9999px;
  border: 2px solid var(--brand-500);
  background: var(--surface-0);
  cursor: pointer;
  transition: transform var(--motion-fast) ease-out;
}
.u-slider::-webkit-slider-thumb:active {
  transform: scale(1.15);
}
.u-slider:focus-visible {
  box-shadow: var(--shadow-ring-focus);
}
.u-slider:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
</style>
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uSlider.test.ts`
Expected: PASS 5 个用例

---

### Task 6: UTabs

**Files:**
- Create: `src/renderer/src/components/ui/UTabs.vue`
- Test: `src/renderer/src/components/ui/__tests__/uTabs.test.ts`

- [ ] **Step 1: 写失败测试**

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UTabs from '../UTabs.vue'

const tabs = [
  { id: 'record', label: '录制' },
  { id: 'history', label: '历史' }
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UTabs, { props: { tabs, modelValue: 'record', ...props } })
}

describe('UTabs', () => {
  it('渲染 tablist/tab 与 aria-selected', () => {
    const w = setup()
    expect(w.get('[role=tablist]').exists()).toBe(true)
    const tabEls = w.findAll('[role=tab]')
    expect(tabEls[0].attributes('aria-selected')).toBe('true')
    expect(tabEls[1].attributes('aria-selected')).toBe('false')
  })

  it('点击发出对应 id', async () => {
    const w = setup()
    await w.findAll('[role=tab]')[1].trigger('click')
    expect(w.emitted('update:modelValue')![0]).toEqual(['history'])
  })

  it('ArrowRight 循环到下一个', async () => {
    const w = setup()
    await w.get('[role=tablist]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('update:modelValue')![0]).toEqual(['history'])
  })

  it('ArrowLeft 从第一个循环到最后一个', async () => {
    const w = setup()
    await w.get('[role=tablist]').trigger('keydown', { key: 'ArrowLeft' })
    expect(w.emitted('update:modelValue')![0]).toEqual(['history'])
  })

  it('Home/End 跳到首尾', async () => {
    const w = setup({ modelValue: 'history' })
    await w.get('[role=tablist]').trigger('keydown', { key: 'Home' })
    expect(w.emitted('update:modelValue')![0]).toEqual(['record'])
    await w.get('[role=tablist]').trigger('keydown', { key: 'End' })
    expect(w.emitted('update:modelValue')![1]).toEqual(['history'])
  })

  it('非激活项 tabindex=-1（roving tabindex）', () => {
    const w = setup()
    expect(w.findAll('[role=tab]')[1].attributes('tabindex')).toBe('-1')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uTabs.test.ts`
Expected: FAIL

- [ ] **Step 3: 写实现**

```vue
<script setup lang="ts">
import { computed } from 'vue'

/**
 * UTabs · 统一页签（受控）
 * - variant: underline（常规页签）/ segment（分段选择，对应录屏按钮组风格）
 * - ArrowLeft/Right 循环 + Home/End 跳转，roving tabindex
 */
interface Tab {
  id: string
  label: string
}

interface Props {
  tabs: Tab[]
  modelValue: string
  variant?: 'underline' | 'segment'
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  variant: 'underline',
  label: ''
})

const emit = defineEmits<{ 'update:modelValue': [value: string] }>()

const activeIndex = computed(() =>
  Math.max(
    0,
    props.tabs.findIndex((t) => t.id === props.modelValue)
  )
)

const moveTo = (i: number): void => {
  const t = props.tabs[i]
  if (t) emit('update:modelValue', t.id)
}

const onKeydown = (e: KeyboardEvent): void => {
  const n = props.tabs.length
  if (n === 0) return
  if (e.key === 'ArrowRight') {
    e.preventDefault()
    moveTo((activeIndex.value + 1) % n)
  } else if (e.key === 'ArrowLeft') {
    e.preventDefault()
    moveTo((activeIndex.value - 1 + n) % n)
  } else if (e.key === 'Home') {
    e.preventDefault()
    moveTo(0)
  } else if (e.key === 'End') {
    e.preventDefault()
    moveTo(n - 1)
  }
}

const tabCls = (id: string): string => {
  const active = id === props.modelValue
  if (props.variant === 'segment') {
    return active
      ? 'bg-brand-500 text-white'
      : 'bg-surface-2 text-fg-primary hover:bg-surface-hover'
  }
  return active
    ? 'border-brand-500 text-fg-primary'
    : 'border-transparent text-fg-secondary hover:border-line-strong hover:text-fg-primary'
}
</script>

<template>
  <div
    role="tablist"
    :aria-label="label || undefined"
    class="flex"
    :class="variant === 'segment' ? 'gap-1 rounded-md bg-surface-2/50 p-1' : 'gap-4 border-b border-line-subtle'"
    @keydown="onKeydown"
  >
    <button
      v-for="t in tabs"
      :key="t.id"
      type="button"
      role="tab"
      :aria-selected="t.id === modelValue"
      :tabindex="t.id === modelValue ? 0 : -1"
      class="whitespace-nowrap text-sm font-medium transition-all duration-fast focus-visible:shadow-ring-focus focus-visible:outline-none"
      :class="[
        variant === 'segment' ? 'rounded-sm px-3 py-1.5' : '-mb-px border-b-2 pb-2 pt-1',
        tabCls(t.id)
      ]"
      @click="moveTo(tabs.indexOf(t))"
    >
      {{ t.label }}
    </button>
  </div>
</template>
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uTabs.test.ts`
Expected: PASS 6 个用例

---

### Task 7: UDropdown（含定位纯函数）

**Files:**
- Create: `src/renderer/src/components/ui/dropdownPlacement.ts`
- Create: `src/renderer/src/components/ui/UDropdown.vue`
- Test: `src/renderer/src/components/ui/__tests__/dropdownPlacement.test.ts`
- Test: `src/renderer/src/components/ui/__tests__/uDropdown.test.ts`

- [ ] **Step 1: 写定位纯函数的失败测试**（不需要 DOM 环境）

```ts
import { describe, it, expect } from 'vitest'
import { computePlacement } from '../dropdownPlacement'

const rect = (o: Partial<{ top: number; bottom: number; left: number; right: number; width: number; height: number }>) => ({
  top: 0,
  bottom: 0,
  left: 0,
  right: 0,
  width: 0,
  height: 0,
  ...o
})

describe('computePlacement', () => {
  it('下方空间充足 → 维持 bottom', () => {
    const p = computePlacement(
      rect({ top: 100, bottom: 140, left: 100, right: 200 }),
      rect({ height: 200, width: 160 }),
      1280,
      800,
      { side: 'bottom', align: 'start' }
    )
    expect(p.side).toBe('bottom')
  })

  it('下方放不下且上方更宽裕 → 翻转为 top', () => {
    const p = computePlacement(
      rect({ top: 700, bottom: 740, left: 100, right: 200 }),
      rect({ height: 200, width: 160 }),
      1280,
      800,
      { side: 'bottom', align: 'start' }
    )
    expect(p.side).toBe('top')
  })

  it('start 会溢出右缘且左移可行 → 翻转为 end', () => {
    const p = computePlacement(
      rect({ top: 100, bottom: 140, left: 1200, right: 1260 }),
      rect({ height: 200, width: 160 }),
      1280,
      800,
      { side: 'bottom', align: 'start' }
    )
    expect(p.align).toBe('end')
  })

  it('end 会溢出左缘且右移可行 → 翻转为 start', () => {
    const p = computePlacement(
      rect({ top: 100, bottom: 140, left: 20, right: 80 }),
      rect({ height: 200, width: 160 }),
      1280,
      800,
      { side: 'bottom', align: 'end' }
    )
    expect(p.align).toBe('start')
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/dropdownPlacement.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写定位纯函数**

```ts
// dropdownPlacement.ts · UDropdown 视口边界翻转（纯函数，便于单测）
export interface RectLike {
  top: number
  bottom: number
  left: number
  right: number
  width: number
  height: number
}

export interface Placement {
  side: 'bottom' | 'top'
  align: 'start' | 'end'
}

export function computePlacement(
  trigger: RectLike,
  panel: RectLike,
  viewportW: number,
  viewportH: number,
  preferred: Placement
): Placement {
  let side = preferred.side
  const spaceBelow = viewportH - trigger.bottom
  const spaceAbove = trigger.top
  if (side === 'bottom' && panel.height > spaceBelow && spaceAbove > spaceBelow) side = 'top'
  else if (side === 'top' && panel.height > spaceAbove && spaceBelow > spaceAbove) side = 'bottom'

  let align = preferred.align
  if (align === 'start' && trigger.left + panel.width > viewportW) align = 'end'
  else if (align === 'end' && trigger.right - panel.width < 0) align = 'start'

  return { side, align }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/dropdownPlacement.test.ts`
Expected: PASS 4 个用例

- [ ] **Step 5: 写组件失败测试**

```ts
// @vitest-environment happy-dom
import { describe, it, expect, beforeEach } from 'vitest'
import { mount } from '@vue/test-utils'
import UDropdown from '../UDropdown.vue'

const items = [
  { id: 'open', label: '打开', icon: 'ri-folder-line' },
  { id: 'sep', divider: true },
  { id: 'del', label: '删除', danger: true },
  { id: 'na', label: '不可用', disabled: true }
]

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UDropdown, { props: { items, ...props }, slots: { default: '菜单' } })
}

describe('UDropdown', () => {
  beforeEach(() => {
    document.body.innerHTML = ''
  })

  it('默认关闭；点击触发器展开并设置 aria', async () => {
    const w = setup()
    expect(w.find('[role=menu]').exists()).toBe(false)
    await w.get('button').trigger('click')
    expect(w.get('button').attributes('aria-expanded')).toBe('true')
    expect(w.get('[role=menu]').exists()).toBe(true)
  })

  it('divider 渲染分隔线且不渲染为 menuitem', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    expect(w.find('[role=separator]').exists()).toBe(true)
    expect(w.findAll('[role=menuitem]').length).toBe(3)
  })

  it('点击菜单项发出 select 并关闭', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    await w.findAll('[role=menuitem]')[1].trigger('click') // del
    expect(w.emitted('select')![0]).toEqual(['del'])
    expect(w.find('[role=menu]').exists()).toBe(false)
  })

  it('disabled 项点击不发事件', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    await w.findAll('[role=menuitem]')[2].trigger('click') // na
    expect(w.emitted('select')).toBeUndefined()
  })

  it('Esc 关闭', async () => {
    const w = setup()
    await w.get('button').trigger('click')
    await w.get('[role=menu]').trigger('keydown', { key: 'Escape' })
    expect(w.find('[role=menu]').exists()).toBe(false)
  })

  it('点击外部关闭（document pointerdown）', async () => {
    const w = setup({ attachTo: document.body })
    await w.get('button').trigger('click')
    expect(w.find('[role=menu]').exists()).toBe(true)
    document.body.dispatchEvent(new Event('pointerdown', { bubbles: true }))
    await new Promise((r) => setTimeout(r, 0))
    expect(w.find('[role=menu]').exists()).toBe(false)
    w.unmount()
  })
})
```

- [ ] **Step 6: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uDropdown.test.ts`
Expected: FAIL

- [ ] **Step 7: 写组件实现**

```vue
<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { computePlacement, type Placement } from './dropdownPlacement'

/**
 * UDropdown · 统一下拉菜单
 * - 默认插槽 = 触发器内容（组件渲染 button，带 aria-haspopup/aria-expanded）
 * - 视口边界翻转（computePlacement 纯函数）、点击外部/Esc 关闭、ArrowUp/Down 导航
 * - divider: true 的项渲染为分隔线，忽略其余字段且不可聚焦
 */
interface MenuItem {
  id: string
  label?: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

interface Props {
  items: MenuItem[]
  align?: 'start' | 'end'
  side?: 'bottom' | 'top'
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  align: 'start',
  side: 'bottom',
  label: ''
})

const emit = defineEmits<{ select: [id: string] }>()

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const open = ref(false)
const placement = ref<Placement>({ side: props.side, align: props.align })
let menuButtons: HTMLButtonElement[] = []

const close = (): void => {
  open.value = false
}

const toggle = async (): Promise<void> => {
  if (open.value) {
    close()
    return
  }
  open.value = true
  await nextTick()
  const trigger = triggerRef.value
  const panel = panelRef.value
  if (trigger && panel) {
    placement.value = computePlacement(
      trigger.getBoundingClientRect(),
      panel.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      { side: props.side, align: props.align }
    )
    menuButtons = Array.from(panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    menuButtons[0]?.focus()
  }
}

const onDocumentPointerDown = (e: PointerEvent): void => {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target as Node)) close()
}

const onPanelKeydown = (e: KeyboardEvent): void => {
  const items = menuButtons.filter((b) => !b.disabled)
  const idx = items.findIndex((b) => b === document.activeElement)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    items[idx + 1 < items.length ? idx + 1 : 0]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    items[idx - 1 >= 0 ? idx - 1 : items.length - 1]?.focus()
  } else if (e.key === 'Escape') {
    close()
    triggerRef.value?.focus()
  }
}

const choose = (item: MenuItem): void => {
  if (item.disabled) return
  emit('select', item.id)
  close()
  triggerRef.value?.focus()
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<template>
  <div ref="rootRef" class="relative inline-flex">
    <button
      ref="triggerRef"
      type="button"
      :aria-haspopup="open ? 'menu' : undefined"
      :aria-expanded="open"
      :aria-label="label || undefined"
      @click="toggle"
    >
      <slot />
    </button>
    <div
      v-if="open"
      ref="panelRef"
      role="menu"
      class="u-menu absolute min-w-36 overflow-hidden rounded-md border border-line-default bg-surface-3 py-1 shadow-lg"
      :class="[
        placement.side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
        placement.align === 'start' ? 'left-0' : 'right-0'
      ]"
      @keydown="onPanelKeydown"
    >
      <template v-for="item in items" :key="item.id">
        <hr v-if="item.divider" role="separator" class="my-1 border-line-subtle" />
        <button
          v-else
          type="button"
          role="menuitem"
          :disabled="item.disabled"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-fast focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          :class="
            item.danger
              ? 'text-danger hover:bg-danger/5 focus-visible:bg-danger/5'
              : 'text-fg-primary hover:bg-surface-hover focus-visible:bg-surface-hover'
          "
          @click="choose(item)"
        >
          <i v-if="item.icon" :class="item.icon" class="text-base" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.u-menu {
  z-index: var(--z-dropdown);
}
</style>
```

- [ ] **Step 8: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uDropdown.test.ts`
Expected: PASS 6 个用例

---

### Task 8: UModal 焦点陷阱 + 焦点归还

**Files:**
- Modify: `src/renderer/src/components/ui/UModal.vue`
- Test: `src/renderer/src/components/ui/__tests__/uModal.test.ts`

- [ ] **Step 1: 写失败测试**（新增文件，覆盖现有行为 + 新行为）

```ts
// @vitest-environment happy-dom
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import UModal from '../UModal.vue'

// eslint-disable-next-line @typescript-eslint/explicit-function-return-type -- 测试工厂
function setup(props: Record<string, unknown> = {}) {
  return mount(UModal, {
    props: { modelValue: true, title: '确认', ...props },
    slots: {
      default: '<button data-a>按钮A</button><button data-b>按钮B</button>',
      footer: '<button data-ok>确定</button>'
    },
    attachTo: document.body
  })
}

describe('UModal', () => {
  it('渲染 dialog 角色与标题', () => {
    const w = setup()
    expect(w.get('[role=dialog]').exists()).toBe(true)
    expect(w.text()).toContain('确认')
  })

  it('Esc 关闭（closeOnEsc 默认开）', async () => {
    const w = setup()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('update:modelValue')![0]).toEqual([false])
  })

  it('closeOnEsc=false 时不关闭', () => {
    const w = setup({ closeOnEsc: false })
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))
    expect(w.emitted('update:modelValue')).toBeUndefined()
  })

  it('Tab 在末尾时循环回首项（焦点陷阱）', async () => {
    const w = setup()
    await new Promise((r) => requestAnimationFrame(r))
    const panel = w.get('[role=dialog]').element as HTMLElement
    const ok = panel.querySelector('[data-ok]') as HTMLElement
    ok.focus()
    window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Tab', bubbles: true }))
    const a = panel.querySelector('[data-a]') as HTMLElement
    expect(document.activeElement).toBe(a)
  })

  it('Shift+Tab 在首项时循环回末项', async () => {
    const w = setup()
    await new Promise((r) => requestAnimationFrame(r))
    const panel = w.get('[role=dialog]').element as HTMLElement
    const a = panel.querySelector('[data-a]') as HTMLElement
    a.focus()
    window.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Tab', shiftKey: true, bubbles: true })
    )
    const ok = panel.querySelector('[data-ok]') as HTMLElement
    expect(document.activeElement).toBe(ok)
  })

  it('关闭后焦点归还之前的活动元素', async () => {
    const outside = document.createElement('button')
    document.body.appendChild(outside)
    outside.focus()
    const w = setup()
    await w.setProps({ modelValue: false })
    expect(document.activeElement).toBe(outside)
    w.unmount()
    outside.remove()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uModal.test.ts`
Expected: FAIL（「焦点陷阱」与「焦点归还」两组用例红，现有行为用例绿）

- [ ] **Step 3: 修改 UModal 脚本段**（模板不动）。将现有 `onKeydown` 与 `watch(modelValue)` 整段替换为：

```ts
const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

let prevFocused: HTMLElement | null = null

const close = (): void => {
  emit('update:modelValue', false)
}

const onOverlayClick = (): void => {
  if (props.closeOnOverlay) close()
}

const onKeydown = (e: KeyboardEvent): void => {
  if (!props.modelValue) return
  if (e.key === 'Escape' && props.closeOnEsc) {
    close()
    return
  }
  if (e.key !== 'Tab') return
  const panel = panelRef.value
  if (!panel) return
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (items.length === 0) {
    e.preventDefault()
    return
  }
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (props.modelValue) prevFocused?.focus?.()
})

// 打开时锁定 body 滚动由外层容器自己保证；聚焦面板并记录来源焦点，关闭时归还
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      prevFocused = document.activeElement as HTMLElement | null
      requestAnimationFrame(() => panelRef.value?.focus())
    } else {
      prevFocused?.focus?.()
      prevFocused = null
    }
  }
)
```

同步把 import 行改为：`import { onBeforeUnmount, onMounted, ref, watch } from 'vue'`（原本就有，无需改）。

- [ ] **Step 4: 运行确认通过 + 既有用例不回归**

Run: `pnpm vitest run src/renderer/src/components/ui/__tests__/uModal.test.ts`
Expected: PASS 6 个用例

---

### Task 9: useConfirm + UConfirmProvider + AppShell 挂载

**Files:**
- Create: `src/renderer/src/composables/useConfirm.ts`
- Create: `src/renderer/src/components/ui/UConfirmProvider.vue`
- Modify: `src/renderer/src/components/shell/AppShell.vue`（L4 import 后加一行、L22 `<UToastProvider />` 后加一行）
- Test: `src/renderer/src/composables/__tests__/useConfirm.test.ts`

- [ ] **Step 1: 写 useConfirm 失败测试**

```ts
import { describe, it, expect } from 'vitest'
import { confirm, resolveConfirm, useConfirm } from '../useConfirm'

describe('useConfirm', () => {
  it('resolveConfirm(true) 兑现 promise 为 true', async () => {
    const p = confirm({ title: '删除？', danger: true })
    resolveConfirm(true)
    await expect(p).resolves.toBe(true)
  })

  it('resolveConfirm(false) 兑现为 false', async () => {
    const p = confirm({ title: '清空？' })
    resolveConfirm(false)
    await expect(p).resolves.toBe(false)
  })

  it('后到覆盖先到：先到的立即以 false 兑现', async () => {
    const first = confirm({ title: '第一个' })
    const second = confirm({ title: '第二个' })
    await expect(first).resolves.toBe(false)
    resolveConfirm(true)
    await expect(second).resolves.toBe(true)
  })

  it('useConfirm 暴露当前 pending（ComputedRef）供 Provider 渲染', async () => {
    const api = useConfirm()
    const p = confirm({ title: '标题', message: '正文', confirmText: '删除' })
    expect(api.pending.value?.title).toBe('标题')
    expect(api.pending.value?.message).toBe('正文')
    expect(api.pending.value?.confirmText).toBe('删除')
    resolveConfirm(false)
    await expect(p).resolves.toBe(false)
  })

  it('resolve 后 pending 变 undefined（Provider 可响应收起）', async () => {
    const api = useConfirm()
    const p = confirm({ title: 'x' })
    expect(api.pending.value).toBeDefined()
    resolveConfirm(true)
    await expect(p).resolves.toBe(true)
    expect(api.pending.value).toBeUndefined()
  })
})
```

- [ ] **Step 2: 运行确认失败**

Run: `pnpm vitest run src/renderer/src/composables/__tests__/useConfirm.test.ts`
Expected: FAIL（模块不存在）

- [ ] **Step 3: 写 useConfirm**

```ts
import { computed, reactive } from 'vue'

/**
 * useConfirm · 命令式确认弹窗（全局单例，Promise API；对称 useToast）
 *
 * 用法：
 *   import { confirm } from '@composables/useConfirm'
 *   const ok = await confirm({ title: '彻底删除片段？', message: '该操作不可撤销。',
 *                              confirmText: '删除', danger: true })
 *   if (!ok) return
 *
 * 渲染端需在 AppShell 挂 <UConfirmProvider />（与 UToastProvider 并列）。
 * 同一时刻仅一个 pending：后到的 confirm 会让先到的立即以 false 兑现。
 */
export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

const state = reactive<{ pending: PendingConfirm | undefined }>({ pending: undefined })

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const prev = state.pending
    if (prev) {
      state.pending = undefined
      prev.resolve(false)
    }
    state.pending = { ...opts, resolve }
  })
}

export function resolveConfirm(ok: boolean): void {
  const cur = state.pending
  state.pending = undefined
  cur?.resolve(ok)
}

export interface ConfirmApi {
  /** ComputedRef：Provider 模板自动解包，watch 可响应 */
  pending: ComputedRef<PendingConfirm | undefined>
}

export function useConfirm(): ConfirmApi {
  return {
    pending: computed(() => state.pending)
  }
}
```

- [ ] **Step 4: 运行确认通过**

Run: `pnpm vitest run src/renderer/src/composables/__tests__/useConfirm.test.ts`
Expected: PASS 5 个用例

- [ ] **Step 5: 写 UConfirmProvider**

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import UModal from './UModal.vue'
import UButton from './UButton.vue'
import { resolveConfirm, useConfirm, type ConfirmOptions } from '../../composables/useConfirm'

/**
 * UConfirmProvider · useConfirm 的渲染容器（挂在 AppShell 一次即可）
 * - 内部复用 UModal（sm）+ UButton；danger 时确认键用 danger 变体
 * - shown 快照：resolve 后 pending 立即清空，快照保证离场动画期间文案不闪空
 */
const { pending } = useConfirm()
const shown = ref<ConfirmOptions | null>(null)

watch(
  pending,
  (p) => {
    if (p) shown.value = p
  },
  { immediate: true }
)
</script>

<template>
  <UModal
    :model-value="pending !== undefined"
    :title="shown?.title ?? ''"
    size="sm"
    @update:model-value="resolveConfirm(false)"
  >
    <p class="text-sm text-fg-secondary">{{ shown?.message }}</p>
    <template #footer>
      <UButton variant="ghost" @click="resolveConfirm(false)">
        {{ shown?.cancelText ?? '取消' }}
      </UButton>
      <UButton
        :variant="shown?.danger ? 'danger' : 'primary'"
        @click="resolveConfirm(true)"
      >
        {{ shown?.confirmText ?? '确定' }}
      </UButton>
    </template>
  </UModal>
</template>
```

- [ ] **Step 6: 挂载到 AppShell**

`src/renderer/src/components/shell/AppShell.vue` 两处精确编辑：

L4 的 import 后加：

```ts
import UConfirmProvider from '../ui/UConfirmProvider.vue'
```

L22 的 `<UToastProvider />` 后加：

```vue
<UConfirmProvider />
```

- [ ] **Step 7: 全 ui + composable 测试回归**

Run: `pnpm vitest run src/renderer/src/components/ui src/renderer/src/composables/__tests__/useConfirm.test.ts`
Expected: 全部 PASS

---

### Task 10: 原语包验收 + 提交 1

- [ ] **Step 1: 门禁三连**

```bash
pnpm typecheck
pnpm lint
pnpm test
```

Expected: 三者全绿（`pnpm test` 为全量；若有与本次无关的既有红，记录并确认其在本批改动前已红，不属回归）。

- [ ] **Step 2: 提交 1（只加本批文件）**

```bash
git add src/renderer/src/components/ui/ \
  src/renderer/src/composables/useConfirm.ts \
  src/renderer/src/composables/__tests__/useConfirm.test.ts \
  src/renderer/src/components/shell/AppShell.vue
git commit -m "feat(ui): 批1 原语库补齐——USwitch/UInput/UCheckbox/URadioGroup/USlider/UTabs/UDropdown + UModal 焦点陷阱 + useConfirm 统一确认弹窗"
```

---

### Task 11: USelect attrs 透传增强（迁移前置）

**Files:**
- Modify: `src/renderer/src/components/ui/USelect.vue`

- [ ] **Step 1: 修改**：`<script setup>` 顶部（`interface Option` 之前）加：

```ts
defineOptions({ inheritAttrs: false })
```

原生 `<select>` 标签上（现有 class 等属性保持不动）加一行 `v-bind="$attrs"`：

```vue
      <select
        v-bind="$attrs"
        :value="String(modelValue)"
        :disabled="disabled"
        class="h-full w-full appearance-none rounded-md border border-line-default bg-surface-1 px-3 pr-8 text-sm text-fg-primary transition-all duration-fast focus:outline-none focus-visible:border-brand-500/50 focus-visible:shadow-ring-focus disabled:cursor-not-allowed disabled:opacity-50"
        @change="onChange"
      >
```

- [ ] **Step 2: 回归**

Run: `pnpm typecheck && pnpm vitest run src/renderer/src/components/ui`
Expected: 全绿（USelect 无既有测试，全量 ui 目录绿即可）

---

### Task 12: 迁移 RecordingSettingsDialog

**Files:**
- Modify: `src/renderer/src/views/screenRecorder/components/RecordingSettingsDialog.vue`
- Modify: `src/renderer/src/components/ui/USelect.vue` 的调用方（本文件内）

**迁移原则**：只换控件实现与弹窗壳，业务逻辑（props/emit/defineExpose/watch/loadSettings/handleSave）一律不动；5 个 `data-test` 属性原样保留；不属于规格 §6.1 清单的部分（质量预设卡片、性能提示块、倒计时按钮组、showAdvanced 折叠开关）保持原样（旧调色板类的刷新归既有 token 迁移批次管）。

- [ ] **Step 1: 改 import**（L488-489 处）

```ts
import { ref, watch, onMounted } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UModal from '@components/ui/UModal.vue'
import UButton from '@components/ui/UButton.vue'
import URadioGroup from '@components/ui/URadioGroup.vue'
import UCheckbox from '@components/ui/UCheckbox.vue'
import UInput from '@components/ui/UInput.vue'
import USelect from '@components/ui/USelect.vue'
```

script 顶部补常量（`const showAdvanced = ref(false)` 之前）：

```ts
const encoderOptions = [
  { label: 'VP9', value: 'vp9', description: '高质量，文件较小（推荐）' },
  { label: 'VP8', value: 'vp8', description: '兼容性好，文件较大' },
  { label: 'H.264', value: 'h264', description: '通用格式，兼容性最好' }
]
const fpsOptions = [
  { label: '30 FPS', value: 30 },
  { label: '60 FPS', value: 60 }
]
const audioCodecOptions = [
  { label: 'Opus', value: 'opus' },
  { label: 'AAC', value: 'aac' }
]
const formatOptions = [
  { label: 'WebM', value: 'webm' },
  { label: 'MP4', value: 'mp4' }
]
```

- [ ] **Step 2: 换弹窗壳**。模板最外层（L2-16 头部 + L483-484 尾部 + L463-482 底部按钮）整体替换为 UModal 结构：

```vue
<template>
  <UModal
    :model-value="show"
    title="录制设置"
    size="lg"
    @update:model-value="(v: boolean) => { if (!v) $emit('close') }"
  >
    <!-- 内容：原 L19-460 的内容区整体保留在 UModal 默认插槽内 -->
    <div class="space-y-6">
      <!-- ……原内容区各段，按 Step 3-6 替换其中的控件…… -->
    </div>

    <template #footer>
      <UButton variant="ghost" @click="handleReset">重置默认</UButton>
      <UButton variant="ghost" @click="$emit('close')">取消</UButton>
      <UButton variant="primary" @click="handleSave">保存</UButton>
    </template>
  </UModal>
</template>
```

注意：`show` 为 prop，用 `:model-value` 单向绑定 + 关闭事件转 `$emit('close')`；不再保留原 `fixed inset-0` 遮罩与 `max-w-2xl` 容器。

- [ ] **Step 3: 编码器 3 连 radio → URadioGroup**（原 L45-87 的 `<div class="space-y-3">` 整块）：

```vue
<URadioGroup v-model="localSettings.encoder" :options="encoderOptions" />
```

- [ ] **Step 4: 帧率 / 音频编码器 / 文件格式 radio → URadioGroup（horizontal）**

帧率（原 L104-141）：

```vue
<div>
  <label class="mb-2 block text-sm font-medium text-fg-primary">帧率 (FPS)</label>
  <URadioGroup
    v-model="localSettings.fps"
    :options="fpsOptions"
    direction="horizontal"
  />
</div>
```

音频编码器（原 L204-239，`localSettings.audioCodec` 可能为 undefined：泛型 T 含 undefined，未选时无 radio 勾选，与原行为一致）：

```vue
<div>
  <label class="mb-2 block text-sm font-medium text-fg-primary">音频编码器</label>
  <URadioGroup
    v-model="localSettings.audioCodec"
    :options="audioCodecOptions"
    direction="horizontal"
  />
</div>
```

文件格式（原 L257-293）：

```vue
<div>
  <label class="mb-2 block text-sm font-medium text-fg-primary">文件格式</label>
  <URadioGroup
    v-model="localSettings.format"
    :options="formatOptions"
    direction="horizontal"
  />
</div>
```

- [ ] **Step 5: 5 个 checkbox → UCheckbox**

音频启用（原 L194-201）：

```vue
<UCheckbox v-model="localSettings.audioEnabled" label="启用音频录制" />
```

系统音频启用（原 L339-348，保留 data-test）：

```vue
<UCheckbox
  v-model="systemAudioEnabled"
  label="启用系统音频"
  data-test="cb-system-audio-enabled"
  @change="onSystemAudioToggle"
/>
```

保留麦克风（原 L367-375）：

```vue
<UCheckbox
  v-model="keepMicrophone"
  label="同时保留麦克风（双声道）"
  @change="onKeepMicrophoneToggle"
/>
```

倒数提示音（原 L448-456；原生 label 包 input 结构换为 UCheckbox，原 `id="countdown-beep"` 一并去掉）：

```vue
<UCheckbox v-model="countdownBeep" label="倒数结束播放提示音" />
```

快捷键开关（原 L413-421 的 peer 结构 → USwitch；规格外顺路收编，因它是同文件内第 5 个手写开关）：

```vue
<USwitch v-model="shortcutsEnabled" label="启用全局快捷键" />
```

（import 行相应补 `import USwitch from '@components/ui/USwitch.vue'`。）

- [ ] **Step 6: 4 个 number input → UInput(v-model.number)；1 个 select → USelect**

宽度（原 L149-157，高度 L161-169 同构；`v-model.number` 会自动注入 `model-modifiers`，勿再显式传 `:model-modifiers` 以免重复 prop）：

```vue
<UInput
  v-model.number="localSettings.resolution.width"
  type="number"
  label="宽度"
  :disabled="localSettings.quality !== 'custom'"
/>
```

（高度同构改 `height`。）

比特率（原 L179-186）：

```vue
<UInput
  v-model.number="localSettings.bitrate"
  type="number"
  label="视频比特率 (kbps)"
/>
```

音频比特率（原 L244-251）：

```vue
<UInput
  v-model.number="localSettings.audioBitrate"
  type="number"
  label="音频比特率 (kbps)"
/>
```

系统音频输出设备（原 L352-365，保留 data-test；`@change` 处理函数为空壳由父组件 watch，删除；`deviceId` 选项可能重复 label 不影响，value 用 deviceId）：

```vue
<div>
  <label class="mb-1.5 block text-sm font-medium text-fg-primary">输出设备</label>
  <USelect
    v-model="systemAudioDeviceId"
    :options="systemAudioDevices.map((d) => ({ label: d.label, value: d.deviceId }))"
    data-test="select-system-audio-device"
  />
</div>
```

- [ ] **Step 6b: 语义按钮 → UButton（规格 §6.1 的 8 个 button 中 6 个）**

重新探测按钮（原 L311-319，保留 data-test 与 disabled 语义；loading 图标逻辑保留在插槽内）：

```vue
<UButton
  variant="ghost"
  size="sm"
  :disabled="probingAudio"
  data-test="btn-probe-system-audio"
  @click="probeSystemAudio"
>
  <AppIcon :icon="probingAudio ? 'ri-loader-4-line' : 'ri-refresh-line'" />
  <span>{{ probingAudio ? '探测中…' : '重新探测' }}</span>
</UButton>
```

折叠开关（原 L94-100，text-link 样式 → ghost sm）：

```vue
<UButton variant="ghost" size="sm" @click="showAdvanced = !showAdvanced">
  <AppIcon :icon="showAdvanced ? 'ri-arrow-up-s-line' : 'ri-arrow-down-s-line'" />
  <span>{{ showAdvanced ? '收起' : '展开' }}</span>
</UButton>
```

底部三按钮已在 Step 2 的 footer 中换为 UButton。**例外（记录在案，不算迁移缺口）**：倒计时的 4 个选项按钮（L428-446）是"分段选择器"而非动作按钮——UButton 无选中态语义，保持原样；若后续需要可再立 `UOptionPills` 原语。

- [ ] **Step 7: 验证**

```bash
pnpm typecheck && pnpm vitest run src/renderer/src/views/screenRecorder
```

Expected: typecheck 0 error；screenRecorder 既有测试全绿。

- [ ] **Step 8: 手测**（留给 Task 15 统一 `pnpm dev` 执行）：打开录屏页 → 录制设置，核对保存/重置/取消、质量预设联动、系统音频探测、5 个 data-test 属性仍在 DOM。

---

### Task 13: 迁移 SettingsView

**Files:**
- Modify: `src/renderer/src/views/SettingsView.vue`（L10-12 import 区、L978-991、L1017-1029、L1070-1075、L1082-1087、L1093-1098、L1115-1123、L1325-1338、L1626-1639）

- [ ] **Step 1: 补 import**（L12 `import UProgress ...` 之后）：

```ts
import USwitch from '@components/ui/USwitch.vue'
import UInput from '@components/ui/UInput.vue'
import USlider from '@components/ui/USlider.vue'
```

- [ ] **Step 2: 紧凑模式开关（L978-991）→ USwitch sm**（保留 `data-compact-toggle`）

```vue
<USwitch
  v-model="compactMode"
  size="sm"
  label="紧凑模式"
  data-compact-toggle
  @update:model-value="chooseCompact"
/>
```

注意：原代码 `@click="chooseCompact(!compactMode)"` 传入显式值；USwitch 发出的 `update:modelValue` 即新值，直接接 `chooseCompact`（其签名 `(v: boolean) => void`，实参自动带入）。**迁移后删除 `chooseCompact(!compactMode)` 的旧 button**，不保留两份。

- [ ] **Step 3: AI 助手开关（L1017-1029）→ USwitch md**

```vue
<USwitch v-model="aiEnabled" label="AI 助手" />
```

（原为 `@click="aiEnabled = !aiEnabled"`，v-model 等价。）

- [ ] **Step 4: 专注护盾开关（L1325-1338）→ USwitch md**

```vue
<USwitch
  :model-value="shieldEnabled"
  :disabled="!shieldSupported"
  label="专注护盾"
  @update:model-value="toggleShieldEnabled"
/>
```

（原 `toggleShieldEnabled` 无参调用——执行时读其实现，若签名无参则保持 `@update:model-value="toggleShieldEnabled"` 让多余实参被忽略；若它依赖外部状态取反，行为等价即可，不改函数本体。）

- [ ] **Step 5: 自动化开关（L1626-1639）→ USwitch md**

```vue
<USwitch
  :model-value="t.enabled"
  label="自动化开关"
  @update:model-value="toggleAutomation(t)"
/>
```

（原 `toggleAutomation(t)` 同理：执行时确认其内部是翻转语义；受控写法保证 `t.enabled` 变化来自它。）

- [ ] **Step 6: 3 个 API 表单 input → UInput**（L1070-1075、L1082-1087、L1093-1098；外层 `<label>` 提示文案与布局保留，只换 input 本体）

```vue
<UInput
  v-model="aiApiKey"
  type="password"
  :placeholder="aiHasStoredKey ? '已保存（留空保持不变）' : 'sk-...'"
/>
```

```vue
<UInput v-model="aiBaseUrl" placeholder="https://api.openai.com/v1" />
```

```vue
<UInput v-model="aiModel" placeholder="gpt-4o-mini" />
```

（原 Base URL / 模型输入的 `font-mono text-[12px]` 等版式微调类由 UInput 统一样式取代，属预期收敛。）

**排除项（记录在案）**：L717 侧栏搜索框（图标内嵌的自定义紧凑变体，换 UInput 会改变侧栏视觉，需 UInput 增 xs 档，YAGNI）；L1115 系统提示词 textarea（本批无 UTextarea 原语，规格未承诺）。

- [ ] **Step 7: 温度 range → USlider（L1115-1123）**

```vue
<div class="flex items-center gap-3">
  <label class="shrink-0 text-[12px] font-medium text-fg-tertiary">
    温度 {{ aiTemperature }}
  </label>
  <USlider
    v-model="aiTemperature"
    :min="0"
    :max="2"
    :step="0.1"
    label="AI 温度"
    class="flex-1"
  />
</div>
```

- [ ] **Step 8: 验证**

```bash
pnpm typecheck && pnpm vitest run src/renderer/src
```

Expected: typecheck 0 error；renderer 测试全绿（SettingsView 无专属测试，全量绿即可）。

---

### Task 14: 迁移 12 处 confirm()

**Files:**
- Modify: `src/renderer/src/views/launcher/index.vue`（L1255、L1362）
- Modify: `src/renderer/src/views/snippets/components/SnippetList.vue`（L189、L201）
- Modify: `src/renderer/src/views/screenRecorder/components/ClipEditor.vue`（L215、L227）
- Modify: `src/renderer/src/views/snippets/components/Sidebar.vue`（L82）
- Modify: `src/renderer/src/views/screenRecorder/components/RecordingHistory.vue`（L40）
- Modify: `src/renderer/src/views/screenRecorder/pages/HistoryPage.vue`（L205、L212）
- Modify: `src/renderer/src/views/pomodoro/components/TaskListPanel.vue`（L126）

**统一模式**：每个文件顶部加 `import { confirm } from '@composables/useConfirm'`；把同步布尔判断改为 `const ok = await confirm({...}); if (!ok) return`；**所在函数若非 async，为其加 `async`**（Vue 事件处理器支持 async 函数，不改调用方）。所有确认 `danger: true`。

逐处替换（旧 → 新，文案语义不变）：

1. `launcher/index.vue` L1255（卸载插件）：

```ts
  const ok = await confirm({
    title: `卸载插件「${p.name}」？`,
    message: '其数据目录将被删除。',
    confirmText: '卸载',
    danger: true
  })
  if (!ok) return
```

2. `launcher/index.vue` L1362（恢复快照）：

```ts
  const ok = await confirm({
    title: '恢复云端快照？',
    message: '将用云端快照覆盖本地全部插件数据。',
    confirmText: '恢复',
    danger: true
  })
  if (!ok) return
```

3. `SnippetList.vue` L189（彻底删除片段）：

```ts
  const ok = await confirm({
    title: `彻底删除「${snippet.name}」？`,
    message: '该操作不可撤销。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
```

4. `SnippetList.vue` L201（清空回收站）：

```ts
  const ok = await confirm({
    title: '清空回收站？',
    message: '其中的片段将不可撤销地删除。',
    confirmText: '清空',
    danger: true
  })
  if (!ok) return
```

5. `ClipEditor.vue` L215（删除片段）：

```ts
  const ok = await confirm({
    title: '删除这个片段？',
    confirmText: '删除',
    danger: true
  })
  if (ok) {
    // 原确认后的处理逻辑原样保留
```

6. `ClipEditor.vue` L227（清空所有片段）：

```ts
  const ok = await confirm({
    title: '清空所有片段？',
    confirmText: '清空',
    danger: true
  })
  if (ok) {
    // 原确认后的处理逻辑原样保留
```

7. `snippets/Sidebar.vue` L82（删除文件夹）：

```ts
  const ok = await confirm({
    title: `删除文件夹「${folder.name}」？`,
    message: '其中的片段会回到收件箱。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
```

8. `RecordingHistory.vue` L40（删除录制及其文件）：

```ts
  const ok = await confirm({
    title: `删除「${target.filename}」？`,
    message: '其视频文件将一并删除，此操作不可撤销。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
```

9. `HistoryPage.vue` L205（删除记录）：

```ts
  const ok = await confirm({
    title: `删除「${item.filename}」的记录？`,
    message: '文件本身会留在磁盘上。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
```

10. `HistoryPage.vue` L212（清空全部记录）：

```ts
  const ok = await confirm({
    title: `清空全部 ${items.value.length} 条记录？`,
    message: '文件本身会留在磁盘上。',
    confirmText: '清空',
    danger: true
  })
  if (!ok) return
```

11. `TaskListPanel.vue` L126（删除任务）：

```ts
  const ok = await confirm({
    title: `删除任务「${task.title}」？`,
    message: '此操作不可撤销。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
```

（上表 11 条覆盖 12 处调用：ClipEditor 与 SnippetList 各 2 处。执行时以 grep 实际行号为准确认——若行号因前序任务漂移，按 `window.confirm(` / `[^.]confirm(` 检索。）

- [ ] **Step 1: 按 8 个文件逐个执行替换**

每处：改 import → 替换调用 → 确认所在函数 `async`。

- [ ] **Step 2: 确认无残留**

```bash
grep -rn "window.confirm\|[^.]confirm(" src/renderer/src --include="*.vue" | grep -v "useConfirm\|__tests__\|import\|MigrationCenterView"
```

Expected: 无输出（MigrationCenterView 的注释行除外）。

- [ ] **Step 3: 验证**

```bash
pnpm typecheck && pnpm lint
```

Expected: 双绿。

---

### Task 15: 全量验收 + 提交 2

- [ ] **Step 1: 门禁三连**

```bash
pnpm typecheck && pnpm lint && pnpm test
```

Expected: 全绿。

- [ ] **Step 2: dev 手测清单**（`pnpm dev` 后逐项）：

1. 录屏 → 录制设置：弹窗开关、质量预设联动、编码器/帧率/格式单选、分辨率/比特率数字输入、音频开关组、系统音频探测与设备选择、快捷键开关、倒计时按钮、保存/重置/取消。
2. 设置 → AI：开关、API Key/URL/模型输入、温度滑块。
3. 设置 → launcher：紧凑模式开关（`data-compact-toggle` 在 DOM 上）。
4. 删除类确认：snippets 删片段/清回收站/删文件夹、录屏删片段/清空/删历史、番茄钟删任务、launcher 卸载插件——确认弹窗出现、Esc/遮罩/取消=不执行、确认=执行、toast 正常。
5. 焦点陷阱：任一确认弹窗内连按 Tab，焦点不出弹窗；关闭后焦点回触发按钮。

- [ ] **Step 3: 提交 2**

```bash
git add src/renderer/src/views/ src/renderer/src/components/ui/USelect.vue
git commit -m "refactor(ui): 批1 高价值迁移——RecordingSettingsDialog/SettingsView 换用 U 原语，12 处 window.confirm 收编 useConfirm"
```

- [ ] **Step 4: 汇报**：对照规格 §8 逐条给出验收结果。
