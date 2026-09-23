<template>
  <div class="browser-tabs-page">
    <div v-if="loading" class="bt-loading">正在读取浏览器标签…</div>
    <div v-else-if="!supported" class="bt-empty">当前平台不支持浏览器标签搜索（仅 macOS）</div>
    <div v-else-if="tabs.length === 0" class="bt-empty">
      <div class="bt-empty-icon"><AppIcon icon="chrome-line" :size="28" /></div>
      <div>没有打开的浏览器标签</div>
      <div class="bt-empty-hint">在 Chrome 或 Safari 中打开一些标签页后重试</div>
    </div>
    <div v-else class="bt-list">
      <div
        v-for="(tab, i) in filteredTabs"
        :key="tab.id"
        class="bt-item"
        :class="{ selected: i === selectedIndex }"
        @mousedown.prevent="activate(tab)"
      >
        <div class="bt-icon">
          <AppIcon :icon="tab.browser === 'chrome' ? 'chrome-line' : 'compass-line'" :size="16" />
        </div>
        <div class="bt-info">
          <div class="bt-title">{{ tab.title || '(无标题)' }}</div>
          <div class="bt-url">{{ tab.url }}</div>
        </div>
        <div class="bt-browser">{{ tab.browser === 'chrome' ? 'Chrome' : 'Safari' }}</div>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@components/AppIcon.vue'

interface Tab {
  id: string
  browser: 'chrome' | 'safari'
  title: string
  url: string
  windowId: number
  tabIndex: number
}

const tabs = ref<Tab[]>([])
const loading = ref(true)
const supported = ref(true)
const selectedIndex = ref(0)
const query = ref('')

const filteredTabs = computed(() => {
  const q = query.value.toLowerCase().trim()
  if (!q) return tabs.value
  return tabs.value.filter(
    (t) => t.title.toLowerCase().includes(q) || t.url.toLowerCase().includes(q)
  )
})

async function loadTabs(): Promise<void> {
  loading.value = true
  try {
    const resp = (await window.api.browserTabs.list()) as {
      ok: boolean
      tabs: Tab[]
      supported: boolean
    }
    supported.value = resp.supported !== false
    tabs.value = resp.tabs ?? []
  } catch {
    tabs.value = []
  } finally {
    loading.value = false
  }
}

async function activate(tab: Tab): Promise<void> {
  try {
    await window.api.browserTabs.activate(tab as unknown as Record<string, unknown>)
  } catch {
    /* 激活失败静默 */
  }
}

/** 胶囊页键盘约定 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'ArrowDown') {
    selectedIndex.value = Math.min(selectedIndex.value + 1, filteredTabs.value.length - 1)
    return true
  }
  if (e.key === 'ArrowUp') {
    selectedIndex.value = Math.max(selectedIndex.value - 1, 0)
    return true
  }
  if (e.key === 'Enter') {
    const tab = filteredTabs.value[selectedIndex.value]
    if (tab) void activate(tab)
    return true
  }
  if (e.key === 'Escape') return false
  return true
}

/** 父级传入搜索词 */
function setQuery(q: string): void {
  query.value = q
  selectedIndex.value = 0
}

defineExpose({ handleKey, setQuery })

onMounted(() => {
  void loadTabs()
})
</script>

<style scoped>
.browser-tabs-page {
  height: 100%;
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.bt-loading,
.bt-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  font-size: 12px;
  color: var(--launcher-text-muted);
  padding: 20px;
}

.bt-empty-icon {
  opacity: 0.5;
  margin-bottom: 4px;
}

.bt-empty-hint {
  font-size: 11px;
  opacity: 0.7;
}

.bt-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px 0;
}

.bt-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px;
  cursor: pointer;
}

.bt-item.selected {
  background: var(--launcher-bg-elevated);
}

.bt-icon {
  flex-shrink: 0;
  color: var(--launcher-text-muted);
}

.bt-info {
  flex: 1;
  min-width: 0;
}

.bt-title {
  font-size: 13px;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.bt-url {
  font-size: 11px;
  color: var(--launcher-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 2px;
}

.bt-browser {
  font-size: 10px;
  color: var(--launcher-text-muted);
  flex-shrink: 0;
  padding: 2px 6px;
  border: 1px solid var(--launcher-border);
  border-radius: 4px;
}
</style>
