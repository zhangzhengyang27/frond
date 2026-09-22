import { onMounted, onUnmounted } from 'vue'
import useEmiter from './useEmiter'

export default function useCanvasMousedown(
  onMousedown: (e: MouseEvent) => unknown
): void {
  const emiter = useEmiter()

  onMounted(() => {
    emiter.on('mousedown', onMousedown)
  })

  onUnmounted(() => {
    emiter.off('mousedown', onMousedown)
  })
}
