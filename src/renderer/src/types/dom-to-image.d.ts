/**
 * Frond · dom-to-image 项目内类型声明（B55 散点根源修复之一）
 *
 * dom-to-image 无 bundled types 且无 @types——CodeScreenshot / JsonVisualizer
 * 的导图功能只用 toPng/toSvg。若日后安装 @types/dom-to-image，删除本文件即可。
 */
declare module 'dom-to-image' {
  export interface DomToImageOptions {
    filter?: (node: HTMLElement) => boolean
    bgcolor?: string
    width?: number
    height?: number
    style?: Record<string, string | null>
    quality?: number
    cacheBust?: boolean
    [key: string]: unknown
  }

  const domToImage: {
    toPng(node: HTMLElement, options?: DomToImageOptions): Promise<string>
    toSvg(node: HTMLElement, options?: DomToImageOptions): Promise<string>
    toJpeg(node: HTMLElement, options?: DomToImageOptions): Promise<string>
    toBlob(node: HTMLElement, options?: DomToImageOptions): Promise<Blob>
    toPixelData(node: HTMLElement, options?: DomToImageOptions): Promise<Uint8ClampedArray>
  }

  export default domToImage
}
