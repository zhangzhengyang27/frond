import { ref, computed, type Ref, type ComputedRef } from 'vue'
import type { RGB } from '../utils/color-extractor'
import {
  extractColorsFromImage,
  rgbToHex,
  rgbToRgba,
  getBrightness,
  isDark,
  adjustBrightness,
  blendColors
} from '../utils/color-extractor'

export interface ThemeColors {
  primary: RGB
  secondary: RGB
  background: RGB
  text: RGB
  accent: RGB
}

/** useDynamicTheme 返回结构 */
export interface DynamicTheme {
  currentPalette: Ref<{
    dominant: RGB
    vibrant: RGB
    muted: RGB
    darkVibrant: RGB
    lightVibrant: RGB
  } | null>
  themeColors: ComputedRef<ThemeColors>
  cssVariables: ComputedRef<Record<string, string>>
  gradientBackground: ComputedRef<{ background: string }>
  gradientToBackground: ComputedRef<{ background: string }>
  extractThemeFromImage: (imageUrl: string | null | undefined) => Promise<void>
  resetTheme: () => void
  // 工具函数
  rgbToHex: (rgb: RGB) => string
  rgbToRgba: (rgb: RGB, alpha?: number) => string
  getBrightness: (rgb: RGB) => number
  isDark: (rgb: RGB) => boolean
  adjustBrightness: (rgb: RGB, factor: number) => RGB
  blendColors: (color1: RGB, color2: RGB, ratio?: number) => RGB
}

/**
 * 动态主题色管理 Composable
 */
export function useDynamicTheme(): DynamicTheme {
  const currentPalette = ref<{
    dominant: RGB
    vibrant: RGB
    muted: RGB
    darkVibrant: RGB
    lightVibrant: RGB
  } | null>(null)

  const themeColors = computed<ThemeColors>(() => {
    if (!currentPalette.value) {
      // 默认主题色
      const defaultColor: RGB = { r: 59, g: 130, b: 246 } // blue-500
      return {
        primary: defaultColor,
        secondary: adjustBrightness(defaultColor, 0.8),
        background: { r: 17, g: 24, b: 39 }, // gray-900
        text: { r: 255, g: 255, b: 255 },
        accent: defaultColor
      }
    }

    const palette = currentPalette.value
    const isDarkTheme = isDark(palette.dominant)

    // 根据主要颜色生成主题色
    const primary = palette.vibrant || palette.dominant
    const secondary = palette.muted || adjustBrightness(primary, 0.7)

    // 背景色：如果是深色主题，使用深色鲜艳色；否则使用浅色
    const background = isDarkTheme
      ? palette.darkVibrant || adjustBrightness(palette.dominant, 0.3)
      : adjustBrightness(palette.lightVibrant || palette.dominant, 1.2)

    // 文本色：根据背景亮度决定
    const text = isDark(background) ? { r: 255, g: 255, b: 255 } : { r: 17, g: 24, b: 39 }

    // 强调色：使用鲜艳色
    const accent = palette.vibrant || primary

    return {
      primary,
      secondary,
      background,
      text,
      accent
    }
  })

  /**
   * 从图片 URL 提取颜色并更新主题
   */
  const extractThemeFromImage = async (imageUrl: string | null | undefined): Promise<void> => {
    if (!imageUrl) {
      currentPalette.value = null
      return
    }

    try {
      const palette = await extractColorsFromImage(imageUrl)
      if (palette) {
        currentPalette.value = palette
        console.log('提取的主题色:', palette)
      }
    } catch (error) {
      console.error('提取主题色失败:', error)
      currentPalette.value = null
    }
  }

  /**
   * 获取 CSS 变量对象
   */
  const cssVariables = computed(() => {
    const colors = themeColors.value
    return {
      '--theme-primary': rgbToHex(colors.primary),
      '--theme-primary-rgb': `${colors.primary.r}, ${colors.primary.g}, ${colors.primary.b}`,
      '--theme-secondary': rgbToHex(colors.secondary),
      '--theme-background': rgbToHex(colors.background),
      '--theme-background-rgb': `${colors.background.r}, ${colors.background.g}, ${colors.background.b}`,
      '--theme-text': rgbToHex(colors.text),
      '--theme-accent': rgbToHex(colors.accent),
      '--theme-primary-10': rgbToRgba(colors.primary, 0.1),
      '--theme-primary-20': rgbToRgba(colors.primary, 0.2),
      '--theme-primary-30': rgbToRgba(colors.primary, 0.3),
      '--theme-primary-50': rgbToRgba(colors.primary, 0.5),
      '--theme-primary-80': rgbToRgba(colors.primary, 0.8),
      '--theme-background-50': rgbToRgba(colors.background, 0.5),
      '--theme-background-80': rgbToRgba(colors.background, 0.8),
      '--theme-background-95': rgbToRgba(colors.background, 0.95)
    }
  })

  /**
   * 获取渐变背景样式
   */
  const gradientBackground = computed(() => {
    const colors = themeColors.value
    const primary = rgbToHex(colors.primary)
    const secondary = rgbToHex(colors.secondary)
    const background = rgbToHex(colors.background)

    return {
      background: `linear-gradient(135deg, ${primary} 0%, ${secondary} 50%, ${background} 100%)`
    }
  })

  /**
   * 获取渐变背景样式（从主题色到背景色）
   */
  const gradientToBackground = computed(() => {
    const colors = themeColors.value
    const primary = rgbToHex(colors.primary)
    const background = rgbToHex(colors.background)

    return {
      background: `linear-gradient(to bottom, ${primary} 0%, ${background} 100%)`
    }
  })

  /**
   * 重置为主题色
   */
  const resetTheme = (): void => {
    currentPalette.value = null
  }

  return {
    currentPalette,
    themeColors,
    cssVariables,
    gradientBackground,
    gradientToBackground,
    extractThemeFromImage,
    resetTheme,
    // 工具函数
    rgbToHex,
    rgbToRgba,
    getBrightness,
    isDark,
    adjustBrightness,
    blendColors
  }
}
