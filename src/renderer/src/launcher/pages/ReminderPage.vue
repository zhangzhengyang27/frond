<template>
  <div class="reminder-page">
    <!-- 新建提醒输入区 -->
    <div class="reminder-create">
      <input
        v-model="newTitle"
        class="reminder-create-input"
        type="text"
        placeholder="创建提醒…（支持自然语言，如「明天下午3点开会」）"
        @keydown.enter="createReminder"
      />
      <button
        class="reminder-time-btn"
        :class="{ active: showTimePicker }"
        title="设置提醒时间"
        @mousedown.prevent="showTimePicker = !showTimePicker"
      >
        <AppIcon icon="alarm-line" :size="16" />
      </button>
      <button class="reminder-create-btn" title="创建提醒" @mousedown.prevent="createReminder">
        <AppIcon icon="add-line" :size="16" />
      </button>
    </div>

    <!-- 提醒时间选择 -->
    <div v-if="showTimePicker" class="reminder-time-picker">
      <select v-model="quickTime" class="reminder-time-select" @change="onQuickTimeChange">
        <option value="">不提醒</option>
        <option value="1h">1 小时后</option>
        <option value="3h">3 小时后</option>
        <option value="tomorrow9">明天上午 9 点</option>
        <option value="tomorrow14">明天下午 2 点</option>
        <option value="custom">自定义…</option>
      </select>
      <input
        v-if="quickTime === 'custom'"
        v-model="customTime"
        type="datetime-local"
        class="reminder-time-custom"
      />
    </div>

    <!-- 标签切换 -->
    <div class="reminder-tabs">
      <button
        class="reminder-tab"
        :class="{ active: activeTab === 'active' }"
        @mousedown.prevent="activeTab = 'active'"
      >
        未完成 <span class="reminder-tab-count">{{ activeReminders.length }}</span>
      </button>
      <button
        class="reminder-tab"
        :class="{ active: activeTab === 'completed' }"
        @mousedown.prevent="activeTab = 'completed'"
      >
        已完成 <span class="reminder-tab-count">{{ completedReminders.length }}</span>
      </button>
    </div>

    <!-- 提醒列表 -->
    <div class="reminder-list">
      <div v-if="displayList.length === 0" class="reminder-empty">
        <AppIcon icon="alarm-line" :size="32" />
        <div class="reminder-empty-text">
          {{ activeTab === 'active' ? '暂无待办提醒' : '暂无已完成提醒' }}
        </div>
      </div>

      <div
        v-for="reminder in displayList"
        :key="reminder.id"
        class="reminder-item"
        :class="{ completed: reminder.isCompleted, overdue: isOverdue(reminder) }"
      >
        <button
          class="reminder-checkbox"
          @mousedown.prevent="toggleComplete(reminder.id, reminder.isCompleted)"
        >
          <AppIcon v-if="reminder.isCompleted" icon="checkbox-circle-fill" :size="18" />
          <AppIcon v-else icon="checkbox-circle-line" :size="18" />
        </button>

        <div class="reminder-content">
          <div class="reminder-title">{{ reminder.title }}</div>
          <div v-if="reminder.notes" class="reminder-notes">{{ reminder.notes }}</div>
          <div v-if="reminder.remindAt" class="reminder-time">
            <AppIcon icon="alarm-line" :size="12" />
            <span :class="{ overdue: isOverdue(reminder) }">{{
              formatTime(reminder.remindAt)
            }}</span>
          </div>
        </div>

        <button class="reminder-delete" @mousedown.prevent="removeReminder(reminder.id)">
          <AppIcon icon="delete-bin-line" :size="14" />
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import AppIcon from '@renderer/components/AppIcon.vue'

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

const props = defineProps<{ query?: string }>()

const newTitle = ref('')
const showTimePicker = ref(false)
const quickTime = ref('')
const customTime = ref('')
const activeTab = ref<'active' | 'completed'>('active')
const reminders = ref<Reminder[]>([])

