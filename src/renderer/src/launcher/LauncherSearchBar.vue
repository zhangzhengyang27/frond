<script setup lang="ts">
/**
 * Frond · 胶囊搜索输入区（P-1.6b 的前置拆分）
 *
 * 从 LauncherApp.vue（2400 行）搬出来的**纯搬运**：模板与样式逐字复制过来，状态与
 * 处理器全部留在父组件——这个组件只负责「长得一样、事件照原样发出去」。
 * 拆它的原因是内联参数槽要重写这一区（命令前缀变 chip、光标落进槽里、←/→ 换格），
 * 在 2400 行里同时改键盘路由和这一区的布局，改一次撞一次。
 *
 * 两条不能忘：
 * - `input` / `keydown` 发的是**原生事件对象**，父组件 handler 照旧用 `e.key` /
 *   `e.preventDefault()`；声明进 emits 后 Vue 不会再把它落到根元素上，不存在跑两遍。
 * - scoped CSS 只作用于带本组件作用域属性的元素：`.launcher-search` 一族必须搬过来，
 *   连带「收成一条栏不要底边线」那条也得换成挂在自家根元素上。
 */
import { computed, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import type { KindFilter } from './pages/clipboardLogic'
import type { ArgSlot } from '@shared/argSlots'

const props = withDefaults(
  defineProps<{
    /** 搜索词（v-model） */
    modelValue: string
    placeholder: string
    /** 有推入页时左侧变返回按钮（Esc / 点击逐级返回） */
    showBack: boolean
    pluginOpen: boolean
    pluginName: string | null
    /** 剪贴板内联页：右侧放类型筛选下拉（Raycast All Types 的位置） */
    showFilter: boolean
    clipFilter: KindFilter
    /** combobox 语义：当前有没有可展开的列表。
     *  刻意不叫 `ariaExpanded`——`aria-*` 的绑定会被当成**属性**透传，prop 收不到值。 */
    listExpanded: boolean
    /** 高亮行的元素 id，读屏靠它在不换焦点的情况下跟住选中项（还没高亮行时是 undefined） */
    activeDescendantId?: string | null
    /** 紧凑模式：整窗收成一条栏 */
    compact?: boolean
    /** 参数模式（P-1.6b）：命令名变 chip，后面一格一格填参数 */
    argMode?: boolean
    argTitle?: string
    argSlots?: ArgSlot[]
    argValues?: string[]
    argIndex?: number
    /** 提交时被挡住的必填格（下标），只用来标红，不做拦截逻辑（判定在 shared/argSlots） */
    argInvalid?: number[]
  }>(),
  {
    compact: false,
    argMode: false,
    argTitle: '',
    argSlots: () => [],
    argValues: () => [],
    argIndex: 0,
    argInvalid: () => []
  }
)

const emit = defineEmits<{
  'update:modelValue': [string]
  'update:clipFilter': [KindFilter]
  input: [Event]
  keydown: [KeyboardEvent]
  back: []
  ai: []
  /** 参数模式：第 i 格改了值 */
  argInput: [number, string]
  /** 参数模式：用户自己 Tab/点到某格，父组件跟着挪 argIndex */
  argFocus: [number]
  /** 参数模式：格子里的按键原样上交（方向键换格 / ↵ 提交 / ⌫ 退出都由父组件判） */
  argKeydown: [KeyboardEvent, number]
}>()

const text = computed({
  get: () => props.modelValue,
  set: (v: string) => emit('update:modelValue', v)
})
const filter = computed({
  get: () => props.clipFilter,
  set: (v: KindFilter) => emit('update:clipFilter', v)
})

const inputEl = ref<HTMLInputElement | null>(null)
const rootEl = ref<HTMLElement | null>(null)
const slotEls = ref<Array<HTMLInputElement | null>>([])

const setSlotEl = (el: unknown, i: number): void => {
  slotEls.value[i] = (el as HTMLInputElement | null) ?? null
}

/** 焦点跟着 argIndex 走（父组件是唯一真相，方向键判定在 shared/argSlots） */
watch(
  () => [props.argMode, props.argIndex, props.argSlots.length] as const,
  () => {
    if (!props.argMode) return
    const el = slotEls.value[props.argIndex]
    if (el && document.activeElement !== el) {
      el.focus()
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }
)

const onSlotInput = (i: number, e: Event): void => {
  emit('argInput', i, (e.target as HTMLInputElement).value)
}

/** 父组件有十几处要把焦点还给输入框（唤起、执行完一条命令、返回上一级…） */
const focus = (): void => {
  if (props.argMode) {
    const el = slotEls.value[props.argIndex]
    if (el) {
      el.focus()
      return
    }
  }
  inputEl.value?.focus()
}

/** 紧凑模式要知道这一栏多高（父组件要把它报给主进程收窗口），别反过来用 querySelector 摸进来 */
const barHeight = (): number => rootEl.value?.offsetHeight ?? 0

defineExpose({ focus, element: () => inputEl.value, barHeight })
</script>

<template>
  <div ref="rootEl" class="launcher-search" :class="{ compact, arg: argMode }">
    <!-- 参数模式（P-1.6b 内联参数槽）：命令名是不可编辑的 chip，参数一格一格排在后面。
         搜索输入框此时**不在**——列表也已经被父组件藏掉，键盘语义整套换掉。 -->
    <template v-if="argMode">
      <span class="launcher-search-chip" data-arg-chip>{{ argTitle }}</span>
      <input
        v-for="(slot, i) in argSlots"
        :key="slot.id"
        :ref="(el) => setSlotEl(el, i)"
        class="launcher-search-slot"
        :class="{ active: i === argIndex, invalid: argInvalid.includes(i) }"
        :type="slot.secret ? 'password' : 'text'"
        :value="argValues[i] ?? ''"
        :placeholder="slot.label"
        :aria-label="slot.label"
        :aria-invalid="argInvalid.includes(i) ? 'true' : 'false'"
        :data-arg-slot="slot.id"
        :data-arg-index="i"
        spellcheck="false"
        autocomplete="off"
        @input="onSlotInput(i, $event)"
        @focus="emit('argFocus', i)"
        @keydown="emit('argKeydown', $event, i)"
      />
      <div class="launcher-search-right">
        <span class="launcher-search-arg-hint">
          <kbd>↵</kbd>执行<kbd>←</kbd><kbd>→</kbd>换格<kbd>⌫</kbd>退出
        </span>
      </div>
    </template>
    <!-- 推入页（Raycast）：搜索栏左侧变返回按钮，Esc/点击逐级返回 -->
    <button
      v-if="showBack"
      class="launcher-search-back"
      title="返回（Esc）"
      @mousedown.prevent="emit('back')"
    >
      <AppIcon icon="arrow-left-s-line" :size="22" />
    </button>
    <AppIcon v-else icon="search" :size="22" class="launcher-search-icon" />
    <!-- P-7 无障碍：搜索框是 combobox，选中项通过 aria-activedescendant 指过去，
         这样读屏软件能在不换焦点的情况下跟住高亮行（键盘是本产品的主输入方式） -->
    <input
      v-if="!argMode"
      ref="inputEl"
      v-model="text"
      class="launcher-search-input"
      type="text"
      :placeholder="placeholder"
      role="combobox"
      aria-label="搜索命令、应用与文件"
      aria-autocomplete="list"
      :aria-expanded="listExpanded"
      aria-controls="launcher-result-list"
      :aria-activedescendant="activeDescendantId ?? undefined"
      spellcheck="false"
      @input="emit('input', $event)"
      @keydown="emit('keydown', $event)"
    />
    <div v-if="!argMode" class="launcher-search-right">
      <span v-if="pluginOpen" class="launcher-search-plugin">{{ pluginName }}</span>
      <!-- I6：剪贴板页类型筛选迁入搜索栏右侧（Raycast All Types 位置） -->
      <select
        v-else-if="showFilter"
        v-model="filter"
        class="launcher-search-filter"
        aria-label="按类型筛选"
      >
        <option value="all">全部</option>
        <option value="text">文本</option>
        <option value="link">链接</option>
        <option value="image">图片</option>
        <option value="files">文件</option>
      </select>
      <button v-else class="launcher-search-ai" @mousedown.prevent="emit('ai')">
        Quick AI <kbd>⇥</kbd>
      </button>
    </div>
  </div>
</template>

<style scoped>
/* ── 搜索框（V1：Raycast 64pt 行高 = 16 padding + 32 输入框居中）── */
.launcher-search.compact {
  /* 收成一条栏时下面没有列表了，这条分隔线会变成窗口的第二条描边。
     原本是 `.launcher.compact .launcher-search`：搬进子组件后父组件的 scoped 选择器
     管不到子组件内部元素，所以改成挂自家根元素。
     e2e/capsule-compact 有一条直接读 borderBottomWidth 的断言钉它。 */
  border-bottom: none;
}

.launcher-search {
  height: var(--launcher-search-height);
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 0 16px;
  border-bottom: 1px solid var(--launcher-hairline);
  position: relative;
  /* P-6⑤：frameless 窗没有标题栏，整条搜索行当拖拽把手。
     但把手不能吃掉点击——输入框 / 筛选下拉 / 右侧按钮一律 no-drag，
     否则「能拖」与「能打字」只能选一个。 */
  -webkit-app-region: drag;
}

.launcher-search input,
.launcher-search button,
.launcher-search select,
.launcher-search .launcher-search-right {
  -webkit-app-region: no-drag;
}

/* I9 统一加载态：贴搜索行底边的不确定进度条 */
.launcher-search-icon {
  color: var(--launcher-text-muted);
  flex-shrink: 0;
  width: 22px;
  height: 22px;
}

.launcher-search-back {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  border: none;
  background: transparent;
  color: var(--launcher-text-muted);
  border-radius: 6px;
  cursor: pointer;
  margin-left: -4px;
  transition: background 0.1s ease;
}

.launcher-search-back:hover {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}

.launcher-search-input {
  flex: 1;
  height: 32px;
  border: none;
  outline: none;
  background: transparent;
  color: var(--launcher-text);
  font-size: 17px;
  font-weight: 400;
  caret-color: var(--launcher-accent);
}

.launcher-search-input::placeholder {
  color: var(--launcher-text-faint);
}

.launcher-search-right {
  display: flex;
  align-items: center;
  flex-shrink: 0;
}

/* I6：剪贴板页类型筛选（Raycast All Types 在搜索栏内右侧） */
.launcher-search-filter {
  height: 28px;
  font-size: 12px;
  color: var(--launcher-text-dim);
  background: var(--launcher-input-bg);
  border: 1px solid var(--launcher-hairline);
  border-radius: 7px;
  padding: 0 4px;
  cursor: pointer;
  outline: none;
  box-sizing: border-box;
}

.launcher-search-ai {
  display: flex;
  align-items: center;
  gap: 5px;
  border: none;
  background: transparent;
  color: var(--launcher-text-muted);
  font-size: 12px;
  font-weight: 500;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.1s ease;
}

.launcher-search-ai:hover {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}

.launcher-search-ai kbd {
  font-family: inherit;
  font-size: 10px;
  color: var(--launcher-text-faint);
  border: 1px solid var(--launcher-border);
  border-radius: 4px;
  padding: 1px 5px;
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
}

.launcher-search-plugin {
  font-size: 12px;
  color: var(--launcher-accent);
  font-weight: 500;
}
/* 参数模式的 chip 与格子（P-1.6b）：chip 不可编辑、看着就是一块标签而不是文字 */
.launcher-search-chip {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  height: 28px;
  padding: 0 10px;
  border-radius: 7px;
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  background: var(--frond-capsule-bg-elevated, var(--launcher-bg-elevated));
  border: 1px solid var(--launcher-border);
  max-width: 46%;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.launcher-search-slot {
  flex: 1;
  min-width: 0;
  height: 32px;
  border: none;
  border-bottom: 1px solid transparent;
  outline: none;
  background: transparent;
  color: var(--launcher-text);
  font-size: 17px;
  caret-color: var(--launcher-accent);
}

.launcher-search-slot.active {
  border-bottom-color: var(--launcher-accent);
}

.launcher-search-slot.invalid {
  border-bottom-color: var(--launcher-danger);
}

.launcher-search-slot::placeholder {
  color: var(--launcher-text-faint);
}

.launcher-search-arg-hint {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--launcher-text-faint);
}

.launcher-search-arg-hint kbd {
  font-family: inherit;
  font-size: 10px;
  border: 1px solid var(--launcher-border);
  border-radius: 4px;
  padding: 1px 4px;
  margin: 0 2px 0 6px;
}
</style>
