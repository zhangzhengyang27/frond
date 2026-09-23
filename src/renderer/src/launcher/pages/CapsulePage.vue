<template>
  <div class="capsule-page">
    <div class="capsule-page-body" :class="{ 'has-detail': hasDetail }">
      <div class="capsule-list">
        <slot />
      </div>
      <!-- Detail 基元（Raycast List-Detail）：提供 detail 插槽即启用双栏 -->
      <div v-if="hasDetail" class="capsule-detail">
        <slot name="detail" />
      </div>
    </div>
    <!-- Actions 栏（Raycast 式）：左侧当前页面包屑（I7，点击返回）+ 动作快捷键 -->
    <div v-if="hints.length > 0 || pageTitle" class="capsule-hints">
      <button
        v-if="pageTitle"
        class="capsule-breadcrumb"
        title="返回上一级（Esc）"
        @click="onBreadcrumb"
      >
        {{ pageTitle }}
      </button>
      <span v-for="h in hints" :key="h.keys + h.label" class="capsule-hint">
        <kbd>{{ h.keys }}</kbd>
        {{ h.label }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, useSlots } from 'vue'
import { injectPageTitle } from '../composables/useLauncherPages'

/**
 * 胶囊内联页壳（阶段B UI 基元）：
 * - 统一的底部 Actions 提示栏（左侧注入当前页标题作面包屑，I7）
 * - List-Detail 双栏：提供 detail 插槽即启用右侧详情面板（Raycast Detail 模式）
 * 键盘约定由 LauncherApp 集中分发到各页的 handleKey(e)。
 */
defineProps<{ hints: Array<{ keys: string; label: string }> }>()

const slots = useSlots()
const hasDetail = computed(() => !!slots.detail)

const pageTitleInjected = injectPageTitle()
const pageTitle = computed(() => pageTitleInjected?.value ?? null)

/** 面包屑点击 = 逐级返回（LauncherApp 统一监听，页面无需各自接线） */
function onBreadcrumb(): void {
  window.dispatchEvent(new CustomEvent('frond:launcher-pop'))
}
</script>

<style scoped>
.capsule-page {
  display: flex;
  flex-direction: column;
  padding-bottom: 4px;
}

.capsule-page-body {
  flex: 1;
  min-height: 0;
}

.capsule-page-body.has-detail {
  display: flex;
  align-items: stretch;
}

.capsule-list {
  flex: 1;
  min-width: 0;
  min-height: 0;
  overflow-y: auto;
}

.capsule-detail {
  /* V7 对齐 Raycast List-Detail：详情列 465px 基准（750 窗下列表 ~285） */
  flex: 0 0 var(--launcher-detail-width);
  min-width: 0;
  border-left: 1px solid var(--launcher-border);
  padding: 10px 12px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 8px;
  box-sizing: border-box;
}

.capsule-hints {
  display: flex;
  gap: 14px;
  padding: 6px 14px 8px;
  border-top: 1px solid var(--launcher-border);
  font-size: 11px;
  color: var(--launcher-text-muted);
}

.capsule-breadcrumb {
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

.capsule-breadcrumb:hover {
  background: var(--launcher-selected-bg);
  color: var(--launcher-text);
}

.capsule-hint kbd {
  font-family: inherit;
  font-size: 10px;
  border: 1px solid var(--launcher-border);
  border-radius: 4px;
  padding: 1px 5px;
  margin-right: 3px;
}
</style>
