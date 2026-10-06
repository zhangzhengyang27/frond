<template>
  <CapsulePage :hints="hints">
    <div class="form-page">
      <div v-for="(field, index) in fields" :key="field.key" class="form-row">
        <!-- checkbox：整行可点的开关行（label 点击切换） -->
        <div
          v-if="fieldType(field) === 'checkbox'"
          :id="`ff-${index}`"
          :ref="(el) => setFieldRef(index, el)"
          class="form-switch-row"
          role="switch"
          :aria-checked="checks[field.key] === true"
          :data-field-index="index"
          tabindex="0"
          @click="toggleCheckbox(field)"
          @keydown="onFieldKeydown($event, index)"
        >
          <span class="form-switch-label">{{ field.label }}</span>
          <span class="form-switch" :class="{ on: checks[field.key] === true }">
            <span class="form-switch-thumb" />
          </span>
        </div>

        <!-- select：PopoverSelect 浮层下拉（透明窗里原生 select popup 画不出来） -->
        <template v-else-if="fieldType(field) === 'select'">
          <label class="form-label" :for="`ff-${index}`">{{ field.label }}</label>
          <PopoverSelect
            :id="`ff-${index}`"
            :ref="(el) => setFieldRef(index, el)"
            :model-value="values[field.key] ?? ''"
            class="form-select-pop"
            :options="selectOptions(field)"
            :aria-label="field.label"
            :data-field-index="index"
            @update:model-value="values[field.key] = $event"
            @keydown="onSelectKeydown($event, index)"
          />
        </template>

        <!-- textarea：多行文本 -->
        <template v-else-if="fieldType(field) === 'textarea'">
          <label class="form-label" :for="`ff-${index}`">{{ field.label }}</label>
          <textarea
            :id="`ff-${index}`"
            :ref="(el) => setFieldRef(index, el)"
            v-model="values[field.key]"
            rows="3"
            class="form-input form-textarea"
            :placeholder="field.placeholder || ''"
            :data-field-index="index"
            spellcheck="false"
            @keydown="onFieldKeydown($event, index)"
          />
        </template>

        <!-- text / date / time：单行输入 -->
        <template v-else>
          <label class="form-label" :for="`ff-${index}`">{{ field.label }}</label>
          <div
            v-if="isPickerField(field)"
            :ref="(el) => setPickerWrapRef(field.key, el)"
            class="form-picker-wrap"
          >
            <input
              :id="`ff-${index}`"
              :ref="(el) => setFieldRef(index, el)"
              v-model="values[field.key]"
              class="form-input"
              :type="fieldType(field)"
              :title="'↑↓ 调整 · ↵ 打开选择面板 · Tab 切字段'"
              :data-field-index="index"
              spellcheck="false"
              @keydown="onFieldKeydown($event, index)"
            />
            <button
              class="form-picker-btn"
              type="button"
              :aria-label="fieldType(field) === 'date' ? '打开日历面板' : '打开时间面板'"
              :tabindex="-1"
              @click.stop="togglePicker(field)"
            >
              <AppIcon
                :icon="fieldType(field) === 'date' ? 'ri-calendar-line' : 'ri-time-line'"
                :size="14"
              />
            </button>
            <PickerPanel
              v-if="openPicker?.key === field.key"
              :ref="setPanelRef"
              :mode="openPicker.mode"
              :value="values[field.key] ?? ''"
              :anchor-el="pickerAnchors[field.key] ?? null"
              @commit="(v) => commitPicker(field, String(v))"
              @cancel="closePicker"
            />
          </div>
          <input
            v-else
            :id="`ff-${index}`"
            :ref="(el) => setFieldRef(index, el)"
            v-model="values[field.key]"
            class="form-input"
            type="text"
            :placeholder="field.placeholder || ''"
            :data-field-index="index"
            spellcheck="false"
            @keydown="onFieldKeydown($event, index)"
          />
        </template>
      </div>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
/**
 * Form 基元（M5.2）：胶囊内的字段式表单（Raycast Form 模式）。
 * 字段类型：text（缺省）/ textarea / select / checkbox / date。
 * Tab/↑↓ 在字段间移动，⌘↵ 提交，ESC 取消（ESC 由外层导航栈先处理）；
 * checkbox 用 ↵/Space 切换，select ←→ 轮转选项、↵ 开自建下拉面板。
 */
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import CapsulePage from './CapsulePage.vue'
import PickerPanel from './PickerPanel.vue'
import PopoverSelect from './PopoverSelect.vue'
import type { PopoverOption } from './PopoverSelect.vue'
import type { FormField, FormFieldType } from '@shared/plugin-protocol'

