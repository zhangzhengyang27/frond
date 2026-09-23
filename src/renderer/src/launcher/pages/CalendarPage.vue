<template>
  <div class="calendar-page">
    <!-- 头部：月份切换 -->
    <div class="cal-header">
      <button class="cal-nav-btn" @mousedown.prevent="prevMonth">
        <AppIcon icon="arrow-left-s-line" :size="16" />
      </button>
      <div class="cal-title">{{ year }}年{{ month + 1 }}月</div>
      <button class="cal-nav-btn" @mousedown.prevent="nextMonth">
        <AppIcon icon="arrow-right-s-line" :size="16" />
      </button>
      <button class="cal-today-btn" @mousedown.prevent="goToday">今天</button>
    </div>

    <!-- 星期表头 -->
    <div class="cal-weekdays">
      <div v-for="day in weekdays" :key="day" class="cal-weekday">{{ day }}</div>
    </div>

    <!-- 日期网格 -->
    <div class="cal-grid">
      <div
        v-for="(day, idx) in calendarDays"
        :key="idx"
        class="cal-day"
        :class="{
          'other-month': !day.currentMonth,
          today: day.isToday,
          selected: day.isSelected,
          'has-reminder': day.reminderCount > 0
        }"
        @mousedown.prevent="selectDate(day)"
      >
        <span class="cal-day-num">{{ day.date }}</span>
        <div v-if="day.reminderCount > 0" class="cal-day-dots">
          <span v-for="n in Math.min(day.reminderCount, 3)" :key="n" class="cal-dot"></span>
        </div>
      </div>
    </div>

    <!-- 选中日期的提醒列表 -->
    <div v-if="selectedDate" class="cal-reminders">
      <div class="cal-reminders-title">
        <AppIcon icon="alarm-line" :size="14" />
        <span
          >{{ selectedDate.year }}年{{ selectedDate.month + 1 }}月{{ selectedDate.date }}日
          提醒</span
        >
      </div>
      <div v-if="dayReminders.length === 0" class="cal-reminders-empty">当天暂无提醒</div>
      <div v-for="reminder in dayReminders" :key="reminder.id" class="cal-reminder-item">
        <button class="cal-reminder-check" @mousedown.prevent="toggleReminder(reminder)">
          <AppIcon v-if="reminder.isCompleted" icon="checkbox-circle-fill" :size="16" />
          <AppIcon v-else icon="checkbox-circle-line" :size="16" />
        </button>
        <div class="cal-reminder-content" :class="{ completed: reminder.isCompleted }">
          <div class="cal-reminder-title">{{ reminder.title }}</div>
          <div v-if="reminder.remindAt" class="cal-reminder-time">
            {{ formatTime(reminder.remindAt) }}
          </div>
        </div>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@renderer/components/AppIcon.vue'
import { formatClock } from '@utils/format'

interface Reminder {
  id: string
  title: string
  notes: string
  dueAt: number | null
  remindAt: number | null
  isCompleted: boolean
  isDeleted: boolean
  completedAt: number | null
  createdAt: number
  updatedAt: number
}

interface CalendarDay {
  year: number
  month: number
  date: number
  currentMonth: boolean
  isToday: boolean
  isSelected: boolean
  reminderCount: number
  timestamp: number
}

const weekdays = ['日', '一', '二', '三', '四', '五', '六']

const now = new Date()
const year = ref(now.getFullYear())
const month = ref(now.getMonth())
const selectedDate = ref<CalendarDay | null>(null)
const reminders = ref<Reminder[]>([])

const calendarDays = computed<CalendarDay[]>(() => {
  const firstDay = new Date(year.value, month.value, 1)
  const lastDay = new Date(year.value, month.value + 1, 0)
  const startWeekday = firstDay.getDay()
  const daysInMonth = lastDay.getDate()
  const daysInPrevMonth = new Date(year.value, month.value, 0).getDate()

  const today = new Date()
  const todayStr = `${today.getFullYear()}-${today.getMonth()}-${today.getDate()}`

  const days: CalendarDay[] = []

  // 上月填充
  for (let i = startWeekday - 1; i >= 0; i--) {
    const d = daysInPrevMonth - i
    const ts = new Date(year.value, month.value - 1, d).getTime()
    days.push({
      year: year.value,
      month: month.value - 1,
      date: d,
      currentMonth: false,
      isToday: false,
      isSelected: false,
      reminderCount: countRemindersOnDay(ts),
      timestamp: ts
    })
  }

  // 本月
  for (let d = 1; d <= daysInMonth; d++) {
    const ts = new Date(year.value, month.value, d).getTime()
    const dayStr = `${year.value}-${month.value}-${d}`
    days.push({
      year: year.value,
      month: month.value,
      date: d,
      currentMonth: true,
      isToday: dayStr === todayStr,
      isSelected: selectedDate.value?.timestamp === ts,
      reminderCount: countRemindersOnDay(ts),
      timestamp: ts
    })
  }

  // 下月填充（补齐 6 行 42 格）
  const remaining = 42 - days.length
  for (let d = 1; d <= remaining; d++) {
    const ts = new Date(year.value, month.value + 1, d).getTime()
    days.push({
      year: year.value,
      month: month.value + 1,
      date: d,
      currentMonth: false,
      isToday: false,
      isSelected: false,
      reminderCount: countRemindersOnDay(ts),
      timestamp: ts
    })
  }

  return days
})

