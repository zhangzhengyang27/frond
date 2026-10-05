import { ref, watch, nextTick, onBeforeUnmount, type CSSProperties, type Ref } from 'vue'

/**
 * 浮层锚定定位（Teleport + fixed）：
 * 面板脱离文档流挂在 body 下，按锚元素算坐标——下方放不下自动向上弹，
 * 水平右对齐并 clamp 在视口内。胶囊窗（透明窗）里所有「点开浮层」的控件
 * 统一走这里：留在文档流里会被任一 overflow 祖先裁剪（PickerPanel 踩过）。
 *
 * 注意 top/left 必须是带 px 的字符串：数字赋给 el.style 会被 DOM 静默忽略。
 */
export function useAnchoredPanel(
  panel: Ref<HTMLElement | null>,
  anchor: Ref<HTMLElement | null>,
  open: Ref<boolean>
): Ref<CSSProperties> {
  const style = ref<CSSProperties>({})

  async function place(): Promise<void> {
    await nextTick()
    const p = panel.value
    const a = anchor.value
    if (!p || !a) return
    const pr = p.getBoundingClientRect()
    const ar = a.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const next: CSSProperties = {}
    if (pr.height <= vh - ar.bottom - 8 || ar.top - 8 < pr.height) {
      next.top = `${Math.min(ar.bottom + 4, vh - pr.height - 8)}px`
    } else {
      next.top = `${Math.max(8, ar.top - pr.height - 4)}px`
    }
    next.left = `${Math.max(8, Math.min(ar.right - pr.width, vw - pr.width - 8))}px`
    style.value = next
  }

  watch(open, (v) => {
    if (v) void place()
  })

  onBeforeUnmount(() => {
    style.value = {}
  })

  return style
}
