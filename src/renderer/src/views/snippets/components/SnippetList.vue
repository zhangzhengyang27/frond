<script setup lang="ts">
/*
 * 2026-09-23 重建件：SnippetList.vue 被截断，仅存 12 行真实代码（脚本前段，逐字保留）。
 * 契约来源：父级 views/snippets/index.vue 的绑定（selectedSnippet / searchQuery 两个 v-model、
 * folderId / libraryFilter / folders），数据一律走 preload 里既有的 window.api.snippet.*。
 * 待核：模板整体重建，右键菜单条目按存留的 showContextMenu / contextMenuPosition 反推。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UEmpty from '@components/ui/UEmpty.vue'
import { useFolders } from '@composables/useFolders'
import { useAsyncGuard } from '@composables/useAsyncGuard'
import { useDismissablePopup } from '@composables/useDismissablePopup'
import { confirm } from '@composables/useConfirm'
import { useToast } from '@composables/useToast'
import { formatSmartDate } from '@utils/format'
import type { Snippet } from '@preload/index.d'

interface FolderLike {
  id: string
  name: string
  defaultLanguage?: string
  icon?: string | null
}

interface TreeNode {
  id: string
  name: string
  children?: TreeNode[]
}

const props = defineProps<{
  selectedSnippet: Snippet | null
  searchQuery: string
  folderId: string | null
  libraryFilter: 'all' | 'inbox' | 'favorites' | 'trash'
  folders: FolderLike[]
  /** B58：标签筛选（与 folderId 互斥，由 Sidebar 保证）；undefined = 未启用 */
  selectedTagId?: string | null
  tags?: Array<{ id: string; name: string }>
}>()

const emit = defineEmits<{
  'update:selectedSnippet': [snippet: Snippet | null]
  'update:searchQuery': [value: string]
}>()

const { folders: allFolders, folderTree, findFolderById } = useFolders()

const snippets = ref<Snippet[]>([])
const searchInput = ref('')
// 防抖后的搜索词：filteredSnippets 只消费它，每次键入不再全量扫描片段全文
const debouncedSearch = ref('')
// 搜索输入防抖定时器（卸载时 flush/clear，见下方 onBeforeUnmount）
let searchDebounceTimer: number | null = null

// 右键菜单相关状态
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
// B54：菜单容器——Esc 关闭 + 外点关闭 + role=menu 语义（此前只靠 click 冒泡、无 Esc）
const contextMenuRef = ref<HTMLElement | null>(null)
useDismissablePopup(contextMenuRef, showContextMenu, closeContextMenu)

const loading = ref(false)
const loadingMore = ref(false)
const loadError = ref(false)
const listRef = ref<HTMLElement | null>(null)
const total = ref(0)

const hasMore = computed(() => snippets.value.length < total.value)
const contextTarget = ref<Snippet | null>(null)

const TITLE: Record<'all' | 'inbox' | 'favorites' | 'trash', string> = {
  all: '全部片段',
  inbox: '收件箱',
  favorites: '收藏',
  trash: '回收站'
}

const listTitle = computed(() => {
  // B58：标签视图标题（Sidebar 已保证互斥：选标签时 folderId 为 null）
  if (props.selectedTagId) {
    return props.tags?.find((t) => t.id === props.selectedTagId)?.name ?? '标签'
  }
  if (props.folderId) return findFolderById(props.folderId)?.name ?? TITLE[props.libraryFilter]
  return TITLE[props.libraryFilter]
})

/** 移动菜单用的扁平文件夹列表（按树展开，带缩进层级） */
function flattenFolders(
  nodes: TreeNode[],
  depth = 0
): Array<{ id: string; name: string; depth: number }> {
  const out: Array<{ id: string; name: string; depth: number }> = []
  for (const node of nodes) {
    out.push({ id: node.id, name: node.name, depth })
    if (node.children?.length) out.push(...flattenFolders(node.children, depth + 1))
  }
  return out
}

const folderOptions = computed(() => flattenFolders(folderTree.value))

