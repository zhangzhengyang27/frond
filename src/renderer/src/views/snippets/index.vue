<script setup lang="ts">
import { ref } from 'vue'
import type { Snippet } from '@preload/index.d'
import Sidebar from '@views/snippets/components/Sidebar.vue'
import SnippetList from '@views/snippets/components/SnippetList.vue'
import Editor from '@views/snippets/components/Editor.vue'

const selectedSnippet = ref<Snippet | null>(null)
const selectedFolderId = ref<string | null>(null)
const libraryFilter = ref<'all' | 'inbox' | 'favorites' | 'trash'>('inbox')
const searchQuery = ref('')
const snippetListKey = ref(0)
const folders = ref<
  Array<{ id: string; name: string; defaultLanguage?: string; icon?: string | null }>
>([])
// B58：标签筛选（Sidebar 加载并回传，SnippetList 消费 tagId + 标题解析）
const selectedTagId = ref<string | null>(null)
const tags = ref<Array<{ id: string; name: string }>>([])

// 处理代码片段移动/删除事件：列表整体失效重建（B58：编辑器删除入口也走这条）
function handleListInvalidate(): void {
  // 通过改变 key 来强制刷新 SnippetList
  snippetListKey.value++
  // 如果选中的代码片段被移动，清除选中状态
  if (selectedSnippet.value) {
    selectedSnippet.value = null
  }
}
</script>

<template>
  <div
    class="snippets-main grid h-[calc(100vh-var(--shell-topbar-h))] grid-cols-[250px_280px_1fr] overflow-hidden bg-surface-0"
  >
    <Sidebar
      v-model:selected-folder-id="selectedFolderId"
      v-model:library-filter="libraryFilter"
      v-model:selected-tag-id="selectedTagId"
      :folders="folders"
      @snippet-moved="handleListInvalidate"
      @update:folders="folders = $event"
      @update:tags="tags = $event"
    />
    <SnippetList
      :key="snippetListKey"
      v-model:selected-snippet="selectedSnippet"
      v-model:search-query="searchQuery"
      :folder-id="selectedFolderId"
      :library-filter="libraryFilter"
      :folders="folders"
      :selected-tag-id="selectedTagId"
      :tags="tags"
    />
    <Editor
      :snippet="selectedSnippet"
      @update:snippet="selectedSnippet = $event"
      @snippet-deleted="handleListInvalidate"
    />
  </div>
</template>
