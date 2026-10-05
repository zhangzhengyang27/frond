<script setup lang="ts">
import TopBar from './TopBar.vue'
// B59：UToastProvider / UConfirmProvider 已上移 App.vue 根层——去壳路由
// （/snippets 等）不挂本组件，留在这里会让确认弹窗与 toast 在模块页消失
</script>

<template>
  <div class="FrondAppShell h-screen flex flex-col bg-surface-0">
    <TopBar />
    <!-- Raycast 化：移除左侧菜单栏，内容区全屏 -->
    <main class="app-scroll flex-1 min-w-0 overflow-auto">
      <slot />
    </main>
  </div>
</template>
