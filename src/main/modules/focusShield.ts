/**
 * Frond · 专注护盾（对标 Raycast Focus 的应用+网站屏蔽）
 *
 * 番茄钟工作计时进行中（渲染端桥上报 focusShield:setActive），轮询前台应用：
 * - 应用屏蔽：命中应用清单 → 弹出全屏置顶遮罩
 * - 网站屏蔽：前台为浏览器时获取当前 URL，命中网站清单 → 弹出遮罩
 * 用户切到非屏蔽应用/网站即自动消失；遮罩内可「放行 60 秒」。
 *
 * 真拦截（2026-09-28 升级，决策见 BUGS/HANDOFF）：config.mode 三档——
 * - remind：旧行为，只弹遮罩（存量配置缺 mode 时归一化到此）
 * - hide：应用命中 → 遮罩 + 隐藏该应用（macOS System Events visible=false；
 *   隐藏应用不进 ⌘Tab，这正是真拦截的原语），会话结束/放行时恢复可见
 * - quit：应用命中 → 遮罩 + 优雅退出该应用（应用自身的保存提示照常触发）
 * 执行面边界：**只对应用命中生效**，网站命中恒为遮罩提醒（不替用户关网页，
 * 见 focusShieldLogic.ts）。
 *
 * 平台支持：
 * - macOS：osascript 检测前台应用 + 浏览器 URL（Chrome/Safari/Edge）+ 真拦截执行
 * - Windows：PowerShell Get-Process 检测前台应用（网站屏蔽与真拦截执行均不支持）
 */
import { BrowserWindow, app, screen } from 'electron'
import { execFile } from 'child_process'
import { join } from 'path'
import { promisify } from 'util'
import { getLauncherDocStore } from '../launcher/docStore'
import { isMac, isWin } from '../utils/platform'
import { typedHandle } from '../ipc/typedIpc'
import { normalizeShieldMode, enforcementFor, type ShieldMode } from './focusShieldLogic'
import { escapeAppleScriptString } from '../services/menuBarLogic'

const execFileAsync = promisify(execFile)

const NS = 'sys.focusshield'

export interface FocusShieldConfig {
  /** 总开关 */
  enabled: boolean
  /** 屏蔽清单：应用名片段（大小写不敏感包含匹配，如 "chrome"、"游戏"） */
  apps: string[]
  /** 网站屏蔽清单：域名片段（大小写不敏感，如 "youtube.com"、"twitter"） */
  websites: string[]
  /** 真拦截档位：remind=仅遮罩 / hide=隐藏应用 / quit=优雅退出（仅应用命中；macOS） */
  mode: ShieldMode
}

const POLL_MS = 2000
const TEMP_ALLOW_MS = 60_000
/** 支持 URL 检测的浏览器（macOS AppleScript） */
const BROWSER_APP_MAP: Record<string, string> = {
  'google chrome': 'Google Chrome',
  safari: 'Safari',
  'microsoft edge': 'Microsoft Edge',
  'brave browser': 'Brave Browser',
  arc: 'Arc',
  vivaldi: 'Vivaldi'
}

function readConfig(): FocusShieldConfig {
  try {
    const doc = getLauncherDocStore().get(NS, 'config')
    const data = (doc?.data ?? {}) as Partial<FocusShieldConfig>
    return {
      enabled: data.enabled === true,
      apps: Array.isArray(data.apps)
        ? data.apps.filter((a) => typeof a === 'string' && a.trim())
        : [],
      websites: Array.isArray(data.websites)
        ? data.websites.filter((w) => typeof w === 'string' && w.trim())
        : [],
      mode: normalizeShieldMode(data.mode)
    }
  } catch {
    return { enabled: false, apps: [], websites: [], mode: 'remind' }
  }
}

function writeConfig(patch: Partial<FocusShieldConfig>): FocusShieldConfig {
  const next = { ...readConfig(), ...patch }
  getLauncherDocStore().put(NS, 'config', next)
  return next
}

