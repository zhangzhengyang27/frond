import { provide, inject, ref, type Ref } from 'vue'
import type { Bounds, History, Emiter, Lang } from '../types'
import { zhCN } from '../types'

export interface ScreenshotsContextStore {
  url?: string
  image: Ref<HTMLImageElement | null> | HTMLImageElement | null
  width: number
  height: number
  scaleFactor?: number
  lang: Lang
  emiterRef: Ref<Emiter>
  canvasContextRef: Ref<CanvasRenderingContext2D | null>
  history: Ref<History> | History
  bounds: Ref<Bounds | null> | Bounds | null
  cursor?: Ref<string | undefined> | string | undefined
  operation?: Ref<string | undefined> | string | undefined
}

export interface ScreenshotsContextDispatcher {
  call?: <T extends unknown[]>(funcName: string, ...args: T) => void
  setHistory?: (history: History | ((prev: History) => History)) => void
  setBounds?: (bounds: Bounds | null | ((prev: Bounds | null) => Bounds | null)) => void
  setCursor?: (
    cursor: string | undefined | ((prev: string | undefined) => string | undefined)
  ) => void
  setOperation?: (
    operation: string | undefined | ((prev: string | undefined) => string | undefined)
  ) => void
}

export interface ScreenshotsContextValue {
  store: ScreenshotsContextStore
  dispatcher: ScreenshotsContextDispatcher
}

const ScreenshotsContextKey = Symbol('ScreenshotsContext')

export function provideScreenshotsContext(value: ScreenshotsContextValue): void {
  provide(ScreenshotsContextKey, value)
}

export function useScreenshotsContext(): ScreenshotsContextValue {
  const context = inject<ScreenshotsContextValue>(ScreenshotsContextKey)
  if (!context) {
    throw new Error('useScreenshotsContext must be used within Screenshots component')
  }
  return context
}

export function useStore(): ScreenshotsContextStore {
  const { store } = useScreenshotsContext()
  return store
}

// 辅助函数：获取 ref 的值
export function getValue<T>(value: Ref<T> | T): T {
  return value && typeof value === 'object' && 'value' in value
    ? (value as Ref<T>).value
    : (value as T)
}

export function useDispatcher(): ScreenshotsContextDispatcher {
  const { dispatcher } = useScreenshotsContext()
  return dispatcher
}

export function createDefaultContext(): ScreenshotsContextValue {
  return {
    store: {
      url: undefined,
      image: null,
      width: 0,
      height: 0,
      lang: zhCN,
      emiterRef: ref<Emiter>({}),
      canvasContextRef: ref<CanvasRenderingContext2D | null>(null),
      history: {
        index: -1,
        stack: []
      },
      bounds: null,
      cursor: 'move',
      operation: undefined
    },
    dispatcher: {
      call: undefined,
      setHistory: undefined,
      setBounds: undefined,
      setCursor: undefined,
      setOperation: undefined
    }
  }
}
