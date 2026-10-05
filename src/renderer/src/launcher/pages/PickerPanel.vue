<template>
  <!-- Teleport 到 body：面板是 fixed 浮层，留在表单文档流里会被任一 overflow 祖先裁剪 -->
  <Teleport to="body">
    <div
      ref="rootEl"
      class="picker-panel"
      data-testid="picker-panel"
      :style="panelStyle"
      @keydown="onPanelKey"
    >
    <!-- 日历模式：月视图 -->
    <template v-if="mode === 'date'">
      <div class="picker-head">
        <button class="picker-nav" type="button" aria-label="上一月" @click="shiftMonth(-1)">
          ‹
        </button>
        <span class="picker-month">{{ viewYear }} 年 {{ viewMonth + 1 }} 月</span>
        <button class="picker-nav" type="button" aria-label="下一月" @click="shiftMonth(1)">
          ›
        </button>
      </div>
      <div class="picker-weeks">
        <span v-for="w in WEEKDAYS" :key="w" class="picker-week">{{ w }}</span>
      </div>
      <div class="picker-grid">
        <button
          v-for="(cell, i) in cells"
          :key="i"
          type="button"
          class="picker-day"
          :class="{
            dim: cell.dim,
            today: cell.today,
            selected: cell.selected,
            cursor: i === cursorIndex
          }"
          @click="pickDay(cell)"
          @mouseenter="cursorIndex = i"
        >
          {{ cell.day }}
        </button>
      </div>
    </template>

    <!-- 时间模式：时 / 分两列 -->
    <template v-else>
      <div class="picker-time-cols">
        <div class="picker-time-col">
          <div class="picker-col-title">时</div>
          <div class="picker-col-scroll">
            <button
              v-for="h in 24"
              :key="h"
              type="button"
              class="picker-cell"
              :class="{ selected: h - 1 === hour, cursor: h - 1 === cursorHour }"
              @click="pickTime(h - 1, minute)"
              @mouseenter="cursorHour = h - 1"
            >
              {{ String(h - 1).padStart(2, '0') }}
            </button>
          </div>
        </div>
        <div class="picker-time-col">
          <div class="picker-col-title">分</div>
          <div class="picker-col-scroll">
            <button
              v-for="m in 12"
              :key="m"
              type="button"
              class="picker-cell"
              :class="{ selected: (m - 1) * 5 === minute, cursor: (m - 1) * 5 === cursorMinute }"
              @click="pickTime(hour, (m - 1) * 5)"
              @mouseenter="cursorMinute = (m - 1) * 5"
            >
              {{ String((m - 1) * 5).padStart(2, '0') }}
            </button>
          </div>
        </div>
      </div>
      <button class="picker-confirm" type="button" @click="confirmTime">
        确定 {{ displayTime }}
      </button>
    </template>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
/**
 * 胶囊内日期/时间选择面板（FormPage date/time 字段的浮层）。
 *
 * 为什么不用原生 picker：胶囊窗 transparent:true，Chromium 的原生选择 popup
 * （date/time/select）画在窗口表面之外，透明窗里渲染不出来——点击毫无反应。
 * 本组件是 DOM 内浮层：日历月视图 / 时分两列，键盘 ↑↓←→ 移动、↵ 选中、ESC 关闭。
 */
import { computed, nextTick, onMounted, ref, watch, type CSSProperties } from 'vue'

const props = defineProps<{
  mode: 'date' | 'time'
  /** date: YYYY-MM-DD；time: HH:mm（可为空 = 未选） */
  value: string
  /** 锚元素（表单字段容器）：面板 fixed 定位的基准，放不下自动向上弹 */
  anchorEl: HTMLElement | null
}>()

const emit = defineEmits<{
  /** 选中并确认（↵ 或点击格子） */
  commit: [value: string]
  cancel: []
}>()

/* ── 定位：fixed + 锚定字段，下方放不下就向上弹（脱离文档流的 overflow 裁剪链）── */

const panelStyle = ref<CSSProperties>({})
const rootEl = ref<HTMLElement | null>(null)

