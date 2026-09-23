import { BrowserWindow } from 'electron'
import type { PreferencesDataStore } from '../stores/PreferencesDataStore'
import {
  ensureThemesDir,
  getUserTheme,
  installThemeFile,
  listUserThemes,
  themesDir
} from '../modules/userThemes'
import { typedHandle } from './typedIpc'
import { normalizeDensity } from '../../shared/density'
import { normalizeGlass } from '../../shared/capsuleGlass'

export function registerPreferencesIpcHandlers(preferencesStore: PreferencesDataStore): void {
  // 编辑器设置（updateEditorSettings 的 req 本身就是补丁对象，符合约定）
  typedHandle('preferences:getEditorSettings', () => preferencesStore.getEditorSettings())
  typedHandle('preferences:updateEditorSettings', (_event, updates) =>
    preferencesStore.updateEditorSettings(updates)
  )

  // 明暗主题
  typedHandle('preferences:getTheme', () => preferencesStore.getTheme())
  typedHandle('preferences:setTheme', (_event, { theme }) => {
    preferencesStore.setTheme(theme)
    // 通道名留字面量：ipcContract 测试靠它静态看到推送通道（收成变量就查不到了）
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('theme:changed', theme)
    }
  })

  typedHandle('preferences:getPreferences', () => preferencesStore.getPreferences())

  // ─────────── 用户主题文件（#12 Phase 2：userData/themes/*.json）───────────
  typedHandle('userTheme:list', () => {
    const { themes, rejected } = listUserThemes()
    return {
      active: preferencesStore.getActiveThemeId(),
      themes: themes.map((t) => t.theme),
      rejected,
      dir: themesDir()
    }
  })

  typedHandle('userTheme:setActive', (_event, { id }) => {
    // '' = 关闭注入回到 tokens.css 现状；其余 id 必须真实存在，否则刷新后会出现
    // 「激活了一个不存在主题」的空档
    const clean = typeof id === 'string' ? id.trim().slice(0, 64) : ''
    if (clean && !getUserTheme(clean)) return { ok: false, error: `主题不存在：${clean}` }
    preferencesStore.setActiveThemeId(clean)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('userTheme:changed', clean)
    }
    return { ok: true, active: clean }
  })

  typedHandle('userTheme:install', async (event) => {
    const { dialog } = await import('electron')
    const win = BrowserWindow.fromWebContents(event.sender)
    const picked = await dialog.showOpenDialog(win ?? undefined!, {
      title: '选择主题文件',
      buttonLabel: '导入',
      properties: ['openFile'],
      filters: [{ name: 'Frond 主题 (JSON)', extensions: ['json'] }]
    })
    const source = picked.filePaths[0]
    if (picked.canceled || !source) return { ok: false, canceled: true }
    const installed = installThemeFile(source)
    return installed.ok ? { ok: true, theme: installed.theme } : installed
  })

  typedHandle('userTheme:openDir', async () => {
    const { shell } = await import('electron')
    ensureThemesDir()
    void shell.openPath(themesDir())
    return { ok: true }
  })

  // 兜底命令启停与自定义顺序（V4 P0-3：Fallback Commands 可配置）
  typedHandle('preferences:getFallbackDisabled', () => preferencesStore.getFallbackDisabled())
  typedHandle('preferences:setFallbackDisabled', (_event, { ids }) => {
    preferencesStore.setFallbackDisabled(ids.filter((v) => typeof v === 'string'))
  })
  typedHandle('preferences:getFallbackOrder', () => preferencesStore.getFallbackOrder())
  typedHandle('preferences:setFallbackOrder', (_event, { ids }) => {
    preferencesStore.setFallbackOrder(ids.filter((v) => typeof v === 'string'))
  })

  // Pop to Root 三态（V4 P0-3：唤起是否回到根搜索）
  typedHandle('preferences:getPopToRootMode', () => preferencesStore.getPopToRootMode())
  typedHandle('preferences:setPopToRootMode', (_event, { mode }) => {
    preferencesStore.setPopToRootMode(mode)
  })

  // 窗口间隙（V4 P1-7 批次3：gaps）
  typedHandle('preferences:getWindowGap', () => preferencesStore.getWindowGap())
  typedHandle('preferences:setWindowGap', (_event, { px }) => {
    preferencesStore.setWindowGap(px)
  })

  // 自动入会开关（V4 P0-1 批次4 第三档）
  typedHandle('preferences:getAutoJoinEnabled', () => preferencesStore.getAutoJoinEnabled())
  typedHandle('preferences:setAutoJoinEnabled', (_event, { enabled }) => {
    preferencesStore.setAutoJoinEnabled(enabled === true)
  })

  // 密度档 / 胶囊玻璃档 / 紧凑模式（P-6）。三档都要**改完广播**：胶囊窗与主窗同时挂着，
  // 只回给发起方会让另一侧继续按旧值渲染（设置页改了、胶囊没变）。
  typedHandle('preferences:getDensity', () => preferencesStore.getDensity())
  typedHandle('preferences:setDensity', (_event, { density }) => {
    // 契约收 string（渲染端/外部能给任何值），先归一化再落库：
    // 回的是生效值，传非法档时界面显示的也是真正生效的那一档
    const next = preferencesStore.setDensity(normalizeDensity(density))
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('density:changed', next)
    }
    return next
  })

  typedHandle('preferences:getCapsuleGlass', () => preferencesStore.getCapsuleGlass())
  typedHandle('preferences:setCapsuleGlass', (_event, { glass }) => {
    const next = preferencesStore.setCapsuleGlass(normalizeGlass(glass))
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('capsule-glass:changed', next)
    }
    return next
  })

  typedHandle('preferences:getCompactMode', () => preferencesStore.getCompactMode())
  typedHandle('preferences:setCompactMode', (_event, { enabled }) => {
    const next = preferencesStore.setCompactMode(enabled)
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) win.webContents.send('compact-mode:changed', next)
    }
    return next
  })

  // onboarding 状态与常用模块
  typedHandle('preferences:isOnboardingCompleted', () => preferencesStore.isOnboardingCompleted())
  typedHandle('preferences:setOnboardingCompleted', () => {
    preferencesStore.setOnboardingCompleted()
  })
  typedHandle('preferences:resetOnboarding', () => {
    preferencesStore.resetOnboarding()
  })
  typedHandle('preferences:getFavoriteModules', () => preferencesStore.getFavoriteModules())
  typedHandle('preferences:setFavoriteModules', (_event, { ids }) => {
    preferencesStore.setFavoriteModules(ids)
  })
}

export function registerPrettierIpcHandlers(preferencesStore: PreferencesDataStore): void {
  typedHandle('prettier:format', async (_event, { text, parser }) => {
    try {
      const prettier = await import('prettier')
      const editorSettings = preferencesStore.getEditorSettings()
      return await prettier.default.format(text, {
        parser,
        tabWidth: editorSettings.tabSize,
        semi: editorSettings.semi,
        singleQuote: editorSettings.singleQuote,
        trailingComma: editorSettings.trailingComma
      })
    } catch (error) {
      console.error('Prettier 格式化失败:', error)
      throw error
    }
  })
}
