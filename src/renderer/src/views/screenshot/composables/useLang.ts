import { computed } from 'vue'
import { useStore } from './useScreenshotsContext'
import type { Lang } from '../types'

export default function useLang(): Lang {
  const store = useStore()
  return computed(() => store.lang).value
}