function firstLine(snippet: Snippet): string {
  const value = snippet.contents?.[0]?.value ?? ''
  return value.split('\n').find((l) => l.trim() !== '') ?? ''
}

// 批3：列表数据整体来自 listSnippets 分页契约（搜索下沉 SQL LIKE），客户端不再二次过滤
const PAGE_SIZE = 200
type LoadMode = 'reset' | 'refresh' | 'append'

// 竞态守卫（B50）：切文件夹/切过滤/键入搜索后，慢的旧 IPC 响应晚到会把旧结果
// 覆盖（或经 append 拼进）新列表——每次 loadSnippets 领轮次，回写前验轮次
const loadGuard = useAsyncGuard()

async function loadSnippets(mode: LoadMode = 'refresh'): Promise<void> {
  const mine = loadGuard.begin()
  if (mode === 'append') loadingMore.value = true
  else loading.value = true
  try {
    const isTrash = props.libraryFilter === 'trash'
    const res = await window.api.snippet.listSnippets(
      {
        // B56-2：库视图（无选中文件夹）必须显式 null——?? undefined 会抹掉 null，
        // 主进程的 folder_id IS NULL（收件箱）过滤门槛 folderId !== undefined 永假
        folderId: props.folderId ?? (props.libraryFilter === 'inbox' ? null : undefined),
        // B58：标签筛选（Sidebar 保证与 folderId 互斥，不会出现交集双过滤）
        tagId: props.selectedTagId ?? undefined,
        isDeleted: isTrash,
        isFavorites: props.libraryFilter === 'favorites' ? true : undefined,
        isInbox: props.libraryFilter === 'inbox' ? true : undefined,
        search: debouncedSearch.value || undefined
      } as unknown as Parameters<typeof window.api.snippet.listSnippets>[0],
      mode === 'refresh' ? Math.max(PAGE_SIZE, snippets.value.length) : PAGE_SIZE,
      mode === 'append' ? snippets.value.length : 0
    )
    if (!loadGuard.isCurrent(mine)) return // 期间有新一轮拉取：丢弃本次回写
    snippets.value = mode === 'append' ? [...snippets.value, ...res.items] : res.items
    total.value = res.total
    loadError.value = false
  } catch (error) {
    if (!loadGuard.isCurrent(mine)) return
    console.error('[SnippetList] 读取片段列表失败:', error)
    // B56-11：错误态与空态区分——误导性的「还没有片段」会让用户以为数据丢了
    if (mode !== 'append') {
      snippets.value = []
      loadError.value = true
    }
  } finally {
    if (loadGuard.isCurrent(mine)) {
      loading.value = false
      loadingMore.value = false
    }
  }
}

/** 滚动接近底部自动追加下一页 */
function onListScroll(e: Event): void {
  const el = e.target as HTMLElement
  if (loading.value || loadingMore.value || !hasMore.value) return
  if (el.scrollTop + el.clientHeight >= el.scrollHeight - 120) void loadSnippets('append')
}

function select(snippet: Snippet): void {
  emit('update:selectedSnippet', snippet)
}

/** B56-4：新建片段——落在当前文件夹视图（库视图不归属），创建即选中进编辑器；
 *  B58：继承所在文件夹的默认语言（此前恒 plaintext，文件夹的 defaultLanguage 是死字段） */
async function createSnippet(): Promise<void> {
  try {
    const defaultLanguage =
      props.folders.find((f) => f.id === props.folderId)?.defaultLanguage || 'plaintext'
    const created = await window.api.snippet.addSnippet({
      name: '未命名片段',
      description: '',
      contents: [{ id: '', label: '代码 1', value: '', language: defaultLanguage }],
      tagIds: [],
      isDeleted: false,
      isFavorites: false,
      folderId: props.folderId
    } as unknown as Parameters<typeof window.api.snippet.addSnippet>[0])
    await loadSnippets('refresh')
    const fresh = snippets.value.find((x) => x.id === created.id)
    if (fresh) emit('update:selectedSnippet', fresh)
  } catch (error) {
    console.error('[SnippetList] 新建片段失败:', error)
  }
}

