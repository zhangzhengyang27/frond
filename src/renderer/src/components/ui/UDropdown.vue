<script setup lang="ts">
import { nextTick, onBeforeUnmount, onMounted, ref } from 'vue'
import { computePlacement, type Placement } from './dropdownPlacement'

/**
 * UDropdown · 统一下拉菜单
 * - 默认插槽 = 触发器内容（组件渲染 button，带 aria-haspopup/aria-expanded）
 * - 视口边界翻转（computePlacement 纯函数）、点击外部/Esc 关闭、ArrowUp/Down 导航
 * - divider: true 的项渲染为分隔线，忽略其余字段且不可聚焦
 */
interface MenuItem {
  id: string
  label?: string
  icon?: string
  danger?: boolean
  disabled?: boolean
  divider?: boolean
}

interface Props {
  items: MenuItem[]
  align?: 'start' | 'end'
  side?: 'bottom' | 'top'
  label?: string
}

const props = withDefaults(defineProps<Props>(), {
  align: 'start',
  side: 'bottom',
  label: ''
})

const emit = defineEmits<{ select: [id: string] }>()

const rootRef = ref<HTMLElement | null>(null)
const triggerRef = ref<HTMLButtonElement | null>(null)
const panelRef = ref<HTMLElement | null>(null)
const open = ref(false)
const placement = ref<Placement>({ side: props.side, align: props.align })
let menuButtons: HTMLButtonElement[] = []

const close = (): void => {
  open.value = false
}

const toggle = async (): Promise<void> => {
  if (open.value) {
    close()
    return
  }
  open.value = true
  await nextTick()
  const trigger = triggerRef.value
  const panel = panelRef.value
  if (trigger && panel) {
    placement.value = computePlacement(
      trigger.getBoundingClientRect(),
      panel.getBoundingClientRect(),
      window.innerWidth,
      window.innerHeight,
      { side: props.side, align: props.align }
    )
    menuButtons = Array.from(panel.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'))
    menuButtons[0]?.focus()
  }
}

const onDocumentPointerDown = (e: PointerEvent): void => {
  if (open.value && rootRef.value && !rootRef.value.contains(e.target as Node)) close()
}

const onPanelKeydown = (e: KeyboardEvent): void => {
  const items = menuButtons.filter((b) => !b.disabled)
  const idx = items.findIndex((b) => b === document.activeElement)
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    items[idx + 1 < items.length ? idx + 1 : 0]?.focus()
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    items[idx - 1 >= 0 ? idx - 1 : items.length - 1]?.focus()
  } else if (e.key === 'Escape') {
    close()
    triggerRef.value?.focus()
  }
}

const choose = (item: MenuItem): void => {
  if (item.disabled) return
  emit('select', item.id)
  close()
  triggerRef.value?.focus()
}

onMounted(() => document.addEventListener('pointerdown', onDocumentPointerDown))
onBeforeUnmount(() => document.removeEventListener('pointerdown', onDocumentPointerDown))
</script>

<template>
  <div ref="rootRef" class="relative inline-flex">
    <button
      ref="triggerRef"
      type="button"
      :aria-haspopup="open ? 'menu' : undefined"
      :aria-expanded="open"
      :aria-label="label || undefined"
      @click="toggle"
    >
      <slot />
    </button>
    <div
      v-if="open"
      ref="panelRef"
      role="menu"
      class="u-menu absolute min-w-36 overflow-hidden rounded-md border border-line-default bg-surface-3 py-1 shadow-lg"
      :class="[
        placement.side === 'bottom' ? 'top-full mt-1.5' : 'bottom-full mb-1.5',
        placement.align === 'start' ? 'left-0' : 'right-0'
      ]"
      @keydown="onPanelKeydown"
    >
      <template v-for="item in items" :key="item.id">
        <hr v-if="item.divider" role="separator" class="my-1 border-line-subtle" />
        <button
          v-else
          type="button"
          role="menuitem"
          :disabled="item.disabled"
          class="flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors duration-fast focus-visible:outline-none disabled:cursor-not-allowed disabled:opacity-40"
          :class="
            item.danger
              ? 'text-danger hover:bg-danger/5 focus-visible:bg-danger/5'
              : 'text-fg-primary hover:bg-surface-hover focus-visible:bg-surface-hover'
          "
          @click="choose(item)"
        >
          <i v-if="item.icon" :class="item.icon" class="text-base" aria-hidden="true" />
          <span>{{ item.label }}</span>
        </button>
      </template>
    </div>
  </div>
</template>

<style scoped>
.u-menu {
  z-index: var(--z-dropdown);
}
</style>
