import { BrowserWindow, nativeTheme, shell } from 'electron'
import { join } from 'path'
import icon from '../../../resources/icon.png?asset'
import { is } from '@electron-toolkit/utils'
import { preferencesStore } from '../stores'
import { log } from '../services/LogService'

/**
 * 窗口启动底色：跟随**应用主题偏好**而非系统外观。
 * 旧版直接读 nativeTheme，导致「应用设为浅色 + 系统为深色」时新窗口闪一下黑，
 * 反之亦然。改为解析 theme 三态（light / dark / auto）。
 */
function resolveWindowBackground(): string {
  let theme: 'light' | 'dark' | 'auto' = 'auto'
  try {
    theme = preferencesStore.getTheme()
  } catch (e) {
    // 批 7b 空 catch 清账（原注释：偏好未就绪时跟随系统）
    log.debug('windows', '偏好未就绪时跟随系统', e)
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

/**
 * B59b：重型工作模块的独立窗尺寸——这些模块开独立窗（不挤主窗），
 * 此前吃 createWindow 的 1450×950 全局默认，用户反馈「窗口太大」。
 * 键与 shared/modules.ts 的 HEAVY_MODULE_IDS 一致。
 */
export const HEAVY_MODULE_WINDOW_SIZES: Record<string, { width: number; height: number }> = {
  snippets: { width: 1040, height: 660 },
  // B61v3：番茄钟改单列布局（页签+会话+环+CTA+任务卡+清单纵向堆叠），
  // 620px 是旧仪表盘布局的调值——单列需要更高的纵向空间
  pomodoro: { width: 900, height: 820 },
  // 插件中心（2026-10-06 用户反馈「太宽、左右浪费」）：紧凑弹窗尺寸，
  // 头部/搜索框固定，仅列表区内部滚动
  'plugins-center': { width: 640, height: 640 }
}

/**
 * B59b：按路由前缀取独立窗尺寸（create-new-window 通道用——胶囊/⌘K 的
 * 沉浸窗此前全吃 1450×950 默认）。query 参数（?immersive=1）不参与匹配。
 */
export function windowSizeForRoute(
  route: string,
  fallback: { width: number; height: number }
): { width: number; height: number } {
  for (const [id, size] of Object.entries(HEAVY_MODULE_WINDOW_SIZES)) {
    const prefix = `/${id}`
    if (route === prefix || route.startsWith(`${prefix}/`) || route.startsWith(`${prefix}?`)) {
      return size
    }
  }
  return fallback
}

/**
 * B59b：重型模块 → 独立小窗（复用优先）。路由键统一带 ?immersive=1——
 * 与胶囊 commandRunner 的 createNewWindow(`${path}?immersive=1`) 同键，
 * 三个入口（launcher:openModule / 菜单 / ⌘K）自然收敛到同一个窗口。
 * 主窗若停在同模块路由则让位（app:route-taken，同 create-new-window 语义）。
 */
export function openHeavyModuleWindow(
  moduleId: string,
  path: string,
  getMainWindow: () => BrowserWindow | null
): BrowserWindow {
  const size = HEAVY_MODULE_WINDOW_SIZES[moduleId] ?? { width: 1000, height: 660 }
  const win = createWindow(`${path}?immersive=1`, true, size.width, size.height)
  // usage 记账跟随新窗渲染端（useAppMenu 在每个 index.html 窗口安装，
  // 收到 app:openModule 会 recordUse + router.push；时序错过只丢一次计数）
  win.webContents.once('did-finish-load', () => {
    setTimeout(() => {
      if (!win.isDestroyed()) win.webContents.send('app:openModule', { moduleId, path })
    }, 250)
  })
  const main = getMainWindow()
  if (main && !main.isDestroyed()) main.webContents.send('app:route-taken', { path })
  return win
}

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
      /**
       * 2026-09-24 已翻转：本仓全部 webPreferences（含此窗）均为 `sandbox: true`。
       * 验收记录见 HANDOFF §10.12 —— preload（src/preload/index.ts）运行时只用
       * `ipcRenderer` / `contextBridge`（其余 import 全是 type-only，编译期擦除），
       * electron-vite 打成单文件后与沙箱化 preload 兼容；翻转属「安全模型变更」，
       * 按原注释的要求在真机跑了全量 e2e 才落此变更，不许靠推断。
       * 导航 / 开窗 / 权限三道守卫在全局兜底（src/main/security/navigationGuard.ts），
       * 不依赖本项。
       */
      sandbox: true,
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
    void window.loadURL(url)
  } else {
    const filePath = join(__dirname, '../renderer/index.html')
    // 带 hash 直接加载目标路由，避免沉浸窗先闪一帧 Hub（did-finish-load 的
    // navigate-to-route 仍保留，作为兜底）
    void window.loadFile(filePath, route ? { hash: route } : undefined)
  }

  return window
}
