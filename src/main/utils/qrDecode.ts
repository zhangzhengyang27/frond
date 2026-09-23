/**
 * Frond · 二维码解码（V4 P1-12 批次3，对齐 Raycast「Copy Text from QR Code」）
 *
 * jsQR 需要 RGBA ImageData；Electron nativeImage.getBitmap() 返回 BGRA 布局，
 * 且带 alpha 预乘。此处做通道转换 + 不透明化，再交 jsQR。
 * BGRA→RGBA 转换为纯函数（可单测）；整图解码失败时尝试交换 R/B（兼容
 * 平台位序差异），双试皆空返回 null。
 */
import type { NativeImage } from 'electron'
import jsQR from 'jsqr'

/** 单像素上限保护：超大图按最长边等比缩小到 MAX_DIM 再解（jsQR O(w·h)） */
const MAX_DIM = 1500

/** BGRA → RGBA（不透明化：alpha 拉满，避免预乘导致暗部失真） */
export function bgraToRgba(
  bitmap: Uint8Array | Buffer,
  width: number,
  height: number
): Uint8ClampedArray {
  const out = new Uint8ClampedArray(width * height * 4)
  for (let i = 0; i < width * height; i++) {
    out[i * 4] = bitmap[i * 4 + 2]
    out[i * 4 + 1] = bitmap[i * 4 + 1]
    out[i * 4 + 2] = bitmap[i * 4]
    out[i * 4 + 3] = 255
  }
  return out
}

/** RGBA 布局下交换 R/B（BRA→RGBA 兜底试法用） */
function swapRB(data: Uint8ClampedArray): Uint8ClampedArray {
  const out = new Uint8ClampedArray(data)
  for (let i = 0; i < out.length; i += 4) {
    const r = out[i]
    out[i] = out[i + 2]
    out[i + 2] = r
  }
  return out
}

function decodeRgba(data: Uint8ClampedArray, width: number, height: number): string | null {
  const result = jsQR(data, width, height)
  return result?.data ?? null
}

/** 从 nativeImage 解码二维码文本；无二维码或图像为空返回 null */
export function decodeQrFromImage(img: NativeImage): string | null {
  const size = img.getSize()
  if (size.width === 0 || size.height === 0) return null
  const scale = Math.min(1, MAX_DIM / Math.max(size.width, size.height))
  const target = scale < 1 ? img.resize({ width: Math.round(size.width * scale) }) : img
  const { width, height } = target.getSize()
  // toBitmap（Buffer）而非 getBitmap（本版本 typings 标记为 void 且返回指针不复制）
  const bitmap = target.toBitmap()
  if (bitmap.length < width * height * 4) return null
  const rgba = bgraToRgba(bitmap, width, height)
  return decodeRgba(rgba, width, height) ?? decodeRgba(swapRB(rgba), width, height)
}