const activeReminders = computed(() =>
  reminders.value.filter((r) => !r.isCompleted && !r.isDeleted)
)
const completedReminders = computed(() =>
  reminders.value.filter((r) => r.isCompleted && !r.isDeleted)
)

const displayList = computed(() =>
  activeTab.value === 'active' ? activeReminders.value : completedReminders.value
)

async function loadReminders(): Promise<void> {
  try {
    // 搜索词交给主进程：FTS5 全文搜索（中文子串有 LIKE 兜底）
    const filter: Record<string, unknown> = { isDeleted: false }
    const q = props.query?.trim()
    if (q) filter.search = q
    reminders.value = (await window.api.reminders.list(filter)) as Reminder[]
  } catch (err) {
    console.warn('[Reminder] 加载失败:', err)
  }
}

function parseNaturalLanguage(text: string): { title: string; remindAt: number | null } {
  const now = new Date()
  let remindAt: number | null = null
  let title = text.trim()

  // 简单的自然语言解析
  const tomorrowMatch = text.match(/明天(上午|下午|早上|晚上)?(\d{1,2})[点:：](\d{2})?/)
  if (tomorrowMatch) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    const period = tomorrowMatch[1] || ''
    let hour = parseInt(tomorrowMatch[2])
    const minute = tomorrowMatch[3] ? parseInt(tomorrowMatch[3]) : 0
    if ((period === '下午' || period === '晚上') && hour < 12) hour += 12
    if ((period === '早上' || period === '上午') && hour === 12) hour = 0
    d.setHours(hour, minute, 0, 0)
    remindAt = d.getTime()
    title = text.replace(tomorrowMatch[0], '').trim()
  }

  // "今天下午3点"
  const todayMatch = text.match(/今天(上午|下午|早上|晚上)?(\d{1,2})[点:：](\d{2})?/)
  if (todayMatch && !remindAt) {
    const d = new Date(now)
    const period = todayMatch[1] || ''
    let hour = parseInt(todayMatch[2])
    const minute = todayMatch[3] ? parseInt(todayMatch[3]) : 0
    if ((period === '下午' || period === '晚上') && hour < 12) hour += 12
    if ((period === '早上' || period === '上午') && hour === 12) hour = 0
    d.setHours(hour, minute, 0, 0)
    if (d.getTime() > now.getTime()) {
      remindAt = d.getTime()
      title = text.replace(todayMatch[0], '').trim()
    }
  }

  // "1小时后" / "30分钟后"
  const durationMatch = text.match(/(\d+)(小时|分钟|天)后/)
  if (durationMatch && !remindAt) {
    const num = parseInt(durationMatch[1])
    const unit = durationMatch[2]
    const d = new Date(now)
    if (unit === '小时') d.setHours(d.getHours() + num)
    else if (unit === '分钟') d.setMinutes(d.getMinutes() + num)
    else if (unit === '天') d.setDate(d.getDate() + num)
    remindAt = d.getTime()
    title = text.replace(durationMatch[0], '').trim()
  }

  // ── 英文自然语言解析 ──

  // "tomorrow 3pm" / "tomorrow at 3pm" / "tomorrow 15:00" / "tomorrow 9:30am"
  const enTomorrowMatch = text.match(/\btomorrow\b.*?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (enTomorrowMatch && !remindAt) {
    const d = new Date(now)
    d.setDate(d.getDate() + 1)
    let hour = parseInt(enTomorrowMatch[1])
    const minute = enTomorrowMatch[2] ? parseInt(enTomorrowMatch[2]) : 0
    const period = enTomorrowMatch[3]?.toLowerCase()
    if (period === 'pm' && hour < 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0
    d.setHours(hour, minute, 0, 0)
    remindAt = d.getTime()
    title = text.replace(enTomorrowMatch[0], '').trim()
  }

  // "today 3pm" / "today at 3pm" / "3pm"（今天，如果已过则明天）
  const enTodayMatch = text.match(/(?:\btoday\b\s+)?(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/i)
  if (enTodayMatch && !remindAt) {
    const d = new Date(now)
    let hour = parseInt(enTodayMatch[1])
    const minute = enTodayMatch[2] ? parseInt(enTodayMatch[2]) : 0
    const period = enTodayMatch[3]?.toLowerCase()
    if (period === 'pm' && hour < 12) hour += 12
    if (period === 'am' && hour === 12) hour = 0
    d.setHours(hour, minute, 0, 0)
    // 如果时间已过，设为明天
    if (d.getTime() <= now.getTime()) {
      d.setDate(d.getDate() + 1)
    }
    remindAt = d.getTime()
    title = text.replace(enTodayMatch[0], '').trim()
  }

  // "in 1 hour" / "in 30 minutes" / "in 2 days"
  const enDurationMatch = text.match(/\bin\s+(\d+)\s+(hour|hours|minute|minutes|day|days)\b/i)
  if (enDurationMatch && !remindAt) {
    const num = parseInt(enDurationMatch[1])
    const unit = enDurationMatch[2].toLowerCase()
    const d = new Date(now)
    if (unit.startsWith('hour')) d.setHours(d.getHours() + num)
    else if (unit.startsWith('minute')) d.setMinutes(d.getMinutes() + num)
    else if (unit.startsWith('day')) d.setDate(d.getDate() + num)
    remindAt = d.getTime()
    title = text.replace(enDurationMatch[0], '').trim()
  }

  return { title: title || text, remindAt }
}

function onQuickTimeChange(): void {
  if (quickTime.value === 'custom') return
  // 选择快捷时间后自动创建
  if (newTitle.value.trim()) createReminder()
}

function computeRemindAt(): number | null {
  const now = Date.now()
  switch (quickTime.value) {
    case '1h':
      return now + 60 * 60 * 1000
    case '3h':
      return now + 3 * 60 * 60 * 1000
    case 'tomorrow9': {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(9, 0, 0, 0)
      return d.getTime()
    }
    case 'tomorrow14': {
      const d = new Date()
      d.setDate(d.getDate() + 1)
      d.setHours(14, 0, 0, 0)
      return d.getTime()
    }
    case 'custom':
      return customTime.value ? new Date(customTime.value).getTime() : null
    default:
      return null
  }
}

async function createReminder(): Promise<void> {
  const title = newTitle.value.trim()
  if (!title) return

  // 先解析自然语言
  const parsed = parseNaturalLanguage(title)
  let remindAt = parsed.remindAt

  // 如果用户手动选择了时间，覆盖自然语言解析
  if (quickTime.value) {
    remindAt = computeRemindAt()
  }

  try {
    await window.api.reminders.create({
      title: parsed.title,
      remindAt
    })
    newTitle.value = ''
    quickTime.value = ''
    customTime.value = ''
    showTimePicker.value = false
    await loadReminders()
  } catch (err) {
    console.warn('[Reminder] 创建失败:', err)
  }
}

async function toggleComplete(id: string, isCompleted: boolean): Promise<void> {
  try {
    if (isCompleted) {
      await window.api.reminders.uncomplete(id)
    } else {
      await window.api.reminders.complete(id)
    }
    await loadReminders()
  } catch (err) {
    console.warn('[Reminder] 操作失败:', err)
  }
}

async function removeReminder(id: string): Promise<void> {
  try {
    await window.api.reminders.remove(id)
    await loadReminders()
  } catch (err) {
    console.warn('[Reminder] 删除失败:', err)
  }
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const isToday = d.toDateString() === now.toDateString()
  const tomorrow = new Date(now)
  tomorrow.setDate(tomorrow.getDate() + 1)
  const isTomorrow = d.toDateString() === tomorrow.toDateString()

  const time = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (isToday) return `今天 ${time}`
  if (isTomorrow) return `明天 ${time}`
  return `${d.getMonth() + 1}月${d.getDate()}日 ${time}`
}

function isOverdue(reminder: Reminder): boolean {
  return !reminder.isCompleted && reminder.remindAt !== null && reminder.remindAt < Date.now()
}

onMounted(() => {
  void loadReminders()
})

// 胶囊搜索词变化 → 重新走后端检索（Raycast 式：页内搜索跟随根搜索框）
watch(
  () => props.query,
  () => {
    void loadReminders()
  }
)
</script>

<style scoped lang="less">
.reminder-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  padding: 8px 12px;
  gap: 8px;
}

.reminder-create {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reminder-create-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--launcher-border);
  border-radius: 8px;
  background: var(--launcher-input-bg);
  color: var(--launcher-text);
  font-size: 13px;
  outline: none;

  &:focus {
    border-color: var(--launcher-accent);
  }
}

