import { onMounted, onUnmounted } from 'vue'
import useEmiter from './useEmiter'

export default function useCanvasMouseup(onMouseup: (e: MouseEvent) => unknown): void {
  const emiter = useEmiter()

  onMounted(() => {
    emiter.on('mouseup', onMouseup)
  })

  onUnmounted(() => {
    emiter.off('mouseup', onMouseup)
  })
}
