/**
 * Leaf · 命令面板开关（⌘K / Ctrl+K）
 *
 * 单例：整个 App 中任何地方调 open() 都会打开同一面板。
 * 使用方式：
 *   const palette = useCommandPalette()
 *   palette.open() / palette.close() / palette.toggle()
 *   palette.isOpen（ref）— 命令面板里用 v-if 渲染
 */

import { ref } from 'vue'

const isOpen = ref(false)

export function useCommandPalette(): {
  isOpen: typeof isOpen
  open: () => void
  close: () => void
  toggle: () => void
} {
  return {
    isOpen,
    open: () => {
      isOpen.value = true
    },
    close: () => {
      isOpen.value = false
    },
    toggle: () => {
      isOpen.value = !isOpen.value
    }
  }
}
