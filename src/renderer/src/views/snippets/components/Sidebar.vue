<script setup lang="ts">
/*
 * 2026-09-23 重建件：Sidebar.vue 随事故丢失且全盘无副本。
 * 契约来源：views/snippets/index.vue 的绑定（两个 v-model + folders + snippet-moved）、
 * preload 的 window.api.folder.*。父级不给 folders 兜底加载，所以首次 getFolders 在这里做，
 * 并把结果回写父级（SnippetList / Editor 都读同一份 folders）。
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import UModal from '@components/ui/UModal.vue'
import USelect from '@components/ui/USelect.vue'
import { confirm } from '@composables/useConfirm'
import { useFolders } from '@composables/useFolders'
import { SNIPPET_LANGUAGES } from '@shared/snippetLanguages'

interface FolderLike {
  id: string
  name: string
  defaultLanguage?: string
  icon?: string | null
}

const props = defineProps<{
  selectedFolderId: string | null
  libraryFilter: 'all' | 'inbox' | 'favorites' | 'trash'
  folders: FolderLike[]
  /** B58：选中的标签（与文件夹/库视图互斥）；undefined = 不启用标签筛选 */
  selectedTagId?: string | null
}>()

const emit = defineEmits<{
  'update:selectedFolderId': [id: string | null]
  'update:libraryFilter': [value: 'all' | 'inbox' | 'favorites' | 'trash']
  'update:folders': [folders: FolderLike[]]
  'update:selectedTagId': [id: string | null]
  'update:tags': [tags: Array<{ id: string; name: string }>]
  'snippet-moved': []
}>()

const LIBRARY_ITEMS: Array<{
  key: 'inbox' | 'favorites' | 'all' | 'trash'
  label: string
  icon: string
}> = [
  { key: 'inbox', label: '收件箱', icon: 'inbox-2-line' },
  { key: 'favorites', label: '收藏', icon: 'star-line' },
  { key: 'all', label: '全部', icon: 'apps-2-line' },
  { key: 'trash', label: '回收站', icon: 'delete-bin-5-line' }
]

const folderCount = computed(() => props.folders.length)

// B56-9：双源真相收口——Sidebar 的增删改必须同步 useFolders 共享 store，
// 否则 SnippetList 的「移动到」菜单与行内徽标永远看不到新文件夹
const { loadFolders, loadFolderTree } = useFolders()

async function reload(): Promise<void> {
  await Promise.all([loadFolders(), loadFolderTree(), loadTags()])
  emit(
    'update:folders',
    (await window.api.folder.getFolders()).map((f) => ({
      id: f.id,
      name: f.name,
      defaultLanguage: f.defaultLanguage,
      icon: f.icon ?? null
    }))
  )
}

// B58：标签清单——侧栏筛选 + 列表标题解析共用；片段打标/摘标会触发
// updateSnippet 广播，这里订阅同一信号保持新鲜
const tags = ref<Array<{ id: string; name: string }>>([])

async function loadTags(): Promise<void> {
  try {
    const list = await window.api.tag.getTags()
    tags.value = list.map((t) => ({ id: t.id, name: t.name }))
    emit('update:tags', tags.value)
  } catch (error) {
    console.error('[Sidebar] 读取标签失败:', error)
  }
}
const offSnippetsChanged = window.api.onSnippetsChanged(() => void loadTags())
onBeforeUnmount(() => offSnippetsChanged())

// B56-3：window.prompt 在 Electron 渲染端直接抛异常——文件夹建/改名改 UModal 输入弹窗。
// B58：弹窗带「默认语言」选择（该字段此前全 UI 无写入方，是个死字段）——
// 新建片段继承所在文件夹的默认语言
const folderDialog = ref<{
  mode: 'create' | 'rename'
  folder: FolderLike | null
  name: string
  language: string
} | null>(null)
const folderInputRef = ref<HTMLInputElement | null>(null)
// v-model 不接受可选链：用 computed 代理读写
const folderDialogName = computed({
  get: () => folderDialog.value?.name ?? '',
  set: (v: string) => {
    if (folderDialog.value) folderDialog.value.name = v
  }
})
const folderDialogLanguage = computed({
  get: () => folderDialog.value?.language ?? '',
  set: (v: string | number) => {
    if (folderDialog.value) folderDialog.value.language = String(v)
  }
})
// 头部空选项 = 不设默认语言
const folderLanguageOptions = [{ value: '', label: '不设默认' }, ...SNIPPET_LANGUAGES]

