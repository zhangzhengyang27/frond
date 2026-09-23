/**
 * Leaf · 窗口截图源（desktopCapturer 工具）
 *
 * 从原 `ScreenshotService`（树内自研的截图覆盖层）里留下的两块纯工具：
 * 覆盖层本身已换成上游 `electron-screenshots`（HANDOFF §11），但「按窗口抓图」这件事
 * 上游没有，所以这两块连同 `screenshot:getWindowList` / `screenshot:captureWindow`
 * 两个 handler 一起保留。当前渲染端**没有入口在用它们**（账记在 HANDOFF §11 末尾）。
 */
import { desktopCapturer } from 'electron'

export interface WindowInfo {
  id: string
  name: string
  thumbnail: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

export type WindowCaptureResult = {
  imageUrl: string
  /** 逻辑像素 bounds（物理尺寸 ÷ scaleFactor），供调用方按 CSS 像素铺满 */
  bounds: { x: number; y: number; width: number; height: number }
  /** 窗口图像的实际缩放系数（由调用方传入覆盖层所在显示器的 scaleFactor） */
  scaleFactor: number
} | null

/** 可抓取的窗口列表（缩略图为空、或明显是自家截图/ Electron 窗的会被滤掉） */
export async function listWindowSources(): Promise<WindowInfo[]> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 300, height: 200 },
      fetchWindowIcons: true
    })

    return sources
      .filter(
        (source) =>
          source.thumbnail.getSize().width > 0 &&
          source.thumbnail.getSize().height > 0 &&
          !source.name.toLowerCase().includes('electron') &&
          !source.name.toLowerCase().includes('screenshot')
      )
      .map((source) => {
        const thumbSize = source.thumbnail.getSize()
        return {
          id: source.id,
          name: source.name || 'Unknown Window',
          thumbnail: source.thumbnail.toDataURL(),
          bounds: { x: 0, y: 0, width: thumbSize.width, height: thumbSize.height }
        }
      })
  } catch (error) {
    console.error('[windowSources] listWindowSources error:', error)
    return []
  }
}

/**
 * 按窗口 ID 捕获窗口内容。
 *
 * desktopCapturer 返回的 thumbnail 是物理像素，调用方按逻辑像素 + scaleFactor
 * 换算鼠标坐标，因此这里必须换算回逻辑尺寸，否则 Retina 下选区与图像错位 2 倍。
 */
export async function captureWindowSource(
  windowId: string,
  scaleFactor = 1
): Promise<WindowCaptureResult> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 3840, height: 2160 }
    })

    const source = sources.find((s) => s.id === windowId || s.id.startsWith(`window:${windowId}`))
    if (!source) return null

    const imageSize = source.thumbnail.getSize()
    return {
      imageUrl: source.thumbnail.toDataURL(),
      bounds: {
        x: 0,
        y: 0,
        width: Math.max(1, Math.round(imageSize.width / scaleFactor)),
        height: Math.max(1, Math.round(imageSize.height / scaleFactor))
      },
      scaleFactor
    }
  } catch (error) {
    console.error('[windowSources] captureWindowSource error:', error)
    return null
  }
}
