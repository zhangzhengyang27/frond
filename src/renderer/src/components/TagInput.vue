<script setup lang="ts">
/*
 * 2026-09-23 重建件：TagInput.vue 随事故丢失且全盘无副本。
 * 契约来源：views/snippets/components/Editor.vue —— `:model-value="snippetTags"`（string[] 的 **标签 id**，
 * 不是名字）、`:suggestions="allTags"`（Tag[]）、`@update:model-value="updateTags"`。
 * 只做「选已有标签」：新增标签要写库，而调用方给的 updateTags 只回写 snippet.tagIds，
 * 在这里偷偷建标签会让「谁创建了标签」这条线失去归属。
 */
import { computed, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'
import type { Tag } from '@preload/index.d'

const props = defineProps<{ modelValue: string[]; suggestions: Tag[] }>()
const emit = defineEmits<{ 'update:modelValue': [ids: string[]] }>()

const query = ref('')
const focused = ref(false)

const selected = computed(() =>
  props.modelValue
    .map((id) => props.suggestions.find((t) => t.id === id))
    .filter((t): t is Tag => !!t)
)

/** 候选 = 名字匹配且未选中的；没输入时给全部未选中的 */
const candidates = computed(() => {
  const q = query.value.trim().toLowerCase()
  const picked = new Set(props.modelValue)
  return props.suggestions
    .filter((t) => !picked.has(t.id))
    .filter((t) => !q || t.name.toLowerCase().includes(q))
    .slice(0, 12)
})

function add(id: string): void {
  if (props.modelValue.includes(id)) return
  emit('update:modelValue', [...props.modelValue, id])
  query.value = ''
}

function remove(id: string): void {
  emit(
    'update:modelValue',
    props.modelValue.filter((x) => x !== id)
  )
}

function onEnter(): void {
  const first = candidates.value[0]
  if (first) add(first.id)
}

function colorOf(tag: Tag): string {
  return tag.color || 'var(--brand-500)'
}
</script>

<template>
  <div class="relative flex flex-wrap items-center gap-1.5">
    <span
      v-for="tag in selected"
      :key="tag.id"
      class="flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]"
      :style="{ borderColor: colorOf(tag), color: colorOf(tag) }"
    >
      {{ tag.name }}
      <button
        type="button"
        class="rounded-full leading-none opacity-70 hover:opacity-100"
        :title="`移除 ${tag.name}`"
        @click="remove(tag.id)"
      >
        ×
      </button>
    </span>

    <div class="flex min-w-[120px] flex-1 items-center gap-1.5">
      <AppIcon icon="price-tag-3-line" :size="13" class="shrink-0 text-fg-faint" />
      <input
        v-model="query"
        type="text"
        class="w-full min-w-0 bg-transparent text-xs text-fg-primary outline-none placeholder:text-fg-faint"
        :placeholder="selected.length === 0 ? '添加标签…' : ''"
        spellcheck="false"
        @focus="focused = true"
        @blur="focused = false"
        @keydown.enter.prevent="onEnter"
        @keydown.backspace="
          query === '' && selected.length > 0 && remove(selected[selected.length - 1].id)
        "
      />
    </div>

    <ul
      v-if="focused && candidates.length > 0"
      class="absolute left-0 top-[calc(100%+4px)] z-30 max-h-56 w-56 overflow-y-auto rounded-lg border border-line-subtle bg-surface-1 py-1 shadow-lg"
    >
      <li v-for="tag in candidates" :key="tag.id">
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-fg-secondary hover:bg-surface-hover"
          @mousedown.prevent="add(tag.id)"
        >
          <span class="h-2 w-2 shrink-0 rounded-full" :style="{ background: colorOf(tag) }" />
          <span class="truncate">{{ tag.name }}</span>
        </button>
      </li>
    </ul>
  </div>
</template>