function openCreateFolder(): void {
  folderDialog.value = { mode: 'create', folder: null, name: '', language: '' }
  void nextTick(() => folderInputRef.value?.focus())
}

function openRenameFolder(folder: FolderLike): void {
  folderDialog.value = {
    mode: 'rename',
    folder,
    name: folder.name,
    language: folder.defaultLanguage ?? ''
  }
  void nextTick(() => folderInputRef.value?.focus())
}

async function confirmFolderDialog(): Promise<void> {
  const dlg = folderDialog.value
  if (!dlg || !dlg.name.trim()) return
  if (dlg.mode === 'create') {
    await window.api.folder.addFolder({
      name: dlg.name.trim(),
      parentId: null,
      // exactOptionalPropertyTypes：不设默认时不带键
      ...(dlg.language ? { defaultLanguage: dlg.language } : {})
    })
  } else if (dlg.folder) {
    await window.api.folder.updateFolder(dlg.folder.id, {
      name: dlg.name.trim(),
      defaultLanguage: dlg.language
    })
  }
  folderDialog.value = null
  await reload()
}

function pickLibrary(key: 'all' | 'inbox' | 'favorites' | 'trash'): void {
  emit('update:libraryFilter', key)
  // 库视图与文件夹互斥：切回库视图要清掉文件夹选中，否则列表按两个条件取交集会空
  emit('update:selectedFolderId', null)
  emit('update:selectedTagId', null)
}

function pickFolder(id: string): void {
  emit('update:selectedFolderId', props.selectedFolderId === id ? null : id)
  emit('update:selectedTagId', null)
}

/** B58：标签筛选——与文件夹/库视图互斥（交集过滤口径已证明易空） */
function pickTag(id: string): void {
  const next = props.selectedTagId === id ? null : id
  emit('update:selectedTagId', next)
  if (next) {
    emit('update:selectedFolderId', null)
    emit('update:libraryFilter', 'all')
  }
}

async function removeFolder(folder: FolderLike): Promise<void> {
  const ok = await confirm({
    title: `删除文件夹「${folder.name}」？`,
    message: '其中的片段会回到收件箱。',
    confirmText: '删除',
    danger: true
  })
  if (!ok) return
  await window.api.folder.deleteFolder(folder.id)
  if (props.selectedFolderId === folder.id) emit('update:selectedFolderId', null)
  await reload()
  // 片段被移回收件箱 = 归属变了，父级要靠这个信号重建列表
  emit('snippet-moved')
}

onMounted(() => {
  void reload()
})
</script>

