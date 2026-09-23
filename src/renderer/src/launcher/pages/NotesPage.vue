<template>
  <div class="notes-page">
    <div class="notes-body">
      <!-- 侧边栏：文件夹 + 笔记列表 -->
      <div class="notes-sidebar">
        <div class="notes-sidebar-header">
          <button class="notes-new-btn" @mousedown.prevent="createNote">
            <AppIcon icon="file-add-line" :size="14" />
            <span>新建笔记</span>
          </button>
        </div>

        <!-- 视图切换 -->
        <div class="notes-views">
          <button
            class="notes-view-btn"
            :class="{ active: currentView === 'all' }"
            @mousedown.prevent="switchView('all')"
          >
            <AppIcon icon="file-text-line" :size="14" />
            <span>全部</span>
            <span class="notes-count">{{ stats.total }}</span>
          </button>
          <button
            class="notes-view-btn"
            :class="{ active: currentView === 'pinned' }"
            @mousedown.prevent="switchView('pinned')"
          >
            <AppIcon icon="pushpin-line" :size="14" />
            <span>置顶</span>
            <span class="notes-count">{{ stats.pinned }}</span>
          </button>
          <button
            class="notes-view-btn"
            :class="{ active: currentView === 'trash' }"
            @mousedown.prevent="switchView('trash')"
          >
            <AppIcon icon="delete-bin-line" :size="14" />
            <span>回收站</span>
            <span class="notes-count">{{ stats.trash }}</span>
          </button>
        </div>

        <!-- 文件夹列表 -->
        <div v-if="folders.length > 0" class="notes-folders">
          <div class="notes-folders-title">文件夹</div>
          <button
            v-for="f in folders"
            :key="f.id"
            class="notes-folder-btn"
            :class="{ active: currentView === 'folder' && currentFolderId === f.id }"
            @mousedown.prevent="selectFolder(f.id)"
          >
            <AppIcon icon="folder-line" :size="14" />
            <span class="notes-folder-name">{{ f.name }}</span>
          </button>
        </div>

        <!-- 笔记列表 -->
        <div class="notes-list">
          <div
            v-for="note in notes"
            :key="note.id"
            class="notes-item"
            :class="{ active: currentNoteId === note.id, pinned: note.isPinned }"
            @mousedown.prevent="selectNote(note.id)"
          >
            <div class="notes-item-title">
              <AppIcon v-if="note.isPinned" icon="pushpin-fill" :size="10" class="notes-pin-icon" />
              <span>{{ note.title || '无标题' }}</span>
            </div>
            <div class="notes-item-preview">{{ note.content.slice(0, 60) || '空笔记' }}</div>
            <div class="notes-item-time">{{ formatTime(note.updatedAt) }}</div>
          </div>
          <div v-if="notes.length === 0" class="notes-empty">
            {{ currentView === 'trash' ? '回收站为空' : '暂无笔记，点击上方新建' }}
          </div>
        </div>
      </div>

      <!-- 编辑区 -->
      <div class="notes-editor">
        <template v-if="currentNote">
          <div class="notes-editor-toolbar">
            <input
              v-model="editTitle"
              class="notes-title-input"
              type="text"
              placeholder="笔记标题"
              @blur="saveNote"
            />
            <div class="notes-editor-actions">
              <button
                class="notes-action-btn"
                :class="{ active: currentNote.isPinned }"
                :title="currentNote.isPinned ? '取消置顶' : '置顶'"
                @mousedown.prevent="togglePin"
              >
                <AppIcon
                  :icon="currentNote.isPinned ? 'pushpin-fill' : 'pushpin-line'"
                  :size="14"
                />
              </button>
              <button
                v-if="currentView !== 'trash'"
                class="notes-action-btn"
                title="移到回收站"
                @mousedown.prevent="trashNote"
              >
                <AppIcon icon="delete-bin-line" :size="14" />
              </button>
              <template v-else>
                <button class="notes-action-btn" title="恢复" @mousedown.prevent="restoreNote">
                  <AppIcon icon="refresh-line" :size="14" />
                </button>
                <button
                  class="notes-action-btn danger"
                  title="永久删除"
                  @mousedown.prevent="deleteNote"
                >
                  <AppIcon icon="delete-bin-2-line" :size="14" />
                </button>
              </template>
            </div>
          </div>
          <textarea
            v-model="editContent"
            class="notes-content-input"
            placeholder="开始书写 Markdown 笔记…"
            spellcheck="false"
            @blur="saveNote"
          />
          <div class="notes-editor-footer">
            <span>{{ editContent.length }} 字</span>
            <button
              v-if="editContent.trim()"
              class="notes-ai-btn"
              type="button"
              title="把笔记交给 AI 总结（⌘⇧A）"
              @mousedown.prevent="askAiSummarize"
            >
              AI 总结
            </button>
            <span>最后更新：{{ formatTime(currentNote.updatedAt) }}</span>
          </div>
        </template>
        <div v-else class="notes-editor-empty">
          <AppIcon icon="file-text-line" :size="48" />
          <div>选择或新建一篇笔记</div>
        </div>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@components/AppIcon.vue'
