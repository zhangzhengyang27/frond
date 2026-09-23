/**
 * Frond · 用户主题注入（#12 Phase 2，渲染端）
 *
 * tokens.css 是静态基线（无 FOUC）；用户主题以「一段 :root 覆盖样式」叠加在其上，
 * 关闭即摘掉，不留残留。变量名与值虽然已在主进程侧过白名单，这里仍按 IPC 边界
 * 再校验一次——这些字符串最终进的是 DOM 里的 CSS。
 *
 * 挂点：useTheme.initTheme() 之后调用 initUserTheme()。主窗与胶囊窗各自的渲染进程
 * 都要跑一次（主进程 setActive 时另发 userTheme:changed 广播保持多窗口一致）。
 */
import { ref, computed } from 'vue'
import { themeToCssVars } from '@shared/themeFile'
import type { ThemeDefinition } from '@shared/themeSchema'

const STYLE_ID = 'frond-user-theme-vars'
const VAR_NAME_RE = /^--[a-z0-9-]+$/
const VAR_VALUE_RE = /^(#[0-9a-fA-F]{3,8}|(?:rgb|rgba|hsl|hsla)\([\d.,%\s/-]+\)|[a-zA-Z]+)$/

/** 把主题的语义变量落到 :root；传 null 摘掉覆盖 */
export function applyThemeVars(vars: Record<string, string> | null): void {
  const existing = document.getElementById(STYLE_ID)
  if (!vars) {
    existing?.remove()
    return
  }
  const decls = Object.entries(vars)
    .filter(([name, value]) => VAR_NAME_RE.test(name) && VAR_VALUE_RE.test(value))
    .map(([name, value]) => `${name}:${value};`)
  const node = existing ?? document.createElement('style')
  node.id = STYLE_ID
  // 选择器要覆盖 tokens.css 的两档定义：`:root`（浅色，0,1,0）与
  // `:root.dark, html.dark`（深色，0,2,0）。只写 `:root` 的话深色模式下压不过
  // 后者（特异性低一档），主题会在切到深色时静默失效——故并列三个选择器，
  // 且本节点始终后插入 <head>（同特异性下后来者胜）。
  node.textContent = `:root,:root.dark,html.dark{${decls.join('')}}`
  if (!existing) document.head.appendChild(node)
}

const userThemes = ref<ThemeDefinition[]>([])
const rejected = ref<Array<{ file: string; error: string }>>([])
const activeId = ref('')
let subscribed = false

function applyActive(): void {
  const theme = userThemes.value.find((t) => t.id === activeId.value) ?? null
  applyThemeVars(theme ? themeToCssVars(theme) : null)
}

export interface UserThemeOption {
  id: string
  name: string
  appearance: 'light' | 'dark' | null
}

export function useUserTheme(): {
  userThemes: typeof userThemes
  rejected: typeof rejected
  activeId: typeof activeId
  /** 选择器条目：'' = 不注入（内置 tokens.css），其余为用户主题 */
  options: typeof options
  initUserTheme: () => Promise<void>
  refresh: () => Promise<void>
  /** 激活某主题（'' 回到内置）；调用方需自行把 light/dark 切到主题 appearance */
  setActive: (id: string) => Promise<{ ok: boolean; error?: string }>
  install: () => Promise<{ ok: boolean; canceled?: boolean; error?: string }>
  openThemesDir: () => Promise<void>
} {
  const options = computed<UserThemeOption[]>(() => [
    { id: '', name: '内置（tokens.css）', appearance: null },
    ...userThemes.value.map((t) => ({ id: t.id, name: t.name, appearance: t.appearance }))
  ])

  const refresh = async (): Promise<void> => {
    const res = await window.api.userTheme.list()
    userThemes.value = res.themes
    rejected.value = res.rejected
    activeId.value = res.active
    applyActive()
  }

  const initUserTheme = async (): Promise<void> => {
    try {
      await refresh()
    } catch {
      /* 主进程未就绪时保持内置 */
    }
    if (!subscribed) {
      subscribed = true
      try {
        window.api.userTheme.onChanged((id) => {
          activeId.value = id
          applyActive()
        })
      } catch {
        /* preload 未提供订阅时忽略（与 useTheme 的广播订阅同口径） */
      }
    }
  }

  const setActive = async (id: string): Promise<{ ok: boolean; error?: string }> => {
    const res = await window.api.userTheme.setActive(id)
    if (res.ok) {
      activeId.value = res.active ?? ''
      applyActive()
    }
    return res
  }

  const install = async (): Promise<{ ok: boolean; canceled?: boolean; error?: string }> => {
    const res = await window.api.userTheme.install()
    if (res.ok) await refresh()
    return res
  }

  return {
    userThemes,
    rejected,
    activeId,
    options,
    initUserTheme,
    refresh,
    setActive,
    install,
    openThemesDir: async (): Promise<void> => {
      await window.api.userTheme.openDir()
    }
  }
}
