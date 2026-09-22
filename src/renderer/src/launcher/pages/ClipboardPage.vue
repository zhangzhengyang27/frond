<template>
  <CapsulePage :hints="hints">
    <!-- B2 List-Detail：双栏布局在本页内自绘（不用 CapsulePage #detail 插槽）。
         原因：详情列由 CapsulePage 渲染时无法按窗宽收起；自绘可在 <640px 时整体隐藏详情，
         胶囊窗固定 720px 宽（LAUNCHER_WIDTH），该断点属前瞻兜底。 -->
    <div ref="rootEl" class="clip-page">
      <div v-if="copiedFlash" class="clip-flash">{{ flashText }}</div>

      <!-- 左栏：分组列表（类型筛选已迁至搜索栏右侧下拉，I6；唯一焦点域） -->
      <div class="clip-list-pane">
        <div v-if="loading" class="clip-empty">加载剪贴板历史中…</div>
        <div v-else-if="filtered.length === 0" class="clip-empty">{{ emptyText }}</div>
        <div v-else class="clip-list">
          <div v-for="group in groups" :key="group.key" class="clip-group">
            <div class="clip-group-header">{{ group.label }}</div>
            <div
              v-for="item in group.items"
              :key="item.id"
              class="clip-item"
              :class="{ selected: item.id === selected?.id }"
              @mouseenter="selectedIndex = filtered.findIndex((i) => i.id === item.id)"
              @click="pasteSelected()"
            >
              <div class="clip-icon">
                <AppIcon :icon="iconOf(item)" :size="16" />
              </div>
              <!-- I8 对齐 Raycast 单行：标题 + 数字徽标（日期由分区头承载，元数据在详情列） -->
              <div class="clip-title">
                <span v-if="item.pinned" class="clip-pin">📌</span>
                {{ titleOf(item) }}
              </div>
              <span v-if="quickLabelOf(item)" class="clip-quick">{{ quickLabelOf(item) }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 右栏：详情面板（Raycast Detail：内容预览 + 元数据表） -->
      <div class="clip-detail-pane">
        <div v-if="selected" class="clip-detail">
          <div class="clip-detail-preview">
            <div v-if="selected.kind === 'image'" class="clip-img-wrap">
              <img
                class="clip-preview"
                :src="`image://${encodeURI(selected.filePath ?? '')}`"
                alt="clipboard image"
              />
              <UButton size="sm" variant="ghost" @click="decodeQrOf(selected)">识别二维码</UButton>
            </div>
            <pre v-else-if="selected.kind === 'files'" class="clip-code">{{
              (selected.paths ?? []).join('\n')
            }}</pre>
            <div v-else-if="selected.kind === 'link'" class="clip-link-wrap">
              <img
                v-if="linkFavicon"
                class="clip-link-favicon"
                :src="`image://${encodeURI(linkFavicon)}`"
                alt=""
              />
              <a
                class="clip-link"
                tabindex="-1"
                :href="selected.text"
                @click.prevent="openLink(selected!.text!)"
                >{{ selected.text }}</a
              >
            </div>
            <pre v-else class="clip-code">{{ selected.text }}</pre>
          </div>
          <div class="clip-meta">
            <div v-for="row in detailRows" :key="row.label" class="clip-meta-row">
              <span class="clip-meta-label">{{ row.label }}</span>
              <span class="clip-meta-value" :title="row.value">{{ row.value }}</span>
            </div>
          </div>
        </div>
        <div v-else class="clip-empty">选择左侧条目查看内容</div>
      </div>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UButton from '@components/ui/UButton.vue'
import CapsulePage from './CapsulePage.vue'
import {
  detailTime,
  filterByKind,
  groupItems,
  kindLabelOf,
  sizeSummaryOf,
  titleOf,
  type ClipItemLike,
  type KindFilter
} from './clipboardLogic'
import { digitToIndex } from '../composables/launcherInteractions'
import { beginBusy, endBusy } from '../composables/useLauncherBusy'

type ClipItem = ClipItemLike

const props = defineProps<{ query?: string; filter?: KindFilter }>()
const emit = defineEmits<{ 'ask-ai': [text: string]; 'update:filter': [KindFilter] }>()

const rootEl = ref<HTMLElement | null>(null)
/** 链接条目的 favicon 本地缓存路径（复用 Quicklink favicon 通道，V4 P1-12） */
const linkFavicon = ref('')
const items = ref<ClipItem[]>([])
const loading = ref(true)
const selectedIndex = ref(0)
/** I6：类型筛选状态提升到搜索栏下拉（v-model:filter），此处只做读写代理 */
const kindFilter = computed<KindFilter>({
  get: () => props.filter ?? 'all',
  set: (v) => emit('update:filter', v)
})
const nowMs = ref(Date.now())
const copiedFlash = ref(false)
const flashText = ref('已复制到剪贴板')
let flashTimer: ReturnType<typeof setTimeout> | null = null
/** I2 目标级文案：唤起 Leaf 前的前台应用名（主进程隐藏期轮询缓存） */
const frontApp = ref('')

/**
 * 主查询即过滤（同 SnippetsPage）+ 类型筛选（纯前端）。
 * 排序保持既有行为：置顶在前，其余按复制时间倒序。
 */
const filtered = computed<ClipItem[]>(() => {
  const q = (props.query ?? '').trim().toLowerCase()
  const sorted = [...items.value].sort((a, b) => {
    if (!!a.pinned !== !!b.pinned) return a.pinned ? -1 : 1
    return b.createdAt - a.createdAt
  })
  const byKind = filterByKind(sorted, kindFilter.value)
  if (!q) return byKind
  return byKind.filter((i) => {
    const hay =
      i.kind === 'files'
        ? (i.paths ?? []).join('\n')
        : (i.text ?? `${i.width ?? ''}x${i.height ?? ''}`)
    return hay.toLowerCase().includes(q)
  })
})

/** 今天/昨天/更早（+置顶）分组；组内保持 filtered 顺序 */
const groups = computed(() => groupItems(filtered.value, nowMs.value))

const selected = computed(() => filtered.value[selectedIndex.value] ?? null)

/** 数字徽标定位（I8 Raycast 语义）：扁平下标 → 1-0 徽标，仅前 10 条 */
const indexById = computed(() => new Map(filtered.value.map((i, idx) => [i.id, idx] as const)))

function quickLabelOf(item: ClipItem): string | null {
  const idx = indexById.value.get(item.id)
  if (idx === undefined || idx >= 10) return null
  return idx < 9 ? String(idx + 1) : '0'
}

const emptyText = computed(() => {
  if ((props.query ?? '').trim() || kindFilter.value !== 'all') return '没有匹配的历史'
  return '还没有历史——复制任意内容后这里就会出现'
})

/** 详情元数据：来源 / 类型 / 字符数(尺寸|数量) / 复制时间 */
const detailRows = computed(() => {
  const it = selected.value
  if (!it) return []
  const sizeLabel = it.kind === 'image' ? '尺寸' : it.kind === 'files' ? '数量' : '字符数'
  return [
    { label: '来源', value: it.sourceApp || '未知' },
    { label: '类型', value: kindLabelOf(it.kind) },
    { label: sizeLabel, value: sizeSummaryOf(it) },
    { label: '复制时间', value: detailTime(it.createdAt, nowMs.value) }
  ]
})

/** I2：主动作带目标应用名（Raycast「Paste to <app>」语义）；未取到时退回通用文案 */
const hints = computed<Array<{ keys: string; label: string }>>(() => [
  { keys: '↵', label: frontApp.value ? `粘贴到 ${frontApp.value}` : '粘贴到前台应用' },
  { keys: '⌘C', label: '仅复制' },
  { keys: '⌘I', label: 'AI 加工' },
  { keys: 'Q', label: '识别二维码' },
  { keys: '⌘P', label: '置顶' },
  { keys: '⌘⌫', label: '删除' }
])

function iconOf(item: ClipItem): string {
  if (item.kind === 'image') return 'image-line'
  if (item.kind === 'files') return 'folder-line'
  if (item.kind === 'link') return 'link'
  return 'file-text-line'
}

function flash(msg: string): void {
  flashText.value = msg
  copiedFlash.value = true
  if (flashTimer) clearTimeout(flashTimer)
  flashTimer = setTimeout(() => {
    copiedFlash.value = false
  }, 1500)
}

/** 粘贴直达：写回剪贴板 → 主进程收起胶囊并向前台应用注入 ⌘V */
async function pasteSelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  const result = await window.api.clipHist.pasteBack(item.id)
  if (!result.ok) {
    // 未授权辅助功能等：内容已写回剪贴板，提示手动粘贴
    flash('已复制（自动粘贴失败，请手动 ⌘V）')
  }
}

