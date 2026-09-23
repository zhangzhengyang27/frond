<script setup lang="ts">
import TopBar from './TopBar.vue'
import CommandPalette from './CommandPalette.vue'
import UToastProvider from '../ui/UToastProvider.vue'
import { useModuleShortcuts } from '../../composables/useModuleShortcuts'
import { useTheme } from '../../composables/useTheme'

useModuleShortcuts()
useTheme().initTheme()
</script>

<template>
  <div class="FrondAppShell h-screen flex flex-col bg-surface-0">
    <TopBar />
    <!-- Raycast 化：移除左侧菜单栏，内容区全屏 -->
    <main class="app-scroll flex-1 min-w-0 overflow-auto">
      <slot />
    </main>
    <!-- 命令面板（⌘K）-->
    <CommandPalette />
    <!-- 全局 Toast 容器 -->
    <UToastProvider />
  </div>
</template>