function closeContextMenu(): void {
  showContextMenu.value = false
  contextTarget.value = null
}

// B58：导入/导出入口——IPC 全链（对话框、幂等去重、20MB 上限）早已就绪，
// 此前渲染端无任何调用方，备份/迁移是断头路。反馈走 toast
const toast = useToast()

async function exportAll(): Promise<void> {
  try {
    const res = await window.api.snippet.exportAll()
    if (res?.ok) {
      toast.success(`已导出 ${res.count} 个片段`, { description: res.filePath })
    } else if (res && !res.canceled) {
      toast.error('导出失败', { description: res.error })
    }
  } catch (error) {
    toast.error('导出失败', { description: (error as Error).message })
  }
}

async function importFromFile(): Promise<void> {
  try {
    const res = await window.api.snippet.importFile()
    if (res?.ok) {
      toast.success(`导入完成：新增 ${res.imported} · 跳过 ${res.skipped}`)
      await loadSnippets('refresh')
    } else if (res && !res.canceled) {
      toast.error('导入失败', { description: res.error })
    }
  } catch (error) {
    toast.error('导入失败', { description: (error as Error).message })
  }
}

async function openContextMenu(snippet: Snippet, event: MouseEvent): Promise<void> {
  contextTarget.value = snippet
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  showContextMenu.value = true
  // 视口钳制：渲染后按实际尺寸夹回可视区（fixed + clientX/Y 靠右/下缘会被裁剪）
  await nextTick()
  const el = contextMenuRef.value
  if (!el) return
  const rect = el.getBoundingClientRect()
  const maxX = window.innerWidth - rect.width - 8
  const maxY = window.innerHeight - rect.height - 8
  contextMenuPosition.value = {
    x: Math.max(8, Math.min(contextMenuPosition.value.x, maxX)),
    y: Math.max(8, Math.min(contextMenuPosition.value.y, maxY))
  }
}

async function applyUpdate(snippet: Snippet, updates: Partial<Snippet>): Promise<void> {
  try {
    await window.api.snippet.updateSnippet(
      snippet.id,
      updates as unknown as Parameters<typeof window.api.snippet.updateSnippet>[1]
    )
    await loadSnippets()
    // B56-5：动作后回写选中态——更新项还在新列表里就同步新对象（Editor 星标/路径
    // 即时亮），已离开当前视图（如 favorites 取消收藏）则清空，杜绝悬空选中
    const fresh = snippets.value.find((x) => x.id === snippet.id)
    if (props.selectedSnippet?.id === snippet.id) {
      emit('update:selectedSnippet', fresh ?? null)
    }
  } catch (error) {
    console.error('[SnippetList] 更新片段失败:', error)
  }
  closeContextMenu()
}

const toggleFavorite = (snippet: Snippet): Promise<void> =>
  applyUpdate(snippet, { isFavorites: !snippet.isFavorites })

const moveToFolder = (snippet: Snippet, folderId: string | null): Promise<void> =>
  applyUpdate(snippet, { folderId })

const moveToInbox = (snippet: Snippet): Promise<void> => applyUpdate(snippet, { folderId: null })

async function duplicate(snippet: Snippet): Promise<void> {
  try {
    await window.api.snippet.duplicateSnippet(snippet.id)
    await loadSnippets()
  } catch (error) {
    console.error('[SnippetList] 创建副本失败:', error)
  }
  closeContextMenu()
}

async function trash(snippet: Snippet): Promise<void> {
  try {
    await window.api.snippet.deleteSnippet(snippet.id)
    if (props.selectedSnippet?.id === snippet.id) emit('update:selectedSnippet', null)
    await loadSnippets()
  } catch (error) {
    console.error('[SnippetList] 移入回收站失败:', error)
  }
  closeContextMenu()
}