/** 仅复制不粘贴 */
async function copySelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  const ok = await window.api.clipHist.copy(item.id)
  if (ok) flash('已复制到剪贴板')
}

async function pinSelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  await window.api.clipHist.togglePin(item.id)
  item.pinned = !item.pinned
  flash(item.pinned ? '已置顶' : '已取消置顶')
}

async function removeSelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  await window.api.clipHist.remove(item.id)
  items.value = items.value.filter((i) => i.id !== item.id)
  if (selectedIndex.value >= filtered.value.length) {
    selectedIndex.value = Math.max(0, filtered.value.length - 1)
  }
}

  const item = selected.value
  if (!item) return
  const ok = await window.api.clipHist.copy(item.id)
  if (ok) flash('已复制到剪贴板')
}

async function pinSelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  await window.api.clipHist.togglePin(item.id)
  item.pinned = !item.pinned
  flash(item.pinned ? '已置顶' : '已取消置顶')
}

async function removeSelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  await window.api.clipHist.remove(item.id)
  items.value = items.value.filter((i) => i.id !== item.id)
  if (selectedIndex.value >= filtered.value.length) {
    selectedIndex.value = Math.max(0, filtered.value.length - 1)
  }
}

/** 识别图片条目二维码：成功后文本已在剪贴板（主进程回填），flash 提示 */
async function decodeQrOf(item: ClipItem): Promise<void> {
  if (!item.filePath) return
  const result = await window.api.clipHist.decodeQr(item.id)
  if (result.ok && result.text) {
    flash(
      `已复制二维码文本：${result.text.length > 24 ? result.text.slice(0, 24) + '…' : result.text}`
    )
  } else {
    flash(result.error ?? '未识别到二维码')
  }
}

