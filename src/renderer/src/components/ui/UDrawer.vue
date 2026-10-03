<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'

/**
 * UDrawer · 侧滑抽屉
 * - side: left / right 贴边滑出；size: sm(w-80) / md(w-120=480px) / lg(w-160)，窄窗 92vw 兜底
 * - Teleport 到 body，遮罩点击/Esc 关闭，焦点陷阱 + 焦点归还（同 UModal）
 * - 侧滑动画内建（right 起始 translateX(100%)，left 反向）
 * - attrs 透传到面板（aria-label / data-* 可命中）；无 title 时不渲染内置 header
 */
defineOptions({ inheritAttrs: false })

interface Props {
  modelValue: boolean
  side?: 'left' | 'right'
  size?: 'sm' | 'md' | 'lg'
  title?: string
  closeOnOverlay?: boolean
  closeOnEsc?: boolean
}

const props = withDefaults(defineProps<Props>(), {
  side: 'right',
  size: 'md',
  title: '',
  closeOnOverlay: true,
  closeOnEsc: true
})

const emit = defineEmits<{ 'update:modelValue': [value: boolean] }>()

const panelRef = ref<HTMLElement | null>(null)

const FOCUSABLE = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

let prevFocused: HTMLElement | null = null

const close = (): void => {
  emit('update:modelValue', false)
}

const onOverlayClick = (): void => {
  if (props.closeOnOverlay) close()
}

const onKeydown = (e: KeyboardEvent): void => {
  if (!props.modelValue) return
  if (e.key === 'Escape' && props.closeOnEsc) {
    close()
    return
  }
  if (e.key !== 'Tab') return
  const panel = panelRef.value
  if (!panel) return
  const items = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE))
  if (items.length === 0) {
    e.preventDefault()
    return
  }
  const first = items[0]!
  const last = items[items.length - 1]!
  const active = document.activeElement
  if (e.shiftKey && (active === first || active === panel)) {
    e.preventDefault()
    last.focus()
  } else if (!e.shiftKey && active === last) {
    e.preventDefault()
    first.focus()
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onBeforeUnmount(() => {
  window.removeEventListener('keydown', onKeydown)
  if (props.modelValue) prevFocused?.focus?.()
})

// 打开时记录来源焦点，关闭时归还；聚焦面板供键盘操作
watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      prevFocused = document.activeElement as HTMLElement | null
      requestAnimationFrame(() => panelRef.value?.focus())
    } else {
      prevFocused?.focus?.()
      prevFocused = null
    }
  }
)

const sizeCls: Record<string, string> = {
  sm: 'w-80',
  md: 'w-120',
  lg: 'w-160'
}
</script>

<template>
  <Teleport to="body">
    <Transition name="udrawer">
      <div v-if="modelValue" class="fixed inset-0 z-[1000]" @click.self="onOverlayClick">
        <div class="absolute inset-0 bg-overlay backdrop-blur-[2px]" aria-hidden="true" />
        <div
          ref="panelRef"
          role="dialog"
          aria-modal="true"
          tabindex="-1"
          class="u-drawer-panel absolute bottom-0 top-0 flex flex-col overflow-hidden border-line-default bg-surface-3 shadow-lg focus:outline-none"
          :class="[
            side === 'right' ? 'right-0 border-l is-right' : 'left-0 border-r is-left',
            sizeCls[size]
          ]"
          style="max-width: 92vw"
          v-bind="$attrs"
        >
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
          <slot />
        </div>
      </div>
    </Transition>
  </Teleport>
</template>

<style scoped>
/* 侧滑动画：遮罩淡入淡出，面板按 side 从屏幕外滑入（right→translateX(100%)） */
.udrawer-enter-active,
.udrawer-leave-active {
  transition: opacity var(--motion-normal) ease-out;
}
.udrawer-enter-active .u-drawer-panel,
.udrawer-leave-active .u-drawer-panel {
  transition: transform var(--motion-normal) ease-out;
}
.udrawer-enter-from,
.udrawer-leave-to {
  opacity: 0;
}
.udrawer-enter-from .u-drawer-panel.is-right,
.udrawer-leave-to .u-drawer-panel.is-right {
  transform: translateX(100%);
}
.udrawer-enter-from .u-drawer-panel.is-left,
.udrawer-leave-to .u-drawer-panel.is-left {
  transform: translateX(-100%);
}
</style>
