<script setup lang="ts">
import { ref, watch } from 'vue'
import UModal from './UModal.vue'
import UButton from './UButton.vue'
import { resolveConfirm, useConfirm, type ConfirmOptions } from '../../composables/useConfirm'

/**
 * UConfirmProvider · useConfirm 的渲染容器（挂在 AppShell 一次即可）
 * - 内部复用 UModal（sm）+ UButton；danger 时确认键用 danger 变体
 * - shown 快照：resolve 后 pending 立即清空，快照保证离场动画期间文案不闪空
 */
const { pending } = useConfirm()
const shown = ref<ConfirmOptions | null>(null)

watch(
  pending,
  (p) => {
    if (p) shown.value = p
  },
  { immediate: true }
)
</script>

<template>
  <UModal
    :model-value="pending !== undefined"
    :title="shown?.title ?? ''"
    size="sm"
    @update:model-value="resolveConfirm(false)"
  >
    <p class="text-sm text-fg-secondary">{{ shown?.message }}</p>
    <template #footer>
      <UButton variant="ghost" @click="resolveConfirm(false)">
        {{ shown?.cancelText ?? '取消' }}
      </UButton>
      <UButton :variant="shown?.danger ? 'danger' : 'primary'" @click="resolveConfirm(true)">
        {{ shown?.confirmText ?? '确定' }}
      </UButton>
    </template>
  </UModal>
</template>
