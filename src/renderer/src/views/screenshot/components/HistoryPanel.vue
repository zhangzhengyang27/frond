<template>
  <div v-if="visible" class="history-panel">
    <div class="history-header">
      <span class="history-title">截图历史</span>
      <div class="history-actions">
        <button class="action-btn" title="刷新" @click="handleRefresh">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M17.65 6.35A7.958 7.958 0 0012 4c-4.42 0-7.99 3.58-7.99 8s3.57 8 7.99 8c3.73 0 6.84-2.55 7.73-6h-2.08A5.99 5.99 0 0112 18c-3.31 0-6-2.69-6-6s2.69-6 6-6c1.66 0 3.14.69 4.22 1.78L13 11h7V4l-2.35 2.35z"
            />
          </svg>
        </button>
        <button class="action-btn close-btn" title="关闭" @click="$emit('close')">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>
    </div>

    <div class="history-toolbar">
      <input
        v-model="searchQuery"
        type="text"
        class="search-input"
        placeholder="搜索截图..."
        @input="handleSearch"
      />
      <div v-if="storageUsage" class="storage-info">
        {{ formatSize(storageUsage.totalSize) }} · {{ storageUsage.count }} 张
      </div>
    </div>

    <div ref="contentRef" class="history-content" @scroll="handleScroll">
      <div v-if="loading && items.length === 0" class="loading">
        <span>加载中...</span>
      </div>
      <div v-else-if="items.length === 0" class="empty">
        <svg viewBox="0 0 24 24" width="48" height="48">
          <path
            fill="currentColor"
            d="M21 3H3c-1.1 0-2 .9-2 2v14c0 1.1.9 2 2 2h18c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2zm0 16H3V5h18v14zM9.41 15.95L12 13.36l2.59 2.59L16 14.54l-2.59-2.59L16 9.36 14.59 7.95 12 10.54 9.41 7.95 8 9.36l2.59 2.59L8 14.54l1.41 1.41z"
          />
        </svg>
        <span>暂无截图记录</span>
      </div>
      <div v-else class="history-grid">
        <div
          v-for="item in items"
          :key="item.id"
          class="history-item"
          @click="handleItemClick(item)"
          @contextmenu.prevent="handleContextMenu($event, item)"
        >
          <div class="item-thumbnail">
            <img :src="'file://' + item.filePath" :alt="item.fileName" loading="lazy" />
          </div>
          <div class="item-info">
            <span class="item-name">{{ formatDate(item.capturedAt) }}</span>
            <span class="item-size">{{ formatSize(item.fileSize) }}</span>
          </div>
          <button class="item-delete" title="删除" @click.stop="handleDelete(item.id)">
            <svg viewBox="0 0 24 24" width="14" height="14">
              <path
                fill="currentColor"
                d="M6 19c0 1.1.9 2 2 2h8c1.1 0 2-.9 2-2V7H6v12zM19 4h-3.5l-1-1h-5l-1 1H5v2h14V4z"
              />
            </svg>
          </button>
        </div>
      </div>
      <div v-if="loading && items.length > 0" class="loading-more">
        <span>加载中...</span>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, onMounted, onUnmounted } from 'vue'

interface ScreenshotItem {
  id: string
  filePath: string
  fileName: string
  fileSize: number
  width: number | null
  height: number | null
  captureMode: string
  capturedAt: number
  isOcrDone: boolean
}

interface StorageUsage {
  totalSize: number
  count: number
}

const props = defineProps<{
  visible: boolean
}>()

const emit = defineEmits<{
  close: []
  open: [item: ScreenshotItem]
}>()

const loading = ref(false)
const items = ref<ScreenshotItem[]>([])
const total = ref(0)
const searchQuery = ref('')
const storageUsage = ref<StorageUsage | null>(null)
const contentRef = ref<HTMLElement | null>(null)

let searchTimeout: ReturnType<typeof setTimeout> | null = null
let activeContextMenu: HTMLElement | null = null

/** 移除当前活动的右键菜单 */
const removeContextMenu = (): void => {
  if (activeContextMenu) {
    activeContextMenu.remove()
    activeContextMenu = null
  }
  document.removeEventListener('click', handleMenuClick)
}

let handleMenuClick: (e: MouseEvent) => void = () => {}

// 过期请求守卫：搜索/刷新触发的 reset 加载必须能打断在途的 loadMore，
// 不能被 loading 守卫整条丢弃（否则搜索看起来无效）
let loadSeq = 0

const loadHistory = async (reset: boolean = true): Promise<void> => {
  if (!reset && loading.value) return
  const seq = ++loadSeq

  if (reset) {
    items.value = []
  }

  loading.value = true
  try {
    const result = await window.api.screenshot.history.list(
      searchQuery.value ? { search: searchQuery.value } : undefined,
      20,
      reset ? 0 : items.value.length
    )
    if (seq !== loadSeq) return
    if (result.success) {
      if (reset) {
        items.value = result.items
      } else {
        items.value = [...items.value, ...result.items]
      }
      total.value = result.total
    }
  } catch (error) {
    console.error('[HistoryPanel] loadHistory error:', error)
  } finally {
    if (seq === loadSeq) {
      loading.value = false
    }
  }
}

const loadStorageUsage = async (): Promise<void> => {
  try {
    const result = await window.api.screenshot.history.storageUsage()
    if (result.success) {
      storageUsage.value = {
        totalSize: result.totalSize,
        count: result.count
      }
    }
  } catch (error) {
    console.error('[HistoryPanel] loadStorageUsage error:', error)
  }
}

const loadMore = (): void => {
  loadHistory(false)
}

