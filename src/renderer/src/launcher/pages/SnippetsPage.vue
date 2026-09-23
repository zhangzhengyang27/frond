<template>
  <CapsulePage :hints="hints">
    <div class="snip-page">
      <div v-if="copiedFlash" class="snip-flash">已复制「{{ copiedFlash }}」</div>
      <div v-if="loading" class="snip-empty">加载片段中…</div>
      <div v-else-if="results.length === 0" class="snip-empty">
        {{ query ? `没有匹配「${query}」的片段` : '还没有代码片段' }}
      </div>
      <div v-else class="snip-list">
        <div
          v-for="(item, index) in results"
          :key="item.entry.key"
          class="snip-item"
          :class="{ selected: index === selectedIndex }"
          @mouseenter="selectedIndex = index"
          @click="runSelected(true)"
        >
          <div class="snip-icon">
            <AppIcon icon="file-code-line" :size="16" />
          </div>
          <div class="snip-text">
            <div class="snip-title">{{ item.entry.title }}</div>
            <div class="snip-sub">{{ item.entry.subtitle }}</div>
          </div>
          <span class="snip-lang">{{ item.entry.language }}</span>
        </div>
      </div>
    </div>
    <!-- Detail：选中片段的完整内容预览 -->
    <template #detail>
      <div v-if="selected" class="snip-detail">
        <div class="snip-detail-head">
          <span class="snip-detail-name">{{ selected.title }}</span>
          <span v-if="selected.language" class="snip-lang">{{ selected.language }}</span>
        </div>
        <pre class="snip-detail-code">{{ selected.value }}</pre>
      </div>
      <div v-else class="snip-empty">选择左侧片段查看内容</div>
    </template>
  </CapsulePage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import CapsulePage from './CapsulePage.vue'
import { searchEntries, type ScoredEntry, type SearchEntryBase } from '@shared/search'

interface SnippetItem {
  id: string
  name: string
  description?: string
  contents: Array<{ value: string; language: string }>
}

interface SnipEntry extends SearchEntryBase {
  language: string
  value: string
}

const props = defineProps<{ query: string }>()
const emit = defineEmits<{ copied: [title: string]; navigate: [] }>()

const all = ref<SnipEntry[]>([])
const loading = ref(true)
const selectedIndex = ref(0)
const copiedFlash = ref('')
let flashTimer: ReturnType<typeof setTimeout> | null = null

const results = computed<ScoredEntry<SnipEntry>[]>(() => {
  if (!props.query.trim()) {
    return all.value.slice(0, 8).map((entry) => ({ entry, highlight: null, score: 0 }))
  }
  return searchEntries(all.value, props.query, 8)
})

const selected = computed(() => results.value[selectedIndex.value]?.entry ?? null)

watch(results, () => {
  selectedIndex.value = 0
})

const hints = [
  { keys: '↵', label: '复制并关闭' },
  { keys: '⌘C', label: '复制' },
  { keys: '⌘↵', label: '打开片段库' },
  { keys: 'ESC', label: '返回' }
]

function currentEntry(): SnipEntry | null {
  return results.value[selectedIndex.value]?.entry ?? null
}

/** 复制；close=true 时通知外层收起胶囊（copy-then-close） */
async function runSelected(close = true): Promise<void> {
  const item = currentEntry()
  if (!item) return
  try {
    await navigator.clipboard.writeText(item.value)
    if (close) {
      emit('copied', item.title)
    } else {
      flashCopied(item.title)
    }
  } catch {
    /* 剪贴板失败静默（窗口失焦等） */
  }
}

function flashCopied(title: string): void {
  copiedFlash.value = title
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    copiedFlash.value = ''
  }, 1500)
}

function openLibrary(): void {
  window.api.launcher.openModule('snippets', '/snippets')
  emit('navigate')
}

function moveSelection(delta: number): void {
  if (results.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + delta + results.value.length) % results.value.length
  // 键盘浏览时保证选中项可见（Detail 联动）
  document.querySelectorAll('.snip-item')[selectedIndex.value]?.scrollIntoView({ block: 'nearest' })
}

/** 键盘分发（LauncherApp 集中转发）；返回 true 表示已消费 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'ArrowDown') {
    moveSelection(1)
    return true
  }
  if (e.key === 'ArrowUp') {
    moveSelection(-1)
    return true
  }
  if (e.key === 'Enter') {
    if (e.metaKey || e.ctrlKey) {
      openLibrary()
    } else {
      void runSelected(true)
    }
    return true
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
    void runSelected(false)
    return true
  }
  return false
}

defineExpose({ handleKey })

onMounted(async () => {
  try {
    const snippets = (await window.api.snippet.getSnippets()) as SnippetItem[]
    all.value = snippets.map((s) => {
      const first = s.contents?.[0]
      const preview = (first?.value ?? '').replace(/\s+/g, ' ').slice(0, 80)
      return {
        key: `snippet:${s.id}`,
        icon: 'file-code-line',
        title: s.name,
        subtitle: s.description || preview || '空片段',
        language: first?.language ?? '',
        value: first?.value ?? ''
      }
    })
  } catch {
    /* 片段读取失败显示空态 */
  } finally {
    loading.value = false
  }
})
</script>

<style scoped>
.snip-page {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  position: relative;
}

.snip-flash {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--launcher-border);
  background: rgba(255, 255, 255, 0.95);
  font-size: 11px;
  color: var(--launcher-accent);
  white-space: nowrap;
  max-width: 90%;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snip-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.snip-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  cursor: pointer;
}

.snip-item.selected {
  background: var(--launcher-accent-soft);
}

.snip-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: rgba(255, 255, 255, 0.07);
  color: var(--launcher-text-dim);
  flex-shrink: 0;
}

.snip-item.selected .snip-icon {
  color: var(--launcher-accent);
}

.snip-text {
  flex: 1;
  min-width: 0;
}

.snip-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.snip-sub {
  font-size: 11px;
  color: var(--launcher-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.snip-lang {
  font-size: 10px;
  color: var(--launcher-text-muted);
  border: 1px solid var(--launcher-border);
  border-radius: 999px;
  padding: 2px 8px;
  flex-shrink: 0;
  text-transform: uppercase;
}

.snip-empty {
  padding: 22px 0;
  text-align: center;
  font-size: 12px;
  color: var(--launcher-text-muted);
}

.snip-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.snip-detail-head {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.snip-detail-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  min-width: 0;
}

.snip-detail-code {
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--launcher-border);
  background: rgba(255, 255, 255, 0.04);
  font-family: var(--font-mono, ui-monospace, Menlo, monospace);
  font-size: 11px;
  line-height: 1.5;
  color: var(--launcher-text-dim);
  white-space: pre-wrap;
  word-break: break-all;
  overflow-y: auto;
  max-height: 300px;
}
</style>
