<template>
  <!-- 输入域内联 :emoji 补全弹层（Raycast v2.1 式）。由父组件负责定位与文本替换。 -->
  <Transition name="es-pop">
    <div v-if="visible" class="emoji-suggest">
      <div v-if="matches.length === 0" class="es-empty">没有匹配的 Emoji</div>
      <div
        v-for="(item, i) in matches"
        :key="item.emoji"
        class="es-item"
        :class="{ selected: i === selectedIndex }"
        @mouseenter="selectedIndex = i"
        @mousedown.prevent="pick(item.emoji)"
      >
        <span class="es-glyph">{{ item.emoji }}</span>
        <span class="es-name">{{ item.name }}</span>
        <span class="es-cat">{{ item.category }}</span>
      </div>
    </div>
  </Transition>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { parseEmojiTrigger, searchEmoji } from '@shared/emoji'
import type { EmojiItem } from '@shared/emoji'

const props = defineProps<{
  /** 输入框当前文本（含光标前内容），据此解析 :query */
  text: string
}>()

const emit = defineEmits<{
  pick: [emoji: string]
}>()

const selectedIndex = ref(0)
const forcedHidden = ref(false)

const trigger = computed(() => parseEmojiTrigger(props.text))
const visible = computed(
  () => !forcedHidden.value && !!trigger.value && trigger.value.query.length >= 1
)

const matches = computed<EmojiItem[]>(() =>
  trigger.value ? searchEmoji(trigger.value.query, 6) : []
)

watch(visible, (v) => {
  if (v) selectedIndex.value = 0
  else forcedHidden.value = false
})

function pick(emoji: string): void {
  forcedHidden.value = true
  emit('pick', emoji)
}

/**
 * 由父输入框在 keydown 时调用：弹层打开时消费方向键/回车/Tab/Esc。
 * @returns true 表示事件已被弹层消费（父不再处理 Enter 发送等）
 */
function consumeKey(e: KeyboardEvent): boolean {
  if (!visible.value) return false
  const len = matches.value.length
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    if (len > 0) selectedIndex.value = (selectedIndex.value + 1) % len
    return true
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    if (len > 0) selectedIndex.value = (selectedIndex.value - 1 + len) % len
    return true
  }
  if (e.key === 'Enter' || e.key === 'Tab') {
    e.preventDefault()
    const target = matches.value[selectedIndex.value]
    if (target) pick(target.emoji)
    return true
  }
  if (e.key === 'Escape') {
    e.preventDefault()
    forcedHidden.value = true
    return true
  }
  return false
}

defineExpose({ consumeKey })
</script>

<style scoped>
.emoji-suggest {
  position: absolute;
  bottom: calc(100% + 6px);
  left: 0;
  min-width: 240px;
  max-width: 320px;
  padding: 4px;
  border: 1px solid var(--launcher-border);
  border-radius: 10px;
  background: var(--launcher-popover-bg);
  box-shadow: 0 12px 32px rgba(0, 0, 0, 0.18);
  z-index: 120;
  overflow: hidden;
}

.es-item {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 5px 8px;
  border-radius: 6px;
  cursor: pointer;
}

.es-item.selected {
  background: var(--launcher-accent-soft);
}

.es-glyph {
  font-size: 16px;
  line-height: 1;
}

.es-name {
  flex: 1;
  font-size: 12px;
  color: var(--launcher-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.es-cat {
  font-size: 10px;
  color: var(--launcher-text-faint);
}

.es-empty {
  padding: 10px;
  font-size: 12px;
  text-align: center;
  color: var(--launcher-text-muted);
}

.es-pop-enter-active,
.es-pop-leave-active {
  transition:
    opacity 0.1s ease,
    transform 0.1s ease;
}

.es-pop-enter-from,
.es-pop-leave-to {
  opacity: 0;
  transform: translateY(3px);
}
</style>
