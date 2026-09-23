<script setup lang="ts">
import { useToast, type ToastItem } from '../../composables/useToast'

/**
 * UToastProvider · Toast 渲染容器（挂在 AppShell 一次即可）
 * 右上角堆叠，glass 材质，成功/失败带语义色描边
 */
const { items, dismiss } = useToast()

/** 触发 toast 动作（如「撤销」）并关闭该条 */
const handleAction = (t: ToastItem): void => {
  t.action?.onClick()
  dismiss(t.id)
}

const iconFor = (kind: ToastItem['kind']): string => {
  switch (kind) {
    case 'success':
      return 'M20 6 9 17l-5-5'
    case 'error':
      return 'M18 6 6 18M6 6l12 12'
    case 'warning':
      return 'M12 9v4m0 4h.01M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z'
    case 'loading':
      return ''
    default:
      return 'M12 16v-4m0-4h.01M22 12a10 10 0 1 1-20 0 10 10 0 0 1 20 0Z'
  }
}

const accentFor = (kind: ToastItem['kind']): string => {
  switch (kind) {
    case 'success':
      return 'text-success'
    case 'error':
      return 'text-danger'
    case 'warning':
      return 'text-warning'
    default:
      return 'text-brand-500'
  }
}
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed right-4 top-4 z-[1100] flex w-80 flex-col gap-2">
      <TransitionGroup name="utoast">
        <div
          v-for="t in items"
          :key="t.id"
          class="pointer-events-auto flex items-start gap-2.5 rounded-md border border-line-default bg-glass-bg-strong p-3 shadow-lg backdrop-blur-[var(--glass-blur)]"
        >
          <span v-if="t.kind === 'loading'" class="mt-0.5 shrink-0">
            <svg class="size-4 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none">
              <circle cx="12" cy="12" r="9" stroke="currentColor" stroke-width="3" opacity="0.25" />
              <path
                d="M21 12a9 9 0 0 0-9-9"
                stroke="currentColor"
                stroke-width="3"
                stroke-linecap="round"
              />
            </svg>
          </span>
          <svg
            v-else
            class="mt-0.5 size-4 shrink-0"
            :class="accentFor(t.kind)"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
          >
            <path :d="iconFor(t.kind)" stroke-linecap="round" stroke-linejoin="round" />
          </svg>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-fg-primary">{{ t.title }}</p>
            <p v-if="t.description" class="mt-0.5 text-xs text-fg-secondary">
              {{ t.description }}
            </p>
            <button
              v-if="t.action"
              type="button"
              class="mt-1 text-xs font-medium text-brand-500 transition-colors hover:text-brand-400"
              @click="handleAction(t)"
            >
              {{ t.action.label }}
            </button>
          </div>
          <button
            type="button"
            class="shrink-0 text-fg-muted transition-colors hover:text-fg-primary"
            aria-label="关闭"
            @click="dismiss(t.id)"
          >
            <svg
              class="size-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
            >
              <path d="M18 6 6 18M6 6l12 12" stroke-linecap="round" />
            </svg>
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.utoast-enter-active,
.utoast-leave-active {
  transition: all var(--motion-spring);
}
.utoast-enter-from {
  opacity: 0;
  transform: translateX(24px);
}
.utoast-leave-to {
  opacity: 0;
  transform: scale(0.96);
}
</style>
