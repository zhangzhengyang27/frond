<template>
  <CapsulePage :hints="hints">
    <div class="files-page">
      <div class="files-toolbar">
        <div class="files-mode">
          <button
            type="button"
            class="files-mode-btn"
            :class="{ active: mode === 'name' }"
            @click="mode = 'name'"
          >
            文件名
          </button>
          <button
            type="button"
            class="files-mode-btn"
            :class="{ active: mode === 'content' }"
            @click="mode = 'content'"
          >
            全文
          </button>
        </div>
        <input
          v-model="onlyIn"
          class="files-dir"
          type="text"
          placeholder="限定目录（可选）"
          spellcheck="false"
        />
      </div>
      <div v-if="!supported" class="files-empty">文件搜索当前仅支持 macOS</div>
      <div v-else-if="!query.trim()" class="files-empty">
        {{
          mode === 'content'
            ? '输入关键词搜索文件内容（较慢）'
            : '输入文件名开始搜索（Spotlight 索引）'
        }}
      </div>
      <div v-else-if="loading" class="files-empty">搜索中…</div>
      <div v-else-if="items.length === 0" class="files-empty">没有匹配「{{ query }}」的文件</div>
      <div v-else class="files-list">
        <div
          v-for="(item, index) in items"
          :key="item.path"
          class="files-item"
          :class="{ selected: index === selectedIndex }"
          @mouseenter="selectedIndex = index"
          @click="openSelected()"
        >
          <div class="files-icon">
            <AppIcon :icon="fileIcon(item.name)" :size="16" />
          </div>
          <div class="files-text">
            <div class="files-title">{{ item.name }}</div>
            <div class="files-sub">
              <span>{{ item.dir }}</span>
              <span v-if="item.size !== undefined" class="files-meta">{{
                formatSize(item.size)
              }}</span>
              <span v-if="item.modifiedAt" class="files-meta">{{
                formatTime(item.modifiedAt)
              }}</span>
            </div>
          </div>
        </div>
      </div>
    </div>
    <!-- Detail：选中文件的完整路径 -->
    <template #detail>
      <div v-if="selected" class="files-detail">
        <div class="files-detail-name">{{ selected.name }}</div>
        <pre class="files-detail-path">{{ selected.path }}</pre>
      </div>
      <div v-else class="files-empty">选择左侧文件查看路径</div>
    </template>
  </CapsulePage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import CapsulePage from './CapsulePage.vue'
import { formatSmartDate } from '@utils/format'

interface FileHit {
  path: string
  name: string
  dir: string
  size?: number
  modifiedAt?: number
}

const props = defineProps<{ query: string }>()

const items = ref<FileHit[]>([])
const loading = ref(false)
const supported = ref(true)
const selectedIndex = ref(0)
/** 搜索模式：文件名（-name）/ 全文（内容与元数据，较慢） */
const mode = ref<'name' | 'content'>('name')
/** 限定目录（可选）：填绝对路径时加 mdfind -onlyin */
const onlyIn = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const selected = computed(() => items.value[selectedIndex.value] ?? null)

const hints = [
  { keys: '↵', label: '打开' },
  { keys: '⌘R', label: '在 Finder 显示' },
  { keys: '⌘C', label: '复制路径' },
  { keys: 'ESC', label: '返回' }
]

/** 根据文件扩展名返回对应图标 */
function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const iconMap: Record<string, string> = {
    // 图片
    png: 'image-line',
    jpg: 'image-line',
    jpeg: 'image-line',
    gif: 'image-line',
    svg: 'image-line',
    webp: 'image-line',
    bmp: 'image-line',
    ico: 'image-line',
    // 文档
    pdf: 'file-pdf-line',
    doc: 'file-text-line',
    docx: 'file-text-line',
    txt: 'file-text-line',
    md: 'file-text-line',
    rtf: 'file-text-line',
    // 表格
    xls: 'file-excel-line',
    xlsx: 'file-excel-line',
    csv: 'file-excel-line',
    // 演示
    ppt: 'file-ppt-line',
    pptx: 'file-ppt-line',
    key: 'file-ppt-line',
    // 代码
    js: 'code-line',
    ts: 'code-line',
    jsx: 'code-line',
    tsx: 'code-line',
    py: 'code-line',
    java: 'code-line',
    c: 'code-line',
    cpp: 'code-line',
    h: 'code-line',
    go: 'code-line',
    rs: 'code-line',
    rb: 'code-line',
    php: 'code-line',
    swift: 'code-line',
    kt: 'code-line',
    json: 'braces-line',
    xml: 'code-line',
    html: 'code-line',
    css: 'code-line',
    scss: 'code-line',
    less: 'code-line',
    vue: 'code-line',
    sql: 'code-line',
    sh: 'terminal-line',
    bash: 'terminal-line',
    zsh: 'terminal-line',
    // 压缩
    zip: 'file-zip-line',
    rar: 'file-zip-line',
    '7z': 'file-zip-line',
    tar: 'file-zip-line',
    gz: 'file-zip-line',
    // 视频
    mp4: 'film-line',
    mov: 'film-line',
    avi: 'film-line',
    mkv: 'film-line',
    flv: 'film-line',
    wmv: 'film-line',
    webm: 'film-line',
    // 音频
    mp3: 'music-line',
    wav: 'music-line',
    flac: 'music-line',
    aac: 'music-line',
    ogg: 'music-line',
    m4a: 'music-line',
    // 字体
    ttf: 'font-size',
    otf: 'font-size',
    woff: 'font-size',
    woff2: 'font-size',
    // 可执行
    app: 'app-line',
    exe: 'app-line',
    dmg: 'hard-drive-line',
    pkg: 'hard-drive-line',
    msi: 'hard-drive-line',
    // 设计
    psd: 'palette-line',
    ai: 'palette-line',
    sketch: 'palette-line',
    fig: 'palette-line',
    xd: 'palette-line'
  }
  return iconMap[ext] ?? 'file-line'
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

