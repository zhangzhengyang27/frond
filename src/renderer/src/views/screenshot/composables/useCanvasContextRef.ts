import { computed, type ComputedRef } from 'vue'
import { useStore } from './useScreenshotsContext'

export interface CanvasContextValue {
  canvas: HTMLCanvasElement | null
  ctx: CanvasRenderingContext2D
}

export function useCanvasContextRef(): ComputedRef<CanvasContextValue | null> {
  const store = useStore()
  return computed(() => {
    const ctx = store.canvasContextRef.value
    if (!ctx) {
      return null
    }
    // CanvasRenderingContext2D 本身就有 canvas 属性
    return {
      canvas: ctx.canvas || null,
      ctx
    }
  })
}