export type { FormField }

/** 字段提交值：checkbox 为 boolean，其余为 string */
type FieldValue = string | boolean

const props = defineProps<{
  fields: FormField[]
  submitLabel?: string
  initial?: Record<string, FieldValue>
}>()

const emit = defineEmits<{ submit: [values: Record<string, FieldValue>]; cancel: [] }>()

function cancel(): void {
  emit('cancel')
}

/** 字符控件（text/textarea/select/date）的值 */
const values = ref<Record<string, string>>({})
/** checkbox 的值（独立存放，提交时转 boolean） */
const checks = ref<Record<string, boolean>>({})
const fieldRefs = ref<HTMLElement[]>([])
/** select 字段的 PopoverSelect 实例（按下标对齐 fields），见 setFieldRef */
type PopoverSelectInst = {
  isOpen: () => boolean
  handleKey: (e: KeyboardEvent) => boolean
  close?: (() => void) | undefined
}
const selectInsts = ref<Record<number, PopoverSelectInst | null>>({})

function fieldType(field: FormField): FormFieldType {
  return field.type ?? 'text'
}

/** date/time：原生 picker 字段（↑↓ 是控件调值语义，↵ 开自建面板） */
function isPickerField(field: FormField): boolean {
  const t = fieldType(field)
  return t === 'date' || t === 'time'
}

/* ── 自建选择面板（透明窗里原生 picker popup 画不出来——点击图标毫无反应的根因）── */

const openPicker = ref<{ key: string; mode: 'date' | 'time' } | null>(null)
const panelRef = ref<{ handleKey: (e: KeyboardEvent) => void } | null>(null)
/** picker 面板的锚元素（字段容器），面板 fixed 定位/上下自适应用它 */
const pickerAnchors = ref<Record<string, HTMLElement | null>>({})

/** v-for 内不能用字符串模板 ref（Vue 会收成数组），面板与锚元素都走函数 ref */
function setPanelRef(el: unknown): void {
  panelRef.value = (el as { handleKey: (e: KeyboardEvent) => void } | null) ?? null
}

function setPickerWrapRef(key: string, el: unknown): void {
  pickerAnchors.value[key] = (el as HTMLElement | null) ?? null
}

function togglePicker(field: FormField): void {
  const mode = fieldType(field) === 'date' ? 'date' : 'time'
  if (openPicker.value?.key === field.key) {
    openPicker.value = null
    return
  }
  openPicker.value = { key: field.key, mode }
}

function closePicker(): void {
  openPicker.value = null
}

function commitPicker(field: FormField, value: string): void {
  values.value[field.key] = value
  closePicker()
  const index = props.fields.findIndex((f) => f.key === field.key)
  focusField(index === -1 ? 0 : index)
}

const hints = computed(() => [
  { keys: '⌘↵', label: props.submitLabel ?? '提交' },
  { keys: '↑↓', label: '切换字段' },
  { keys: 'Tab', label: '下一字段' },
  { keys: 'ESC', label: '取消' }
])

function submit(): void {
  const filled: Record<string, FieldValue> = {}
  for (const field of props.fields) {
    // checkbox 提交 boolean；其余控件统一提交去首尾空白的字符串
    filled[field.key] =
      fieldType(field) === 'checkbox'
        ? checks.value[field.key] === true
        : (values.value[field.key] ?? '').trim()
  }
  emit('submit', filled)
}

function setFieldRef(index: number, el: unknown): void {
  if (!el) return
  // select 字段的 ref 是 PopoverSelect 组件实例：exposed.el（根 div，tabindex=-1）
  // 才是可 focus 的 DOM；实例本体另存（面板开着时按键要转发给它）
  const maybeInst = el as {
    el?: HTMLElement | null
    $el?: HTMLElement
    isOpen?: () => boolean
    handleKey?: (e: KeyboardEvent) => boolean
    close?: () => void
  }
  fieldRefs.value[index] = (maybeInst.el ?? maybeInst.$el ?? el) as HTMLElement
  if (maybeInst.isOpen && maybeInst.handleKey) {
    // 显式挑出三个方法存，避免把「可选成员的宽形状」直接塞进严格实例类型
    selectInsts.value[index] = {
      isOpen: maybeInst.isOpen,
      handleKey: maybeInst.handleKey,
      close: maybeInst.close
    }
  } else {
    delete selectInsts.value[index]
  }
}

function focusField(index: number): void {
  fieldRefs.value?.[index]?.focus()
}