<template>
  <aside class="flex min-h-0 flex-col overflow-hidden border-r border-line-subtle bg-surface-0">
    <nav class="px-2 py-3">
      <button
        v-for="item in LIBRARY_ITEMS"
        :key="item.key"
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px] no-underline"
        :class="
          props.libraryFilter === item.key && !props.selectedFolderId
            ? 'bg-brand-500/10 text-fg-brand'
            : 'text-fg-secondary hover:bg-surface-hover'
        "
        @click="pickLibrary(item.key)"
      >
        <AppIcon :icon="item.icon" :size="15" />
        <span>{{ item.label }}</span>
      </button>
    </nav>

    <div class="flex items-center justify-between px-4 pb-1 pt-2">
      <span class="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
        文件夹 · {{ folderCount }}
      </span>
      <button
        type="button"
        class="rounded p-1 text-fg-muted hover:bg-surface-hover hover:text-fg-primary"
        title="新建文件夹"
        @click="openCreateFolder"
      >
        <AppIcon icon="add-line" :size="14" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      <p v-if="folderCount === 0" class="px-2.5 py-2 text-xs text-fg-tertiary">还没有文件夹</p>
      <div
        v-for="folder in props.folders"
        :key="folder.id"
        class="group flex items-center gap-1 rounded-md pr-1"
        :class="
          props.selectedFolderId === folder.id
            ? 'bg-brand-500/10 text-fg-brand'
            : 'hover:bg-surface-hover'
        "
      >
        <button
          type="button"
          class="flex min-w-0 flex-1 items-center gap-2 px-2.5 py-1.5 text-left text-[13px]"
          :class="props.selectedFolderId === folder.id ? 'text-fg-brand' : 'text-fg-secondary'"
          @click="pickFolder(folder.id)"
        >
          <AppIcon :icon="folder.icon || 'folder-line'" :size="15" />
          <span class="truncate">{{ folder.name }}</span>
        </button>
        <button
          type="button"
          class="rounded p-1 text-fg-tertiary opacity-0 hover:text-fg-primary group-hover:opacity-100"
          title="重命名"
          @click="openRenameFolder(folder)"
        >
          <AppIcon icon="pencil-line" :size="13" />
        </button>
        <button
          type="button"
          class="rounded p-1 text-fg-tertiary opacity-0 hover:text-fg-danger group-hover:opacity-100"
          title="删除文件夹"
          @click="removeFolder(folder)"
        >
          <AppIcon icon="delete-bin-6-line" :size="13" />
        </button>
      </div>

      <!-- B58：标签筛选（此前标签只写不读——编辑器可打标，但没有任何消费入口） -->
      <div class="flex items-center justify-between px-2.5 pb-1 pt-3">
        <span class="text-[11px] font-medium uppercase tracking-wide text-fg-tertiary">
          标签 · {{ tags.length }}
        </span>
      </div>
      <p v-if="tags.length === 0" class="px-2.5 py-2 text-xs text-fg-tertiary">
        在编辑器里给片段加标签
      </p>
      <button
        v-for="tag in tags"
        :key="tag.id"
        type="button"
        class="flex w-full items-center gap-2 rounded-md px-2.5 py-1.5 text-left text-[13px]"
        :class="
          props.selectedTagId === tag.id
            ? 'bg-brand-500/10 text-fg-brand'
            : 'text-fg-secondary hover:bg-surface-hover'
        "
        @click="pickTag(tag.id)"
      >
        <AppIcon icon="price-tag-3-line" :size="14" />
        <span class="truncate">{{ tag.name }}</span>
      </button>
    </div>
  </aside>

  <!-- B56-3：文件夹建/改名弹窗（替代 Electron 不存在的 window.prompt） -->
  <UModal
    :model-value="folderDialog !== null"
    :title="folderDialog?.mode === 'rename' ? '重命名文件夹' : '新建文件夹'"
    size="sm"
    @update:model-value="(v: boolean) => (v ? null : (folderDialog = null))"
  >
    <div class="p-4">
      <input
        ref="folderInputRef"
        v-model="folderDialogName"
        type="text"
        class="w-full rounded-md border border-line-subtle bg-surface-0 px-3 py-2 text-sm text-fg-primary outline-none focus:border-brand-500/40"
        placeholder="文件夹名称"
        data-testid="folder-name-input"
        @keydown.enter="confirmFolderDialog"
      />
      <div class="mt-3">
        <span class="mb-1 block text-[11px] text-fg-tertiary">
          默认语言（在此文件夹新建片段时自动套用）
        </span>
        <USelect
          v-model="folderDialogLanguage"
          :options="folderLanguageOptions"
          class="w-full"
          data-testid="folder-language-select"
        />
      </div>
      <div class="mt-4 flex justify-end gap-2">
        <button
          type="button"
          class="rounded-md px-3 py-1.5 text-sm text-fg-secondary hover:bg-surface-hover"
          @click="folderDialog = null"
        >
          取消
        </button>
        <button
          type="button"
          class="rounded-md bg-brand-500 px-3 py-1.5 text-sm text-white hover:bg-brand-600"
          data-testid="folder-name-confirm"
          @click="confirmFolderDialog"
        >
          保存
        </button>
      </div>
    </div>
  </UModal>
</template>
