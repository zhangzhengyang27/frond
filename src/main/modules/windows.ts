import { BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'path'
import icon from '../../../resources/icon.png?asset'
import { is } from '@electron-toolkit/utils'
import { preferencesStore } from '../stores'

/**
 * 窗口启动底色：跟随**应用主题偏好**而非系统外观。
 * 旧版直接读 nativeTheme，导致「应用设为浅色 + 系统为深色」时新窗口闪一下黑，
 * 反之亦然。改为解析 theme 三态（light / dark / auto）。
 */
function resolveWindowBackground(): string {
  let theme: 'light' | 'dark' | 'auto' = 'auto'
  try {
    theme = preferencesStore.getTheme()
  } catch {
    // 偏好未就绪时跟随系统
  }
  const dark = theme === 'dark' || (theme === 'auto' && nativeTheme.shouldUseDarkColors)
  // 与 tokens.css v4 的 --surface-0（亮/暗画布）保持一致，避免首帧跳色
  return dark ? '#191a1e' : '#f5f5f7'
}

/**
 * 窗口登记表：route → BrowserWindow
 * BUGS.md B2：同 route 的窗口已存在时复用（focus + 进程内路由跳转），
 * 避免每次点击模块卡 / ⌘1-9 都 new 一个完整渲染进程导致窗口无限堆积。
 */
const routeWindows = new Map<string, BrowserWindow>()

export function createWindow(
  route?: string,
  autoShow = true,
  width = 1450,
  height = 950
): BrowserWindow {
  // ── 复用分支：该 route 已有存活窗口 → 聚焦并做进程内导航 ──
  if (route) {
    const existing = routeWindows.get(route)
    if (existing && !existing.isDestroyed()) {
      if (existing.isMinimized()) existing.restore()
      existing.focus()
      existing.webContents.send('navigate-to-route', route)
      return existing
    }
  }

  const window = new BrowserWindow({
    width,
    height,
    show: false,
    autoHideMenuBar: true,
    /**
     * 启动背景色：避免 ready-to-show 之前的「白屏 / 黑闪」（BUGS.md B4）。
     * 跟随应用主题偏好（默认跟随系统），并与 tokens.css 的 --surface-* 对齐。
     */
    backgroundColor: resolveWindowBackground(),
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      spellcheck: false,
      webSecurity: true
    }
  })

  // 带 route 的窗口纳入登记表，关闭时清除
  if (route) {
    routeWindows.set(route, window)
    window.once('closed', () => {
      routeWindows.delete(route)
    })
  }

  window.webContents.setWindowOpenHandler((details) => {
    // 仅放行 http(s)：file:/自定义协议交给系统打开可能执行任意程序
    if (/^https?:\/\//i.test(details.url)) {
      void shell.openExternal(details.url)
    }
    return { action: 'deny' }
  })

  // 页面加载完成后发送路由导航消息
  if (route) {
    window.webContents.once('did-finish-load', () => {
      setTimeout(() => {
        if (!window.isDestroyed()) {
          window.webContents.send('navigate-to-route', route)
        }
      }, 200)
    })
  }

  // 页面准备就绪后显示窗口（避免白屏）
  // Raycast 化：主窗口 autoShow=false，不自动显示，只作为后台支撑
  if (autoShow) {
    window.once('ready-to-show', () => {
      window.show()
    })

    // 安全保障：如果 ready-to-show 未触发，延迟后强制显示
    setTimeout(() => {
      if (!window.isDestroyed() && !window.isVisible()) {
        window.show()
      }
    }, 1000)
  }

  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    const url = route
      ? `${process.env['ELECTRON_RENDERER_URL']}#${route}`
      : process.env['ELECTRON_RENDERER_URL']
    window.loadURL(url)
  } else {
    const filePath = join(__dirname, '../renderer/index.html')
    // 带 hash 直接加载目标路由，避免沉浸窗先闪一帧 Hub（did-finish-load 的
    // navigate-to-route 仍保留，作为兜底）
    window.loadFile(filePath, route ? { hash: route } : undefined)
  }

  return window
}
