<template>
  <CapsulePage :hints="hints">
    <div class="snip-page">
      <div v-if="copiedFlash" class="snip-flash">{{ copiedFlash }}</div>
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
          <span v-if="item.entry.blockCount > 1" class="snip-lang"
            >×{{ item.entry.blockCount }}</span
          >
          <span class="snip-lang">{{ item.entry.language }}</span>
        </div>
      </div>
    </div>
    <!-- Detail：选中片段的完整内容预览（B58 批C：多块片段可切块复制） -->
    <template #detail>
      <div v-if="selected" class="snip-detail">
        <div class="snip-detail-head">
          <span class="snip-detail-name">{{ selected.title }}</span>
          <span v-if="selected.language" class="snip-lang">{{ selected.language }}</span>
        </div>
        <div v-if="blockLabels.length > 1" class="snip-blocks" data-testid="snip-blocks">
          <button
            v-for="(label, i) in blockLabels"
            :key="`${selected.id}-block-${i}`"
            type="button"
            class="snip-block-chip"
            :class="{ active: i === activeBlock }"
            @click="activeBlock = i"
          >
            {{ label }}
          </button>
        </div>
        <pre class="snip-detail-code" data-testid="snip-detail-code">{{ activeValue }}</pre>
      </div>
      <div v-else class="snip-empty">选择左侧片段查看内容</div>
    </template>
  </CapsulePage>
</template>

<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import CapsulePage from './CapsulePage.vue'
import { searchEntries, type ScoredEntry, type SearchEntryBase } from '@shared/search'
import type { Snippet } from '@preload/index.d'

/**
 * B58 批C 重构：
 * - 轻路径：列表走 snippet:getIndex（不解密 contents），替换每次唤起全库
 *   getSnippets 的 AES 重路径；内容全文匹配靠 snippet:quickSearch（SQL LIKE
 *   search_text 明文投影，覆盖反而比旧的 80 字符首块预览更全）
 * - 多块：详情按需 getSnippetById + 缓存，块 chips 切换（⌘←/→），复制/粘贴
 *   取活动块（此前永远只有第一块可达）
 * - ⇧↵ 粘贴到前台：snippet:pasteToForeground（写剪贴板 → 收起胶囊 → 注入 ⌘V；
 *   无辅助功能授权时注入失败但内容已在剪贴板，保持窗口供手动粘贴）
 */

interface SnipIndexEntry {
  id: string
  name: string
  description: string
  language: string
  blockCount: number
}

interface SnipEntry extends SearchEntryBase {
  id: string
  language: string
  blockCount: number
}

const props = defineProps<{ query: string }>()
const emit = defineEmits<{ copied: [title: string]; navigate: [] }>()

const all = ref<SnipEntry[]>([])
const loading = ref(true)
const selectedIndex = ref(0)
const results = ref<ScoredEntry<SnipEntry>[]>([])
const copiedFlash = ref('')
let flashTimer: ReturnType<typeof setTimeout> | null = null

// 详情按需加载 + 缓存（snippets:changed 时整体失效）
const selectedFull = ref<Snippet | null>(null)
const activeBlock = ref(0)
const detailCache = new Map<string, Snippet>()

const subtitleOf = (entry: SnipIndexEntry): string =>
  entry.description || (entry.blockCount > 1 ? `${entry.blockCount} 个代码块` : '') || '空片段'

const selected = computed(() => results.value[selectedIndex.value]?.entry ?? null)

const selectedId = computed(() => selected.value?.id ?? null)
watch(selectedId, (id) => {
  activeBlock.value = 0
  selectedFull.value = id ? (detailCache.get(id) ?? null) : null
  if (id) void ensureFull(id)
})

async function ensureFull(id: string): Promise<Snippet | null> {
  const hit = detailCache.get(id)
  if (hit) {
    selectedFull.value = hit
    return hit
  }
  try {
    const full = (await window.api.snippet.getSnippetById(id)) ?? null
    if (full) detailCache.set(id, full)
    selectedFull.value = full
    return full
  } catch {
    return null
  }
}

const blockLabels = computed(() =>
  (selectedFull.value?.contents ?? []).map((c, i) => c.label || `#${i + 1}`)
)

const activeValue = computed(() => {
  const contents = selectedFull.value?.contents
  if (!contents || contents.length === 0) return selected.value ? '加载中…' : ''
  return contents[activeBlock.value]?.value ?? contents[0]?.value ?? ''
})

function moveBlock(delta: number): void {
  const len = selectedFull.value?.contents.length ?? 0
  if (len < 2) return
  activeBlock.value = (activeBlock.value + delta + len) % len
}

const hints = computed(() => {
  const base: Array<{ keys: string; label: string }> = [
    { keys: '↵', label: '复制并关闭' },
    { keys: '⇧↵', label: '粘贴到前台' },
    { keys: '⌘C', label: '复制' }
  ]
  if (blockLabels.value.length > 1) {
    base.push({ keys: '⌘←→', label: '切换代码块' })
  }
  base.push({ keys: '⌘↵', label: '打开片段库' }, { keys: 'ESC', label: '返回' })
  return base
})