.reminder-create-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 8px;
  background: var(--launcher-accent);
  color: #fff;
  cursor: pointer;

  &:hover {
    opacity: 0.9;
  }
}

.reminder-time-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--launcher-border);
  border-radius: 8px;
  background: transparent;
  color: var(--launcher-text-muted);
  cursor: pointer;

  &:hover {
    border-color: var(--launcher-accent);
    color: var(--launcher-accent);
  }

  &.active {
    border-color: var(--launcher-accent);
    color: var(--launcher-accent);
    background: var(--launcher-accent-bg);
  }
}

.reminder-time-picker {
  display: flex;
  align-items: center;
  gap: 8px;
}

.reminder-time-select,
.reminder-time-custom {
  padding: 6px 10px;
  border: 1px solid var(--launcher-border);
  border-radius: 6px;
  background: var(--launcher-input-bg);
  color: var(--launcher-text);
  font-size: 12px;
}

.reminder-tabs {
  display: flex;
  gap: 4px;
  border-bottom: 1px solid var(--launcher-border);
  padding-bottom: 4px;
}

.reminder-tab {
  padding: 6px 12px;
  border: none;
  background: transparent;
  color: var(--launcher-text-muted);
  font-size: 12px;
  cursor: pointer;
  border-radius: 6px;
  display: flex;
  align-items: center;
  gap: 6px;

  &.active {
    color: var(--launcher-accent);
    background: var(--launcher-accent-bg);
  }
}

