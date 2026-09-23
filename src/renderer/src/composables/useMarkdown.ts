import { computed, ref, shallowRef, watch, type ComputedRef, type ShallowRef } from 'vue'

/**
 * 演示模式（MarkdownPresentation）的缩放状态。
 *
 * 2026-09-22 恢复事故里这个文件的**函数体全没了**，只剩签名与 return（那份签名就是规格：
 * `scale` 是字符串、`scaleToShow` 是给人看的百分比、`onZoom` 收 'in' | 'out'）。
 * 数值口径照 `MarkdownPreview` 里既有的那套（0.5–2.0、步进 0.1、显示取整百分数）——
 * 同一应用里两个视图各定一套缩放范围是迟早要对不上的。
 *
 * `scale` 用字符串是消费方决定的：它直接插进 `calc(1rem * ${scale})`。
 * 状态放在模块级：演示页与预览页共享同一份缩放，换页不该跳回 100%。
 */
const ZOOM_MIN = 0.5
const ZOOM_MAX = 2
const ZOOM_STEP = 0.1

const zoomLevel = ref(1)
const scale: ShallowRef<string | undefined> = shallowRef(zoomLevel.value.toString())

watch(
  zoomLevel,
  (value) => {
    scale.value = value.toString()
  },
  { flush: 'sync' }
)

const scaleToShow: ComputedRef<string> = computed(() => `${Math.round(zoomLevel.value * 100)}%`)

export function useMarkdown(): {
  onZoom: (type: 'in' | 'out') => void
  scaleToShow: ComputedRef<string>
  scale: ShallowRef<string | undefined>
} {
  function onZoom(type: 'in' | 'out'): void {
    const next = zoomLevel.value + (type === 'in' ? ZOOM_STEP : -ZOOM_STEP)
    zoomLevel.value = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(next * 10) / 10))
  }

  return {
    onZoom,
    scaleToShow,
    scale
  }
}
