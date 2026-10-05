<template>
  <Teleport to="body">
    <div
      v-if="isOpen"
      class="fixed inset-0 z-[80] flex items-center justify-center bg-overlay backdrop-blur-sm"
      data-testid="settings-modal"
      @click.self="close"
    >
      <div
        class="flex h-[min(780px,88vh)] w-[min(960px,92vw)] flex-col overflow-hidden rounded-2xl border border-line-subtle bg-surface-0 shadow-[0_24px_64px_rgba(0,0,0,0.35)]"
      >
        <SettingsView embedded />
      </div>
    </div>
  </Teleport>
</template>

<script setup lang="ts">
// B58 后续（用户确认的弹窗形态）：主窗/沉浸窗内设置 = 居中模态浮层。
// ESC 在此统一处理（capture 先于 SettingsView 自身的 ESC 逻辑——embedded 下后者已让位）
import { onBeforeUnmount, onMounted, watch } from 'vue'
import SettingsView from '@views/SettingsView.vue'
import { useSettingsModal } from '@composables/useSettingsModal'

const { isOpen, close } = useSettingsModal()

function handleEsc(e: KeyboardEvent): void {
  if (isOpen.value && e.key === 'Escape') {
    e.preventDefault()
    e.stopPropagation()
    close()
  }
}

// capture 阶段拦截：设置页内嵌组件（输入框等）先拿到按键也不影响关闭语义
onMounted(() => window.addEventListener('keydown', handleEsc, true))
onBeforeUnmount(() => window.removeEventListener('keydown', handleEsc, true))

// 打开时暂停背景滚动（锁 body），关闭恢复
watch(isOpen, (open) => {
  document.body.style.overflow = open ? 'hidden' : ''
})
</script>
