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

        <!-- select：原生下拉 -->
        <template v-else-if="fieldType(field) === 'select'">
          <label class="form-label" :for="`ff-${index}`">{{ field.label }}</label>
          <select
            :id="`ff-${index}`"
            :ref="(el) => setFieldRef(index, el)"
            v-model="values[field.key]"
            class="form-input form-select"
            :data-field-index="index"
            @keydown="onFieldKeydown($event, index)"
          >
            <option v-for="opt in field.options ?? []" :key="opt" :value="opt">{{ opt }}</option>
          </select>
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

        <!-- text / date：单行输入 -->
        <template v-else>
          <label class="form-label" :for="`ff-${index}`">{{ field.label }}</label>
          <input
            :id="`ff-${index}`"
            :ref="(el) => setFieldRef(index, el)"
            v-model="values[field.key]"
            class="form-input"
            :type="fieldType(field) === 'date' ? 'date' : 'text'"
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
 * checkbox 用 ↵/Space 切换，select 聚焦时 ←→ 换选项。
 */
import { computed, onMounted, ref, watch } from 'vue'
import CapsulePage from './CapsulePage.vue'
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

function fieldType(field: FormField): FormFieldType {
  return field.type ?? 'text'
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
  if (el) fieldRefs.value[index] = el as HTMLElement
}

function focusField(index: number): void {
  fieldRefs.value?.[index]?.focus()
}

/** 当前焦点所在字段下标（焦点在搜索框/其他区域时返回 -1） */
function currentFieldIndex(): number {
  const el = document.activeElement as HTMLElement | null
  const raw = el?.dataset?.fieldIndex
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

/** select ←→ 换选项（不展开原生下拉，胶囊内直接轮转） */
function moveSelectOption(field: FormField, delta: number): void {
  const opts = field.options ?? []
  if (opts.length === 0) return
  const at = opts.indexOf(values.value[field.key] ?? '')
  const next = at === -1 ? 0 : (at + delta + opts.length) % opts.length
  values.value[field.key] = opts[next]
}

function onFieldKeydown(e: KeyboardEvent, index: number): void {
  if (e.key === 'Escape') {
    e.preventDefault()
    cancel()
    return
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') {
    e.preventDefault()
    submit()
    return
  }
  const field = props.fields[index]
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

.form-textarea {
  height: auto;
  min-height: 72px;
  padding: 8px 10px;
  resize: none;
  line-height: 1.5;
  font-family: inherit;
}

.form-select option {
  background: #1e1e22;
  color: #f5f5f5;
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
  background: #fff;
  transition: transform 0.15s ease;
}

.form-switch.on .form-switch-thumb {
  transform: translateX(13px);
}
</style>
