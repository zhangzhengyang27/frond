<template>
  <CapsulePage :hints="hints">
    <div class="shots-idx">
      <div v-if="flash" class="shots-flash">{{ flash }}</div>

      <!-- 左栏：状态条 + 列表 -->
      <div class="shots-list-pane">
        <div class="shots-status">
          <template v-if="status.scanning || status.pending > 0">
            OCR 索引中 {{ status.done }}/{{ status.total }}
          </template>
          <template v-else-if="status.total > 0">已索引 {{ status.total }} 张截图</template>
          <template v-else>尚未索引</template>
          <button class="shots-rescan" type="button" @click="rescan">重新扫描</button>
        </div>

        <div v-if="loading" class="shots-empty">加载截图索引中…</div>
        <div v-else-if="items.length === 0" class="shots-empty">
          {{ emptyText }}
        </div>
        <div v-else class="shots-list">
          <div
            v-for="(item, i) in items"
            :key="item.filePath"
            class="shots-item"
            :class="{ selected: i === selectedIndex }"
            @mouseenter="selectedIndex = i"
            @click="pasteSelected()"
          >
            <img class="shots-thumb" :src="`image://${encodeURI(item.filePath)}`" alt="" />
            <div class="shots-text">
              <div class="shots-title">{{ item.fileName }}</div>
              <div class="shots-sub">
                {{ timeLabel(item.capturedAt)
                }}<template v-if="ocrSnippet(item)"> · {{ ocrSnippet(item) }}</template>
              </div>
            </div>
          </div>
        </div>
      </div>

      <!-- 右栏：详情（大图预览 + OCR 文本） -->
      <div class="shots-detail-pane">
        <div v-if="selected" class="shots-detail">
          <img class="shots-preview" :src="`image://${encodeURI(selected.filePath)}`" alt="" />
          <div class="shots-meta">
            <div class="shots-meta-row">
              <span class="shots-meta-key">名称</span>
              <span class="shots-meta-val">{{ selected.fileName }}</span>
            </div>
            <div class="shots-meta-row">
              <span class="shots-meta-key">大小</span>
              <span class="shots-meta-val">{{ sizeLabel(selected.fileSize) }}</span>
            </div>
            <div class="shots-meta-row">
              <span class="shots-meta-key">时间</span>
              <span class="shots-meta-val">{{ fullTimeLabel(selected.capturedAt) }}</span>
            </div>
            <div v-if="selected.ocrText" class="shots-ocr">{{ selected.ocrText }}</div>
          </div>
        </div>
        <div v-else class="shots-empty">选择左侧截图查看预览</div>
      </div>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
/**
 * 截图库内联页（V4 P1-10，对齐 Raycast Search Screenshots）：
 * 按图内文字（OCR）/ 文件名搜索既有截图，回车把选中截图粘贴到前台应用，
 * ⌘C 复制 OCR 文本，⌘O 在 Finder 中显示，R 重新扫描。
 * OCR 进度经 shotidx:changed 推送刷新（主进程渐进回填）。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { beginBusy, endBusy } from '../composables/useLauncherBusy'
import CapsulePage from './CapsulePage.vue'

interface ShotItem {
  filePath: string
  fileName: string
  fileSize: number
  mtime: number
  capturedAt: number
  ocrStatus: 'pending' | 'done' | 'failed'
  ocrText: string | null
}

const props = defineProps<{ query?: string }>()
const emit = defineEmits<{ 'ask-ai': [text: string] }>()

const loading = ref(true)
const items = ref<ShotItem[]>([])
const selectedIndex = ref(0)
const status = ref({ total: 0, pending: 0, done: 0, failed: 0, scanning: false })
const flash = ref('')
const all = ref<ShotItem[]>([])

const selected = computed<ShotItem | null>(() => items.value[selectedIndex.value] ?? null)

const hints = [
  { keys: '↵', label: '粘贴到前台' },
  { keys: '⌘C', label: '复制文字' },
  { keys: '⌘A', label: '问 AI' },
  { keys: '⌘O', label: 'Finder 显示' },
  { keys: 'R', label: '重新扫描' },
  { keys: 'ESC', label: '返回' }
]

const emptyText = computed(() => {
  if (status.value.total === 0) return '未索引到截图：截一张图或点「重新扫描」'
  if ((props.query ?? '').trim()) return `没有匹配「${props.query}」的截图`
  return '没有截图'
})

let flashTimer: ReturnType<typeof setTimeout> | null = null
function showFlash(text: string): void {
  flash.value = text
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => (flash.value = ''), 1600)
}

async function load(): Promise<void> {
  beginBusy() // I9 统一加载态
  try {
    const q = (props.query ?? '').trim()
    const result = await window.api.shotIndex.search(q, true)
    if (result.success) {
      all.value = result.items
      applyFilter()
    }
    status.value = await window.api.shotIndex.status()
  } finally {
    loading.value = false
    endBusy()
  }
}

/** 客户端二次过滤：status/OCR 进度推送会重拉 all，保留输入中的筛选体验 */
function applyFilter(): void {
  const q = (props.query ?? '').trim().toLowerCase()
  if (!q) {
    items.value = all.value
  } else {
    items.value = all.value.filter(
      (i) => i.fileName.toLowerCase().includes(q) || (i.ocrText ?? '').toLowerCase().includes(q)
    )
  }
  if (selectedIndex.value >= items.value.length) selectedIndex.value = 0
}

watch(
  () => props.query,
  () => {
    applyFilter()
    selectedIndex.value = 0
  }
)

async function refreshStatus(): Promise<void> {
  status.value = await window.api.shotIndex.status()
  // OCR 渐进回填 → 重拉（轻量：仅列表数据）
  const result = await window.api.shotIndex.search((props.query ?? '').trim())
  if (result.success) {
    all.value = result.items
    applyFilter()
  }
}