/** 当前焦点所在字段下标（焦点在搜索框/其他区域时返回 -1）。
 *  PopoverSelect 聚焦落点是行内按钮（无 fieldIndex），向上找带标记的行根 */
function currentFieldIndex(): number {
  const el = document.activeElement as HTMLElement | null
  const raw =
    el?.dataset?.fieldIndex ?? el?.closest?.('[data-field-index]')?.getAttribute('data-field-index')
  const parsed = raw !== undefined ? Number(raw) : NaN
  return Number.isInteger(parsed) ? parsed : -1
}

/** 焦点移到相邻字段；无字段持焦时 ↓ 到首个、↑ 到末个 */
function moveFocus(delta: number): boolean {
  if (props.fields.length === 0) return false
  const cur = currentFieldIndex()
  const base = cur === -1 ? (delta > 0 ? -1 : 0) : cur
  focusField((base + delta + props.fields.length) % props.fields.length)
  return true
}

function toggleCheckbox(field: FormField): void {
  checks.value[field.key] = checks.value[field.key] !== true
}

/** select ←→ 换选项（面板没开时的键盘快捷路径） */
function moveSelectOption(field: FormField, delta: number): void {
  const opts = field.options ?? []
  if (opts.length === 0) return
  const at = opts.indexOf(values.value[field.key] ?? '')
  const next = at === -1 ? 0 : (at + delta + opts.length) % opts.length
  values.value[field.key] = opts[next] ?? ''
}

/** FormField.options 是纯字符串（title），PopoverSelect 要 {value,label} 形状 */
function selectOptions(field: FormField): PopoverOption[] {
  return (field.options ?? []).map((o) => ({ value: o, label: o }))
}

/**
 * select 字段按键分发：面板开着 → 按键归 PopoverSelect（↑↓↵ESC），没收走的
 * Tab 先收面板再走字段导航；面板没开 → ↵ 开面板，其余（←→ 轮转、↑↓ 切字段、
 * ESC 退表单）归 onFieldKeydown。⌘↵ 任何时刻都是提交。
 */
function onSelectKeydown(e: KeyboardEvent, index: number): void {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    onFieldKeydown(e, index)
    return
  }
  const inst = selectInsts.value[index]
  if (inst) {
    if (inst.isOpen()) {
      if (inst.handleKey(e)) return
      if (e.key === 'Tab') inst.close?.()
    } else if (e.key === 'Enter') {
      inst.handleKey(e)
      return
    }
  }
  onFieldKeydown(e, index)
}

function onFieldKeydown(e: KeyboardEvent, index: number): void {
  // 面板开着时 ESC 归面板（只收面板）；没收面板就 ESC 会把整个表单退掉
  const field = props.fields[index]
  if (e.key === 'Escape' && openPicker.value?.key !== field?.key) {
    e.preventDefault()
    cancel()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    submit()
    return
  }
  if (!field) return
  if (fieldType(field) === 'checkbox') {
    // checkbox：↵/Space 切换（不触发提交）
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault()
      toggleCheckbox(field)
      return
    }
  } else if (fieldType(field) === 'select') {
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault()
      moveSelectOption(field, e.key === 'ArrowRight' ? 1 : -1)
      return
    }
  } else if (isPickerField(field)) {
    // date/time：面板开着 → 按键全归面板（↑↓←→ 移动、↵ 选中、ESC 关）；
    // 面板没开：↵ 开面板；↑↓ 归原生控件分段调值（透明窗里这是唯一可用的调值路径）
    if (openPicker.value?.key === field.key) {
      e.preventDefault()
      panelRef.value?.handleKey(e)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      openPicker.value = { key: field.key, mode: fieldType(field) === 'date' ? 'date' : 'time' }
      return
    }
    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') return
  }
  if (e.key === 'Tab' || e.key === 'ArrowDown') {
    e.preventDefault()
    focusField((index + 1) % props.fields.length)
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    focusField((index - 1 + props.fields.length) % props.fields.length)
  }
}

/** 键盘分发（LauncherApp 集中转发）：字段内按键由控件自身处理；
 *  焦点仍在搜索框时，这里兜住 ⌘↵ 提交与 ↑↓ 字段间移动 */
function handleKey(e: KeyboardEvent): boolean {
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    submit()
    return true
  }
  if (e.key === 'ArrowDown') {
    return moveFocus(1)
  }
  if (e.key === 'ArrowUp') {
    return moveFocus(-1)
  }
  return false
}

defineExpose({ handleKey, submit })

onMounted(() => {
  initValues()
  focusField(0)
})

/** 组件被外层复用（分支切换不换 key）时 fields/initial 会原地变化：
 *  用「内容签名」而非数组身份做依赖（inline 字面量每次渲染都是新数组），变化时重读初始值 */
