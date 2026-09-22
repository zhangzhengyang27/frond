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
