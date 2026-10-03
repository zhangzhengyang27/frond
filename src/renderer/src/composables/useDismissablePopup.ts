/**
 * useDismissablePopup（B54）：非模态浮层的统一关闭语义——Esc 关闭 + 容器外
 * pointerdown 关闭。收口对象：SnippetList/Editor 的自建右键菜单（此前只靠
 * document click、无 Esc）、pomodoro 的声景/特殊休息浮层（此前外点处理器是
 * no-op 存根）。模态用 useFocusTrap，互不依赖。
 *
 * 契约：
 * - 仅 open 时响应；Esc → onClose（每轮只触发一次，closed 后再按无效）
 * - 容器外 pointerdown（捕获阶段）→ onClose；容器内的事件不关
 * - 组件卸载自动摘监听
 */
import { onBeforeUnmount, type Ref } from 'vue'

export function useDismissablePopup(
  container: Ref<HTMLElement | null>,
  isOpen: Ref<boolean> | (() => boolean),
  onClose: () => void,
  opts?: {
    esc?: boolean
    outsideClick?: boolean
    /** 不触发外点关闭的元素（如唤起浮层的开关按钮本身）：外点关→按钮再点又开 的竞态消除 */
    ignore?: Array<Ref<HTMLElement | null> | (() => Element | null)>
  }
): void {
  const esc = opts?.esc ?? true
  const outsideClick = opts?.outsideClick ?? true
  const ignore = opts?.ignore ?? []

  const isOpenFn = (): boolean => (typeof isOpen === 'function' ? isOpen() : isOpen.value)

  const onKeydown = (e: KeyboardEvent): void => {
    if (!esc || !isOpenFn()) return
    if (e.key === 'Escape') onClose()
  }

  const onPointerDown = (e: Event): void => {
    if (!outsideClick || !isOpenFn()) return
    const target = e.target as Node
    const panel = container.value
    if (panel && panel.contains(target)) return
    for (const ig of ignore) {
      const el = typeof ig === 'function' ? ig() : ig.value
      if (el && el.contains(target)) return
    }
    onClose()
  }

  window.addEventListener('keydown', onKeydown)
  document.addEventListener('pointerdown', onPointerDown, true)
  onBeforeUnmount(() => {
    window.removeEventListener('keydown', onKeydown)
    document.removeEventListener('pointerdown', onPointerDown, true)
  })
}