const handleScroll = (): void => {
  if (!contentRef.value || loading.value) return

  const { scrollTop, scrollHeight, clientHeight } = contentRef.value
  // 当滚动到底部 100px 范围内时加载更多
  if (scrollHeight - scrollTop - clientHeight < 100 && items.value.length < total.value) {
    loadMore()
  }
}

const handleSearch = (): void => {
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
  searchTimeout = setTimeout(() => {
    loadHistory(true)
  }, 300)
}

const handleRefresh = (): void => {
  loadHistory(true)
  loadStorageUsage()
}

const handleItemClick = (item: ScreenshotItem): void => {
  emit('open', item)
}

const handleDelete = async (id: string): Promise<void> => {
  if (!confirm('确定要删除这张截图吗？')) return

  try {
    const result = await window.api.screenshot.history.delete(id)
    if (result.success) {
      items.value = items.value.filter((item) => item.id !== id)
      total.value--
      loadStorageUsage()
    }
  } catch (error) {
    console.error('[HistoryPanel] delete error:', error)
  }
}

const handleContextMenu = (event: MouseEvent, item: ScreenshotItem): void => {
  // 先移除已存在的菜单，防止 DOM 泄漏
  removeContextMenu()

  const menu = document.createElement('div')
  menu.className = 'context-menu'
  menu.innerHTML = `
    <div class="menu-item" data-action="open">在文件夹中显示</div>
    <div class="menu-item" data-action="delete">删除</div>
  `
  menu.style.cssText = `
    position: fixed;
    left: ${event.clientX}px;
    top: ${event.clientY}px;
    background: var(--shot-panel);
    border-radius: 6px;
    padding: 4px;
    box-shadow: 0 4px 12px rgba(0,0,0,0.3);
    z-index: 10000;
  `
  document.body.appendChild(menu)
  activeContextMenu = menu

  handleMenuClick = async (e: MouseEvent) => {
    const target = e.target as HTMLElement
    const action = target.dataset.action
    if (action === 'open') {
      await window.api.screenshot.history.showInFolder(item.filePath)
    } else if (action === 'delete') {
      handleDelete(item.id)
    }
    removeContextMenu()
  }

  setTimeout(() => {
    document.addEventListener('click', handleMenuClick)
  }, 0)
}

const formatSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
}

const formatDate = (timestamp: number): string => {
  const date = new Date(timestamp)
  const now = new Date()
  const isToday = date.toDateString() === now.toDateString()

  if (isToday) {
    return date.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return date.toLocaleDateString('zh-CN', {
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  })
}

watch(
  () => props.visible,
  (visible) => {
    if (visible) {
      loadHistory(true)
      loadStorageUsage()
    }
  }
)

onMounted(() => {
  if (props.visible) {
    loadHistory(true)
    loadStorageUsage()
  }
})

onUnmounted(() => {
  removeContextMenu()
  if (searchTimeout) {
    clearTimeout(searchTimeout)
  }
})
</script>

<style scoped>
.history-panel {
  position: fixed;
  right: 20px;
  bottom: 20px;
  width: 400px;
  max-height: 500px;
  background: var(--shot-panel);
  border-radius: 12px;
  box-shadow: var(--shot-shadow);
  display: flex;
  flex-direction: column;
  overflow: hidden;
  z-index: 9998;
}

.history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.history-title {
  font-size: 14px;
  font-weight: 600;
  color: var(--shot-text);
}

.history-actions {
  display: flex;
  gap: 4px;
}

.action-btn {
  background: transparent;
  border: none;
  padding: 6px;
  cursor: pointer;
  color: var(--shot-text-muted);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all 0.2s;
}

.action-btn:hover {
  color: var(--shot-text);
  background: rgba(255, 255, 255, 0.1);
}

.history-toolbar {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.05);
}

.search-input {
  flex: 1;
  background: var(--shot-panel);
  border: 1px solid rgba(255, 255, 255, 0.1);
  border-radius: 6px;
  padding: 8px 12px;
  color: var(--shot-text);
  font-size: 13px;
  outline: none;
}

.search-input:focus {
  border-color: var(--shot-accent);
}

.search-input::placeholder {
  color: var(--shot-text-faint);
}

.storage-info {
  font-size: 12px;
  color: var(--shot-text-faint);
  white-space: nowrap;
}

.history-content {
  flex: 1;
  overflow-y: auto;
  padding: 12px;
}

.loading,
.empty {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--shot-text-faint);
  font-size: 13px;
  gap: 12px;
}

.empty svg {
  opacity: 0.3;
}

.history-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 8px;
}

.history-item {
  position: relative;
  background: var(--shot-panel);
  border-radius: 6px;
  overflow: hidden;
  cursor: pointer;
  transition: all 0.2s;
}

.history-item:hover {
  transform: scale(1.02);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
}

.history-item:hover .item-delete {
  opacity: 1;
}

.item-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--shot-panel-raised);
  overflow: hidden;
}

.item-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.item-info {
  padding: 6px 8px;
}

.item-name {
  display: block;
  font-size: 11px;
  color: var(--shot-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.item-size {
  display: block;
  font-size: 10px;
  color: var(--shot-text-faint);
  margin-top: 2px;
}

.item-delete {
  position: absolute;
  top: 4px;
  right: 4px;
  background: var(--shot-overlay);
  border: none;
  border-radius: 4px;
  padding: 4px;
  cursor: pointer;
  color: var(--shot-text);
  opacity: 0;
  transition: opacity 0.2s;
}

.item-delete:hover {
  background: var(--color-danger);
}

.loading-more {
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 12px;
  color: var(--shot-text-faint);
  font-size: 12px;
}

.history-footer {
  padding: 12px;
  border-top: 1px solid rgba(255, 255, 255, 0.05);
}

.load-more-btn {
  display: none;
}
</style>

