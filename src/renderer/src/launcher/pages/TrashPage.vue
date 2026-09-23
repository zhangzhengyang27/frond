<template>
  <div class="trash-page">
    <div v-if="loading" class="trash-loading">
      <AppIcon icon="loader-4" :size="18" class="spin" />
      <span>读取回收站…</span>
    </div>
    <div v-else-if="items.length === 0" class="trash-empty">
      <AppIcon icon="delete-bin" :size="32" />
      <span>回收站为空</span>
    </div>
    <div v-else class="trash-content">
      <div class="trash-header">
        <span>{{ items.length }} 个项目</span>
        <button class="trash-empty-btn" @click="emptyTrash">
          <AppIcon icon="delete-bin" :size="14" />
          <span>清空</span>
        </button>
      </div>
      <div class="trash-list">
        <div
          v-for="(item, index) in items"
          :key="item.path"
          class="trash-item"
          :class="{ selected: index === selectedIndex }"
          @mouseenter="selectedIndex = index"
        >
          <div class="trash-item-icon">
            <AppIcon :icon="item.type === 'folder' ? 'folder' : 'file-3'" :size="16" />
          </div>
          <div class="trash-item-info">
            <div class="trash-item-name">{{ item.name }}</div>
            <div class="trash-item-meta">
              {{ formatSize(item.size) }} · {{ formatDate(item.deletedAt) }}
            </div>
          </div>
          <div class="trash-item-actions">
            <button class="trash-action-btn" title="恢复" @click.stop="restore(item)">
              <AppIcon icon="refresh" :size="14" />
            </button>
            <button class="trash-action-btn danger" title="永久删除" @click.stop="remove(item)">
              <AppIcon icon="close" :size="14" />
            </button>
          </div>
        </div>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@components/AppIcon.vue'

interface TrashItem {
  name: string
  path: string
  size: number
  deletedAt?: number
  type: 'file' | 'folder'
}

const loading = ref(true)
const items = ref<TrashItem[]>([])
const selectedIndex = ref(0)

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`
}

function formatDate(timestamp?: number): string {
  if (!timestamp) return ''
  const d = new Date(timestamp)
  const now = new Date()
  const diff = now.getTime() - d.getTime()
  if (diff < 60000) return '刚刚'
  if (diff < 3600000) return `${Math.floor(diff / 60000)} 分钟前`
  if (diff < 86400000) return `${Math.floor(diff / 3600000)} 小时前`
  if (diff < 604800000) return `${Math.floor(diff / 86400000)} 天前`
  return `${d.getMonth() + 1}/${d.getDate()}`
}

async function loadItems(): Promise<void> {
  loading.value = true
  try {
    items.value = (await window.api.trash.list()) as TrashItem[]
  } catch (err) {
    console.warn('TrashPage: list failed', err)
  } finally {
    loading.value = false
  }
}

async function emptyTrash(): Promise<void> {
  try {
    await window.api.trash.empty()
    items.value = []
  } catch (err) {
    console.warn('TrashPage: empty failed', err)
  }
}

async function restore(item: TrashItem): Promise<void> {
  try {
    await window.api.trash.restore(item.path)
    items.value = items.value.filter((i) => i.path !== item.path)
  } catch (err) {
    console.warn('TrashPage: restore failed', err)
  }
}

async function remove(item: TrashItem): Promise<void> {
  try {
    await window.api.trash.delete(item.path)
    items.value = items.value.filter((i) => i.path !== item.path)
  } catch (err) {
    console.warn('TrashPage: delete failed', err)
  }
}

onMounted(() => {
  void loadItems()
})

defineExpose({
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown') {
      selectedIndex.value = (selectedIndex.value + 1) % items.value.length
      return true
    }
    if (e.key === 'ArrowUp') {
      selectedIndex.value = (selectedIndex.value - 1 + items.value.length) % items.value.length
      return true
    }
    if (e.key === 'Enter') {
      const item = items.value[selectedIndex.value]
      if (item) void restore(item)
      return true
    }
    if (e.key === 'Delete' || e.key === 'Backspace') {
      const item = items.value[selectedIndex.value]
      if (item) void remove(item)
      return true
    }
    return false
  }
})
</script>

<style scoped>
.trash-page {
  height: 100%;
  display: flex;
  flex-direction: column;
}

.trash-loading,
.trash-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  color: var(--launcher-text-muted);
  font-size: 13px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.trash-content {
  flex: 1;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.trash-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 10px 16px;
  border-bottom: 1px solid var(--launcher-hairline);
  font-size: 12px;
  color: var(--launcher-text-muted);
}

.trash-empty-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 4px 10px;
  border: 1px solid rgba(255, 59, 48, 0.3);
  border-radius: 6px;
  background: rgba(255, 59, 48, 0.08);
  color: #ff3b30;
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.trash-empty-btn:hover {
  background: rgba(255, 59, 48, 0.15);
}

.trash-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.trash-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 16px;
  cursor: pointer;
  position: relative;
}

.trash-item.selected {
  background: var(--launcher-bg-elevated);
}

.trash-item-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--launcher-text-muted);
  flex-shrink: 0;
}

.trash-item.selected .trash-item-icon {
  color: var(--launcher-text);
}

.trash-item-info {
  flex: 1;
  min-width: 0;
}

.trash-item-name {
  font-size: 13px;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.trash-item.selected .trash-item-name {
  color: var(--launcher-text);
}

.trash-item-meta {
  font-size: 11px;
  color: var(--launcher-text-muted);
  margin-top: 1px;
}

.trash-item-actions {
  display: flex;
  gap: 4px;
  opacity: 0;
  transition: opacity 0.15s;
}

.trash-item:hover .trash-item-actions,
.trash-item.selected .trash-item-actions {
  opacity: 1;
}

.trash-action-btn {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 5px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text-muted);
  cursor: pointer;
  transition: all 0.15s;
}

.trash-action-btn:hover {
  background: var(--launcher-accent-soft);
  color: var(--launcher-accent);
}

.trash-action-btn.danger:hover {
  background: rgba(255, 59, 48, 0.12);
  color: #ff3b30;
}
</style>
