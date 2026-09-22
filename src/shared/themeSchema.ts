/**
 * Leaf · 主题 Schema（#12，对标 Vicinae extra/themes/*.toml 的 core/accent/语义子表）
 *
 * 设计目标：把「一套主题 = 少量 core 值 + 语义子表」的结构落到类型层，
 * 让未来的用户主题文件（TOML/JSON 安装）只需提供这份数据即可派生全套令牌。
 *
 * 当前状态（Phase 1）：本文件是 tokens.css 语义层的**结构化提取**（值 1:1 对应，
 * 修改 tokens.css 时必须同步本文件——由 themeSchema.test 不变量测试守护）。
 * 运行时视觉仍由 tokens.css 承载（静态 CSS 无 FOUC），本文件不注入任何样式。
 *
 * 分层（与 Vicinae 主题文件同构）：
 * - core：bg / fg / accent 三元组——主题的「身份」，其余由此派生
 * - semantic 子表：surface（表面分层）/ border（hairline）/ text（文本层级）/
 *   glass（毛玻璃材质）
 * - 模块命名空间（pomo-* / shot-* / launcher-*）不在本 schema——它们是模块
 *   私有令牌，其中 launcher 的强调色是独立拍板（Raycast 品牌红，Decision-010），
 *   不随 core.accent 派生
 */

/** 主题身份三元组（对标 Vicinae [colors.core]） */
export interface ThemeCore {
  /** 应用画布底色 */
  bg: string
  /** 主文本色 */
  fg: string
  /** 品牌强调色（Brand Default；launcher 胶囊另有独立拍板的强调色） */
  accent: string
}

/** 语义子表：表面分层（亮度差建立层级） */
export interface ThemeSurfaceTable {
  'surface-0': string
  'surface-1': string
  'surface-2': string
  'surface-3': string
  'surface-hover': string
  'surface-active': string
  'surface-inverse': string
}

/** 语义子表：hairline 描边 */
export interface ThemeBorderTable {
  'border-subtle': string
  'border-default': string
  'border-strong': string
}

/** 语义子表：文本层级（对齐 Apple 官网灰阶） */
export interface ThemeTextTable {
  'text-primary': string
  'text-secondary': string
  'text-tertiary': string
  'text-muted': string
  'text-inverse': string
  /** AA 达标的品牌文本色（白底/深底各一档） */
  'text-brand': string
  'text-danger': string
  'text-success': string
}

/** 语义子表：毛玻璃材质（macOS vibrancy 观感） */
export interface ThemeGlassTable {
  'glass-bg': string
  'glass-bg-strong': string
  'glass-border': string
  'glass-highlight': string
}

export interface ThemeDefinition {
  id: string
  name: string
  appearance: 'light' | 'dark'
  core: ThemeCore
  surface: ThemeSurfaceTable
  border: ThemeBorderTable
  text: ThemeTextTable
  glass: ThemeGlassTable
}

/** 浅色主题（值 1:1 提取自 tokens.css :root 语义层） */
export const LEAF_LIGHT_THEME: ThemeDefinition = {
  id: 'leaf-light',
  name: 'Leaf Light（macOS 浅色）',
  appearance: 'light',
  core: { bg: '#f5f5f7', fg: '#1d1d1f', accent: '#007aff' },
  surface: {
    'surface-0': '#f5f5f7',
    'surface-1': '#ffffff',
    'surface-2': '#ffffff',
    'surface-3': '#ffffff',
    'surface-hover': 'rgba(0, 0, 0, 0.045)',
    'surface-active': 'rgba(0, 0, 0, 0.085)',
    'surface-inverse': '#1d1d1f'
  },
  border: {
    'border-subtle': 'rgba(0, 0, 0, 0.06)',
    'border-default': 'rgba(0, 0, 0, 0.1)',
    'border-strong': 'rgba(0, 0, 0, 0.16)'
  },
  text: {
    'text-primary': '#1d1d1f',
    'text-secondary': '#515154',
    'text-tertiary': '#6e6e73',
    'text-muted': '#86868b',
    'text-inverse': '#f5f5f7',
    'text-brand': '#0064d2',
    'text-danger': '#d70015',
    'text-success': '#248a3d'
  },
  glass: {
    'glass-bg': 'rgba(255, 255, 255, 0.68)',
    'glass-bg-strong': 'rgba(255, 255, 255, 0.82)',
    'glass-border': 'rgba(0, 0, 0, 0.09)',
    'glass-highlight': 'rgba(255, 255, 255, 0.6)'
  }
}

/** 深色主题（值 1:1 提取自 tokens.css html.dark 语义层） */
export const LEAF_DARK_THEME: ThemeDefinition = {
  id: 'leaf-dark',
  name: 'Leaf Dark（macOS 深色）',
  appearance: 'dark',
  core: { bg: '#191a1e', fg: '#f5f5f7', accent: '#0a84ff' },
  surface: {
    'surface-0': '#191a1e',
    'surface-1': '#222329',
    'surface-2': '#292b32',
    'surface-3': '#30333b',
    'surface-hover': 'rgba(255, 255, 255, 0.06)',
    'surface-active': 'rgba(255, 255, 255, 0.1)',
    'surface-inverse': '#f5f5f7'
  },
  border: {
    'border-subtle': 'rgba(255, 255, 255, 0.07)',
    'border-default': 'rgba(255, 255, 255, 0.11)',
    'border-strong': 'rgba(255, 255, 255, 0.18)'
  },
  text: {
    'text-primary': '#f5f5f7',
    'text-secondary': '#a6abb5',
    'text-tertiary': '#8a909c',
    'text-muted': '#666c78',
    'text-inverse': '#1d1d1f',
    'text-brand': '#6fb2ff',
    'text-danger': '#ff6961',
    'text-success': '#30d158'
  },
  glass: {
    'glass-bg': 'rgba(26, 27, 31, 0.72)',
    'glass-bg-strong': 'rgba(34, 35, 41, 0.85)',
    'glass-border': 'rgba(255, 255, 255, 0.09)',
    'glass-highlight': 'rgba(255, 255, 255, 0.08)'
  }
}

/** 内置主题（用户主题文件落地后由此扩展） */
export const BUILTIN_THEMES: readonly ThemeDefinition[] = [LEAF_LIGHT_THEME, LEAF_DARK_THEME]