import { formatSmartDate } from '@utils/format'

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

interface Folder {
  id: string
  name: string
  position: number
  createdAt: number
  updatedAt: number
}

const notes = ref<Note[]>([])
const folders = ref<Folder[]>([])
const currentNoteId = ref<string | null>(null)
const currentView = ref<'all' | 'pinned' | 'trash' | 'folder'>('all')
const currentFolderId = ref<string | null>(null)
const emit = defineEmits<{ 'ask-ai': [text: string] }>()
const editTitle = ref('')
const editContent = ref('')
const stats = ref({ total: 0, trash: 0, pinned: 0 })
let saveTimer: ReturnType<typeof setTimeout> | null = null

const currentNote = computed(() => notes.value.find((n) => n.id === currentNoteId.value) ?? null)

async function loadNotes(): Promise<void> {
  try {
    let filter: Record<string, unknown> = { isDeleted: false }
    if (currentView.value === 'trash') {
      filter = { isDeleted: true }
    } else if (currentView.value === 'pinned') {
      filter = { isDeleted: false, isPinned: true }
    } else if (currentView.value === 'folder' && currentFolderId.value) {
      filter = { isDeleted: false, folderId: currentFolderId.value }
    }
    notes.value = (await window.api.notes.list(filter)) as Note[]
  } catch {
    notes.value = []
  }
}

async function loadFolders(): Promise<void> {
  try {
    folders.value = (await window.api.notes.folders()) as Folder[]
  } catch {
    folders.value = []
  }
}

async function loadStats(): Promise<void> {
  try {
    stats.value = await window.api.notes.stats()
  } catch {
    stats.value = { total: 0, trash: 0, pinned: 0 }
  }
}

function switchView(view: 'all' | 'pinned' | 'trash'): void {
  currentView.value = view
  currentFolderId.value = null
  currentNoteId.value = null
  void loadNotes()
}

function selectFolder(id: string): void {
  currentView.value = 'folder'
  currentFolderId.value = id
  currentNoteId.value = null
  void loadNotes()
}

async function createNote(): Promise<void> {
  try {
    const note = (await window.api.notes.create({ title: '', content: '' })) as Note
    currentView.value = 'all'
    currentFolderId.value = null
    await loadNotes()
    await loadStats()
    selectNote(note.id)
  } catch {
    /* ignore */
  }
}

function saveNote(): void {
  if (!currentNoteId.value) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    if (!currentNoteId.value) return
    try {
      await window.api.notes.update(currentNoteId.value, {
        title: editTitle.value,
        content: editContent.value
      })
      await loadNotes()
      await loadStats()
    } catch {
      /* ignore */
    }
  }, 300)
}

/**
 * 立即落盘待存的防抖保存并清掉定时器。
 * 必须在切换/卸载前调用：saveNote 回调触发时读取的是「当时的」
 * currentNoteId / editTitle / editContent，切换后旧笔记的待存内容
 * 会被写丢（甚至写进错误的笔记）。
 */
