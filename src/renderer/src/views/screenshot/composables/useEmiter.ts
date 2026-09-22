import type { EmiterListener } from '../types'
import { useStore } from './useScreenshotsContext'

export interface EmiterDispatcher {
  on: (event: string, listener: EmiterListener) => void
  off: (event: string, listener: EmiterListener) => void
  emit: (event: string, ...args: unknown[]) => void
  reset: () => void
}

export default function useEmiter(): EmiterDispatcher {
  const store = useStore()
  const emiterRef = store.emiterRef

  const on = (event: string, listener: EmiterListener): void => {
    const emiter = emiterRef.value
    if (Array.isArray(emiter[event])) {
      emiter[event].push(listener)
    } else {
      emiter[event] = [listener]
    }
  }

  const off = (event: string, listener: EmiterListener): void => {
    const emiter = emiterRef.value
    if (Array.isArray(emiter[event])) {
      const index = emiter[event].findIndex((item) => item === listener)
      if (index !== -1) {
        emiter[event].splice(index, 1)
      }
    }
  }

  const emit = (event: string, ...args: unknown[]): void => {
    const emiter = emiterRef.value

    if (Array.isArray(emiter[event])) {
      emiter[event].forEach((listener) => listener(...args))
    }
  }

  const reset = (): void => {
    emiterRef.value = {}
  }

  return {
    on,
    off,
    emit,
    reset
  }
}