// 查询重算：本地模糊先上屏（即时），quickSearch（含内容全文）到达后合并替换
let searchToken = 0
async function recompute(query: string): Promise<void> {
  const q = query.trim()
  selectedIndex.value = 0
  if (!q) {
    results.value = all.value.slice(0, 8).map((entry) => ({ entry, highlight: null, score: 0 }))
    return
  }
  const local = searchEntries(all.value, q, 20)
  results.value = local
  const token = ++searchToken
  try {
    const hits = (await window.api.snippet.quickSearch(q, 20)) as Array<{ id: string }>
    if (token !== searchToken) return
    const byId = new Map(all.value.map((e) => [e.id, e]))
    // SQL 命中在前（内容全文匹配是本地模糊做不到的），本地独有命中殿后
    const merged = new Map<string, ScoredEntry<SnipEntry>>()
    for (const h of hits) {
      const entry = byId.get(h.id)
      if (entry) merged.set(h.id, { entry, highlight: null, score: 45 })
    }
    for (const row of local) merged.set(row.entry.id, row)
    results.value = [...merged.values()].slice(0, 20)
  } catch {
    /* quickSearch 失败：本地模糊结果已兜底 */
  }
}

watch(
  () => props.query,
  (q) => void recompute(q)
)
watch(all, () => void recompute(props.query))

const currentEntry = (): SnipEntry | null => results.value[selectedIndex.value]?.entry ?? null

/** 活动块内容复制；close=true 时通知外层收起胶囊（copy-then-close） */
async function runSelected(close = true): Promise<void> {
  const item = currentEntry()
  if (!item) return
  const full = await ensureFull(item.id)
  const value = full?.contents?.[activeBlock.value]?.value ?? full?.contents?.[0]?.value ?? ''
  try {
    await navigator.clipboard.writeText(value)
    if (close) {
      emit('copied', item.title)
    } else {
      flashCopied(`已复制「${item.title}」`)
    }
  } catch {
    /* 剪贴板失败静默（窗口失焦等） */
  }
}

/** ⇧↵：复制活动块并粘贴到前台应用（主进程收起胶囊后注入 ⌘V） */
async function pasteSelected(): Promise<void> {
  const item = currentEntry()
  if (!item) return
  try {
    const res = await window.api.snippet.pasteToForeground(item.id, activeBlock.value)
    if (res?.ok) {
      emit('copied', item.title)
    } else {
      // 无辅助功能授权等场景：内容已写入剪贴板，保留窗口供手动粘贴
      flashCopied('已复制；自动粘贴失败（需辅助功能授权），可手动 ⌘V')
    }
  } catch {
    flashCopied('已复制；自动粘贴失败，可手动 ⌘V')
  }
}

function flashCopied(message: string): void {
  copiedFlash.value = message
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
  if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowRight') {
    moveBlock(1)
    return true
  }
  if ((e.metaKey || e.ctrlKey) && e.key === 'ArrowLeft') {
    moveBlock(-1)
    return true
  }
  if (e.key === 'Enter') {
    if (e.shiftKey) {
      void pasteSelected()
    } else if (e.metaKey || e.ctrlKey) {
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

onMounted(() => {
  void load()
  // 具名句柄：匿名函数无法 removeEventListener，进出页面会累积监听器
  const onFocus = (): void => void load()
  window.addEventListener('focus', onFocus)
  // B56-5：主窗片段变更广播 → 胶囊页即时失效重拉（替代单纯依赖唤起时机）
  const offChanged = window.api.onSnippetsChanged(() => void load())
  onUnmounted(() => {
    window.removeEventListener('focus', onFocus)
    offChanged()
  })
})

/** B58 批C：轻路径加载——getIndex 不解密 contents，唤起重拉不再全库 AES */
async function load(): Promise<void> {
  try {
    const index = (await window.api.snippet.getIndex()) as SnipIndexEntry[]
    detailCache.clear()
    all.value = index.map((s) => ({
      key: `snippet:${s.id}`,
      icon: 'file-code-line',
      title: s.name,
      subtitle: subtitleOf(s),
      language: s.language ?? '',
      id: s.id,
      blockCount: s.blockCount ?? 1
    }))
  } catch {
    /* 片段读取失败显示空态 */
  } finally {
    loading.value = false
  }
}
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

.snip-blocks {
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
}

.snip-block-chip {
  padding: 2px 8px;
  border-radius: 999px;
  border: 1px solid var(--launcher-border);
  background: transparent;
  color: var(--launcher-text-muted);
  font-size: 10px;
  cursor: pointer;
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.snip-block-chip.active {
  border-color: var(--launcher-accent);
  color: var(--launcher-accent);
  background: var(--launcher-accent-soft);
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
