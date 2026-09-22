/**
 * 从图片取主题色（动态主题用）。
 *
 * 2026-09-22 恢复事故里这个文件的**头与尾**都没了（盘上只剩中间那段算法）：
 * 头按 useDynamicTheme 的实际调用形态重建（`extractColorsFromImage(url) → ColorPalette`），
 * 尾四个 helper 的签名直接抄它 `DynamicThemeSource` 接口里写死的那三行，不猜。
 * 中间那段算法逐字保留。
 */

export interface RGB {
  r: number
  g: number
  b: number
}

export interface ColorPalette {
  dominant: RGB
  vibrant: RGB
  muted: RGB
  darkVibrant: RGB
  lightVibrant: RGB
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = 'anonymous'
    image.onload = (): void => resolve(image)
    image.onerror = (): void => reject(new Error(`图片加载失败: ${src}`))
    image.src = src
  })
}

/**
 * 取一张图的调色板。缩到 64px 内再隔点采样——整幅读像素会让切图时明显掉帧，
 * 而主题色要的是「大概什么颜色」，不是逐像素准确。
 */
export async function extractColorsFromImage(imageUrl: string): Promise<ColorPalette> {
  const image = await loadImage(imageUrl)
  const scale = Math.min(1, 64 / Math.max(image.width || 64, image.height || 64))
  const canvas = document.createElement('canvas')
  canvas.width = Math.max(1, Math.round((image.width || 64) * scale))
  canvas.height = Math.max(1, Math.round((image.height || 64) * scale))
  const ctx = canvas.getContext('2d')
  if (!ctx) return createDefaultPalette()
  ctx.drawImage(image, 0, 0, canvas.width, canvas.height)

  const { data } = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const colors: RGB[] = []
  for (let i = 0; i < data.length; i += 16) {
    const a = data[i + 3]
    if (a < 125) continue // 透明与半透明像素不参与
    colors.push({ r: data[i], g: data[i + 1], b: data[i + 2] })
  }

  // 主色：按 Rec. 601 亮度加权取最突出的那个采样点
  let dominantColor: RGB = colors[0] ?? { r: 0, g: 0, b: 0 }
  let bestScore = -1
  colors.forEach((color) => {
    const { r, g, b } = color
    const score = (r * 299 + g * 587 + b * 114) / 1000
    if (score > bestScore) {
      bestScore = score
      dominantColor = { r, g, b }
    }
  })

  // 计算平均颜色
  if (colors.length === 0) {
    return createDefaultPalette()
  }

  // 计算亮度
  const brightness = (r: number, g: number, b: number): number =>
    (r * 299 + g * 587 + b * 114) / 1000

  // 计算饱和度
  const saturation = (r: number, g: number, b: number): number => {
    const max = Math.max(r, g, b)
    const min = Math.min(r, g, b)
    if (max === 0) return 0
    return (max - min) / max
  }

  // 找到鲜艳的颜色（高饱和度）
  let vibrantColor: RGB = dominantColor
  let maxSaturation = 0
  colors.forEach((color) => {
    const sat = saturation(color.r, color.g, color.b)
    if (sat > maxSaturation && sat > 0.3) {
      maxSaturation = sat
      vibrantColor = color
    }
  })

  // 找到柔和的颜色（低饱和度）
  let mutedColor: RGB = dominantColor
  let minSaturation = 1
  colors.forEach((color) => {
    const sat = saturation(color.r, color.g, color.b)
    const bright = brightness(color.r, color.g, color.b)
    if (sat < minSaturation && sat < 0.5 && bright > 50 && bright < 200) {
      minSaturation = sat
      mutedColor = color
    }
  })

  // 找到深色鲜艳的颜色
  let darkVibrantColor: RGB = dominantColor
  let maxDarkVibrant = 0
  colors.forEach((color) => {
    const sat = saturation(color.r, color.g, color.b)
    const bright = brightness(color.r, color.g, color.b)
    if (sat > 0.3 && bright < 150 && sat * (200 - bright) > maxDarkVibrant) {
      maxDarkVibrant = sat * (200 - bright)
      darkVibrantColor = color
    }
  })

  // 找到浅色鲜艳的颜色
  let lightVibrantColor: RGB = dominantColor
  let maxLightVibrant = 0
  colors.forEach((color) => {
    const sat = saturation(color.r, color.g, color.b)
    const bright = brightness(color.r, color.g, color.b)
    if (sat > 0.3 && bright > 150 && sat * bright > maxLightVibrant) {
      maxLightVibrant = sat * bright
      lightVibrantColor = color
    }
  })

  return {
    dominant: dominantColor,
    vibrant: vibrantColor,
    muted: mutedColor,
    darkVibrant: darkVibrantColor,
    lightVibrant: lightVibrantColor
  }
}

/**
 * 创建默认颜色调色板
 */
function createDefaultPalette(): ColorPalette {
  const defaultColor: RGB = { r: 59, g: 130, b: 246 } // blue-500
  return {
    dominant: defaultColor,
    vibrant: defaultColor,
    muted: defaultColor,
    darkVibrant: defaultColor,
    lightVibrant: defaultColor
  }
}

/**
 * RGB 转十六进制
 */
export function rgbToHex(rgb: RGB): string {
  const toHex = (n: number): string => {
    const hex = Math.round(n).toString(16)
    return hex.length === 1 ? '0' + hex : hex
  }
  return `#${toHex(rgb.r)}${toHex(rgb.g)}${toHex(rgb.b)}`
}

/**
 * RGB 转 CSS rgba 字符串
 */
export function rgbToRgba(rgb: RGB, alpha: number = 1): string {
  return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`
}

/**
 * 计算颜色的亮度
 */

/**
 * 计算颜色的亮度（0-255，Rec. 601 加权）
 */
export function getBrightness(rgb: RGB): number {
  return (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000
}

/** 亮度低于 128 即算深色色 */
export function isDark(rgb: RGB): boolean {
  return getBrightness(rgb) < 128
}

/** factor > 1 提亮、< 1 压暗，结果夹在 0-255 */
export function adjustBrightness(rgb: RGB, factor: number): RGB {
  const clamp = (n: number): number => Math.max(0, Math.min(255, Math.round(n)))
  return { r: clamp(rgb.r * factor), g: clamp(rgb.g * factor), b: clamp(rgb.b * factor) }
}

/** ratio = 0 全取 color1、1 全取 color2 */
export function blendColors(color1: RGB, color2: RGB, ratio = 0.5): RGB {
  const mix = (a: number, b: number): number => Math.round(a + (b - a) * ratio)
  return { r: mix(color1.r, color2.r), g: mix(color1.g, color2.g), b: mix(color1.b, color2.b) }
}