const dayReminders = computed(() => {
  if (!selectedDate.value) return []
  const start = selectedDate.value.timestamp
  const end = start + 24 * 60 * 60 * 1000
  return reminders.value.filter((r) => {
    if (r.isDeleted) return false
    const t = r.remindAt || r.dueAt
    if (!t) return false
    return t >= start && t < end
  })
})

function countRemindersOnDay(timestamp: number): number {
  const start = timestamp
  const end = start + 24 * 60 * 60 * 1000
  return reminders.value.filter((r) => {
    if (r.isDeleted) return false
    const t = r.remindAt || r.dueAt
    if (!t) return false
    return t >= start && t < end
  }).length
}

function prevMonth(): void {
  if (month.value === 0) {
    month.value = 11
    year.value--
  } else {
    month.value--
  }
}

function nextMonth(): void {
  if (month.value === 11) {
    month.value = 0
    year.value++
  } else {
    month.value++
  }
}

function goToday(): void {
  const t = new Date()
  year.value = t.getFullYear()
  month.value = t.getMonth()
  const ts = new Date(t.getFullYear(), t.getMonth(), t.getDate()).getTime()
  selectedDate.value = {
    year: t.getFullYear(),
    month: t.getMonth(),
    date: t.getDate(),
    currentMonth: true,
    isToday: true,
    isSelected: true,
    reminderCount: countRemindersOnDay(ts),
    timestamp: ts
  }
}

function selectDate(day: CalendarDay): void {
  selectedDate.value = { ...day, isSelected: true }
}

async function toggleReminder(reminder: Reminder): Promise<void> {
  try {
    if (reminder.isCompleted) {
      await window.api.reminders.uncomplete(reminder.id)
    } else {
      await window.api.reminders.complete(reminder.id)
    }
    await loadReminders()
  } catch (err) {
    console.warn('[Calendar] 操作失败:', err)
  }
}

const formatTime = formatClock

async function loadReminders(): Promise<void> {
  try {
    reminders.value = (await window.api.reminders.list({ isDeleted: false })) as Reminder[]
  } catch (err) {
    console.warn('[Calendar] 加载提醒失败:', err)
  }
}

onMounted(() => {
  void loadReminders()
  // 默认选中今天
  goToday()
})
</script>

<style scoped lang="less">
.calendar-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 12px;
  gap: 8px;
}

.cal-header {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cal-nav-btn {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--launcher-text-muted);
  cursor: pointer;
  border-radius: 6px;

  &:hover {
    background: var(--launcher-result-hover);
    color: var(--launcher-text);
  }
}

.cal-title {
  flex: 1;
  text-align: center;
  font-size: 14px;
  font-weight: 600;
  color: var(--launcher-text);
}

.cal-today-btn {
  padding: 4px 10px;
  border: 1px solid var(--launcher-border);
  background: transparent;
  color: var(--launcher-text-muted);
  font-size: 11px;
  cursor: pointer;
  border-radius: 6px;

  &:hover {
    border-color: var(--launcher-accent);
    color: var(--launcher-accent);
  }
}

.cal-weekdays {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-weekday {
  text-align: center;
  font-size: 11px;
  font-weight: 500;
  color: var(--launcher-text-muted);
  padding: 4px 0;
}

.cal-grid {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 2px;
}

.cal-day {
  aspect-ratio: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  border-radius: 6px;
  cursor: pointer;
  position: relative;
  gap: 2px;

  &:hover {
    background: var(--launcher-result-hover);
  }

  &.other-month {
    opacity: 0.3;
  }

  &.today {
    background: var(--launcher-accent-bg);
    .cal-day-num {
      color: var(--launcher-accent);
      font-weight: 700;
    }
  }

  &.selected {
    background: var(--launcher-accent);
    .cal-day-num {
      color: #fff;
      font-weight: 700;
    }
    .cal-dot {
      background: #fff;
    }
  }
}

.cal-day-num {
  font-size: 12px;
  color: var(--launcher-text);
}

.cal-day-dots {
  display: flex;
  gap: 2px;
}

.cal-dot {
  width: 4px;
  height: 4px;
  border-radius: 50%;
  background: var(--launcher-accent);
}

.cal-reminders {
  margin-top: 8px;
  padding-top: 8px;
  border-top: 1px solid var(--launcher-border);
  max-height: 160px;
  overflow-y: auto;
}

.cal-reminders-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--launcher-text);
  margin-bottom: 8px;
}

.cal-reminders-empty {
  font-size: 12px;
  color: var(--launcher-text-faint);
  padding: 8px 0;
  text-align: center;
}

.cal-reminder-item {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 6px 8px;
  border-radius: 6px;

  &:hover {
    background: var(--launcher-result-hover);
  }
}

.cal-reminder-check {
  flex-shrink: 0;
  width: 20px;
  height: 20px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--launcher-text-muted);
}

.cal-reminder-content {
  flex: 1;
  min-width: 0;

  &.completed .cal-reminder-title {
    text-decoration: line-through;
    color: var(--launcher-text-faint);
  }
}

.cal-reminder-title {
  font-size: 12px;
  color: var(--launcher-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.cal-reminder-time {
  font-size: 10px;
  color: var(--launcher-text-muted);
  margin-top: 2px;
}
</style>
