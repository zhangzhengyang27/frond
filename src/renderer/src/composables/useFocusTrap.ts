/**
 * useFocusTrap（B54）：焦点陷阱原语——从 UModal / UDrawer 各自手写的 ~40 行
 * Tab 循环 + 焦点保存/归还提炼。模态（UModal/UDrawer/CommandPalette）用；
 * 非模态浮层（右键菜单等）用 useDismissablePopup，两者互不依赖。
 *
 * 契约：
 * - active 变 true：记录当前焦点，聚焦容器内第一个可聚焦元素（无可聚焦元素则
 *   聚焦容器自身，保证 Tab 循环有锚点）
 * - active 期间 window keydown 的 Tab/Shift+Tab 在容器内循环（对越过边界的
 *   Tab preventDefault），容器外的 Tab 一律拦下——Tab 不能走出弹层
 * - active 变 false：焦点归还激活前的来源元素；组件卸载同样归还
 */
import { onBeforeUnmount, watch, type Ref } from 'vue'

export const FOCUSABLE_SELECTOR = [
  'a[href]',
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[tabindex]:not([tabindex="-1"])'
].join(', ')

export function useFocusTrap(
  container: Ref<HTMLElement | null>,
  active: Ref<boolean> | (() => boolean)
): void {
  let prevFocused: HTMLElement | null = null

  const isActive = (): boolean => (typeof active === 'function' ? active() : active.value)

  const focusables = (): HTMLElement[] =>
    Array.from(container.value?.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR) ?? [])

  const onKeydown = (e: KeyboardEvent): void => {
    if (!isActive() || e.key !== 'Tab') return
    const panel = container.value
    if (!panel) return
    const items = focusables()
    if (items.length === 0) {
      // 没有可聚焦元素：焦点留在容器上，Tab 别走到背景里
      e.preventDefault()
      return
    }
    const first = items[0]!
    const last = items[items.length - 1]!
    const active_ = document.activeElement
    const inside = panel.contains(active_)
    if (!inside) {
      // 焦点在容器外（被外部抢走）：首个 Tab 拉回容器
      e.preventDefault()
      ;(e.shiftKey ? last : first).focus()
      return
    }
    if (e.shiftKey && (active_ === first || active_ === panel)) {
      e.preventDefault()
      last.focus()
    } else if (!e.shiftKey && active_ === last) {
      e.preventDefault()
      first.focus()
    }
  }

  const onActivate = (): void => {
    prevFocused = document.activeElement as HTMLElement | null
    requestAnimationFrame(() => {
      if (!isActive()) return
      const items = focusables()
      ;(items[0] ?? container.value)?.focus()
    })
  }

  const onDeactivate = (): void => {
    prevFocused?.focus?.()
    prevFocused = null
  }

  watch(
    () => isActive(),
    (open) => {
      if (open) onActivate()
      else onDeactivate()
    },
    // 初始即 active（如 UModal modelValue 直传 true）也要走激活
    { immediate: true }
  )

  window.addEventListener('keydown', onKeydown)
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    if (isActive()) onDeactivate()
  })
}