async function restore(snippet: Snippet): Promise<void> {
  try {
    await window.api.snippet.restoreSnippet(snippet.id)
    await loadSnippets()
  // B56-5：恢复后条目离开回收站视图——与移回收站/彻底删除同口径清选中
  if (props.selectedSnippet?.id === snippet.id) emit('update:selectedSnippet', null)
  } catch (error) {
    console.error('[SnippetList] 恢复片段失败:', error)
  }
  closeContextMenu()
}

async function destroyForever(snippet: Snippet): Promise<void> {
  const ok = await confirm({
    title: `彻底删除「${snippet.name}」？`,
    message: '该操作不可撤销。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
  try {
    await window.api.snippet.permanentlyDeleteSnippet(snippet.id)
    if (props.selectedSnippet?.id === snippet.id) emit('update:selectedSnippet', null)
    await loadSnippets()
  } catch (error) {
    console.error('[SnippetList] 彻底删除失败:', error)
  }
  closeContextMenu()
}

async function emptyTrash(): Promise<void> {
  const ok = await confirm({
    title: '清空回收站？',
    message: '其中的片段将不可撤销地删除。',
    confirmText: '清空',
    danger: true
  })
  if (!ok) return
  try {
    await window.api.snippet.emptyTrash()
    emit('update:selectedSnippet', null)
    await loadSnippets()
  } catch (error) {
    console.error('[SnippetList] 清空回收站失败:', error)
  }
}

watch(searchInput, (value) => {
  if (searchDebounceTimer !== null) window.clearTimeout(searchDebounceTimer)
  searchDebounceTimer = window.setTimeout(() => {
    debouncedSearch.value = value
    emit('update:searchQuery', value)
    searchDebounceTimer = null
  }, 200)
})

// 批3：debouncedSearch 加入重拉源——搜索真正下沉 SQL（此前仅前端过滤，SQL search 是死代码）
// B56 键盘导航：↑↓ 移动选中（输入框焦点时不抢）、Enter 复制选中项首个内容
function onListKeydown(e: KeyboardEvent): void {
  const t = e.target as HTMLElement | null
  if (
    t &&
    (t instanceof HTMLInputElement ||
      t instanceof HTMLTextAreaElement ||
      t.isContentEditable)
  ) {
    return
  }
  if (snippets.value.length === 0) return
  if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp' && e.key !== 'Enter') return
  e.preventDefault()
  const currentId = props.selectedSnippet?.id
  const idx = snippets.value.findIndex((x) => x.id === currentId)
  if (e.key === 'Enter') {
    const item = props.selectedSnippet
    const first = item?.contents?.[0]
    if (first) void navigator.clipboard.writeText(first.value)
    return
  }
  const base = idx === -1 ? (e.key === 'ArrowDown' ? -1 : 0) : idx
  const next = e.key === 'ArrowDown' ? Math.min(base + 1, snippets.value.length - 1) : Math.max(base - 1, 0)
  const item = snippets.value[next]
  if (!item) return
  emit('update:selectedSnippet', item)
  void nextTick(() => {
    listRef.value
      ?.querySelector(`[data-snippet-id="${item.id}"]`)
      ?.scrollIntoView({ block: 'nearest' })
  })
}

watch(
  () => [props.folderId, props.libraryFilter, props.selectedTagId, debouncedSearch.value],
  () => {
    closeContextMenu()
    // B56-5：视图切换后旧选中项大概率不在新列表——清空，Editor 不再悬空展示
    if (props.selectedSnippet) emit('update:selectedSnippet', null)
    void loadSnippets('reset')
  }
)

// 批4③：编辑器保存（id 不变而 updatedAt 变化）→ 按已加载量重拉，服务端按 updated_at 重排；
// id 变化是用户切换选中，不触发（避免每次点选都发请求）
watch(
  () => props.selectedSnippet,
  (now, prev) => {
    if (now && prev && now.id === prev.id && now.updatedAt !== prev.updatedAt) {
      void loadSnippets('refresh')
    }
  }
)

onMounted(() => {
  searchInput.value = props.searchQuery
  debouncedSearch.value = props.searchQuery
  void loadSnippets('reset')
})

onBeforeUnmount(() => {
  // 卸载前把在飞的防抖落账，避免最后一次键入被丢掉
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
    debouncedSearch.value = searchInput.value
  }
})
</script>

<template>
  <div class="flex min-h-0 flex-col border-r border-line-subtle bg-surface-1">
    <!-- 列表头：标题 + 计数 + 搜索 -->
    <div class="shrink-0 px-3 pb-2 pt-3">
      <div class="mb-2 flex items-center gap-2">
        <h2 class="min-w-0 flex-1 truncate text-sm font-medium text-fg-primary">{{ listTitle }}</h2>
        <span class="shrink-0 text-xs text-fg-tertiary">{{ total }}</span>
        <!-- B58：导入/导出入口（备份与迁移；回收站视图不显示） -->
        <button
          v-if="libraryFilter !== 'trash'"
          type="button"
          data-testid="snippet-import"
          class="shrink-0 text-fg-muted hover:text-brand-500"
          title="从 JSON 导入片段"
          @click="importFromFile"
        >
          <AppIcon icon="ri-upload-line" :size="14" />
        </button>
        <button
          v-if="libraryFilter !== 'trash'"
          type="button"
          data-testid="snippet-export"
          class="shrink-0 text-fg-muted hover:text-brand-500"
          title="导出全部片段为 JSON"
          @click="exportAll"
        >
          <AppIcon icon="ri-download-line" :size="14" />
        </button>
        <!-- B56-4：新建片段入口（此前全 UI 无任何创建路径，空态引导成了断头路） -->
        <button
          v-if="libraryFilter !== 'trash'"
          type="button"
          data-testid="snippet-create"
          class="shrink-0 text-fg-muted hover:text-brand-500"
          title="新建片段"
          @click="createSnippet"
        >
          <AppIcon icon="add-line" :size="15" />
        </button>
        <button
          v-if="libraryFilter === 'trash' && snippets.length > 0"
          type="button"
          class="shrink-0 text-xs text-fg-muted hover:text-danger"
          @click="emptyTrash"
        >
          清空
        </button>
      </div>
      <div class="relative flex h-8 items-center">
        <AppIcon
          icon="search"
          :size="14"
          class="pointer-events-none absolute left-2.5 text-fg-muted"
        />
        <input
          v-model="searchInput"
          type="text"
          placeholder="搜索片段…"
          class="h-full w-full rounded-md border border-line-subtle bg-surface-0 pl-8 pr-7 text-xs text-fg-primary outline-none focus:border-brand-500/40"
        />
        <button
          v-if="searchInput"
          type="button"
          class="absolute right-2 text-fg-muted hover:text-fg-primary"
          @click="searchInput = ''"
        >
          <AppIcon icon="close-circle-fill" :size="13" />
        </button>
      </div>
    </div>

    <!-- 列表（滚动接近底部自动加载下一页，页大小 200） -->
    <div
      ref="listRef"
      class="min-h-0 flex-1 overflow-y-auto px-2 pb-3 outline-none"
      tabindex="-1"
      @scroll="onListScroll"
      @keydown="onListKeydown"
    >
      <p v-if="loading" class="px-2 py-6 text-center text-xs text-fg-muted">加载中…</p>
      <UEmpty
        v-else-if="loadError"
        title="加载失败"
        description="片段列表读取失败，请重试（详情见日志）"
      >
        <template #icon>
          <AppIcon icon="error-warning-line" :size="20" />
        </template>
      </UEmpty>
      <UEmpty
        v-else-if="snippets.length === 0"
        :title="debouncedSearch ? '没有匹配的片段' : '这里还没有片段'"
        :description="debouncedSearch ? '换个关键词试试' : '点右上角 + 新建一个片段，或从其它文件夹移动过来'"
      >
        <template #icon>
          <AppIcon icon="code-s-slash-line" :size="20" />
        </template>
      </UEmpty>
      <div v-else class="flex flex-col gap-1">
        <div
          v-for="snippet in snippets"
          :key="snippet.id"
          :data-snippet-id="snippet.id"
          class="cursor-pointer rounded-md px-2.5 py-2 transition-colors"
          :class="
            selectedSnippet?.id === snippet.id
              ? 'bg-brand-500/10 text-fg-brand'
              : 'hover:bg-surface-hover'
          "
          @click="select(snippet)"
          @contextmenu.prevent="openContextMenu(snippet, $event)"
        >
          <div class="flex items-center gap-2">
            <span class="min-w-0 flex-1 truncate text-xs font-medium text-fg-primary">
              {{ snippet.name || '未命名片段' }}
            </span>
            <AppIcon
              v-if="snippet.isFavorites"
              icon="star-fill"
              :size="12"
              class="shrink-0 text-warning"
            />
            <span class="shrink-0 text-[10px] text-fg-tertiary">
              {{ formatSmartDate(snippet.updatedAt) }}
            </span>
          </div>
          <div class="mt-0.5 truncate text-[11px] text-fg-tertiary">
            {{ snippet.description || firstLine(snippet) }}
          </div>
          <div
            v-if="findFolderById(snippet.folderId)"
            class="mt-1 flex items-center gap-1 text-[10px] text-fg-muted"
          >
            <AppIcon icon="folder-line" :size="11" />
            <span class="truncate">{{ findFolderById(snippet.folderId)?.name }}</span>
          </div>
        </div>
      </div>
      <p v-if="loadingMore" class="py-2 text-center text-xs text-fg-muted">加载中…</p>
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="showContextMenu && contextTarget"
      ref="contextMenuRef"
      role="menu"
      aria-label="片段操作菜单"
      class="fixed z-[900] min-w-44 rounded-md border border-line-subtle bg-surface-3 py-1 shadow-lg"
      :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <button
        v-if="libraryFilter !== 'trash'"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
        role="menuitem"
        @click="toggleFavorite(contextTarget)"
      >
        <AppIcon :icon="contextTarget.isFavorites ? 'star-line' : 'star-fill'" :size="13" />
        <span>{{ contextTarget.isFavorites ? '取消收藏' : '收藏' }}</span>
      </button>
      <button
        v-if="libraryFilter !== 'trash'"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
        role="menuitem"
        @click="duplicate(contextTarget)"
      >
        <AppIcon icon="file-copy-line" :size="13" />
        <span>创建副本</span>
      </button>
      <button
        v-if="contextTarget.folderId"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
        role="menuitem"
        @click="moveToInbox(contextTarget)"
      >
        <AppIcon icon="inbox-line" :size="13" />
        <span>移回收件箱</span>
      </button>

      <!-- 移动到文件夹 -->
      <div
        v-if="allFolders.length > 0"
        class="border-t border-line-subtle px-3 pb-1 pt-1.5 text-[10px] text-fg-muted"
      >
        移动到
      </div>
      <button
        v-for="folder in folderOptions"
        :key="folder.id"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
        :style="{ paddingLeft: `${12 + folder.depth * 12}px` }"
        role="menuitem"
        @click="moveToFolder(contextTarget, folder.id)"
      >
        <AppIcon icon="folder-line" :size="13" />
        <span class="truncate">{{ folder.name }}</span>
      </button>

      <div class="my-1 border-t border-line-subtle" />
      <button
        v-if="libraryFilter === 'trash'"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
        role="menuitem"
        @click="restore(contextTarget)"
      >
        <AppIcon icon="arrow-go-back-line" :size="13" />
        <span>恢复</span>
      </button>
      <button
        v-if="libraryFilter === 'trash'"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-danger hover:bg-surface-hover"
        role="menuitem"
        @click="destroyForever(contextTarget)"
      >
        <AppIcon icon="delete-bin-line" :size="13" />
        <span>彻底删除</span>
      </button>
      <button
        v-else
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-danger hover:bg-surface-hover"
        role="menuitem"
        @click="trash(contextTarget)"
      >
        <AppIcon icon="delete-bin-line" :size="13" />
        <span>移入回收站</span>
      </button>
    </div>
  </div>
</template>
