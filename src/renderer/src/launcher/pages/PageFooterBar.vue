<template>
  <div class="page-footer-bar">
    <button
      v-if="pageTitle"
      class="page-footer-breadcrumb"
      title="返回上一级（Esc）"
      @click="onBreadcrumb"
    >
      {{ pageTitle }}
    </button>
    <span v-for="h in hints" :key="h.keys + h.label" class="page-footer-hint">
      <kbd>{{ h.keys }}</kbd>
      {{ h.label }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { injectPageTitle } from '../composables/useLauncherPages'

/**
 * 内联页底栏（I7 全量覆盖）：不经过 CapsulePage 的自绘页面用本组件补齐
 * Raycast 式底栏——左侧当前页面包屑（标题由 LauncherApp provide）+ 可选动作提示。
 * 面包屑点击经 frond:launcher-pop 事件由 LauncherApp 统一逐级返回。
 */
withDefaults(defineProps<{ hints?: Array<{ keys: string; label: string }> }>(), {
  hints: () => []
})

const injected = injectPageTitle()
const pageTitle = computed(() => injected?.value ?? null)

function onBreadcrumb(): void {
  window.dispatchEvent(new CustomEvent('frond:launcher-pop'))
}
</script>

<style scoped>
/* 与 CapsulePage 的 capsule-hints 同款视觉 */
.page-footer-bar {
  flex-shrink: 0;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 6px 14px 8px;
  border-top: 1px solid var(--launcher-border);
  font-size: 11px;
  color: var(--launcher-text-muted);
  box-sizing: border-box;
}

.page-footer-breadcrumb {
  border: none;
  background: transparent;
  cursor: pointer;
  font-size: 11px;
  font-weight: 500;
  color: var(--launcher-text-dim);
  padding: 2px 8px;
  border-radius: 5px;
  transition: background 0.1s ease;
  margin-right: 2px;
}

.page-footer-breadcrumb:hover {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}

.page-footer-hint kbd {
  font-family: inherit;
  font-size: 10px;
  border: 1px solid var(--launcher-border);
  border-radius: 4px;
  padding: 1px 5px;
  margin-right: 3px;
}
</style>
