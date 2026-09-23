<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * UModal · 模态弹窗
 * - Teleport 到 body，遮罩 + 居中面板
 * - ESC 关闭、遮罩点击关闭（closeOnOverlay）
 * - v-model 控制显隐，带 Raycast 式缩放入场动画
 */
interface Props {
  modelValue: boolean
  title?: string
  size?: 'sm' | 'md' | 'lg'
  /** 点击遮罩是否关闭 */
  closeOnOverlay?: boolean
  /** ESC 是否关闭 */
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  title: '',
  size: 'md',
  closeOnOverlay: true,
  closeOnEsc: true
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const panelRef = ref<HTMLElement | null>(null)

const close = (): void => {
  emit('update:modelValue', false)
}

const onOverlayClick = (): void => {
  if (props.closeOnOverlay) close()
}

const onKeydown = (e: KeyboardEvent): void => {
  if (props.closeOnEsc && e.key === 'Escape' && props.modelValue) close()
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => window.removeEventListener('keydown', onKeydown))

// 打开时锁定 body 滚动由外层容器自己保证；这里聚焦面板便于键盘操作
watch(
  () => props.modelValue,
  (open) => {
    if (open) requestAnimationFrame(() => panelRef.value?.focus())
  }
)

const sizeCls: Record<string, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="umodal">
      <div
        v-if="modelValue"
        class="fixed inset-0 z-[1000] flex items-center justify-center p-6"
        @click.self="onOverlayClick"
      >
        <div class="absolute inset-0 bg-overlay backdrop-blur-[2px]" aria-hidden="true" />
        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          class="relative w-full overflow-hidden rounded-lg border border-line-default bg-surface-3 shadow-lg focus:outline-none"
          :class="sizeCls[size]"
        >
          <!-- 顶部 1px 内高光 -->
          <div
            class="pointer-events-none absolute inset-x-0 top-0 h-px bg-glass-highlight"
            aria-hidden="true"
          />
          <header
            v-if="title"
            class="flex items-center justify-between gap-3 border-b border-line-default px-5 py-3.5"
          >
            <h2 class="truncate text-sm font-semibold text-fg-primary">{{ title }}</h2>
            <button
              type="button"
              aria-label="关闭"
              class="rounded-sm p-1 text-fg-muted transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary focus-visible:shadow-ring-focus focus-visible:outline-none"
              @click="close"
            >
              <svg class="size-4" viewBox="0 0 24 24" fill="none" aria-hidden="true">
                <path
                  d="M6 6l12 12M18 6L6 18"
                  stroke="currentColor"
                  stroke-width="2"
                  stroke-linecap="round"
                />
              </svg>
            </button>
          </header>
          <div class="max-h-[70vh] overflow-y-auto px-5 py-4">
            <slot />
          </div>
          <footer
            v-if="$slots.footer"
            class="flex items-center justify-end gap-2 border-t border-line-default px-5 py-3.5"
          >
            <slot name="footer" />
          </footer>
        </div>
      </div>
    </Transition>
  </Teleport>
</template>