/** mac 前台应用进程名（如 "Google Chrome"）；失败返回 null */
export async function frontmostAppName(): Promise<string | null> {
  if (isMac()) return (await frontmostAppIdentity()).name
  if (isWin()) {
    try {
      // Windows：通过 PowerShell 获取前台窗口的进程名
      const { stdout } = await execFileAsync(
        'powershell.exe',
        [
          '-NoProfile',
          '-Command',
          'Add-Type @"using System;using System.Runtime.InteropServices;public class Win32{[DllImport("user32.dll")]public static extern IntPtr GetForegroundWindow();[DllImport("user32.dll")]public static extern uint GetWindowThreadProcessId(IntPtr hWnd,out uint lpdwProcessId);}"@;$h=[Win32]::GetForegroundWindow();$p=0;[Win32]::GetWindowThreadProcessId($h,[ref]$p)|Out-Null;(Get-Process -Id $p).ProcessName'
        ],
        { timeout: 3000, windowsHide: true }
      )
      const name = String(stdout).trim()
      return name || null
    } catch {
      return null
    }
  }
  return null
}

/**
 * mac 前台应用名 + unix pid（tab 分隔单次查询，名字含逗号也不裂）。
 * pid 供菜单栏搜索按 unix id 寻址（B36：胶囊聚焦时执行时刻的 frontmost
 * 只能查到 Frond 自己，必须在隐藏期间快照）。非 mac / 失败返回 {null,null}。
 */
export async function frontmostAppIdentity(): Promise<{
  name: string | null
  pid: number | null
}> {
  if (!isMac()) return { name: null, pid: null }
  try {
    const { stdout } = await execFileAsync(
      'osascript',
      [
        '-e',
        [
          'tell application "System Events"',
          '  set f to first application process whose frontmost is true',
          '  return (name of f) & tab & ((unix id of f) as text)',
          'end tell'
        ].join('\n')
      ],
      { timeout: 3000 }
    )
    const [name, pid] = String(stdout).trim().split('\t')
    const pidNum = Number(pid)
    return {
      name: name || null,
      pid: Number.isInteger(pidNum) ? pidNum : null
    }
  } catch {
    return { name: null, pid: null }
  }
}

/**
 * 获取浏览器当前标签页 URL（macOS）。
 * 支持 Chrome/Safari/Edge/Brave/Arc/Vivaldi。
 * 前台应用不是支持的浏览器时返回 null。
 */
async function getBrowserUrl(appName: string): Promise<string | null> {
  if (!isMac()) return null
  const lower = appName.toLowerCase()
  const browserName = BROWSER_APP_MAP[lower]
  if (!browserName) return null

  try {
    let script = ''
    if (lower === 'safari') {
      script = `tell application "Safari" to get URL of front document`
    } else {
      // Chromium 系浏览器（Chrome/Edge/Brave/Arc/Vivaldi）
      script = `tell application "${browserName}" to get URL of active tab of front window`
    }
    const { stdout } = await execFileAsync('osascript', ['-e', script], { timeout: 3000 })
    const url = String(stdout).trim()
    return url || null
  } catch {
    return null
  }
}

/** 从 URL 中提取域名（用于匹配网站屏蔽清单） */
function extractDomain(url: string): string {
  try {
    const u = new URL(url.startsWith('http') ? url : `https://${url}`)
    return u.hostname.toLowerCase()
  } catch {
    return url.toLowerCase()
  }
}

function matchesBlocklist(appName: string, patterns: string[]): string | null {
  const lower = appName.toLowerCase()
  for (const p of patterns) {
    if (lower.includes(p.toLowerCase())) return p
  }
  return null
}

function matchesWebsiteBlocklist(url: string, patterns: string[]): string | null {
  const domain = extractDomain(url)
  const lowerUrl = url.toLowerCase()
  for (const p of patterns) {
    const lowerP = p.toLowerCase()
    if (domain.includes(lowerP) || lowerUrl.includes(lowerP)) return p
  }
  return null
}

class FocusShieldService {
  private config: FocusShieldConfig = { enabled: false, apps: [], websites: [], mode: 'remind' }
  /** 番茄钟工作计时进行中（渲染端桥上报） */
  private focusActive = false
  private timer: ReturnType<typeof setInterval> | null = null
  private win: BrowserWindow | null = null
  private current: {
    appName: string
    pattern: string
    kind: 'app' | 'website'
    url?: string
  } | null = null
  private tempAllowUntil = 0
  /** 轮询中防重入（osascript 3s 超时 > 轮询间隔时的串行化） */
  private polling = false
  /** hide 模式下被隐藏的应用名（System Events process name），会话结束恢复可见 */
  private hiddenApps = new Set<string>()
  /** enforce 防抖：同名应用已处理就不再每 2s 重发 osascript */
  private enforcedApps = new Set<string>()