function flushPendingSave(refreshList: boolean): void {
  if (saveTimer) {
    clearTimeout(saveTimer)
    saveTimer = null
  } else {
    return
  }
  const id = currentNoteId.value
  if (!id) return
  void window.api.notes
    .update(id, { title: editTitle.value, content: editContent.value })
    .then(() => {
      if (refreshList) {
        void loadNotes()
        void loadStats()
      }
    })
    .catch(() => {
      /* 冲刷失败无 UI 可提示 */
    })
}

// 输入时自动保存（防抖）
watch([editTitle, editContent], () => {
  if (currentNoteId.value) saveNote()
})

// 切换笔记前冲刷上一条的待存内容
function selectNote(id: string): void {
  flushPendingSave(true)
  currentNoteId.value = id
  const note = notes.value.find((n) => n.id === id)
  if (note) {
    editTitle.value = note.title
    editContent.value = note.content
  }
}

// 卸载时把未落盘的防抖保存立即冲刷（不刷新列表——组件已卸载）
onUnmounted(() => {
  flushPendingSave(false)
})

async function togglePin(): Promise<void> {
  if (!currentNoteId.value) return
  try {
    await window.api.notes.togglePin(currentNoteId.value)
    await loadNotes()
    await loadStats()
  } catch {
    /* ignore */
  }
}

async function trashNote(): Promise<void> {
  if (!currentNoteId.value) return
  try {
    await window.api.notes.trash(currentNoteId.value)
    currentNoteId.value = null
    await loadNotes()
    await loadStats()
  } catch {
    /* ignore */
  }
}

async function restoreNote(): Promise<void> {
  if (!currentNoteId.value) return
  try {
    await window.api.notes.restore(currentNoteId.value)
    currentView.value = 'all'
    currentNoteId.value = null
    await loadNotes()
    await loadStats()
  } catch {
    /* ignore */
  }
}

async function deleteNote(): Promise<void> {
  if (!currentNoteId.value) return
  try {
    await window.api.notes.delete(currentNoteId.value)
    currentNoteId.value = null
    await loadNotes()
    await loadStats()
  } catch {
    /* ignore */
  }
}

const formatTime = formatSmartDate

/** 胶囊页键盘约定 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'Escape') return false
  if ((e.metaKey || e.ctrlKey) && e.key === 'n') {
    e.preventDefault()
    void createNote()
    return true
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 's') {
    e.preventDefault()
    saveNote()
    return true
  }
  // ⌘⇧A：AI 总结当前笔记（V4 批次5；避开编辑器 ⌘A 全选）
  if ((e.metaKey || e.ctrlKey) && e.shiftKey && (e.key === 'a' || e.key === 'A')) {
    e.preventDefault()
    askAiSummarize()
    return true
  }
  return true
}

/** AI 总结当前笔记：经 LauncherApp 通道切到 AI 页并排队发送（不要求先保存） */
function askAiSummarize(): void {
  const content = editContent.value.trim()
  if (!content) return
  emit(
    'ask-ai',
    `请总结以下笔记的核心要点：\n\n标题：${editTitle.value.trim() || '（无标题）'}\n\n${content}`
  )
}

defineExpose({ handleKey })

onMounted(() => {
  void loadNotes()
  void loadFolders()
  void loadStats()
})
</script>

<style scoped>
.notes-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.notes-body {
  flex: 1;
  min-height: 0;
  display: flex;
}

.notes-sidebar {
  width: 220px;
  border-right: 1px solid var(--launcher-hairline);
  display: flex;
  flex-direction: column;
  min-height: 0;
  flex-shrink: 0;
}

.notes-sidebar-header {
  padding: 10px;
  border-bottom: 1px solid var(--launcher-hairline);
}

.notes-new-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  width: 100%;
  padding: 7px;
  border: none;
  border-radius: 7px;
  background: var(--launcher-accent);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
}

