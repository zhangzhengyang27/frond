import { onMounted, onUnmounted } from 'vue'
import type { HistoryItemSource } from '../types'
import useEmiter from './useEmiter'

export default function useDrawSelect(
  onDrawSelect: (action: HistoryItemSource<unknown, unknown>, e: MouseEvent) => unknown
): void {
  const emiter = useEmiter()

  onMounted(() => {
    emiter.on('drawselect', onDrawSelect)
  })

  onUnmounted(() => {
    emiter.off('drawselect', onDrawSelect)
  })
}