onMounted(async () => {
  await nextTick()
  const panel = rootEl.value
  const anchor = props.anchorEl
  if (!panel || !anchor) return
  const p = panel.getBoundingClientRect()
  const a = anchor.getBoundingClientRect()
  const vw = window.innerWidth
  const vh = window.innerHeight
  const below = vh - a.bottom - 8
  const style: CSSProperties = {}
  // 垂直：默认字段下方 4px；下方容不下且上方更宽裕则弹到字段上方
  if (p.height <= below || a.top - 8 < p.height) {
    style.top = `${Math.min(a.bottom + 4, vh - p.height - 8)}px`
  } else {
    style.top = `${Math.max(8, a.top - p.height - 4)}px`
  }
  // 水平：右对齐字段（胶囊窗 750 宽，面板 252 固定，clamp 防出窗）
  // 注意必须带 px 的字符串：数字赋给 el.style.top 会被 DOM 静默忽略
  style.left = `${Math.max(8, Math.min(a.right - p.width, vw - p.width - 8))}px`
  panelStyle.value = style
})

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六']

/* ── date 模式 ── */

function parseDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value)
  if (!m) return null
  const d = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
  return Number.isNaN(d.getTime()) ? null : d
}

const today = new Date()
const initial = parseDate(props.value)
const viewYear = ref(initial?.getFullYear() ?? today.getFullYear())
const viewMonth = ref(initial?.getMonth() ?? today.getMonth())
const selectedDate = ref<Date | null>(initial)
/** 网格光标（与 selected 独立：移动光标不等于选中） */
const cursorDate = ref<Date>(initial ?? today)

interface DayCell {
  day: number
  date: Date
  dim: boolean
  today: boolean
  selected: boolean
}

const cells = computed<DayCell[]>(() => {
  const first = new Date(viewYear.value, viewMonth.value, 1)
  const start = new Date(first)
  start.setDate(1 - first.getDay())
  const out: DayCell[] = []
  for (let i = 0; i < 42; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const sameDay = (a: Date, b: Date): boolean =>
      a.getFullYear() === b.getFullYear() &&
      a.getMonth() === b.getMonth() &&
      a.getDate() === b.getDate()
    out.push({
      day: d.getDate(),
      date: d,
      dim: d.getMonth() !== viewMonth.value,
      today: sameDay(d, today),
      selected: selectedDate.value !== null && sameDay(d, selectedDate.value)
    })
  }
  return out
})

const cursorIndex = computed<number>({
  get: () => cells.value.findIndex((c) => sameDaySafe(c.date, cursorDate.value)),
  set: (i: number) => {
    const c = cells.value[i]
    if (c) cursorDate.value = c.date
  }
})

function sameDaySafe(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  )
}

function shiftMonth(delta: number): void {
  const next = new Date(viewYear.value, viewMonth.value + delta, 1)
  viewYear.value = next.getFullYear()
  viewMonth.value = next.getMonth()
}

function fmtDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, '0')
  const dd = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mm}-${dd}`
}

function pickDay(cell: DayCell): void {
  emit('commit', fmtDate(cell.date))
}

/* ── time 模式 ── */

function parseTime(value: string): { h: number; m: number } | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(value)
  if (!m) return null
  const h = Number(m[1])
  const min = Number(m[2])
  if (h > 23 || min > 59) return null
  return { h, m: min }
}

const initialTime = parseTime(props.value)
const hour = ref(initialTime?.h ?? 9)
const minute = ref(initialTime?.m ?? 0)
const cursorHour = ref(hour.value)
const cursorMinute = ref(
  Math.round(minute.value / 5) * 5 > 55 ? 55 : Math.round(minute.value / 5) * 5
)

const displayTime = computed(
  () => `${String(hour.value).padStart(2, '0')}:${String(minute.value).padStart(2, '0')}`
)

function pickTime(h: number, m: number): void {
  hour.value = h
  minute.value = m
}

function confirmTime(): void {
  emit('commit', displayTime.value)
}

/* ── 面板内键盘（FormPage 把按键转发到这里；焦点仍在 input 上，DOM 冒泡到不了面板）── */

function onPanelKey(e: KeyboardEvent): void {
  if (props.mode === 'date') {
    const step = (days: number): void => {
      e.preventDefault()
      const next = new Date(cursorDate.value)
      next.setDate(next.getDate() + days)
      cursorDate.value = next
      if (next.getMonth() !== viewMonth.value || next.getFullYear() !== viewYear.value) {
        viewYear.value = next.getFullYear()
        viewMonth.value = next.getMonth()
      }
    }
    if (e.key === 'ArrowLeft') step(-1)
    else if (e.key === 'ArrowRight') step(1)
    else if (e.key === 'ArrowUp') step(-7)
    else if (e.key === 'ArrowDown') step(7)
    else if (e.key === 'Enter') {
      e.preventDefault()
      emit('commit', fmtDate(cursorDate.value))
    } else if (e.key === 'Escape') {
      e.preventDefault()
      emit('cancel')
    }
    return
  }

  const moveHour = (delta: number): void => {
    e.preventDefault()
    cursorHour.value = (cursorHour.value + delta + 24) % 24
  }
  const moveMinute = (delta: number): void => {
    e.preventDefault()
    cursorMinute.value = (cursorMinute.value + delta * 5 + 60) % 60
  }
  if (e.key === 'ArrowLeft') moveHour(-1)
  else if (e.key === 'ArrowRight') moveHour(1)
  else if (e.key === 'ArrowUp') moveMinute(1)
  else if (e.key === 'ArrowDown') moveMinute(-1)
  else if (e.key === 'Enter') {
    e.preventDefault()
    hour.value = cursorHour.value
    minute.value = cursorMinute.value
    confirmTime()
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('cancel')
  }
}

/** 外部值变化（如表单重填初值）时同步面板选中态 */
watch(
  () => props.value,
  (v) => {
    if (props.mode === 'date') {
      const d = parseDate(v)
      if (d) {
        selectedDate.value = d
        cursorDate.value = d
        viewYear.value = d.getFullYear()
        viewMonth.value = d.getMonth()
      }
    } else {
      const t = parseTime(v)
      if (t) {
        hour.value = t.h
        minute.value = t.m
        cursorHour.value = t.h
        cursorMinute.value = Math.round(t.m / 5) * 5 > 55 ? 55 : Math.round(t.m / 5) * 5
      }
    }
  }
)

defineExpose({ handleKey: onPanelKey })
</script>

<style scoped>
.picker-panel {
  position: fixed;
  z-index: 40;
  width: 252px;
  padding: 8px;
  border: 1px solid var(--launcher-border);
  border-radius: 10px;
  background: var(--launcher-bg-elevated);
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.18);
}

.picker-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 4px;
}

.picker-month {
  color: var(--launcher-text);
  font-size: 12px;
  font-weight: 500;
}

.picker-nav {
  width: 22px;
  height: 22px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text-muted);
  cursor: pointer;
  font-size: 14px;
  line-height: 1;
}

.picker-nav:hover {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}

.picker-weeks {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  margin-bottom: 2px;
}

.picker-week {
  color: var(--launcher-text-muted);
  font-size: 10px;
  text-align: center;
}

.picker-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 1px;
}

.picker-day {
  height: 26px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}

.picker-day.dim {
  color: var(--launcher-text-muted);
  opacity: 0.5;
}

.picker-day.today {
  box-shadow: inset 0 0 0 1px var(--launcher-accent);
}

.picker-day.selected {
  background: var(--launcher-accent);
  color: var(--text-inverse);
}

.picker-day.cursor:not(.selected) {
  background: var(--launcher-selected-bg);
}

.picker-time-cols {
  display: flex;
  gap: 6px;
}

.picker-time-col {
  flex: 1;
  min-width: 0;
}

.picker-col-title {
  margin-bottom: 4px;
  color: var(--launcher-text-muted);
  font-size: 10px;
  text-align: center;
}

.picker-col-scroll {
  max-height: 168px;
  overflow-y: auto;
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 1px;
}

.picker-cell {
  height: 24px;
  border: none;
  border-radius: 5px;
  background: transparent;
  color: var(--launcher-text);
  cursor: pointer;
  font-size: 11px;
  padding: 0;
}

.picker-cell.selected {
  background: var(--launcher-accent);
  color: var(--text-inverse);
}

.picker-cell.cursor:not(.selected) {
  background: var(--launcher-selected-bg);
}

.picker-confirm {
  width: 100%;
  margin-top: 6px;
  padding: 5px 0;
  border: none;
  border-radius: 7px;
  background: var(--launcher-accent);
  color: var(--text-inverse);
  cursor: pointer;
  font-size: 11px;
}
</style>
