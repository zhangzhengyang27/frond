/**
 * Frond · 导航 / 开窗 / 权限的全局兜底
 *
 * 为什么要有这一层：窗口创建路径不止一条（主窗、胶囊窗、detach 承载窗、插件
 * BrowserView、录屏区域覆盖层、悬浮窗、迷你窗）。此前胶囊窗与 detach 承载窗没有
 * 守卫 —— 插件 markdown 详情里的链接经 `window.open` 会让新窗口**继承全量 preload
 * 的 window.api** 后加载远程页面。所以兜底必须挂在 `app.on('web-contents-created')`
 * 上，任何创建路径都覆盖得到。窗口自带更严格的 handler（主窗 windows.ts /
 * 插件 view runtime.ts）会在此之上再收一遍，行为不变。
 *
 * 本模块把判定写成**纯函数**（`isAllowedNavigation` / `decidePermission`），
 * 装配部分单独放 `install*`。原因：这两条判据判错的代价是「某个功能静默失效」
 * 或「攻击面敞开」，必须能被单测钉住。
 *
 * ⚠ 两条极易踩的线（改动前务必读）：
 *
 * 1. `frond-region://` 是**内部哨兵**，不是注册协议。录屏的区域覆盖层用
 *    `location.href = 'frond-region://select?...'` 触发，由该窗口自己的
 *    `will-navigate`（RegionOverlay.ts）消费并 `preventDefault()`。它不是导航，
 *    但会走同一个事件 —— 不在这里放行的话，每次框选都会打一条
 *    「blocked navigation to non-first-party url」的误导性 warn（功能不受影响，
 *    因为 preventDefault 不影响后续监听器，但日志噪音会训练人忽略真告警）。
 *
 * 2. `media` 权限**必须**对第一方渲染进程放行。录屏的麦克风与摄像头走渲染端
 *    `navigator.mediaDevices.getUserMedia`（useStreamManager / useSourceSelection /
 *    RecordingSettingsDialog）。Electron 在**没有**注册
 *    `setPermissionRequestHandler` 时默认放行权限请求 —— 也就是说加了这个 handler
 *    反而可能把录屏掐死。白名单见 PERMISSION_ALLOWLIST。
 */
import { app, shell, type Session } from 'electron'
import { fileURLToPath } from 'node:url'
import { isAbsolute, join, relative } from 'node:path'
import { log } from '../services/LogService'

/**
 * 路径是否落在 root 目录内。
 *
 * ⚠ 不要写成 `p.startsWith(root)` —— 那是**纯前缀匹配**，`/out-evil/x` 会命中
 * `/out`（本文件单测里有一条专门钉这个）。用 relative + isAbsolute 才是正确判据：
 * 跨盘符时 relative 会返回绝对路径，由 isAbsolute 兜住。
 */
function isUnderDirectory(p: string, root: string): boolean {
  if (!p || !root) return false
  if (p === root) return true
  const rel = relative(root, p)
  return rel !== '' && !rel.startsWith('..') && !isAbsolute(rel)
}

/** 第一方判定的输入（显式传入以便单测，不在模块里读 __dirname） */
export interface FirstPartyContext {
  /** 构建产物根目录（打包态 file:// 页面必须落在它下面） */
  appRoot: string
  /** dev 态本地 dev server 前缀 */
  devServerUrl?: string | undefined
}

/**
 * 内部哨兵 scheme：由各窗口自己的 will-navigate 处理器消费，**不会真的导航**。
 * 放行它们只是为了让兜底不误报。
 */
export const INTERNAL_SENTINEL_SCHEMES = ['frond-region:'] as const

/**
 * 第一方页面判定。
 * - `about:blank` / `devtools://`：Electron 内部
 * - `plugin://`：内建插件页面（内容仍是第三方，故**权限**另算，见 decidePermission）
 * - `frond://`：应用自身 scheme
 * - `file://`：仅限构建产物目录下
 * - dev 态：仅限本地 dev server
 */
export function isFirstPartyUrl(url: string, ctx: FirstPartyContext): boolean {
  if (!url) return false
  if (url === 'about:blank' || url.startsWith('devtools://')) return true
  if (url.startsWith('plugin://') || url.startsWith('frond://')) return true
  if (url.startsWith('file://')) {
    try {
      return isUnderDirectory(fileURLToPath(url), ctx.appRoot)
    } catch {
      return false
    }
  }
  return !!ctx.devServerUrl && url.startsWith(ctx.devServerUrl)
}

/** 允许页面自身发起的导航（其余一律 preventDefault + warn） */
export function isAllowedNavigation(url: string, ctx: FirstPartyContext): boolean {
  if (INTERNAL_SENTINEL_SCHEMES.some((s) => url.startsWith(s))) return true
  return isFirstPartyUrl(url, ctx)
}

/**
 * 第一方可放行的权限白名单。每一条都有明确的使用点，**不要凭感觉加**：
 * - `media`：录屏的麦克风 / 摄像头（useStreamManager.ts、useSourceSelection.ts、
 *   RecordingSettingsDialog.vue）。删了它 = 录屏全废。
 * - `clipboard-read`：AI Chat 的「从剪贴板粘贴」（AIChatPage.vue）
 * - `clipboard-sanitized-write`：全应用的复制按钮（7 处 navigator.clipboard.writeText）
 * - `fullscreen`：番茄钟页的全屏专注（views/pomodoro/index.vue）
 */
