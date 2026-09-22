<template>
  <div
    class="screenshots"
    :style="{ width: `${width}px`, height: `${height}px` }"
    @dblclick="handleDoubleClick"
    @contextmenu="handleContextMenu"
  >
    <ScreenshotsBackground />
    <ScreenshotsCanvas ref="canvasRef" />
    <ScreenshotsOperations
      @ok="handleOk"
      @cancel="handleCancel"
      @save="handleSave"
      @pin="handlePin"
      @ocr="handleOcr"
    />
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import type { Bounds, History, Emiter, Lang } from '../types'
import { zhCN } from '../types'
import {
  provideScreenshotsContext,
  type ScreenshotsContextValue
} from '../composables/useScreenshotsContext'
import useGetLoadedImage from '../composables/useGetLoadedImage'
import composeImage from '../utils/composeImage'
import ScreenshotsBackground from './ScreenshotsBackground.vue'
import ScreenshotsCanvas from './ScreenshotsCanvas.vue'
import ScreenshotsOperations from './ScreenshotsOperations.vue'

export interface ScreenshotsProps {
  url?: string
  width: number
  height: number
  /** 来源显示器的缩放系数（窗口截图/跨屏时 ≠ 当前窗口 dpr），用于成图分辨率 */
  scaleFactor?: number
  lang?: Partial<Lang>
  className?: string
  onOk?: (blob: Blob | null, bounds: Bounds) => void
  onCancel?: () => void
  onSave?: (blob: Blob | null, bounds: Bounds) => void
  onPin?: (blob: Blob | null, bounds: Bounds) => void
  onOcr?: (imageDataUrl: string) => void
}

const props = withDefaults(defineProps<ScreenshotsProps>(), {
  url: undefined,
  scaleFactor: undefined,
  lang: () => ({}),
  className: '',
  onOk: undefined,
  onCancel: undefined,
  onSave: undefined,
  onPin: undefined,
  onOcr: undefined
})

const emit = defineEmits<{
  ok: [blob: Blob | null, bounds: Bounds]
  cancel: []
  save: [blob: Blob | null, bounds: Bounds]
  pin: [blob: Blob | null, bounds: Bounds]
  ocr: [imageDataUrl: string]
}>()

const image = useGetLoadedImage(props.url)
const canvasRef = ref<InstanceType<typeof ScreenshotsCanvas> | null>(null)

const emiterRef = ref<Emiter>({})
const history = ref<History>({
  index: -1,
  stack: []
})
const bounds = ref<Bounds | null>(null)
const cursor = ref<string | undefined>('move')
const operation = ref<string | undefined>(undefined)

const canvasContextRef = ref<CanvasRenderingContext2D | null>(null)

watch(
  () => canvasRef.value?.ctx,
  (ctx) => {
    if (ctx && 'value' in ctx) {
      canvasContextRef.value = (ctx as { value: CanvasRenderingContext2D | null }).value
    } else {
      canvasContextRef.value = (ctx as CanvasRenderingContext2D | null) || null
    }
  },
  { immediate: true }
)

const store = {
  url: props.url,
  image,
  width: props.width,
  height: props.height,
  scaleFactor: props.scaleFactor,
  lang: {
    ...zhCN,
    ...props.lang
  },
  emiterRef,
  // 类型兼容：store 期望 Ref<CanvasRenderingContext2D | null>，此处
  // 上下文 store 接口比内联更宽松；any 是历史 copy-paste 残留
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  canvasContextRef: canvasContextRef as any,
  history,
  bounds,
  cursor,
  operation
}

const call = <T extends unknown[]>(funcName: string, ...args: T): void => {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const func = (props as any)[funcName]
  if (typeof func === 'function') {
    func(...args)
  }
}

const dispatcher = {
  call,
  setHistory: (newHistory: History | ((prev: History) => History)) => {
    history.value = typeof newHistory === 'function' ? newHistory(history.value) : newHistory
  },
  setBounds: (newBounds: Bounds | null | ((prev: Bounds | null) => Bounds | null)) => {
    bounds.value = typeof newBounds === 'function' ? newBounds(bounds.value) : newBounds
  },
  setCursor: (
    newCursor: string | undefined | ((prev: string | undefined) => string | undefined)
  ) => {
    cursor.value = typeof newCursor === 'function' ? newCursor(cursor.value) : newCursor
  },
  setOperation: (
    newOperation: string | undefined | ((prev: string | undefined) => string | undefined)
  ) => {
    operation.value =
      typeof newOperation === 'function' ? newOperation(operation.value) : newOperation
  }
}

const contextValue: ScreenshotsContextValue = {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  store: store as any,
  dispatcher
}

provideScreenshotsContext(contextValue)

// 监听 props.url 变化，更新 store.url
watch(
  () => props.url,
  (newUrl) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ;(store as any).url = newUrl
  }
)

const reset = (): void => {
  emiterRef.value = {}
  history.value = {
    index: -1,
    stack: []
  }
  bounds.value = null
  cursor.value = 'move'
  operation.value = undefined
}

