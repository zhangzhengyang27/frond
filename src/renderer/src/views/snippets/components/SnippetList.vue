<script setup lang="ts">
/*
 * 2026-09-23 重建件：SnippetList.vue 被截断，仅存 12 行真实代码（脚本前段，逐字保留）。
 * 契约来源：父级 views/snippets/index.vue 的绑定（selectedSnippet / searchQuery 两个 v-model、
 * folderId / libraryFilter / folders），数据一律走 preload 里既有的 window.api.snippet.*。
 * 待核：模板整体重建，右键菜单条目按存留的 showContextMenu / contextMenuPosition 反推。
 */
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UEmpty from '@components/ui/UEmpty.vue'
import { useFolders } from '@composables/useFolders'
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

const loading = ref(false)
const contextTarget = ref<Snippet | null>(null)

const TITLE: Record<'all' | 'inbox' | 'favorites' | 'trash', string> = {
  all: '全部片段',
  inbox: '收件箱',
  favorites: '收藏',
  trash: '回收站'
}

const listTitle = computed(() => {
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

const filteredSnippets = computed(() => {
  const keyword = debouncedSearch.value.trim().toLowerCase()
  if (!keyword) return snippets.value
  return snippets.value.filter((snippet) =>
    [
      snippet.name,
      snippet.description ?? '',
      snippet.trigger ?? '',
      (snippet.contents ?? []).map((content) => content.value ?? '').join('\n')
    ]
      .join('\n')
      .toLowerCase()
      .includes(keyword)
  )
})

async function loadSnippets(): Promise<void> {
  loading.value = true
  try {
    const isTrash = props.libraryFilter === 'trash'
    snippets.value = await window.api.snippet.getSnippets({
      folderId: props.folderId ?? undefined,
      isDeleted: isTrash,
      isFavorites: props.libraryFilter === 'favorites' ? true : undefined,
      isInbox: props.libraryFilter === 'inbox' ? true : undefined,
      search: props.searchQuery || undefined
    })
  } catch (error) {
    console.error('[SnippetList] 读取片段列表失败:', error)
    snippets.value = []
  } finally {
    loading.value = false
  }
}

function select(snippet: Snippet): void {
  emit('update:selectedSnippet', snippet)
}

function closeContextMenu(): void {
  showContextMenu.value = false
  contextTarget.value = null
}

function openContextMenu(snippet: Snippet, event: MouseEvent): void {
  contextTarget.value = snippet
  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  showContextMenu.value = true
}

async function applyUpdate(snippet: Snippet, updates: Partial<Snippet>): Promise<void> {
  try {
    await window.api.snippet.updateSnippet(snippet.id, updates)
    await loadSnippets()
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
  } catch (error) {
    console.error('[SnippetList] 恢复片段失败:', error)
  }
  closeContextMenu()
}

async function destroyForever(snippet: Snippet): Promise<void> {
  if (!confirm(`彻底删除「${snippet.name}」？该操作不可撤销。`)) return
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
  if (!confirm('清空回收站？其中的片段将不可撤销地删除。')) return
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

watch(
  () => [props.folderId, props.libraryFilter],
  () => {
    closeContextMenu()
    void loadSnippets()
  }
)

onMounted(() => {
  searchInput.value = props.searchQuery
  debouncedSearch.value = props.searchQuery
  document.addEventListener('click', closeContextMenu)
  void loadSnippets()
})

onBeforeUnmount(() => {
  // 卸载前把在飞的防抖落账，避免最后一次键入被丢掉
  if (searchDebounceTimer !== null) {
    window.clearTimeout(searchDebounceTimer)
    searchDebounceTimer = null
    debouncedSearch.value = searchInput.value
  }
  document.removeEventListener('click', closeContextMenu)
})
</script>

<template>
  <div class="flex min-h-0 flex-col border-r border-line-subtle bg-surface-1">
    <!-- 列表头：标题 + 计数 + 搜索 -->
    <div class="shrink-0 px-3 pb-2 pt-3">
      <div class="mb-2 flex items-center gap-2">
        <h2 class="min-w-0 flex-1 truncate text-sm font-medium text-fg-primary">{{ listTitle }}</h2>
        <span class="shrink-0 text-xs text-fg-faint">{{ filteredSnippets.length }}</span>
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

    <!-- 列表 -->
    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      <p v-if="loading" class="px-2 py-6 text-center text-xs text-fg-muted">加载中…</p>
      <UEmpty
        v-else-if="filteredSnippets.length === 0"
        :title="debouncedSearch ? '没有匹配的片段' : '这里还没有片段'"
        :description="debouncedSearch ? '换个关键词试试' : '新建一个片段，或从其它文件夹移动过来'"
      >
        <template #icon>
          <AppIcon icon="code-s-slash-line" :size="20" />
        </template>
      </UEmpty>
      <div v-else class="flex flex-col gap-1">
        <div
          v-for="snippet in filteredSnippets"
          :key="snippet.id"
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
            <span class="shrink-0 text-[10px] text-fg-faint">
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
    </div>

    <!-- 右键菜单 -->
    <div
      v-if="showContextMenu && contextTarget"
      class="fixed z-[900] min-w-44 rounded-md border border-line-subtle bg-surface-3 py-1 shadow-lg"
      :style="{ left: `${contextMenuPosition.x}px`, top: `${contextMenuPosition.y}px` }"
      @click.stop
      @contextmenu.prevent
    >
      <button
        v-if="libraryFilter !== 'trash'"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
        @click="toggleFavorite(contextTarget)"
      >
        <AppIcon :icon="contextTarget.isFavorites ? 'star-line' : 'star-fill'" :size="13" />
        <span>{{ contextTarget.isFavorites ? '取消收藏' : '收藏' }}</span>
      </button>
      <button
        v-if="libraryFilter !== 'trash'"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
        @click="duplicate(contextTarget)"
      >
        <AppIcon icon="file-copy-line" :size="13" />
        <span>创建副本</span>
      </button>
      <button
        v-if="contextTarget.folderId"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
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
        @click="restore(contextTarget)"
      >
        <AppIcon icon="arrow-go-back-line" :size="13" />
        <span>恢复</span>
      </button>
      <button
        v-if="libraryFilter === 'trash'"
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-danger hover:bg-surface-hover"
        @click="destroyForever(contextTarget)"
      >
        <AppIcon icon="delete-bin-line" :size="13" />
        <span>彻底删除</span>
      </button>
      <button
        v-else
        type="button"
        class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-danger hover:bg-surface-hover"
        @click="trash(contextTarget)"
      >
        <AppIcon icon="delete-bin-line" :size="13" />
        <span>移入回收站</span>
      </button>
    </div>
  </div>
</template>
