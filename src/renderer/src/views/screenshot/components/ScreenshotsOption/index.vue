<template>
  <div>
    <div ref="childrenRef">
      <slot />
    </div>
    <Teleport to="body">
      <div
        v-if="open && hasContent"
        ref="contentRef"
        class="screenshots-option"
        :class="`screenshots-option-${placement}`"
        :style="{
          visibility: position ? 'visible' : 'hidden',
          transform: position ? `translate(${position.x}px, ${position.y}px)` : 'none'
        }"
      >
        <div class="screenshots-option-container">
          <slot name="content" />
        </div>
        <div
          class="screenshots-option-arrow"
          :class="`screenshots-option-arrow-${placement}`"
          :style="{ marginLeft: `${offsetX}px` }"
        />
      </div>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import { ref, watch, computed, inject } from 'vue'
import type { Slot } from 'vue'
import type { Bounds, Position } from '../../types'

interface ScreenshotsOptionProps {
  open?: boolean
  // content 是 dropdown 内的任意内容（color picker / 字号选择器等），
  // 由父组件 ScreenshotsButton 消费，结构多变，用 unknown 收口
  content?: unknown
}

enum Placement {
  Bottom = 'bottom',
  Top = 'top'
}

const props = withDefaults(defineProps<ScreenshotsOptionProps>(), {
  open: false,
  content: undefined
})

// slots 用 vue 官方的 Slot 类型（(...args) => VNode[]）
const slots = defineSlots<{
  default?: Slot
  content?: Slot
}>()

const hasContent = computed(() => {
  return !!slots.content || !!props.content
})

const operationsRect = inject<{ value: Bounds | null } | null>('ScreenshotsOperationsRect', null)

const childrenRef = ref<HTMLDivElement | null>(null)
const contentRef = ref<HTMLDivElement | null>(null)
const placement = ref<Placement>(Placement.Bottom)
const position = ref<Position | null>(null)
const offsetX = ref<number>(0)

watch(
  () => [props.open, operationsRect?.value, childrenRef.value, contentRef.value],
  () => {
    if (!props.open || !operationsRect?.value || !childrenRef.value || !contentRef.value) {
      return
    }

    const childrenRect = childrenRef.value.getBoundingClientRect()
    const contentRect = contentRef.value.getBoundingClientRect()

    let currentPlacement = placement.value
    let x = childrenRect.left + childrenRect.width / 2
    let y = childrenRect.top + childrenRect.height
    let currentOffsetX = offsetX.value

    // 如果左右都越界了，就以左边界为准
    if (x + contentRect.width / 2 > operationsRect.value.x + operationsRect.value.width) {
      const ox = x
      x = operationsRect.value.x + operationsRect.value.width - contentRect.width / 2
      currentOffsetX = ox - x
    }

    // 左边不能超出
    if (x < operationsRect.value.x + contentRect.width / 2) {
      const ox = x
      x = operationsRect.value.x + contentRect.width / 2
      currentOffsetX = ox - x
    }

    // 如果上下都越界了，就以上边界为准
    if (y > window.innerHeight - contentRect.height) {
      if (currentPlacement === Placement.Bottom) {
        currentPlacement = Placement.Top
      }
      y = childrenRect.top - contentRect.height
    }

    if (y < 0) {
      if (currentPlacement === Placement.Top) {
        currentPlacement = Placement.Bottom
      }
      y = childrenRect.top + childrenRect.height
    }
    if (currentPlacement !== placement.value) {
      placement.value = currentPlacement
    }
    if (position.value?.x !== x || position.value.y !== y) {
      position.value = {
        x,
        y
      }
    }

    if (currentOffsetX !== offsetX.value) {
      offsetX.value = currentOffsetX
    }
  },
  { immediate: true }
)
</script>

<style scoped>
.screenshots-option {
  position: absolute;
  left: 0;
  top: 0;
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans',
    sans-serif;
  z-index: 10000;
}

.screenshots-option,
.screenshots-option * {
  box-sizing: border-box;
  user-select: none;
}

.screenshots-option-container {
  background: var(--shot-glass-strong);
  backdrop-filter: blur(24px) saturate(1.6);
  -webkit-backdrop-filter: blur(24px) saturate(1.6);
  padding: 4px 6px;
  border-radius: 8px;
  border: 1px solid var(--shot-hairline);
  box-shadow: var(--shot-shadow);
}

.screenshots-option-arrow {
  position: absolute;
  border: 6px solid transparent;
}

.screenshots-option-top {
  transform: translate(-50%, -11px);
}

.screenshots-option-top .screenshots-option-arrow {
  transform: translate(-50%, -1px);
  border-top-color: rgb(37, 37, 41);
  top: 100%;
  left: 50%;
}

.screenshots-option-bottom {
  transform: translate(-50%, 11px);
}

.screenshots-option-bottom .screenshots-option-arrow {
  transform: translate(-50%, 1px);
  border-bottom-color: rgb(37, 37, 41);
  bottom: 100%;
  left: 50%;
}
</style>