const handleDoubleClick = async (e: MouseEvent): Promise<void> => {
  if (e.button !== 0 || !image.value) {
    return
  }
  if (bounds.value && canvasContextRef.value) {
    const blob = await composeImage({
      image: image.value,
      width: props.width,
      height: props.height,
      history: history.value,
      scaleFactor: props.scaleFactor,
      bounds: bounds.value
    })
    call('onOk', blob, bounds.value)
    reset()
  } else {
    const targetBounds = {
      x: 0,
      y: 0,
      width: props.width,
      height: props.height
    }
    const blob = await composeImage({
      image: image.value,
      width: props.width,
      height: props.height,
      history: history.value,
      scaleFactor: props.scaleFactor,
      bounds: targetBounds
    })
    call('onOk', blob, targetBounds)
    reset()
  }
}

const handleContextMenu = (e: MouseEvent): void => {
  if (e.button !== 2) {
    return
  }
  e.preventDefault()
  call('onCancel')
  reset()
}

const handleOk = (blob: Blob | null, bounds: Bounds): void => {
  call('onOk', blob, bounds)
  reset()
}

const handleCancel = (): void => {
  call('onCancel')
  reset()
}

const handleSave = (blob: Blob | null, bounds: Bounds): void => {
  call('onSave', blob, bounds)
  reset()
}

const handlePin = async (blob: Blob | null, bounds: Bounds): Promise<void> => {
  try {
    // 如果 blob 为 null（从工具栏触发），自行合成图片
    let finalBlob = blob
    if (!finalBlob && image.value && bounds) {
      finalBlob = await composeImage({
        image: image.value,
        width: props.width,
        height: props.height,
        history: history.value,
        scaleFactor: props.scaleFactor,
        bounds
      })
    }
    if (!finalBlob) return

    // blob → dataURL（FileReader 异步转换，避免逐字节拼串在大图上卡顿数秒）
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = () => reject(reader.error ?? new Error('readAsDataURL failed'))
      reader.readAsDataURL(finalBlob)
    })
    const base64 = dataUrl.split(',')[1] ?? ''

    // 调用 API 创建贴图
    const result = await window.api.screenshot.pin.create({
      imagePath: dataUrl,
      imageBuffer: base64
    })

    if (result.success) {
      console.log('[Screenshots] Pin created:', result.id)
      // 贴图创建后关闭截图窗口
      call('onCancel')
      reset()
    }
  } catch (error) {
    console.error('[Screenshots] Failed to create pin:', error)
  }
}

const handleOcr = async (blob: Blob | null, bounds: Bounds): Promise<void> => {
  if (!image.value) return

  try {
    // 如果有选区 bounds，裁剪选区进行 OCR；否则使用全图
    const targetBounds = bounds || { x: 0, y: 0, width: props.width, height: props.height }

    // 创建临时画布裁剪选区
    const tempCanvas = document.createElement('canvas')
    tempCanvas.width = targetBounds.width
    tempCanvas.height = targetBounds.height
    const tempCtx = tempCanvas.getContext('2d')
    if (!tempCtx) return

    // 计算图片缩放比例
    const rx = image.value.naturalWidth / props.width
    const ry = image.value.naturalHeight / props.height

    tempCtx.drawImage(
      image.value,
      targetBounds.x * rx,
      targetBounds.y * ry,
      targetBounds.width * rx,
      targetBounds.height * ry,
      0,
      0,
      targetBounds.width,
      targetBounds.height
    )

    const dataUrl = tempCanvas.toDataURL('image/png')
    emit('ocr', dataUrl)
  } catch (error) {
    console.error('[Screenshots] Failed to handle OCR:', error)
  }
}

watch(
  () => props.url,
  () => {
    reset()
  }
)

/** 供父组件通过 ref 调用，模拟“确定”操作（如 Enter 键触发） */
const confirm = async (): Promise<void> => {
  if (!image.value) return
  if (bounds.value && canvasContextRef.value) {
    const blob = await composeImage({
      image: image.value,
      width: props.width,
      height: props.height,
      history: history.value,
      scaleFactor: props.scaleFactor,
      bounds: bounds.value
    })
    call('onOk', blob, bounds.value)
    reset()
  } else {
    const targetBounds = {
      x: 0,
      y: 0,
      width: props.width,
      height: props.height
    }
    const blob = await composeImage({
      image: image.value,
      width: props.width,
      height: props.height,
      history: history.value,
      scaleFactor: props.scaleFactor,
      bounds: targetBounds
    })
    call('onOk', blob, targetBounds)
    reset()
  }
}

defineExpose({ confirm })
</script>

<style>
@import '../icons/iconfont.less';
</style>

<style scoped>
.screenshots {
  position: relative;
  transform: translateZ(0);
  font-family:
    -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, 'Noto Sans',
    sans-serif;
}

.screenshots,
.screenshots * {
  box-sizing: border-box;
  user-select: none;
}
</style>
