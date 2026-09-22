import { prefRepository } from '../db/repos/PrefRepository'
import { normalizePopToRootMode, type PopToRootMode } from '../../shared/popToRoot'
import { DEFAULT_DENSITY, normalizeDensity, type Density } from '../../shared/density'
import { normalizeGlass, type CapsuleGlass } from '../../shared/capsuleGlass'

export interface EditorSettings {
  fontSize: number
  fontFamily: string
  wrap: boolean
  tabSize: number
  matchBrackets: boolean
  highlightLine: boolean
  // Prettier 格式化设置
  semi: boolean
  singleQuote: boolean
  trailingComma: 'none' | 'es5' | 'all'
}

export interface Preferences {
  editor: EditorSettings
  theme: 'light' | 'dark' | 'auto'
  /** onboarding 是否已完成（首次启动引导） */
  onboardingCompleted: boolean
  /** 用户在 onboarding 步骤 3 选的常用模块（影响 Hub 「收藏」区） */
  favoriteModules: string[]
}

const EDITOR_DEFAULTS: EditorSettings = {
  fontSize: 14,
  fontFamily: "'Monaco', 'Menlo', 'Ubuntu Mono', monospace",
  wrap: false,
  tabSize: 2,
  matchBrackets: true,
  highlightLine: true,
  semi: true,
  singleQuote: true,
  trailingComma: 'es5'
}

const THEME_VALUES = ['light', 'dark', 'auto'] as const
const PREF_KEYS = {
  theme: 'theme',
  editor: 'editor',
  onboardingCompleted: 'onboarding:completed',
  favoriteModules: 'onboarding:favoriteModules',
  fallbackDisabled: 'launcher:fallbackDisabled',
  fallbackOrder: 'launcher:fallbackOrder',
  popToRoot: 'launcher:popToRoot',
  windowGap: 'launcher:windowGap',
  density: 'launcher:density',
  capsuleGlass: 'launcher:capsuleGlass',
  compactMode: 'launcher:compactMode',
  autoJoin: 'launcher:autoJoin',
  activeTheme: 'theme:activeUser'
} as const

/**
 * PreferencesDataStore — 5-7 纯转发层。
 */

export class PreferencesDataStore {
  private getEditor(): EditorSettings {
    const raw = prefRepository.get(PREF_KEYS.editor)
    if (raw) {
      try {
        return { ...EDITOR_DEFAULTS, ...JSON.parse(raw) }
      } catch {
        // fall through
      }
    }
    return EDITOR_DEFAULTS
  }

  getEditorSettings(): EditorSettings {
    return this.getEditor()
  }

  updateEditorSettings(updates: Partial<EditorSettings>): EditorSettings {
    const current = this.getEditor()
    const updated = { ...current, ...updates }
    prefRepository.set(PREF_KEYS.editor, JSON.stringify(updated))
    return updated
  }

  getTheme(): 'light' | 'dark' | 'auto' {
    const raw = prefRepository.get(PREF_KEYS.theme)
    if (raw) {
      try {
        const parsed = JSON.parse(raw)
        if (THEME_VALUES.includes(parsed)) return parsed
      } catch {
        // fall through
      }
    }
    // 默认跟随系统（v4 产品决策）：首次启动读取系统外观，设置页可手动覆盖并持久化。
    // 渲染进程 useTheme 的初值与此保持一致。
    return 'auto'
  }

  setTheme(theme: 'light' | 'dark' | 'auto'): void {
    prefRepository.set(PREF_KEYS.theme, JSON.stringify(theme))
  }

  /** 激活的用户主题 id（#12 Phase 2）；'' = 不注入，走 tokens.css 现状（默认即此） */
  getActiveThemeId(): string {
    const raw = prefRepository.get(PREF_KEYS.activeTheme)
    if (!raw) return ''
    try {
      const parsed = JSON.parse(raw) as unknown
      return typeof parsed === 'string' ? parsed : ''
    } catch {
      return ''
    }
  }

  setActiveThemeId(id: string): void {
    prefRepository.set(PREF_KEYS.activeTheme, JSON.stringify(id))
  }

  /** onboarding 是否已完成 */
  isOnboardingCompleted(): boolean {
    return prefRepository.get(PREF_KEYS.onboardingCompleted) === 'true'
  }

  /** 标记 onboarding 完成 */
  setOnboardingCompleted(): void {
    prefRepository.set(PREF_KEYS.onboardingCompleted, 'true')
  }