/** 格式化修改时间 */
const formatTime = (ts?: number): string => (ts ? formatSmartDate(ts) : '')

watch([() => props.query, mode, onlyIn], ([q]) => {
  selectedIndex.value = 0
  if (searchTimer) clearTimeout(searchTimer)
  if (!q.trim()) {
    items.value = []
    return
  }
  // 300ms 防抖后走 mdfind
  searchTimer = setTimeout(() => {
    void runSearch(q)
  }, 300)
})

// 过期请求守卫：mode/关键词切换后，慢的旧响应不得覆盖新结果
let searchSeq = 0

async function runSearch(q: string): Promise<void> {
  const seq = ++searchSeq
  loading.value = true
  try {
    const result = await window.api.fileSearch.query(q, 30, {
      mode: mode.value,
      onlyIn: onlyIn.value.trim() || undefined
    })
    if (seq !== searchSeq) return
    supported.value = result.supported
    items.value = result.items ?? []
  } catch {
    if (seq !== searchSeq) return
    items.value = []
  } finally {
    if (seq === searchSeq) {
      loading.value = false
    }
  }
}

function openSelected(): void {
  const item = selected.value
  if (!item) return
  void window.api.system.openPath(item.path)
  window.api.launcher.hide()
}

function revealSelected(): void {
  const item = selected.value
  if (!item) return
  void window.api.fileSearch.reveal(item.path)
  window.api.launcher.hide()
}

function copyPath(): void {
  const item = selected.value
  if (!item) return
  navigator.clipboard.writeText(item.path).catch(() => {
    /* 剪贴板写入失败时静默 */
  })
}

function moveSelection(delta: number): void {
  if (items.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + delta + items.value.length) % items.value.length
  document
    .querySelectorAll('.files-item')
    [selectedIndex.value]?.scrollIntoView({ block: 'nearest' })
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
    openSelected()
    return true
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'r' || e.key === 'R')) {
    revealSelected()
    return true
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
    copyPath()
    return true
  }
  return false
}

defineExpose({ handleKey })

onMounted(() => {
  // 挂载时主进程探测平台支持（清空 items 即显示不支持文案）
  void window.api.fileSearch.query('', 1).then((r) => {
    supported.value = r.supported
  })
})
</script>

<style scoped>
.files-page {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.files-toolbar {
  display: flex;
  align-items: center;
  gap: 8px;
}

.files-mode {
  display: flex;
  flex-shrink: 0;
  gap: 2px;
  padding: 2px;
  border: 1px solid var(--launcher-border);
  border-radius: 8px;
  background: var(--launcher-bg-elevated);
}

.files-mode-btn {
  border: none;
  background: transparent;
  color: var(--launcher-text-dim);
  font-size: 11px;
  line-height: 1;
  padding: 4px 9px;
  border-radius: 6px;
  cursor: pointer;
}

.files-mode-btn.active {
  background: var(--launcher-accent-soft);
  color: var(--launcher-accent);
}

.files-dir {
  flex: 1;
  min-width: 0;
  padding: 5px 9px;
  border: 1px solid var(--launcher-border);
  border-radius: 8px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text);
  font-size: 11px;
  outline: none;
}

.files-dir::placeholder {
  color: var(--launcher-text-muted);
}

.files-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.files-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 7px 10px;
  border-radius: 9px;
  cursor: pointer;
}

.files-item.selected {
  background: var(--launcher-accent-soft);
}

.files-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text-dim);
  flex-shrink: 0;
}

.files-item.selected .files-icon {
  color: var(--launcher-accent);
}

.files-text {
  flex: 1;
  min-width: 0;
}

.files-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.files-sub {
  font-size: 11px;
  color: var(--launcher-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
  direction: rtl;
  text-align: left;
  display: flex;
  align-items: center;
  gap: 8px;
}

.files-meta {
  flex-shrink: 0;
  color: var(--launcher-text-faint);
  direction: ltr;
}

.files-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.files-detail-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--launcher-text);
  word-break: break-all;
}

.files-detail-path {
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--launcher-border);
  background: var(--launcher-bg-elevated);
  font-family: var(--font-mono, ui-monospace, Menlo, monospace);
  font-size: 11px;
  line-height: 1.5;
  color: var(--launcher-text-dim);
  white-space: pre-wrap;
  word-break: break-all;
}

.files-empty {
  padding: 22px 0;
  text-align: center;
  font-size: 12px;
  color: var(--launcher-text-muted);
}
</style>