  /** 真拦截执行：hide=隐藏（记录待恢复）/ quit=优雅退出（应用自身的保存提示照常触发） */
  private async enforce(action: 'hide' | 'quit', processName: string): Promise<void> {
    if (!isMac() || this.enforcedApps.has(processName)) return
    this.enforcedApps.add(processName)
    const esc = escapeAppleScriptString(processName)
    try {
      if (action === 'hide') {
        await execFileAsync(
          'osascript',
          ['-e', `tell application "System Events" to set visible of application process "${esc}" to false`],
          { timeout: 3000 }
        )
        this.hiddenApps.add(processName)
      } else {
        await execFileAsync(
          'osascript',
          ['-e', `tell application "${esc}" to quit`],
          { timeout: 3000 }
        )
      }
    } catch {
      // 退出/隐藏失败（应用名与 bundle 名不一致等）静默：遮罩层仍在提醒
    }
  }

  /** 会话结束：把 hide 模式隐藏的应用全部恢复可见（含 Frond 自身退出路径） */
  private async restoreHidden(): Promise<void> {
    if (!isMac() || this.hiddenApps.size === 0) return
    for (const name of this.hiddenApps) {
      try {
        await execFileAsync(
          'osascript',
          ['-e', `tell application "System Events" to set visible of application process "${escapeAppleScriptString(name)}" to true`],
          { timeout: 3000 }
        )
      } catch {
        // 应用可能已被用户自己退出：忽略
      }
    }
    this.hiddenApps.clear()
  }

