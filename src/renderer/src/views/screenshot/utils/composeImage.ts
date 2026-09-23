import type { Bounds, History } from '../types'
import { HistoryItemType } from '../types'

interface ComposeImageOpts {
  image: HTMLImageElement
  width: number
  height: number
  history: History
  bounds: Bounds
  /**
   * 输出缩放系数：应传来源显示器的 scaleFactor（窗口截图时 ≠ 当前窗口的 dpr）。
   * 缺省回退 window.devicePixelRatio。
   */
  scaleFactor?: number
}

export default function composeImage({
  image,
  width,
  height,
  history,
  bounds,
  scaleFactor
}: ComposeImageOpts): Promise<Blob> {
  return new Promise<Blob>((resolve, reject) => {
    const scale = Math.max(scaleFactor ?? window.devicePixelRatio, 0.1)
    const $canvas = document.createElement('canvas')
    const targetWidth = Math.max(1, Math.round(bounds.width * scale))
    const targetHeight = Math.max(1, Math.round(bounds.height * scale))
    $canvas.width = targetWidth
    $canvas.height = targetHeight

    const ctx = $canvas.getContext('2d')
    if (!ctx) {
      return reject(new Error('convert image to blob fail'))
    }

    const rx = image.naturalWidth / width
    const ry = image.naturalHeight / height

    ctx.imageSmoothingEnabled = true
    // 设置太高，图片会模糊
    ctx.imageSmoothingQuality = 'low'
    ctx.setTransform(scale, 0, 0, scale, 0, 0)
    ctx.clearRect(0, 0, bounds.width, bounds.height)
    ctx.drawImage(
      image,
      bounds.x * rx,
      bounds.y * ry,
      bounds.width * rx,
      bounds.height * ry,
      0,
      0,
      bounds.width,
      bounds.height
    )

    history.stack.slice(0, history.index + 1).forEach((item) => {
      if (item.type === HistoryItemType.Source) {
        item.draw(ctx, item)
      }
    })

    $canvas.toBlob((blob) => {
      // Bug#14: 显式释放 canvas 帮助 GC 回收内存
      $canvas.width = 0
      $canvas.height = 0

      if (!blob) {
        return reject(new Error('canvas toBlob fail'))
      }
      resolve(blob)
    }, 'image/png')
  })
}