  /** 重置 onboarding 状态（设置页「重新开始引导」） */
  resetOnboarding(): void {
    prefRepository.delete(PREF_KEYS.onboardingCompleted)
  }

  /** 取得 onboarding 阶段收藏的模块 id 列表 */
  getFavoriteModules(): string[] {
    const raw = prefRepository.get(PREF_KEYS.favoriteModules)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      /* fall through */
    }
    return []
  }

  /** 写入 onboarding 阶段收藏的模块 id 列表 */
  setFavoriteModules(ids: string[]): void {
    prefRepository.set(PREF_KEYS.favoriteModules, JSON.stringify(ids))
  }

  /** 胶囊兜底命令（fallback:*）中被用户停用的 id 列表（V4 P0-3） */
  getFallbackDisabled(): string[] {
    const raw = prefRepository.get(PREF_KEYS.fallbackDisabled)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      /* fall through */
    }
    return []
  }

  /** 写入被停用的兜底命令 id 列表 */
  setFallbackDisabled(ids: string[]): void {
    prefRepository.set(PREF_KEYS.fallbackDisabled, JSON.stringify([...new Set(ids)]))
  }

  /** 兜底命令的用户自定义顺序（id 列表；未收录的 id 保持默认相对序随后，V4 P0-3） */
  getFallbackOrder(): string[] {
    const raw = prefRepository.get(PREF_KEYS.fallbackOrder)
    if (!raw) return []
    try {
      const parsed = JSON.parse(raw)
      if (Array.isArray(parsed)) return parsed.filter((x): x is string => typeof x === 'string')
    } catch {
      /* fall through */
    }
    return []
  }

  /** 写入兜底命令自定义顺序 */
  setFallbackOrder(ids: string[]): void {
    prefRepository.set(PREF_KEYS.fallbackOrder, JSON.stringify([...new Set(ids)]))
  }

  /** Pop to Root 三态（对标 Raycast；非法值回退 immediately，V4 P0-3） */
  getPopToRootMode(): PopToRootMode {
    return normalizePopToRootMode(prefRepository.get(PREF_KEYS.popToRoot))
  }

  setPopToRootMode(mode: PopToRootMode): void {
    prefRepository.set(PREF_KEYS.popToRoot, normalizePopToRootMode(mode))
  }

  /** 兜底命令的用户自定义顺序（id 列表；未收录的 id 保持默认相对序随后，V4 P0-3） */
  getWindowGap(): number {
    const raw = prefRepository.get(PREF_KEYS.windowGap)
    const n = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(n) && n >= 0 && n <= 200 ? Math.round(n) : 0
  }

  /** 写入窗口间隙（超出 0-200 一律拒绝） */
  setWindowGap(px: number): void {
    if (!Number.isFinite(px) || px < 0 || px > 200) return
    prefRepository.set(PREF_KEYS.windowGap, String(Math.round(px)))
  }

  /** 自动入会开关（V4 P0-1 批次4；默认关） */
  getAutoJoinEnabled(): boolean {
    return prefRepository.get(PREF_KEYS.autoJoin) === 'true'
  }

  /** 列表密度档（P-6 Compact Mode）：非法值回落 comfortable，不存原始字符串 */
  getDensity(): Density {
    return normalizeDensity(prefRepository.get(PREF_KEYS.density))
  }

  setDensity(density: Density): Density {
    const next = normalizeDensity(density)
    prefRepository.set(PREF_KEYS.density, next)
    return next
  }

  getDefaultDensity(): Density {
    return DEFAULT_DENSITY
  }

  /** 胶囊玻璃档（P-6）：默认 opaque = 观感与改动前完全一致 */
  getCapsuleGlass(): CapsuleGlass {
    return normalizeGlass(prefRepository.get(PREF_KEYS.capsuleGlass))
  }

  setCapsuleGlass(glass: CapsuleGlass): CapsuleGlass {
    const next = normalizeGlass(glass)
    prefRepository.set(PREF_KEYS.capsuleGlass, next)
    return next
  }

  setAutoJoinEnabled(enabled: boolean): void {
    prefRepository.set(PREF_KEYS.autoJoin, enabled ? 'true' : 'false')
  }

  getPreferences(): Preferences {
    return {
      editor: this.getEditorSettings(),
      theme: this.getTheme(),
      onboardingCompleted: this.isOnboardingCompleted(),
      favoriteModules: this.getFavoriteModules()
    }
  }
}
