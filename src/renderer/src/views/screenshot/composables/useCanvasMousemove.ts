import { onMounted, onUnmounted } from 'vue'
import useEmiter from './useEmiter'

export default function useCanvasMousemove(
  onMousemove: (e: MouseEvent) => unknown
): void {
  const emiter = useEmiter()

  onMounted(() => {
    emiter.on('mousemove', onMousemove)
  })

  onUnmounted(() => {
    emiter.off('mousemove', onMousemove)
  })
}
