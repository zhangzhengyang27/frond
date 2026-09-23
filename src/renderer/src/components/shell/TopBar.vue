<script setup lang="ts">
import { computed } from 'vue'
import { useRouter } from 'vue-router'
import AppIcon from '@components/AppIcon.vue'
import UTooltip from '../ui/UTooltip.vue'
import { useCommandPalette } from '../../composables/useCommandPalette'
import { useTheme } from '../../composables/useTheme'

const router = useRouter()
const palette = useCommandPalette()
const { setTheme } = useTheme()

const goSettings = (): void => {
  router.push('/settings').catch(() => {
    /* ignore */
  })
}

const goAbout = (): void => {
  router.push('/about').catch(() => {
    /* ignore */
  })
}

const openCommandPalette = (): void => {
  palette.open()
}

/* 主题快捷切换：读当前视觉状态（classList），而不是 theme ref
   —— theme ref 在 auto 模式下不反映实际明暗 */
const isDarkNow = (): boolean => document.documentElement.classList.contains('dark')

const themeIcon = computed(() => (isDarkNow() ? 'sun-line' : 'moon-line'))

const toggleTheme = (): void => {
  void setTheme(isDarkNow() ? 'light' : 'dark')
}
</script>

<template>
  <header
    class="FrondTopBar relative z-20 flex h-10 shrink-0 items-center justify-between border-b border-line-subtle bg-glass-bg px-4 backdrop-blur-[var(--glass-blur)]"
  >
    <!-- 顶部 1px 内高光 -->
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-px bg-glass-highlight"
      aria-hidden="true"
    />

    <!-- 左：Logo + 名称 -->
    <div class="flex items-center gap-2 select-none">
      <span class="text-lg leading-none">🌿</span>
      <span class="text-sm font-semibold text-fg-primary">Frond</span>
    </div>

    <!-- 中：命令面板入口（⌘K）—— 独立浮层，不挤占两侧 -->
    <button
      type="button"
      class="group absolute left-1/2 top-1/2 flex h-7 w-72 -translate-x-1/2 -translate-y-1/2 items-center gap-2 rounded-full border border-line-default bg-surface-1 px-3 text-xs text-fg-muted shadow-xs transition-all duration-normal hover:border-line-strong hover:shadow-md focus-visible:shadow-ring-focus focus-visible:outline-none"
      @click="openCommandPalette"
    >
      <AppIcon icon="search" :size="14" class="shrink-0" />
      <span class="flex-1 truncate text-left">搜索模块、跳转、命令…</span>
      <kbd
        class="hidden shrink-0 rounded border border-line-subtle bg-surface-hover px-1.5 py-0.5 font-mono text-[10px]"
        >⌘K</kbd
      >
    </button>

    <!-- 右：主题切换 + 设置 + 关于 -->
    <div class="flex items-center gap-0.5">
      <UTooltip content="切换主题" position="bottom">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none"
          aria-label="切换主题"
          @click="toggleTheme"
        >
          <AppIcon :icon="themeIcon" :size="17" />
        </button>
      </UTooltip>
      <UTooltip content="设置" position="bottom">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none"
          aria-label="设置"
          @click="goSettings"
        >
          <AppIcon icon="settings-3-line" :size="17" />
        </button>
      </UTooltip>
      <UTooltip content="关于" position="bottom">
        <button
          type="button"
          class="flex h-8 w-8 items-center justify-center rounded-md text-fg-secondary transition-colors hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none"
          aria-label="关于"
          @click="goAbout"
        >
          <AppIcon icon="information-line" :size="17" />
        </button>
      </UTooltip>
    </div>
  </header>
</template>
