<template>
  <div class="floating-note">
    <!-- 标题栏（可拖动，CSS -webkit-app-region: drag） -->
    <div class="fn-header">
      <div class="fn-title">
        <AppIcon icon="sticky-note-line" :size="14" />
        <span>浮动笔记</span>
      </div>
      <div class="fn-actions">
        <button class="fn-btn" title="新建笔记" @mousedown.stop="createNewNote">
          <AppIcon icon="add-line" :size="14" />
        </button>
        <button class="fn-btn" title="关闭" @mousedown.stop="closeWindow">
          <AppIcon icon="close-line" :size="14" />
        </button>
      </div>
    </div>

    <!-- 笔记列表（可折叠） -->
    <div v-if="showList" class="fn-list">
      <div
        v-for="note in recentNotes"
        :key="note.id"
        class="fn-list-item"
        :class="{ active: note.id === currentNote?.id }"
        @mousedown.stop="selectNote(note.id)"
      >
        <span class="fn-list-title">{{ note.title || '无标题' }}</span>
        <span class="fn-list-time">{{ formatTime(note.updatedAt) }}</span>
      </div>
      <div v-if="recentNotes.length === 0" class="fn-list-empty">暂无笔记</div>
    </div>

    <!-- 编辑区 -->
    <div class="fn-editor">
      <input
        v-model="title"
        class="fn-title-input"
        type="text"
        placeholder="笔记标题…"
        @input="scheduleSave"
      />
      <textarea
        v-model="content"
        class="fn-content-input"
        placeholder="开始记录…（支持 Markdown）"
        @input="scheduleSave"
        @keydown.esc="closeWindow"
      />
    </div>

    <!-- 底部状态栏 -->
    <div class="fn-footer">
      <span class="fn-status">{{ saveStatus }}</span>
      <button class="fn-list-toggle" @mousedown.stop="showList = !showList">
        <AppIcon :icon="showList ? 'arrow-up-s-line' : 'arrow-down-s-line'" :size="12" />
        <span>最近笔记</span>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted } from 'vue'
import AppIcon from '@renderer/components/AppIcon.vue'

interface Note {
  id: string
  title: string
  content: string
  folderId: string | null
  isPinned: boolean
  isDeleted: boolean
  createdAt: number
  updatedAt: number
}

const title = ref('')
const content = ref('')
const currentNote = ref<Note | null>(null)
const recentNotes = ref<Note[]>([])
const showList = ref(false)
const saveStatus = ref('')
let saveTimer: ReturnType<typeof setTimeout> | null = null

async function loadRecentNotes(): Promise<void> {
  try {
    const notes = (await window.api.notes.list({ isDeleted: false })) as Note[]
    recentNotes.value = notes.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 10)
  } catch (err) {
    console.warn('[FloatingNote] 加载笔记失败:', err)
  }
}

async function selectNote(id: string): Promise<void> {
  try {
    const note = (await window.api.notes.get(id)) as Note | null
    if (note) {
      currentNote.value = note
      title.value = note.title
      content.value = note.content
      showList.value = false
    }
  } catch (err) {
    console.warn('[FloatingNote] 加载笔记失败:', err)
  }
}

async function createNewNote(): Promise<void> {
  try {
    const note = (await window.api.notes.create({ title: '', content: '' })) as Note
    currentNote.value = note
    title.value = ''
    content.value = ''
    await loadRecentNotes()
  } catch (err) {
    console.warn('[FloatingNote] 创建笔记失败:', err)
  }
}

function scheduleSave(): void {
  saveStatus.value = '编辑中…'
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    void saveNote()
  }, 800)
}

async function saveNote(): Promise<void> {
  if (!currentNote.value) {
    // 没有当前笔记时自动创建
    try {
      const note = (await window.api.notes.create({
        title: title.value,
        content: content.value
      })) as Note
      currentNote.value = note
      await loadRecentNotes()
      saveStatus.value = '已保存'
      setTimeout(() => (saveStatus.value = ''), 2000)
      return
    } catch (err) {
      console.warn('[FloatingNote] 自动创建失败:', err)
      return
    }
  }

  try {
    await window.api.notes.update(currentNote.value.id, {
      title: title.value,
      content: content.value
    })
    await loadRecentNotes()
    saveStatus.value = '已保存'
    setTimeout(() => (saveStatus.value = ''), 2000)
  } catch (err) {
    console.warn('[FloatingNote] 保存失败:', err)
    saveStatus.value = '保存失败'
  }
}

function closeWindow(): void {
  void saveNote()
  setTimeout(() => {
    void window.api.floatingNote.hide()
  }, 100)
}

function formatTime(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  }
  return `${d.getMonth() + 1}/${d.getDate()}`
}

onMounted(async () => {
  await loadRecentNotes()
  // 默认打开最近的笔记，或者新建一个
  if (recentNotes.value.length > 0) {
    await selectNote(recentNotes.value[0].id)
  }
})

onUnmounted(() => {
  if (saveTimer) clearTimeout(saveTimer)
  void saveNote()
})
</script>

<style scoped lang="less">
.floating-note {
  display: flex;
  flex-direction: column;
  height: 100vh;
  background: var(--bg-color, #ffffff);
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
}

.fn-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  background: var(--bg-secondary, #f5f5f5);
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  -webkit-app-region: drag;
  cursor: move;
  user-select: none;
}

.fn-title {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  font-weight: 600;
  color: var(--text-primary, #333);
}

.fn-actions {
  display: flex;
  gap: 4px;
  -webkit-app-region: no-drag;
}

.fn-btn {
  width: 24px;
  height: 24px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666);
  cursor: pointer;
  border-radius: 4px;

  &:hover {
    background: var(--bg-hover, #e8e8e8);
    color: var(--text-primary, #333);
  }
}

.fn-list {
  max-height: 160px;
  overflow-y: auto;
  border-bottom: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-tertiary, #fafafa);
}

.fn-list-item {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  cursor: pointer;
  font-size: 12px;

  &:hover {
    background: var(--bg-hover, #e8e8e8);
  }

  &.active {
    background: var(--accent-bg, #e3f2fd);
    color: var(--accent, #1976d2);
  }
}

.fn-list-title {
  flex: 1;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.fn-list-time {
  font-size: 10px;
  color: var(--text-muted, #999);
  flex-shrink: 0;
  margin-left: 8px;
}

.fn-list-empty {
  padding: 16px;
  text-align: center;
  font-size: 12px;
  color: var(--text-muted, #999);
}

.fn-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  padding: 8px 12px;
  gap: 8px;
  overflow: hidden;
}

.fn-title-input {
  border: none;
  outline: none;
  font-size: 14px;
  font-weight: 600;
  color: var(--text-primary, #333);
  background: transparent;
  padding: 4px 0;
}

.fn-content-input {
  flex: 1;
  border: none;
  outline: none;
  font-size: 13px;
  line-height: 1.6;
  color: var(--text-primary, #333);
  background: transparent;
  resize: none;
  font-family: inherit;
}

.fn-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-top: 1px solid var(--border-color, #e0e0e0);
  background: var(--bg-secondary, #f5f5f5);
}

.fn-status {
  font-size: 10px;
  color: var(--text-muted, #999);
}

.fn-list-toggle {
  display: flex;
  align-items: center;
  gap: 4px;
  border: none;
  background: transparent;
  color: var(--text-secondary, #666);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;

  &:hover {
    background: var(--bg-hover, #e8e8e8);
  }
}
</style>