watch(
  () =>
    props.fields
      .map((f) => {
        const fieldInit = typeof f.initial === 'boolean' ? String(f.initial) : (f.initial ?? '')
        const formInit = props.initial?.[f.key]
        const formInitText = typeof formInit === 'boolean' ? String(formInit) : (formInit ?? '')
        return `${f.key}:${f.type ?? 'text'}:${fieldInit}:${formInitText}`
      })
      .join('|'),
  () => initValues()
)

/** 初始值：字段级 field.initial 为底，表单级 props.initial 覆盖；
 *  select 初值不在 options 内时回落到首个选项 */
function initValues(): void {
  const nextValues: Record<string, string> = {}
  const nextChecks: Record<string, boolean> = {}
  for (const field of props.fields) {
    const type = fieldType(field)
    if (type === 'checkbox') {
      nextChecks[field.key] = field.initial === true
    } else if (type === 'select') {
      const opts = field.options ?? []
      const want = typeof field.initial === 'string' ? field.initial : undefined
      nextValues[field.key] = want !== undefined && opts.includes(want) ? want : (opts[0] ?? '')
    } else {
      nextValues[field.key] = typeof field.initial === 'string' ? field.initial : ''
    }
  }
  if (props.initial) {
    for (const [key, val] of Object.entries(props.initial)) {
      if (key in nextChecks) nextChecks[key] = val === true
      else if (key in nextValues) nextValues[key] = String(val)
    }
  }
  values.value = nextValues
  checks.value = nextChecks
}
</script>

<style scoped>
.form-page {
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.form-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 11px;
  color: var(--launcher-text-muted);
}

.form-input {
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--launcher-border);
  background: var(--launcher-bg-elevated);
  padding: 0 10px;
  font-size: 13px;
  color: var(--launcher-text);
  outline: none;
}

.form-input:focus {
  border-color: var(--launcher-accent);
}

/* ── date/time 原生 picker 字段 ──
 * 原生日历/时钟 popup 在透明窗里渲染不出来（点击图标无反应的根因），图标换成自建
 * 面板入口；input 保留键盘输入与 ↑↓ 分段调值（input 内行为，不依赖 popup）。 */

.form-picker-wrap {
  position: relative;
  display: flex;
}

.form-picker-wrap .form-input {
  flex: 1;
  width: 100%;
  padding-right: 30px;
}

.form-picker-wrap input[type='date']::-webkit-calendar-picker-indicator,
.form-picker-wrap input[type='time']::-webkit-calendar-picker-indicator {
  display: none;
}

.form-picker-btn {
  position: absolute;
  top: 50%;
  right: 5px;
  transform: translateY(-50%);
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text-muted);
  cursor: pointer;
  padding: 0;
}

.form-picker-btn:hover {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}

.form-textarea {
  height: auto;
  min-height: 72px;
  padding: 8px 10px;
  resize: none;
  line-height: 1.5;
  font-family: inherit;
}

/* ── select 字段：PopoverSelect 触发器拉成与 .form-input 一致的外观 ── */
.form-select-pop {
  display: flex;
  width: 100%;
  border-radius: 8px;
}

.form-select-pop:focus-within :deep(.popover-select-trigger) {
  border-color: var(--launcher-accent);
}

.form-select-pop :deep(.popover-select-trigger) {
  width: 100%;
  height: 34px;
  justify-content: space-between;
  border-radius: 8px;
  font-size: 13px;
  color: var(--launcher-text);
}

.form-select-pop :deep(.popover-select-trigger:hover) {
  border-color: var(--launcher-accent);
}

/* checkbox 开关行 */
.form-switch-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--launcher-border);
  background: var(--launcher-bg-elevated);
  cursor: pointer;
  outline: none;
}

.form-switch-row:focus {
  border-color: var(--launcher-accent);
}

.form-switch-label {
  font-size: 13px;
  color: var(--launcher-text);
}

.form-switch {
  position: relative;
  width: 30px;
  height: 17px;
  border-radius: 999px;
  background: var(--launcher-bg-elevated);
  transition: background 0.15s ease;
  flex-shrink: 0;
}

.form-switch.on {
  background: var(--launcher-accent);
}

.form-switch-thumb {
  position: absolute;
  top: 2px;
  left: 2px;
  width: 13px;
  height: 13px;
  border-radius: 50%;
  background: var(--surface-1);
  transition: transform 0.15s ease;
}

.form-switch.on .form-switch-thumb {
  transform: translateX(13px);
}
</style>
