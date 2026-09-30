<template>
  <div class="emoji-picker">
    <div ref="scrollRef" class="ep-scroll">
      <template v-if="props.query?.trim()">
        <div
          v-for="(item, index) in flatRows"
          :key="item.emoji + index"
          class="ep-item"
          :class="{ selected: index === selectedIndex }"
          @mouseenter="selectedIndex = index"
          @mousedown.prevent="copy(item)"
        >
          <span class="ep-char">{{ item.emoji }}</span>
          <span class="ep-name">{{ item.name }}</span>
          <span class="ep-kw">{{ item.keywords.slice(0, 4).join(' · ') }}</span>
          <span v-if="copiedEmoji === item.emoji" class="ep-copied">已复制</span>
          <span v-else class="ep-shortcut">↵</span>
        </div>
        <div v-if="flatRows.length === 0" class="ep-empty">没有匹配的 Emoji</div>
      </template>
      <template v-else>
        <template v-for="group in grouped" :key="group.category">
          <div class="ep-category">{{ group.category }}</div>
          <div
            v-for="item in group.items"
            :key="group.category + item.emoji"
            class="ep-item"
            :class="{ selected: item.flatIndex === selectedIndex }"
            @mouseenter="selectedIndex = item.flatIndex"
            @mousedown.prevent="copy(item)"
          >
            <span class="ep-char">{{ item.emoji }}</span>
            <span class="ep-name">{{ item.name }}</span>
            <span class="ep-kw">{{ item.keywords.slice(0, 4).join(' · ') }}</span>
            <span v-if="copiedEmoji === item.emoji" class="ep-copied">已复制</span>
            <span v-else class="ep-shortcut">↵</span>
          </div>
        </template>
      </template>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import { EMOJI_LIST, searchEmoji, type EmojiItem } from '@shared/emoji'

/**
 * Emoji 选择页（Raycast「Emoji Search」parity 的浏览面）：
 * 空查询按类别分组浏览；有关键词走 searchEmoji 打分。
 * 复制不关胶囊——连续挑几个表情是主路径（与根搜索「复制即关」互补）。
 */

const props = defineProps<{ query?: string }>()

const selectedIndex = ref(0)
const copiedEmoji = ref('')
let copiedTimer: ReturnType<typeof setTimeout> | null = null

interface FlatRow extends EmojiItem {
  flatIndex: number
}

const grouped = computed<{ category: string; items: FlatRow[] }[]>(() => {
  const map = new Map<string, EmojiItem[]>()
  for (const item of EMOJI_LIST) {
    const list = map.get(item.category) ?? []
    list.push(item)
    map.set(item.category, list)
  }
  let flat = 0
  return [...map.entries()].map(([category, items]) => ({
    category,
    items: items.map((item) => ({ ...item, flatIndex: flat++ }))
  }))
})

const flatRows = computed<FlatRow[]>(() => {
  if (props.query?.trim()) {
    return searchEmoji(props.query, 60).map((item) => ({ ...item, flatIndex: 0 }))
  }
  return grouped.value.flatMap((g) => g.items)
})

const total = computed(() => flatRows.value.length)

watch(
  () => props.query,
  () => {
    selectedIndex.value = 0
  }
)

watch(total, (n) => {
  if (selectedIndex.value >= n) selectedIndex.value = Math.max(0, n - 1)
})

async function copy(item: EmojiItem): Promise<void> {
  try {
    await navigator.clipboard.writeText(item.emoji)
    copiedEmoji.value = item.emoji
    if (copiedTimer) clearTimeout(copiedTimer)
    copiedTimer = setTimeout(() => (copiedEmoji.value = ''), 1500)
  } catch (err) {
    console.warn('EmojiPickerPage: copy failed', err)
  }
}

defineExpose({
  handleKey(e: KeyboardEvent): boolean {
    if (e.key === 'ArrowDown') {
      selectedIndex.value = (selectedIndex.value + 1) % Math.max(1, total.value)
      return true
    }
    if (e.key === 'ArrowUp') {
      selectedIndex.value =
        (selectedIndex.value - 1 + Math.max(1, total.value)) % Math.max(1, total.value)
      return true
    }
    if (e.key === 'Enter') {
      const row = flatRows.value[selectedIndex.value]
      if (row) void copy(row)
      return true
    }
    return false
  }
})
</script>

<style scoped>
.emoji-picker {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ep-scroll {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  padding: 6px 0;
}

.ep-category {
  padding: 8px 16px 4px;
  font-size: 11px;
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.06em;
  color: var(--launcher-text-faint);
}

.ep-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 6px 16px;
  cursor: pointer;
}

.ep-item.selected {
  background: var(--launcher-bg-elevated);
}

.ep-char {
  font-size: 20px;
  width: 28px;
  text-align: center;
  flex-shrink: 0;
}

.ep-name {
  font-size: 13px;
  color: var(--launcher-text);
  flex-shrink: 0;
}

.ep-kw {
  font-size: 11px;
  color: var(--launcher-text-faint);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  flex: 1;
  min-width: 0;
}

.ep-copied {
  font-size: 12px;
  color: var(--launcher-accent);
  flex-shrink: 0;
}

.ep-shortcut {
  font-size: 13px;
  color: var(--launcher-text-faint);
  flex-shrink: 0;
}

.ep-empty {
  display: flex;
  align-items: center;
  justify-content: center;
  height: 100%;
  color: var(--launcher-text-muted);
  font-size: 13px;
}
</style>
