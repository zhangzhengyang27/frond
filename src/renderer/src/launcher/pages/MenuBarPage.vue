<template>
  <div class="menu-bar">
    <div v-if="appName" class="mb-header">
      当前应用：<span class="mb-app">{{ appName }}</span>
    </div>
    <div v-if="error" class="mb-error">{{ error }}</div>
    <div class="mb-scroll">
      <div v-if="loading" class="mb-loading">
        <AppIcon icon="loader-4" :size="18" class="spin" />
        <span>遍历菜单栏…（大应用需数秒，已缓存 15 秒）</span>
      </div>
      <div v-else-if="filteredItems.length === 0" class="mb-empty">没有匹配的菜单项</div>
      <div v-else class="mb-list">
        <div
          v-for="(item, index) in filteredItems"
          :key="item.pathLabel + item.title"
          class="mb-item"
          :class="{ selected: index === selectedIndex }"
          @mouseenter="selectedIndex = index"
          @mousedown.prevent="trigger(item)"
        >
          <div class="mb-icon">
            <AppIcon icon="menu-line" :size="15" />
          </div>
          <div class="mb-info">
            <div class="mb-title">{{ item.title }}</div>
            <div class="mb-path">{{ item.pathLabel }}</div>
          </div>
          <span v-if="triggeredTitle === item.title" class="mb-done">已触发</span>
          <span v-else class="mb-shortcut">↵</span>
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
import type { MenuBarItem } from '@shared/menuBar'

const props = defineProps<{ query?: string }>()

const loading = ref(true)
const appName = ref<string | null>(null)
const items = ref<MenuBarItem[]>([])
const selectedIndex = ref(0)
const error = ref('')
const triggeredTitle = ref('')
let triggeredTimer: ReturnType<typeof setTimeout> | null = null

const filteredItems = computed(() => {
  if (!props.query?.trim()) return items.value
  const q = props.query.toLowerCase()
  return items.value.filter(
    (i) => i.title.toLowerCase().includes(q) || i.pathLabel.toLowerCase().includes(q)
  )
})

watch(filteredItems, () => {
  selectedIndex.value = 0
})

async function refresh(): Promise<void> {
  loading.value = true
  error.value = ''
  try {
    const res = await window.api.menuBar.list()
    if (!res.ok) {
      error.value = res.reason === 'unsupported' ? '仅 macOS 支持' : `遍历失败：${res.reason}`
      items.value = []
    } else {
      appName.value = res.app
      items.value = res.items
    }
  } catch (err) {
    error.value = (err as Error).message
  } finally {
    loading.value = false
  }
}

async function trigger(item: MenuBarItem): Promise<void> {
  try {
    const res = await window.api.menuBar.trigger(item.segments, item.title)
    if (!res.ok) {
      error.value = res.error ?? '触发失败'
      return
    }
    error.value = ''
    triggeredTitle.value = item.title
    if (triggeredTimer) clearTimeout(triggeredTimer)
    triggeredTimer = setTimeout(() => (triggeredTitle.value = ''), 1500)
    void window.api.launcher.hide()
  } catch (err) {
    error.value = (err as Error).message
  }
}

onMounted(refresh)

defineExpose({
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown') {
      selectedIndex.value = (selectedIndex.value + 1) % Math.max(1, filteredItems.value.length)
      return true
    }
    if (e.key === 'ArrowUp') {
      selectedIndex.value =
        (selectedIndex.value - 1 + Math.max(1, filteredItems.value.length)) %
        Math.max(1, filteredItems.value.length)
      return true
    }
    if (e.key === 'Enter') {
      const item = filteredItems.value[selectedIndex.value]
      if (item) void trigger(item)
      return true
    }
    return false
  }
})
</script>

<style scoped>
.menu-bar {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.mb-header {
  padding: 8px 16px 4px;
  font-size: 12px;
  color: var(--launcher-text-faint);
}

.mb-app {
  color: var(--launcher-text);
  font-weight: 500;
}

.mb-error {
  padding: 6px 16px;
  font-size: 12px;
  color: #ff453a;
  background: rgba(255, 69, 58, 0.1);
}

.mb-list {
  display: flex;
  flex-direction: column;
}

.mb-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 0;
}

.mb-loading,
.mb-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--launcher-text-muted);
  font-size: 13px;
  gap: 8px;
  text-align: center;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}

.mb-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 16px;
  cursor: pointer;
}

.mb-item.selected {
  background: var(--launcher-bg-elevated);
}

.mb-icon {
  width: 26px;
  height: 26px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: var(--launcher-text-muted);
  flex-shrink: 0;
}

.mb-item.selected .mb-icon {
  color: var(--launcher-text);
}

.mb-info {
  flex: 1;
  min-width: 0;
}

.mb-title {
  font-size: 13px;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.mb-path {
  font-size: 11px;
  color: var(--launcher-text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.mb-done {
  font-size: 12px;
  color: var(--launcher-accent);
  flex-shrink: 0;
}

.mb-shortcut {
  font-size: 13px;
  color: var(--launcher-text-faint);
  flex-shrink: 0;
}
</style>
