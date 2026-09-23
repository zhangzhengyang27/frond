<script setup lang="ts">
/*
 * 2026-09-23 重建件：Sidebar.vue 随事故丢失且全盘无副本。
 * 契约来源：views/snippets/index.vue 的绑定（两个 v-model + folders + snippet-moved）、
 * preload 的 window.api.folder.*。父级不给 folders 兜底加载，所以首次 getFolders 在这里做，
 * 并把结果回写父级（SnippetList / Editor 都读同一份 folders）。
 */
import { computed, onMounted } from 'vue'
import AppIcon from '@components/AppIcon.vue'

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
}>()

const emit = defineEmits<{
  'update:selectedFolderId': [id: string | null]
  'update:libraryFilter': [value: 'all' | 'inbox' | 'favorites' | 'trash']
  'update:folders': [folders: FolderLike[]]
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

async function reload(): Promise<void> {
  const list = await window.api.folder.getFolders()
  emit(
    'update:folders',
    list.map((f) => ({
      id: f.id,
      name: f.name,
      defaultLanguage: f.defaultLanguage,
      icon: f.icon ?? null
    }))
  )
}

function pickLibrary(key: 'all' | 'inbox' | 'favorites' | 'trash'): void {
  emit('update:libraryFilter', key)
  // 库视图与文件夹互斥：切回库视图要清掉文件夹选中，否则列表按两个条件取交集会空
  emit('update:selectedFolderId', null)
}

function pickFolder(id: string): void {
  emit('update:selectedFolderId', props.selectedFolderId === id ? null : id)
}

async function addFolder(): Promise<void> {
  const name = window.prompt('新建文件夹名称')
  if (!name || !name.trim()) return
  await window.api.folder.addFolder({ name: name.trim(), parentId: null })
  await reload()
}

async function renameFolder(folder: FolderLike): Promise<void> {
  const name = window.prompt('重命名文件夹', folder.name)
  if (!name || !name.trim() || name.trim() === folder.name) return
  await window.api.folder.updateFolder(folder.id, { name: name.trim() })
  await reload()
}

async function removeFolder(folder: FolderLike): Promise<void> {
  if (!window.confirm(`删除文件夹「${folder.name}」？其中的片段会回到收件箱。`)) return
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
      <span class="text-[11px] font-medium uppercase tracking-wide text-fg-faint">
        文件夹 · {{ folderCount }}
      </span>
      <button
        type="button"
        class="rounded p-1 text-fg-muted hover:bg-surface-hover hover:text-fg-primary"
        title="新建文件夹"
        @click="addFolder"
      >
        <AppIcon icon="add-line" :size="14" />
      </button>
    </div>

    <div class="min-h-0 flex-1 overflow-y-auto px-2 pb-3">
      <p v-if="folderCount === 0" class="px-2.5 py-2 text-xs text-fg-faint">还没有文件夹</p>
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
          class="rounded p-1 text-fg-faint opacity-0 hover:text-fg-primary group-hover:opacity-100"
          title="重命名"
          @click="renameFolder(folder)"
        >
          <AppIcon icon="pencil-line" :size="13" />
        </button>
        <button
          type="button"
          class="rounded p-1 text-fg-faint opacity-0 hover:text-fg-danger group-hover:opacity-100"
          title="删除文件夹"
          @click="removeFolder(folder)"
        >
          <AppIcon icon="delete-bin-6-line" :size="13" />
        </button>
      </div>
    </div>
  </aside>
</template>