.reminder-tab-count {
  font-size: 10px;
  background: var(--launcher-badge-bg);
  padding: 1px 6px;
  border-radius: 8px;
}

.reminder-list {
  flex: 1;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.reminder-empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  color: var(--launcher-text-faint);
  gap: 12px;
}

.reminder-empty-text {
  font-size: 13px;
}

.reminder-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 10px 12px;
  border-radius: 8px;
  cursor: pointer;
  transition: background 0.12s;

  &:hover {
    background: var(--launcher-result-hover);
  }

  &.completed .reminder-title {
    text-decoration: line-through;
    color: var(--launcher-text-faint);
  }

  &.overdue .reminder-title {
    color: var(--launcher-danger, #ea6668);
  }
}

.reminder-checkbox {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--launcher-text-muted);

  &:hover {
    color: var(--launcher-accent);
  }
}

.reminder-content {
  flex: 1;
  min-width: 0;
}

.reminder-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  word-break: break-word;
}

.reminder-notes {
  font-size: 11px;
  color: var(--launcher-text-muted);
  margin-top: 2px;
  word-break: break-word;
}

.reminder-time {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: var(--launcher-text-muted);
  margin-top: 4px;

  .overdue {
    color: var(--launcher-danger, #ea6668);
  }
}

.reminder-delete {
  flex-shrink: 0;
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  cursor: pointer;
  color: var(--launcher-text-faint);
  opacity: 0;
  transition: opacity 0.12s;

  .reminder-item:hover & {
    opacity: 1;
  }

  &:hover {
    color: var(--launcher-danger, #ea6668);
  }
}
</style>