  start(): void {
    this.config = readConfig()
    // 检测轮询始终运行（轻量：enabled && focusActive 才真正执行 osascript）
    if (!this.timer) {
      this.timer = setInterval(() => void this.poll(), POLL_MS)
    }
    app.on('will-quit', () => this.destroy())
  }

  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer)
      this.timer = null
    }
    this.hideShield()
    // Frond 退出前必须恢复，否则被隐藏的应用永远回不来
    void this.restoreHidden()
  }

  getConfig(): FocusShieldConfig & { supported: boolean; websiteBlockSupported: boolean } {
    return {
      ...this.config,
      supported: isMac() || isWin(),
      websiteBlockSupported: isMac()
    }
  }

  setConfig(patch: Partial<FocusShieldConfig>): FocusShieldConfig & { supported: boolean } {
    this.config = writeConfig(patch)
    if (!this.config.enabled) {
      this.hideShield()
      this.resetEnforcement()
      void this.restoreHidden()
    }
    return this.getConfig()
  }

  /** 番茄钟桥上报：工作计时开始/结束 */
  setActive(active: boolean): void {
    this.focusActive = active
    if (!active) {
      this.hideShield()
      this.resetEnforcement()
      void this.restoreHidden()
    }
  }

  /** 清执行防抖名单（新一轮工作计时从零开始） */
  private resetEnforcement(): void {
    this.enforcedApps.clear()
  }

  private async poll(): Promise<void> {
    if (this.polling) return
    if (!this.config.enabled || !this.focusActive || Date.now() < this.tempAllowUntil) {
      this.hideShield()
      return
    }
    // 遮罩自身处于前台时保持现状：遮罩弹出的瞬间它就是前台应用，
    // 若照常判定会把刚弹出的遮罩当作「已切走」关掉，形成弹关闪烁循环
    if (this.win && !this.win.isDestroyed() && this.win.isFocused()) return
    this.polling = true
    try {
      const front = await frontmostAppName()
      if (!front) {
        this.hideShield()
        return
      }
      // 1. 应用屏蔽检测
      const appHit = matchesBlocklist(front, this.config.apps)
      if (appHit) {
        this.showShield(front, appHit, 'app')
        const action = enforcementFor(this.config.mode, 'app')
        if (action !== 'none') void this.enforce(action, front)
        return
      }
      // 2. 网站屏蔽检测（仅 macOS，前台为支持的浏览器时）
      if (this.config.websites.length > 0 && isMac()) {
        const url = await getBrowserUrl(front)
        if (url) {
          const siteHit = matchesWebsiteBlocklist(url, this.config.websites)
          if (siteHit) {
            this.showShield(front, siteHit, 'website', url)
            return
          }
        }
      }
      this.hideShield()
    } finally {
      this.polling = false
    }
  }

  private showShield(
    appName: string,
    pattern: string,
    kind: 'app' | 'website' = 'app',
    url?: string
  ): void {
    this.current = { appName, pattern, kind, url }
    if (this.win && !this.win.isDestroyed()) {
      this.win.webContents.send('focus-shield:info', { appName, pattern, kind, url })
      return
    }
    const display = screen.getPrimaryDisplay()
    this.win = new BrowserWindow({
      x: display.bounds.x,
      y: display.bounds.y,
      width: display.bounds.width,
      height: display.bounds.height,
      frame: false,
      resizable: false,
      movable: false,
      enableLargerThanScreen: true,
      show: false,
      fullscreenable: false,
      skipTaskbar: true,
      alwaysOnTop: true,
      hasShadow: false,
      backgroundColor: '#101418',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        contextIsolation: true
      }
    })
    this.win.setAlwaysOnTop(true, 'screen-saver')
    this.win.loadFile(join(__dirname, '../renderer/shield.html')).catch((error) => {
      // 遮罩页加载失败（产物缺失等）：关窗退化为无遮罩检测，避免白屏挡脸
      console.error('[FocusShield] shield page load failed:', error)
      this.hideShield()
    })
    this.win.once('ready-to-show', () => {
      this.win?.show()
      this.win?.focus()
      this.win?.webContents.send('focus-shield:info', { appName, pattern, kind, url })
    })
    this.win.on('closed', () => {
      this.win = null
    })
  }

  private hideShield(): void {
    this.current = null
    if (this.win && !this.win.isDestroyed()) {
      this.win.close()
      this.win = null
    }
  }

  /** 遮罩内「放行」：短暂放行 60s；hide 模式下同时恢复被隐藏的命中应用（要能用它） */
  temporaryAllow(): void {
    this.tempAllowUntil = Date.now() + TEMP_ALLOW_MS
    const current = this.current?.appName
    if (current && this.hiddenApps.has(current)) {
      this.hiddenApps.delete(current)
      this.enforcedApps.delete(current)
      if (isMac()) {
        void execFileAsync(
          'osascript',
          ['-e', `tell application "System Events" to set visible of application process "${escapeAppleScriptString(current)}" to true`],
          { timeout: 3000 }
        ).catch(() => {})
      }
    }
    this.hideShield()
  }

  /** 供遮罩 UI 兜底查询当前命中 */
  currentState(): {
    appName: string
    pattern: string
    kind: 'app' | 'website'
    url?: string
  } | null {
    return this.current
  }
}

export const focusShield = new FocusShieldService()

export function registerFocusShieldIpc(): void {
  typedHandle('focus-shield:getConfig', () => focusShield.getConfig())
  typedHandle('focus-shield:setConfig', (_e, patch: Partial<FocusShieldConfig>) => {
    // 渲染端传入白名单字段，apps/websites 逐项 trim 与上限防护
    const apps = Array.isArray(patch.apps)
      ? patch.apps
          .map((a) => String(a).trim())
          .filter(Boolean)
          .slice(0, 50)
      : undefined
    const websites = Array.isArray(patch.websites)
      ? patch.websites
          .map((w) => String(w).trim())
          .filter(Boolean)
          .slice(0, 50)
      : undefined
    return focusShield.setConfig({
      // 展开式而非 `enabled: undefined`：undefined 键会在 writeConfig 的合并中
      // 覆盖旧值，随后 JSON.stringify 丢弃该键，导致护盾开关被静默关闭
      ...(typeof patch.enabled === 'boolean' ? { enabled: patch.enabled } : {}),
      ...(apps ? { apps } : {}),
      ...(websites ? { websites } : {}),
      ...(patch.mode !== undefined ? { mode: normalizeShieldMode(patch.mode) } : {})
    })
  })
  typedHandle('focus-shield:setActive', (_e, req) => {
    focusShield.setActive(Boolean(req.active))
    return true
  })
  typedHandle('focus-shield:temporaryAllow', () => {
    focusShield.temporaryAllow()
    return true
  })
  typedHandle('focus-shield:currentState', () => focusShield.currentState())
}
