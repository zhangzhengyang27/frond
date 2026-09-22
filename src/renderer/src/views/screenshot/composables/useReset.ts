import useEmiter from './useEmiter'
import { useBounds } from './useBounds'
import { useCursor } from './useCursor'
import { useHistory } from './useHistory'
import { useOperation } from './useOperation'

export type ResetDispatcher = () => void

export default function useReset(): ResetDispatcher {
  const emiter = useEmiter()
  const [, boundsDispatcher] = useBounds()
  const [, cursorDispatcher] = useCursor()
  const [, historyDispatcher] = useHistory()
  const [, operationDispatcher] = useOperation()

  const reset = (): void => {
    emiter.reset()
    historyDispatcher.reset()
    boundsDispatcher.reset()
    cursorDispatcher.reset()
    operationDispatcher.reset()
  }

  return reset
}