export const PERMISSION_ALLOWLIST: readonly string[] = [
  'media',
  'clipboard-read',
  'clipboard-sanitized-write',
  'fullscreen'
]

/**
 * 权限请求判定。
 *
 * 策略：**只对第一方渲染进程放行白名单内的权限**，其余（含所有 `plugin://` 插件页
 * 与任何远程页）一律拒绝并记日志。
 *
 * 为什么插件页也不给：插件是市场上可自由安装的第三方内容，给它 `media` 等于让
 * 任意插件静默开麦/开摄像头。官方插件目前没有一处用 `getUserMedia`；将来若真有需要，
 * 应当走显式授权 UI 而不是在这里放宽。
 */
export function decidePermission(
  permission: string,
  requestingUrl: string,
  ctx: FirstPartyContext
): { grant: boolean; reason: string } {
  // 只有 app 自己的渲染进程（file:// 产物 / dev server）算第一方
  const ownRenderer = isOwnRendererUrl(requestingUrl, ctx)
  if (!ownRenderer) {
    return { grant: false, reason: `非第一方渲染进程（${requestingUrl.slice(0, 80)}）` }
  }
  if (!PERMISSION_ALLOWLIST.includes(permission)) {
    return { grant: false, reason: `权限「${permission}」不在白名单内` }
  }
  return { grant: true, reason: '第一方渲染进程 + 白名单内' }
}

/**
 * 「本应用自己的渲染进程」判定 —— 比 isFirstPartyUrl 更窄：**不含 plugin://**。
 * 权限判定必须用这个，不能用 isFirstPartyUrl。
 */
export function isOwnRendererUrl(url: string, ctx: FirstPartyContext): boolean {
  if (!url) return false
  if (url.startsWith('file://')) {
    try {
      return isUnderDirectory(fileURLToPath(url), ctx.appRoot)
    } catch {
      return false
    }
  }
  return !!ctx.devServerUrl && url.startsWith(ctx.devServerUrl)
}

/**
 * 挂全局导航 / 开窗守卫（`web-contents-created` 早于任何窗口创建，故可在 app ready 前调用）。
 * 返回解绑函数（测试用）。
 */
export function installNavigationGuards(ctx: FirstPartyContext): () => void {
  const onCreated = (_event: unknown, contents: Electron.WebContents): void => {
    contents.setWindowOpenHandler((details) => {
      // 仅放行 http(s) 转系统浏览器：file:/自定义协议交给系统打开可能执行任意程序
      if (/^https?:\/\//i.test(details.url)) {
        void shell.openExternal(details.url)
      }
      return { action: 'deny' }
    })

    const block = (kind: string, url: string): void => {
      log.warn('webContents', `blocked ${kind} to non-first-party url: ${url.slice(0, 200)}`)
    }

    contents.on('will-navigate', (e, url) => {
      if (isAllowedNavigation(url, ctx)) return
      e.preventDefault()
      block('navigation', url)
    })

    // 服务端 30x 重定向走的是另一个事件；插件 devServer 被投毒时这是唯一出口
    contents.on('will-redirect', (e, url) => {
      if (isAllowedNavigation(url, ctx)) return
      e.preventDefault()
      block('redirect', url)
    })

    // 本应用不用 <webview>（webPreferences 也没开 webviewTag），显式拒掉做纵深防御
    contents.on('will-attach-webview', (e, _prefs, params) => {
      e.preventDefault()
      log.warn('webContents', `blocked <webview> attach: ${String(params.src).slice(0, 200)}`)
    })
  }

  app.on('web-contents-created', onCreated)
  return () => app.removeListener('web-contents-created', onCreated)
}

/**
 * 注册权限请求 / 权限查询处理器。必须在 app ready 之后、用真实 session 调用。
 *
 * 两个 handler 都要注册：`setPermissionRequestHandler` 管主动请求（getUserMedia），
 * `setPermissionCheckHandler` 管同步查询（`navigator.permissions.query`）。只注册
 * 前者的话，后者仍走 Electron 默认（放行），形成一条绕过路径。
 */
export function installPermissionGuards(targetSession: Session, ctx: FirstPartyContext): void {
  targetSession.setPermissionRequestHandler((_wc, permission, callback, details) => {
    const requestingUrl = details?.requestingUrl ?? ''
    const { grant, reason } = decidePermission(permission, requestingUrl, ctx)
    if (!grant) {
      log.warn('permission', `denied 「${permission}」：${reason}`)
    }
    callback(grant)
  })

  targetSession.setPermissionCheckHandler((_wc, permission, requestingOrigin) => {
    return decidePermission(permission, requestingOrigin ?? '', ctx).grant
  })
}

/** 从 index.ts 调用时的便捷装配（显式传入根目录，便于单测） */
export function defaultFirstPartyContext(appRoot: string): FirstPartyContext {
  return { appRoot, devServerUrl: process.env.ELECTRON_RENDERER_URL }
}

/** 主进程 bundle 的产物根（out/main/… → out/） */
export function resolveAppRoot(): string {
  return join(__dirname, '..')
}