async function rescan(): Promise<void> {
  showFlash('扫描中…')
  await window.api.shotIndex.scan()
  await refreshStatus()
}

function ocrSnippet(item: ShotItem): string {
  const t = (item.ocrText ?? '').replace(/\s+/g, ' ').trim()
  return t.length > 26 ? `${t.slice(0, 26)}…` : t
}

function timeLabel(ts: number): string {
  const d = new Date(ts)
  const now = new Date()
  const sameDay = d.toDateString() === now.toDateString()
  const hm = `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
  if (sameDay) return hm
  return `${d.getMonth() + 1}/${d.getDate()} ${hm}`
}

function fullTimeLabel(ts: number): string {
  const d = new Date(ts)
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
}

function sizeLabel(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

async function pasteSelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  const result = await window.api.shotIndex.pastePath(item.filePath)
  if (!result.ok) {
    showFlash(result.error ?? '粘贴失败（内容已复制，可手动 ⌘V）')
  }
}

async function copyOcrText(): Promise<void> {
  const item = selected.value
  if (!item?.ocrText) {
    showFlash('该截图暂无识别文本')
    return
  }
  try {
    await navigator.clipboard.writeText(item.ocrText)
    showFlash('已复制文字')
  } catch {
    showFlash('复制失败')
  }
}

function reveal(): void {
  const item = selected.value
  if (item) void window.api.fileSearch.reveal(item.filePath)
}

/** 键盘分发（LauncherApp 集中转发）；返回 true 表示已消费 */
function handleKey(e: KeyboardEvent): boolean {
  // ⌘A：把图内文字交给 AI 解释/翻译（V4 批次5）
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'a') {
    e.preventDefault()
    const item = selected.value
    if (item?.ocrText) {
      emit('ask-ai', `以下是从截图 OCR 识别的文字，请按内容判断并解释或翻译：\n\n${item.ocrText}`)
    }
    return true
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'c') {
    e.preventDefault()
    void copyOcrText()
    return true
  }
  if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'o') {
    e.preventDefault()
    reveal()
    return true
  }
  if (!e.metaKey && !e.ctrlKey && !e.altKey && e.key.toLowerCase() === 'r') {
    e.preventDefault()
    void rescan()
    return true
  }
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (items.value.length > 0) selectedIndex.value = (selectedIndex.value + 1) % items.value.length
    return true
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (items.value.length > 0)
      selectedIndex.value = (selectedIndex.value - 1 + items.value.length) % items.value.length
    return true
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    void pasteSelected()
    return true
  }
  return false
}

defineExpose({ handleKey })

const offChanged = window.api.shotIndex.onChanged(() => void refreshStatus())
onBeforeUnmount(() => {
  // 胶囊是常驻 SPA：路由进出不触发 unload，必须显式退订（审查 I2）
  offChanged()
})

onMounted(() => {
  void load()
})
</script>

<style scoped>
.shots-idx {
  display: flex;
  min-height: 0;
  flex: 1;
  height: 100%;
  position: relative;
}

.shots-flash {
  position: absolute;
  top: 8px;
  left: 50%;
  z-index: 10;
  padding: 4px 12px;
  border-radius: 999px;
  background: var(--launcher-accent);
  color: #fff;
  font-size: 11px;
  transform: translateX(-50%);
}

.shots-list-pane {
  display: flex;
  min-width: 0;
  flex: 1;
  flex-direction: column;
  border-right: 1px solid var(--launcher-border);
}

.shots-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 12px;
  border-bottom: 1px solid var(--launcher-border);
  color: var(--launcher-text-muted);
  font-size: 10px;
}

.shots-rescan {
  border: none;
  background: none;
  color: var(--launcher-text-muted);
  cursor: pointer;
  font-size: 10px;
}

.shots-rescan:hover {
  color: var(--launcher-text);
}

.shots-empty {
  padding: 24px 16px;
  color: var(--launcher-text-muted);
  font-size: 12px;
  text-align: center;
}

.shots-list {
  flex: 1;
  overflow-y: auto;
}

.shots-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 12px;
  cursor: pointer;
}

.shots-item.selected {
  background: var(--launcher-accent-soft);
}

.shots-thumb {
  width: 44px;
  height: 30px;
  flex-shrink: 0;
  border-radius: 4px;
  border: 1px solid var(--launcher-border);
  object-fit: cover;
}

.shots-text {
  min-width: 0;
  flex: 1;
}

.shots-title {
  overflow: hidden;
  font-size: 12px;
  color: var(--launcher-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shots-sub {
  overflow: hidden;
  margin-top: 1px;
  font-size: 10px;
  color: var(--launcher-text-muted);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shots-detail-pane {
  display: flex;
  width: 300px;
  flex-shrink: 0;
  flex-direction: column;
}

.shots-detail {
  display: flex;
  min-height: 0;
  flex: 1;
  flex-direction: column;
  padding: 10px;
}

.shots-preview {
  max-height: 40%;
  width: 100%;
  border-radius: 6px;
  border: 1px solid var(--launcher-border);
  object-fit: contain;
}

.shots-meta {
  margin-top: 8px;
  overflow-y: auto;
}

.shots-meta-row {
  display: flex;
  gap: 8px;
  margin-bottom: 4px;
  font-size: 11px;
}

.shots-meta-key {
  flex-shrink: 0;
  color: var(--launcher-text-muted);
}

.shots-meta-val {
  min-width: 0;
  overflow: hidden;
  color: var(--launcher-text);
  text-overflow: ellipsis;
  white-space: nowrap;
}

.shots-ocr {
  margin-top: 6px;
  padding: 8px;
  border-radius: 6px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text-dim);
  font-size: 11px;
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
