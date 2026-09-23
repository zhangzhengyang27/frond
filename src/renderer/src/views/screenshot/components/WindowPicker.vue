<template>
  <div class="window-picker-overlay" @click.self="handleClose">
    <div class="window-picker-container">
      <div class="window-picker-header">
        <span class="header-title">选择窗口</span>
        <button class="close-btn" @click="handleClose">
          <svg viewBox="0 0 24 24" width="16" height="16">
            <path
              fill="currentColor"
              d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
            />
          </svg>
        </button>
      </div>
      <div class="window-picker-content">
        <div v-if="loading" class="loading">
          <span>加载窗口列表...</span>
        </div>
        <div v-else-if="windows.length === 0" class="empty">
          <span>没有检测到窗口</span>
        </div>
        <div v-else class="window-grid">
          <div
            v-for="win in windows"
            :key="win.id"
            class="window-item"
            :class="{ selected: selectedId === win.id }"
            @click="handleSelect(win)"
          >
            <div class="window-thumbnail">
              <img :src="win.thumbnail" :alt="win.name" />
            </div>
            <div class="window-name">{{ win.name }}</div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface WindowInfo {
  id: string
  name: string
  thumbnail: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

const emit = defineEmits<{
  select: [window: WindowInfo]
  close: []
}>()

const loading = ref(true)
const windows = ref<WindowInfo[]>([])
const selectedId = ref<string | null>(null)

onMounted(async () => {
  try {
    const result = await window.api.screenshot.getWindowList()
    if (result.success) {
      windows.value = result.windows
    }
  } catch (error) {
    console.error('[WindowPicker] Failed to load windows:', error)
  } finally {
    loading.value = false
  }
})

const handleSelect = (win: WindowInfo) => {
  selectedId.value = win.id
  emit('select', win)
}

const handleClose = () => {
  emit('close')
}
</script>

<style scoped>
.window-picker-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: var(--shot-overlay);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10000;
}

.window-picker-container {
  background: var(--shot-panel);
  border-radius: 12px;
  box-shadow: var(--shot-shadow);
  width: 600px;
  max-width: 90vw;
  max-height: 80vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
}

.window-picker-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px;
  border-bottom: 1px solid rgba(255, 255, 255, 0.1);
}

.header-title {
  font-size: 16px;
  font-weight: 600;
  color: var(--shot-text);
}

.close-btn {
  background: transparent;
  border: none;
  padding: 4px;
  cursor: pointer;
  color: var(--shot-text-muted);
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 4px;
  transition: all 0.2s;
}

.close-btn:hover {
  color: var(--shot-text);
  background: rgba(255, 255, 255, 0.1);
}

.window-picker-content {
  padding: 16px;
  overflow-y: auto;
  flex: 1;
}

.loading,
.empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 200px;
  color: var(--shot-text-muted);
  font-size: 14px;
}

.window-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
  gap: 12px;
}

.window-item {
  background: var(--shot-panel);
  border-radius: 8px;
  padding: 8px;
  cursor: pointer;
  transition: all 0.2s;
  border: 2px solid transparent;
}

.window-item:hover {
  background: var(--shot-panel-raised);
  border-color: rgba(255, 255, 255, 0.2);
}

.window-item.selected {
  border-color: var(--shot-accent);
  background: rgba(74, 163, 255, 0.15);
}

.window-thumbnail {
  width: 100%;
  aspect-ratio: 16 / 10;
  background: var(--shot-panel-raised);
  border-radius: 4px;
  overflow: hidden;
  margin-bottom: 8px;
}

.window-thumbnail img {
  width: 100%;
  height: 100%;
  object-fit: contain;
}

.window-name {
  font-size: 12px;
  color: var(--shot-text-dim);
  text-align: center;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