.notes-new-btn:hover {
  background: #0066dd;
}

.notes-views {
  padding: 6px;
  border-bottom: 1px solid var(--launcher-hairline);
}

.notes-view-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 6px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text-dim);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.notes-view-btn:hover {
  background: var(--launcher-bg-elevated);
}

.notes-view-btn.active {
  background: var(--launcher-accent-soft);
  color: var(--launcher-accent);
}

.notes-count {
  margin-left: auto;
  font-size: 11px;
  color: var(--launcher-text-faint);
}

.notes-folders {
  padding: 6px;
  border-bottom: 1px solid var(--launcher-hairline);
  max-height: 150px;
  overflow-y: auto;
}

.notes-folders-title {
  font-size: 10px;
  font-weight: 600;
  color: var(--launcher-text-faint);
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 4px 8px;
}

.notes-folder-btn {
  display: flex;
  align-items: center;
  gap: 7px;
  width: 100%;
  padding: 5px 8px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text-dim);
  font-size: 12px;
  cursor: pointer;
  text-align: left;
}

.notes-folder-btn:hover {
  background: var(--launcher-bg-elevated);
}

.notes-folder-btn.active {
  background: var(--launcher-accent-soft);
  color: var(--launcher-accent);
}

.notes-folder-name {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes-list {
  flex: 1;
  overflow-y: auto;
  padding: 6px;
  min-height: 0;
}

.notes-item {
  padding: 8px 10px;
  border-radius: 7px;
  cursor: pointer;
  margin-bottom: 2px;
}

.notes-item:hover {
  background: var(--launcher-bg-elevated);
}

.notes-item.active {
  background: var(--launcher-accent-soft);
}

.notes-item-title {
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  font-weight: 500;
  color: var(--launcher-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes-pin-icon {
  color: var(--launcher-accent);
  flex-shrink: 0;
}

.notes-item-preview {
  font-size: 11px;
  color: var(--launcher-text-muted);
  margin-top: 2px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.notes-item-time {
  font-size: 10px;
  color: var(--launcher-text-faint);
  margin-top: 3px;
}

.notes-empty {
  padding: 20px 10px;
  text-align: center;
  font-size: 11px;
  color: var(--launcher-text-faint);
}

.notes-editor {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-width: 0;
  min-height: 0;
}

.notes-editor-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 14px;
  border-bottom: 1px solid var(--launcher-hairline);
}

.notes-title-input {
  flex: 1;
  border: none;
  background: transparent;
  font-size: 15px;
  font-weight: 600;
  color: var(--launcher-text);
  outline: none;
}

.notes-editor-actions {
  display: flex;
  gap: 4px;
}

.notes-action-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text-muted);
  cursor: pointer;
}

.notes-action-btn:hover {
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text);
}

.notes-action-btn.active {
  color: var(--launcher-accent);
}

.notes-action-btn.danger:hover {
  background: rgba(239, 68, 68, 0.1);
  color: #ef4444;
}

.notes-ai-btn {
  flex-shrink: 0;
  padding: 2px 8px;
  border: 1px solid var(--launcher-border);
  border-radius: 6px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text-muted);
  cursor: pointer;
  font-size: 10px;
}

.notes-ai-btn:hover {
  color: var(--launcher-text);
  border-color: var(--launcher-accent);
}

.notes-content-input {
  flex: 1;
  border: none;
  background: transparent;
  padding: 14px;
  font-size: 13px;
  line-height: 1.7;
  color: var(--launcher-text);
  outline: none;
  resize: none;
  font-family: var(--font-mono, ui-monospace, Menlo, monospace);
  min-height: 0;
}

.notes-editor-footer {
  display: flex;
  justify-content: space-between;
  padding: 6px 14px;
  border-top: 1px solid var(--launcher-hairline);
  font-size: 10px;
  color: var(--launcher-text-faint);
}

.notes-editor-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 12px;
  color: var(--launcher-text-faint);
  font-size: 13px;
}
</style>