/** 按条目类型组装 AI 加工提示词（仅发送单条内容） */
function aiProcess(item: ClipItem): void {
  if (item.kind === 'image') {
  if (filtered.value.length === 0) return
  selectedIndex.value =
    (selectedIndex.value + delta + filtered.value.length) % filtered.value.length
  // 列表按分组渲染但元素顺序与 filtered 一致，按索引定位即可
  const nodes = rootEl.value?.querySelectorAll('.clip-item')
  nodes?.[selectedIndex.value]?.scrollIntoView({ block: 'nearest' })
}

/** 键盘分发（LauncherApp 集中转发）；返回 true 表示已消费 */
function handleKey(e: KeyboardEvent): boolean {
  // 类型下拉聚焦时按键全部交给原生 select（否则方向键会同时改下拉值和列表选中项）；
  // ESC 不经过本函数，仍由 LauncherApp 优先处理收起胶囊
  if ((e.target as HTMLElement | null)?.tagName === 'SELECT') return false
  // 数字 1-0 直达选中第 N 条（Raycast 徽标语义；搜索框聚焦时数字仍作过滤词）
  if (
    (e.target as HTMLElement | null)?.tagName !== 'INPUT' &&
    !e.metaKey &&
    !e.ctrlKey &&
    !e.altKey
  ) {
    const idx = digitToIndex(e.key)
    if (idx !== null && filtered.value[idx]) {
      selectedIndex.value = idx
      rootEl.value?.querySelectorAll('.clip-item')[idx]?.scrollIntoView({ block: 'nearest' })
      return true
    }
  }
  if (e.key === 'ArrowDown') {
    moveSelection(1)
    return true
  }
  if (e.key === 'ArrowUp') {
    moveSelection(-1)
    return true
  }
  if (e.key === 'Enter') {
    void pasteSelected()
    return true
  }
  // Q：识别图片条目中的二维码（V4 P1-12 批次3）；搜索框输入时不劫持
  if (
    (e.target as HTMLElement | null)?.tagName !== 'INPUT' &&
    !e.metaKey &&
    !e.ctrlKey &&
    (e.key === 'q' || e.key === 'Q')
  ) {
    const item = selected.value
    if (item?.kind === 'image') {
      void decodeQrOf(item)
      return true
    }
  }
  // ⌘I：AI 加工选中条目（V4 批次5 收尾：单条内容发送，隐私面最小）
  if ((e.metaKey || e.ctrlKey) && (e.key === 'i' || e.key === 'I')) {
    e.preventDefault()
    const item = selected.value
    if (item) aiProcess(item)
    return true
  }
  if (e.metaKey || e.ctrlKey) {
    if (e.key === 'c' || e.key === 'C') {
      void copySelected()
      return true
    }
    if (e.key === 'p' || e.key === 'P') {
      void pinSelected()
      return true
    }
    if (e.key === 'Backspace' || e.key === 'Delete') {
      void removeSelected()
      return true
    }
  }
  return false
}

defineExpose({ handleKey })

watch(
  selected,
  (item) => {
    linkFavicon.value = ''
    if (item?.kind !== 'link' || !item.text) return
    void window.api.launcher
      .quicklinkFavicon(item.text)
      .then((path) => {
        // 异步回填防串位：仅当选中的仍是这条链接时才写入
        if (selected.value?.id === item.id && path) linkFavicon.value = path
      })
      .catch(() => {
        /* favicon 拉取失败：保持通用图标 */
      })
  },
  { immediate: true }
)

watch(
  () => props.query,
  () => {
    selectedIndex.value = 0
  }
)

// 切换类型筛选后选中项回到列表顶部
watch(kindFilter, () => {
  selectedIndex.value = 0
})

onMounted(async () => {
  nowMs.value = Date.now()
  beginBusy() // I9 统一加载态
  try {
    items.value = (await window.api.clipHist.list()) as ClipItem[]
  } catch {
    /* 历史读取失败显示空态 */
  } finally {
    loading.value = false
    endBusy()
  }
  try {
    frontApp.value = (await window.api.system.frontmostApp()) ?? ''
  } catch {
    /* 缓存不可用时退回通用文案 */
  }
})
</script>

<style scoped>
/* ── 双栏骨架：左列表 + 右详情（Raycast List-Detail）── */
.clip-page {
  height: 100%;
  min-height: 0;
  display: flex;
  align-items: stretch;
  padding: 6px;
  box-sizing: border-box;
  position: relative;
}

.clip-list-pane {
  flex: 1 1 auto;
  min-width: 0;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding-right: 8px;
}

/* 窄窗（<640px）退化为单栏：直接隐藏详情面板（选择的最简单方案）。
   详情信息（类型/来源/时间）都在右栏元数据表，复制/粘贴/删除等操作也都在列表上可用。 */
@media (max-width: 639px) {
  .clip-detail-pane {
    display: none;
  }

  .clip-list-pane {
    padding-right: 0;
  }
}

.clip-detail-pane {
  /* V7 对齐 Raycast：详情列 465px（750 窗下左列表 ~285） */
  flex: 0 0 var(--launcher-detail-width);
  min-width: 0;
  min-height: 0;
  border-left: 1px solid var(--launcher-border);
  padding: 2px 0 2px 12px;
  overflow-y: auto;
  box-sizing: border-box;
}

/* ── 分组列表 ── */
.clip-list {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.clip-group-header {
  position: sticky;
  top: 0;
  z-index: 1;
  background: var(--launcher-bg);
  font-size: 11px;
  font-weight: 600;
  color: var(--launcher-text-muted);
  padding: 8px 10px 3px;
  user-select: none;
}

.clip-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 0 10px;
  height: 38px;
  box-sizing: border-box;
  border-radius: 9px;
  cursor: pointer;
}

.clip-item.selected {
  background: var(--launcher-selected-bg);
}

.clip-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  flex-shrink: 0;
  color: var(--launcher-text-muted);
}

