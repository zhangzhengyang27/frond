<template>
  <CapsulePage :hints="hints">
    <div class="sched">
      <div v-if="auth === 'denied'" class="sched-empty">
        日历访问被拒绝：系统设置 → 隐私与安全性 → 日历，允许本应用后重试
      </div>
      <div v-else-if="loading" class="sched-empty">加载日程中…</div>
      <div v-else-if="groups.length === 0" class="sched-empty">
        {{
          auth === 'authorized' ? '未来 7 天没有日程' : '日历尚未授权：回车或点击下方按钮发起授权'
        }}
        <button
          v-if="auth === 'notDetermined'"
          class="sched-auth-btn"
          type="button"
          @click="requestAccess"
        >
          发起日历授权
        </button>
      </div>
      <div v-else class="sched-body">
        <!-- 左栏：按天分组列表 -->
        <div class="sched-list">
          <div v-for="group in groups" :key="group.label" class="sched-group">
            <div class="sched-day">{{ group.label }}</div>
            <div
              v-for="item in group.items"
              :key="item.startMs + item.title"
              class="sched-item"
              :class="{ selected: selectedItem === item }"
              @mouseenter="selectedItem = item"
              @click="openMeeting(item)"
            >
              <div class="sched-item-main">
                <div class="sched-title">
                  <span v-if="item.isAllDay" class="sched-allday">全天</span>
                  {{ item.title }}
                </div>
                <div class="sched-sub">{{ timeRange(item) }}</div>
              </div>
              <span v-if="item.meeting" class="sched-meeting-badge">会议</span>
            </div>
          </div>
        </div>
        <!-- 右栏：详情 -->
        <div class="sched-detail">
          <template v-if="selectedItem">
            <div class="sched-detail-title">{{ selectedItem.title }}</div>
            <div class="sched-detail-row">
              <span class="k">时间</span>
              <span>{{ detailTime(selectedItem) }}</span>
            </div>
            <div class="sched-detail-row">
              <span class="k">会议</span>
              <span>{{ selectedItem.meeting ? selectedItem.meeting.provider : '—' }}</span>
            </div>
            <button
              v-if="selectedItem.meeting"
              class="sched-join-btn"
              type="button"
              @click="openMeeting(selectedItem)"
            >
              入会
            </button>
          </template>
          <div v-else class="sched-empty">选择左侧日程查看详情</div>
        </div>
      </div>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
/**
 * My Schedule 内联页（V4 P0-1 批次4 第二档）：未来 7 天日程按天分组，
 * ↑↓ 选择、回车入会（有会议链接时）；denied / notDetermined 给出授权引导。
 */
import { onMounted, ref } from 'vue'
import { beginBusy, endBusy } from '../composables/useLauncherBusy'
import CapsulePage from './CapsulePage.vue'
import { groupSchedule, timeRange, type ScheduleEvent, type ScheduleGroup } from './scheduleLogic'
import { isOpenUrlAllowed } from '@shared/openUrl'

const emit = defineEmits<{ close: [] }>()

const loading = ref(true)
const auth = ref<'authorized' | 'denied' | 'notDetermined' | 'unsupported'>('authorized')
const groups = ref<ScheduleGroup[]>([])
const flat = ref<ScheduleEvent[]>([])
const selectedItem = ref<ScheduleEvent | null>(null)

const hints = [
  { keys: '↑↓', label: '选择' },
  { keys: '↵', label: '入会' },
  { keys: 'ESC', label: '返回' }
]

async function load(): Promise<void> {
  beginBusy() // I9 统一加载态
  try {
    const result = await window.api.calendar.schedule()
    auth.value = result.auth
    flat.value = result.events
    groups.value = groupSchedule(result.events, new Date())
    selectedItem.value = groups.value[0]?.items[0] ?? null
  } finally {
    loading.value = false
    endBusy()
  }
}

async function requestAccess(): Promise<void> {
  await window.api.calendar.requestAccess()
  await load()
}

function openMeeting(item: ScheduleEvent): void {
  if (!item.meeting) return
  if (!isOpenUrlAllowed(item.meeting.url)) return
  void window.api.system.openExternal(item.meeting.url)
  emit('close')
}

function detailTime(item: ScheduleEvent): string {
  const d = new Date(item.startMs)
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, '0')}/${String(d.getDate()).padStart(2, '0')} ${timeRange(item)}`
}

function moveSelection(delta: number): void {
  if (flat.value.length === 0) return
  const idx = selectedItem.value ? flat.value.indexOf(selectedItem.value) : -1
  const next = idx === -1 ? 0 : (idx + delta + flat.value.length) % flat.value.length
  selectedItem.value = flat.value[next]
}

function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    moveSelection(1)
    return true
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    moveSelection(-1)
    return true
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    if (selectedItem.value) openMeeting(selectedItem.value)
    return true
  }
  return false
}

defineExpose({ handleKey })

onMounted(() => {
  void load()
})
</script>

<style scoped>
.sched {
  display: flex;
  min-height: 0;
  flex: 1;
  height: 100%;
}

.sched-empty {
  padding: 24px 16px;
  color: var(--launcher-text-muted);
  font-size: 12px;
  text-align: center;
  width: 100%;
}

.sched-auth-btn {
  display: block;
  margin: 10px auto 0;
  padding: 4px 12px;
  border: 1px solid var(--launcher-border);
  border-radius: 6px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text);
  cursor: pointer;
  font-size: 11px;
}

.sched-body {
  display: flex;
  min-height: 0;
  flex: 1;
}

.sched-list {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  border-right: 1px solid var(--launcher-border);
}

.sched-day {
  padding: 5px 12px;
  border-bottom: 1px solid var(--launcher-border);
  color: var(--launcher-text-muted);
  font-size: 10px;
}

.sched-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 6px 12px;
  cursor: pointer;
}

.sched-item.selected {
  background: var(--launcher-accent-soft);
}

.sched-item-main {
  min-width: 0;
  flex: 1;
}

.sched-title {
  overflow: hidden;
  color: var(--launcher-text);
  font-size: 12px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.sched-allday {
  margin-right: 4px;
  padding: 0 4px;
  border-radius: 4px;
  background: var(--launcher-accent-soft);
  color: var(--launcher-text-dim);
  font-size: 10px;
}

.sched-sub {
  margin-top: 1px;
  color: var(--launcher-text-muted);
  font-size: 10px;
}

.sched-meeting-badge {
  flex-shrink: 0;
  padding: 1px 6px;
  border-radius: 999px;
  background: var(--launcher-accent-soft);
  color: #2f7fe0;
  font-size: 10px;
}

.sched-detail {
  display: flex;
  width: 260px;
  flex-shrink: 0;
  flex-direction: column;
  gap: 8px;
  padding: 12px;
}

.sched-detail-title {
  color: var(--launcher-text);
  font-size: 13px;
  font-weight: 500;
  word-break: break-word;
}

.sched-detail-row {
  color: var(--launcher-text-dim);
  font-size: 11px;
}

.sched-detail-row .k {
  margin-right: 6px;
  color: var(--launcher-text-muted);
}

.sched-join-btn {
  align-self: flex-start;
  padding: 4px 14px;
  border: none;
  border-radius: 6px;
  background: var(--launcher-accent);
  color: #fff;
  cursor: pointer;
  font-size: 11px;
}
</style>
