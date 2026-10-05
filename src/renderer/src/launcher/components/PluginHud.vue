<template>
  <Transition name="hud-fade">
    <div v-if="text" class="plugin-hud">{{ text }}</div>
  </Transition>
</template>

<script setup lang="ts">
/**
 * 插件 showHud 轻提示（2026-10-05 spec 3.3）：1.5s 自动淡出；同文本连发只刷新计时。
 * 固定在胶囊窗底部居中，pointer-events: none 不挡交互。
 */
import { onBeforeUnmount, ref } from 'vue'

const HIDE_AFTER_MS = 1500
const text = ref('')
let timer: ReturnType<typeof setTimeout> | null = null

function show(title: string): void {
  text.value = title
  if (timer) clearTimeout(timer)
  timer = setTimeout(() => {
    text.value = ''
    timer = null
  }, HIDE_AFTER_MS)
}

onBeforeUnmount(() => {
  if (timer) clearTimeout(timer)
})

defineExpose({ show })
</script>

<style scoped>
.plugin-hud {
  position: fixed;
  left: 50%;
  bottom: 56px;
  transform: translateX(-50%);
  max-width: 70%;
  padding: 7px 16px;
  border-radius: 999px;
  background: var(--launcher-bg-elevated);
  border: 1px solid var(--launcher-border);
  color: var(--launcher-text);
  font-size: 12px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  pointer-events: none;
  z-index: 60;
}

.hud-fade-enter-active,
.hud-fade-leave-active {
  transition: opacity 0.15s ease;
}
.hud-fade-enter-from,
.hud-fade-leave-to {
  opacity: 0;
}
</style>