.clip-title {
  flex: 1;
  min-width: 0;
  font-size: 13px;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-pin {
  font-size: 11px;
  margin-right: 2px;
}

.clip-quick {
  flex-shrink: 0;
  font-size: 10px;
  color: var(--launcher-text-muted);
  font-weight: 500;
  min-width: 18px;
  text-align: center;
  padding: 1px 0;
  border-radius: 4px;
  background: var(--launcher-bg-elevated);
}

/* ── 详情面板 ── */
.clip-detail {
  height: 100%;
  min-height: 0;
  display: flex;
  flex-direction: column;
  gap: 10px;
}

.clip-detail-preview {
  flex: 1 1 auto;
  min-height: 0;
  overflow: auto;
  display: flex;
  flex-direction: column;
}

.clip-img-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
}

.clip-preview {
  flex: none;
  max-width: 100%;
  max-height: 100%;
  object-fit: contain;
  border-radius: 8px;
  align-self: center;
}

.clip-code {
  margin: 0;
  font-family: var(--font-mono, ui-monospace, monospace);
  font-size: 12px;
  color: var(--launcher-text-dim);
  white-space: pre-wrap;
  word-break: break-all;
  line-height: 1.5;
}

.clip-link {
  font-size: 13px;
  color: var(--launcher-accent);
  word-break: break-all;
}

.clip-link-wrap {
  display: flex;
  align-items: flex-start;
  gap: 8px;
}

.clip-link-favicon {
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  margin-top: 3px;
  border-radius: 3px;
}

.clip-meta {
  flex: none;
  display: flex;
  flex-direction: column;
  gap: 6px;
  padding-top: 10px;
  border-top: 1px solid var(--launcher-hairline);
}

.clip-meta-row {
  display: flex;
  gap: 10px;
  font-size: 11px;
  min-width: 0;
}

.clip-meta-label {
  flex: none;
  width: 52px;
  color: var(--launcher-text-muted);
}

.clip-meta-value {
  flex: 1;
  min-width: 0;
  color: var(--launcher-text-dim);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.clip-flash {
  position: absolute;
  top: 6px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 10;
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--launcher-border);
  background: var(--launcher-popover-bg);
  font-size: 11px;
  color: var(--launcher-accent);
  white-space: nowrap;
}

.clip-empty {
  padding: 24px 10px;
  text-align: center;
  font-size: 12px;
  color: var(--launcher-text-faint);
}
</style>

