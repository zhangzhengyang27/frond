import { ref } from 'vue'

/**
 * 设置模态浮层（用户确认的弹窗形态改造）：
 * - 主窗 / 沉浸窗内：设置一律渲染为居中模态浮层（复用 SettingsView，ESC/遮罩关闭）
 * - tray / 深链 / 胶囊命令：保持独立 800×786 设置小窗（无宿主窗口可挂浮层）
 * 模块级单例：任意窗口内全局唯一实例，App.vue 挂载 <SettingsModal /> 消费。
 */
const isOpen = ref(false)

export function useSettingsModal(): {
  isOpen: typeof isOpen
  open: () => void
  close: () => void
} {
  return {
    isOpen,
    open: () => {
      isOpen.value = true
    },
    close: () => {
      isOpen.value = false
    }
  }
}
