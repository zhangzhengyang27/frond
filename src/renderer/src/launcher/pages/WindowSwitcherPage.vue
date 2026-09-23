<template>
  <div class="window-switcher">
    <div class="ws-scroll">
      <div v-if="loading" class="ws-loading">
        <AppIcon icon="loader-4" :size="18" class="spin" />
        <span>读取窗口列表…</span>
      </div>
      <div v-else-if="filteredWindows.length === 0" class="ws-empty">没有可见窗口</div>
      <div v-else class="ws-list">
        <div
          v-for="(win, index) in filteredWindows"
          :key="win.id"
          class="ws-item"
          :class="{ selected: index === selectedIndex }"
          @mouseenter="selectedIndex = index"
          @mousedown.prevent="activate(win)"
        >
          <div class="ws-app-icon">
            <AppIcon icon="window-2" :size="16" />
          </div>
          <div class="ws-info">
            <div class="ws-title">{{ win.title }}</div>
            <div class="ws-app">{{ win.appName }}</div>
          </div>
          <span class="ws-shortcut">↵</span>
        </div>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@components/AppIcon.vue'

interface WindowInfo {
  id: string
  appName: string
  title: string
  pid: number
}

const props = defineProps<{ query?: string }>()

const loading = ref(true)
const windows = ref<WindowInfo[]>([])
const selectedIndex = ref(0)

const filteredWindows = computed(() => {
  if (!props.query?.trim()) return windows.value
  const q = props.query.toLowerCase()
  return windows.value.filter(
    (w) => w.title.toLowerCase().includes(q) || w.appName.toLowerCase().includes(q)
  )
})

watch(filteredWindows, () => {
  selectedIndex.value = 0
})

async function activate(win: WindowInfo): Promise<void> {
  try {
    await window.api.windows.activate(win.pid, win.title)
  } catch (err) {
    console.warn('WindowSwitcher: activate failed', err)
  }
}

onMounted(async () => {
  try {
    windows.value = (await window.api.windows.list()) as WindowInfo[]
  } catch (err) {
    console.warn('WindowSwitcher: list failed', err)
  } finally {
    loading.value = false
  }
})

defineExpose({
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown') {
      selectedIndex.value = (selectedIndex.value + 1) % filteredWindows.value.length
      return true
    }
    if (e.key === 'ArrowUp') {
      selectedIndex.value =
        (selectedIndex.value - 1 + filteredWindows.value.length) % filteredWindows.value.length
      return true
    }
    if (e.key === 'Enter') {
      const win = filteredWindows.value[selectedIndex.value]
      if (win) void activate(win)
      return true
    }
    return false
  }
})
</script>

<style scoped>
.window-switcher {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ws-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 0;
}

.ws-loading,
.ws-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--launcher-text-muted);
  font-size: 13px;
  gap: 8px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.ws-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 16px;
  cursor: pointer;
  position: relative;
}

.ws-item.selected {
  background: var(--launcher-bg-elevated);
}

.ws-app-icon {
  width: 28px;
  height: 28px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--launcher-text-muted);
  flex-shrink: 0;
}

.ws-item.selected .ws-app-icon {
  color: var(--launcher-text);
}

.ws-info {
  flex: 1;
  min-width: 0;
}

.ws-title {
  font-size: 13px;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ws-item.selected .ws-title {
  color: var(--launcher-text);
}

.ws-app {
  font-size: 11px;
  color: var(--launcher-text-muted);
  margin-top: 1px;
}

.ws-shortcut {
  font-size: 13px;
  color: var(--launcher-text-faint);
  flex-shrink: 0;
}
</style>
