<script setup lang="ts">
/**
 * PinPage · 贴图窗口（B1）
 *
 * 主进程 PinService 会创建无边框透明置顶窗口并加载 `#/screenshot/pin`，
 * 但此前路由表没有该路由 → 窗口永远空白，快捷键提示与缩放/旋转推送全部落空。
 * 本组件负责：
 * - 接收 pin:setImage 渲染图片（image:// 协议或 base64）
 * - 接收 pin:setRotation / pin:setShortcuts
 * - 无边框窗口拖拽（webkit-app-region）+ 关闭按钮 + ESC 关闭
 */

import { onBeforeUnmount, onMounted, ref } from 'vue'
import AppIcon from '@components/AppIcon.vue'

interface PinImageData {
  id: string
  imagePath: string
  imageBuffer?: string
}

const imageSrc = ref('')
const rotation = ref(0)
const opacity = ref(1)
const shortcutClose = ref('')
const hasImage = ref(false)

let unsubs: Array<(() => void) | undefined> = []

onMounted(() => {
  const api = window.api?.screenshot?.pin
  if (!api) return

  unsubs.push(
    api.onSetImage((data: PinImageData) => {
      // 优先用主进程给的 base64（image:// 协议在某些路径下解析失败时兜底）
      imageSrc.value = data.imageBuffer
        ? `data:image/png;base64,${data.imageBuffer}`
        : data.imagePath
      hasImage.value = true
    })
  )
  unsubs.push(
    api.onSetRotation((r: number) => {
      rotation.value = r
    })
  )
  unsubs.push(
    api.onSetShortcuts((s: { close?: string }) => {
      shortcutClose.value = s.close ?? ''
    })
  )
})

onBeforeUnmount(() => {
  for (const u of unsubs) u?.()
  unsubs = []
  window.api?.screenshot?.pin?.removeListeners?.()
})

const close = (): void => {
  // 关闭由主进程处理（renderer 无窗口句柄）；这里仅兜底
  window.close()
}

const onKeydown = (e: KeyboardEvent): void => {
  if (e.key === 'Escape') close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <!-- 透明底 + 可拖拽区域（无边框窗口靠 app-region 拖动） -->
  <div class="pin-root h-screen w-screen overflow-hidden bg-transparent select-none">
    <!-- drag-region：无边框窗口的拖动区域（-webkit-app-region 只能写在 CSS 里，
         放在内联 style 中会被 vue-tsc 判定为非法 CSSProperties 键） -->
    <div class="drag-region relative h-full w-full" @dblclick.stop="close">
      <img
        v-if="hasImage"
        :src="imageSrc"
        class="h-full w-full object-contain"
        :style="{
          transform: `rotate(${rotation}deg)`,
          opacity,
          filter: 'drop-shadow(0 8px 24px rgba(0,0,0,0.35))'
        }"
        alt="贴图"
      />
      <div v-else class="flex h-full w-full items-center justify-center text-xs text-fg-muted">
        等待图片…
      </div>

      <!-- 悬浮控制条（hover 显现，不参与拖拽） -->
      <div
        class="no-drag pin-controls absolute right-2 top-2 flex items-center gap-1 rounded-md border border-line-default bg-glass-bg-strong px-1.5 py-1 opacity-0 backdrop-blur-[var(--glass-blur)] transition-opacity duration-normal hover:opacity-100"
      >
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded-sm text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary"
          title="降低不透明度"
          @click.stop="opacity = Math.max(0.2, opacity - 0.1)"
        >
          <AppIcon icon="ri-subtract-line" :size="13" />
        </button>
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded-sm text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary"
          title="提高不透明度"
          @click.stop="opacity = Math.min(1, opacity + 0.1)"
        >
          <AppIcon icon="ri-add-line" :size="13" />
        </button>
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded-sm text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary"
          title="旋转 90°"
          @click.stop="rotation = (rotation + 90) % 360"
        >
          <AppIcon icon="ri-restart-line" :size="13" />
        </button>
        <button
          type="button"
          class="flex size-6 items-center justify-center rounded-sm text-danger transition-colors hover:bg-danger/10"
          :title="shortcutClose ? `关闭 (${shortcutClose})` : '关闭 (ESC)'"
          @click.stop="close"
        >
          <AppIcon icon="ri-close-line" :size="13" />
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* 无边框窗口拖拽区域 */
.drag-region {
  -webkit-app-region: drag;
}
.no-drag {
  -webkit-app-region: no-drag;
}
/* hover 整个窗口时显现控制条 */
.pin-root:hover .pin-controls {
  opacity: 1;
}
</style>
