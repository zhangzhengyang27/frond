import {
  BrowserView,
  BrowserWindow,
  clipboard,
  desktopCapturer,
  dialog,
  ipcMain,
  nativeImage,
  Notification,
  screen
} from 'electron'
import Events from 'events'
import { join } from 'path'
import { writeFileSync } from 'fs'

export interface WindowInfo {
  id: string
  name: string
  thumbnail: string
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
}

export interface Display {
  id: number
  x: number
  y: number
  width: number
  height: number
  scaleFactor: number
}

export interface ScreenshotsData {
  bounds: {
    x: number
    y: number
    width: number
    height: number
  }
  display: Display
  // 窗口截图模式
  sourceType?: 'screen' | 'window'
  sourceId?: string
  sourceName?: string
}

export interface ScreenshotOptions {
  singleWindow?: boolean
}

/**
 * 截图服务 —— 完全对齐 nashaofu/screenshots 架构：
 *
 * 核心设计（与参考项目一一对应）：
 * 1. $view (BrowserView) 在构造时创建，加载独立截图页面（screenshot.html），永不销毁
 * 2. isReady 为一次性 Promise，渲染进程 onMounted 后发 SCREENSHOT:ready 即 resolve
 * 3. 构造函数中只 listenIpc + loadURL，不创建窗口
 * 4. startCapture: Promise.all([capture, isReady]) → createWindow → send capture
 * 5. endCapture: reset → removeBrowserView → hide/destroy window
 * 6. 截图页面是独立 HTML 入口（无路由/无守卫/无全局状态），确保能立即加载
 */

/**
 * 窗口列表（纯 desktopCapturer 工具，模块级导出供 IPC handler 直接使用，
 * 无需实例化本类——构造函数会创建整套旧截图 UI 流程）
 */
export async function listWindowSources(): Promise<WindowInfo[]> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 300, height: 200 },
      fetchWindowIcons: true
    })

    return sources
      .filter(
        (source) =>
          source.thumbnail.getSize().width > 0 &&
          source.thumbnail.getSize().height > 0 &&
          !source.name.toLowerCase().includes('electron') &&
          !source.name.toLowerCase().includes('screenshot')
      )
      .map((source) => {
        const thumbSize = source.thumbnail.getSize()
        return {
          id: source.id,
          name: source.name || 'Unknown Window',
          thumbnail: source.thumbnail.toDataURL(),
          bounds: { x: 0, y: 0, width: thumbSize.width, height: thumbSize.height }
        }
      })
  } catch (error) {
    console.error('[ScreenshotService] getWindowList error:', error)
    return []
  }
}

export type WindowCaptureResult = {
  imageUrl: string
  /** 逻辑像素 bounds（物理尺寸 ÷ scaleFactor），供编辑器按 CSS 像素铺满 */
  bounds: { x: number; y: number; width: number; height: number }
  /** 窗口图像的实际缩放系数（由调用方传入截图 overlay 所在显示器的 scaleFactor） */
  scaleFactor: number
} | null

/**
 * 按窗口 ID 捕获窗口内容（纯 desktopCapturer 工具，同上）。
 *
 * scaleFactor：调用方（截图 overlay 所在显示器）的缩放系数。
 * desktopCapturer 返回的 thumbnail 是物理像素，编辑器按逻辑像素 + scaleFactor
 * 换算鼠标坐标，因此这里必须换算回逻辑尺寸，否则 Retina 下选区与图像错位 2 倍。
 */
export async function captureWindowSource(
  windowId: string,
  scaleFactor = 1
): Promise<WindowCaptureResult> {
  try {
    const sources = await desktopCapturer.getSources({
      types: ['window'],
      thumbnailSize: { width: 3840, height: 2160 }
    })

    const source = sources.find((s) => s.id === windowId || s.id.startsWith(`window:${windowId}`))
    if (!source) return null

    const imageSize = source.thumbnail.getSize()
    return {
      imageUrl: source.thumbnail.toDataURL(),
      bounds: {
        x: 0,
        y: 0,
        width: Math.max(1, Math.round(imageSize.width / scaleFactor)),
        height: Math.max(1, Math.round(imageSize.height / scaleFactor))
      },
      scaleFactor
    }
  } catch (error) {
    console.error('[ScreenshotService] captureWindow error:', error)
    return null
  }
}

export default class ScreenshotService extends Events {
  public $win: BrowserWindow | null = null
  public $view: BrowserView
  private singleWindow: boolean
  private isReady: Promise<void>
  private isCapturing = false

  constructor(opts?: ScreenshotOptions) {
    super()
    this.singleWindow = opts?.singleWindow || false

    // 1. 创建 BrowserView（只创建一次，永不销毁）
    this.$view = new BrowserView({
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        sandbox: false,
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // 2. 一次性 ready Promise（带 30s 超时保护）
    this.isReady = new Promise<void>((resolve) => {
      const timer = setTimeout(() => {
        console.warn('[ScreenshotService] 渲染进程 30s 内未发送 ready，强制继续')
        resolve()
      }, 30000)
      ipcMain.once('SCREENSHOT:ready', () => {
        clearTimeout(timer)
        console.log('[ScreenshotService] 收到 SCREENSHOT:ready，渲染进程已就绪')
        resolve()
      })
    })

    // 3. 注册 IPC 事件处理
    this.listenIpc()

    // 4. 创建初始窗口并附加 BrowserView
    //    关键：BrowserView 必须附加到窗口才能正常执行网络请求和 JS，
    //    未附加的 webContents 会被 Chromium 节流（对 HTTP URL 影响极大）
    this.initWindow()

    // 5. 加载截图页面（独立入口，不经过 Vue Router）
    //    开发模式: http://localhost:5173/screenshot.html
    //    生产模式: file://...out/renderer/screenshot.html
    const loadUrl = process.env['ELECTRON_RENDERER_URL']
      ? `${process.env['ELECTRON_RENDERER_URL']}/screenshot.html`
      : `file://${join(__dirname, '../renderer/screenshot.html')}`

    console.log('[ScreenshotService] 加载截图页面:', loadUrl)
    this.$view.webContents.loadURL(loadUrl)

    // 6. 渲染进程崩溃恢复
    this.$view.webContents.on('render-process-gone', (_event, details) => {
      console.error('[ScreenshotService] 渲染进程崩溃:', details.reason)
      this.$view.webContents.loadURL(loadUrl)
    })
  }

  /**
   * 初始化窗口（仅用于承载 BrowserView，用户不可见）
   * 使用 paintWhenInitiallyHidden 确保 webContents 正常执行
   */
  private initWindow(): void {
    const display = this.getDisplay()

    const windowTypes: Record<string, string | undefined> = {
      darwin: 'panel',
      linux: undefined,
      win32: 'toolbar'
    }

    this.$win = new BrowserWindow({
      title: 'screenshots',
      x: display.x,
      y: display.y,
      width: display.width,
      height: display.height,
      useContentSize: true,
      type: windowTypes[process.platform] as string,
      frame: false,
      show: false,
      autoHideMenuBar: true,
      transparent: true,
      resizable: false,
      movable: false,
      minimizable: false,
      maximizable: false,
      focusable: true,
      skipTaskbar: true,
      alwaysOnTop: true,
      fullscreen: false,
      fullscreenable: false,
      kiosk: false,
      backgroundColor: '#00000000',
      titleBarStyle: 'hidden',
      hasShadow: false,
      // 关键：即使窗口未显示，也允许 webContents 正常渲染
      paintWhenInitiallyHidden: true,
      roundedCorners: false,
      enableLargerThanScreen: false,
      acceptFirstMouse: true
    })

    this.$win.on('show', () => {
      this.$win?.focus()
      this.$win?.setKiosk(true)
    })

    this.$win.on('closed', () => {
      this.$win = null
    })

    // 附加 BrowserView 到窗口
    this.$win.setBrowserView(this.$view)
    this.$view.setBounds({
      x: 0,
      y: 0,
      width: display.width,
      height: display.height
    })
  }

  /**
   * 开始截图（完全对齐参考项目 startCapture）
   */
  public async startCapture(): Promise<void> {
    if (this.isCapturing) return
    this.isCapturing = true

    try {
      const display = this.getDisplay()

      // 并行：截屏 + 等待渲染进程就绪（首次可能等待，后续已 resolved）
      const [imageUrl] = await Promise.all([this.capture(display), this.isReady])

      // 创建/复用窗口
      await this.createWindow(display)

      // 发送截图数据到渲染进程
      this.$view.webContents.send('SCREENSHOT:capture', display, imageUrl)
    } catch (error) {
      console.error('[ScreenshotService] startCapture 失败:', error)
      await this.endCapture()
      throw error
    } finally {
      this.isCapturing = false
    }
  }

  /**
   * 结束截图
   * singleWindow 模式：只隐藏窗口，保留 BrowserView 附加（避免重新加载）
   * 非 singleWindow 模式：移除 BrowserView + 销毁窗口
   */
  public async endCapture(): Promise<void> {
    // 重置渲染进程 UI 状态
    if (this.$view && !this.$view.webContents.isDestroyed()) {
      this.$view.webContents.send('SCREENSHOT:reset')
    }

    if (!this.$win || this.$win.isDestroyed()) return

    // 先清除 Kiosk 模式
    this.$win.setKiosk(false)
    this.$win.blur()
    this.$win.blurWebView()
    this.$win.unmaximize()

    if (this.singleWindow) {
      // 保留 BrowserView 附加，只隐藏窗口
      this.$win.hide()
    } else {
      this.$win.removeBrowserView(this.$view)
      this.$win.destroy()
    }
  }

  /**
   * 初始化/复用截图窗口
   */
  private async createWindow(display: Display): Promise<void> {
    // 发送重置消息，确保渲染进程 UI 状态干净
    if (this.$view && !this.$view.webContents.isDestroyed()) {
      this.$view.webContents.send('SCREENSHOT:reset')
    }
    // 给渲染进程一点时间处理 reset
    await new Promise((r) => setTimeout(r, 100))

    // 复用未销毁的窗口
    if (!this.$win || this.$win.isDestroyed()) {
      const windowTypes: Record<string, string | undefined> = {
        darwin: 'panel',
        linux: undefined,
        win32: 'toolbar'
      }

      this.$win = new BrowserWindow({
        title: 'screenshots',
        x: display.x,
        y: display.y,
        width: display.width,
        height: display.height,
        useContentSize: true,
        type: windowTypes[process.platform] as string,
        frame: false,
        show: false,
        autoHideMenuBar: true,
        transparent: true,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        focusable: true,
        skipTaskbar: true,
        alwaysOnTop: true,
        fullscreen: false,
        fullscreenable: false,
        kiosk: true,
        backgroundColor: '#00000000',
        titleBarStyle: 'hidden',
        hasShadow: false,
        paintWhenInitiallyHidden: true,
        roundedCorners: false,
        enableLargerThanScreen: false,
        acceptFirstMouse: true
      })

      this.$win.on('show', () => {
        this.$win?.focus()
        this.$win?.setKiosk(true)
      })

      this.$win.on('closed', () => {
        this.$win = null
      })

      // 重新附加 BrowserView
      this.$win.setBrowserView(this.$view)
    }

    // 平台特定设置
    if (process.platform === 'darwin') {
      this.$win.setWindowButtonVisibility(false)
    }
    if (process.platform !== 'win32') {
      this.$win.setVisibleOnAllWorkspaces(true, {
        visibleOnFullScreen: true,
        skipTransformProcessType: true
      })
    }

    this.$win.blur()
    this.$win.setBounds(display)
    this.$view.setBounds({
      x: 0,
      y: 0,
      width: display.width,
      height: display.height
    })
    this.$win.setAlwaysOnTop(true)
    this.$win.show()
  }

  /**
   * 获取当前显示器信息
   */
  private getDisplay(): Display {
    const point = screen.getCursorScreenPoint()
    const { id, bounds, scaleFactor } = screen.getDisplayNearestPoint(point)
    return {
      id,
      x: Math.floor(bounds.x),
      y: Math.floor(bounds.y),
      width: Math.floor(bounds.width),
      height: Math.floor(bounds.height),
      scaleFactor
    }
  }

  /**
   * 捕获屏幕（对齐参考项目 capture，使用 desktopCapturer）
   */
  private async capture(display: Display): Promise<string> {
    const sources = await desktopCapturer.getSources({
      types: ['screen'],
      thumbnailSize: {
        width: Math.floor(display.width * display.scaleFactor),
        height: Math.floor(display.height * display.scaleFactor)
      }
    })

    let source
    if (sources.length === 1) {
      ;[source] = sources
    } else {
      source = sources.find(
        (item) =>
          item.display_id === display.id.toString() || item.id.startsWith(`screen:${display.id}:`)
      )
    }

    if (!source) {
      throw new Error("Can't find screen source")
    }

    return source.thumbnail.toDataURL()
  }

  /**
   * 获取窗口列表
   */
  public async getWindowList(): Promise<WindowInfo[]> {
    return listWindowSources()
  }

  /**
   * 根据窗口 ID 捕获窗口内容
   */
  public async captureWindow(windowId: string): Promise<WindowCaptureResult> {
    return captureWindowSource(windowId)
  }

  /**
   * 销毁服务
   */
  public destroy(): void {
    try {
      if (this.$view && !this.$view.webContents.isDestroyed()) {
        this.$view.webContents.removeAllListeners()
        // WebContents 没有 destroy()；关闭加载器即可释放（webContents 随视图销毁）
        this.$view.webContents.close()
      }
    } catch {
      /* ignore */
    }
    try {
      if (this.$win && !this.$win.isDestroyed()) {
        this.$win.destroy()
        this.$win = null
      }
    } catch {
      /* ignore */
    }
  }

  /**
   * 监听 IPC 事件
   */
  private listenIpc(): void {
    // 确定事件（复制到剪贴板）
    ipcMain.on('SCREENSHOT:ok', async (_e, buffer: Buffer, data: ScreenshotsData) => {
      try {
        this.emit('ok', buffer, data)
        clipboard.writeImage(nativeImage.createFromBuffer(buffer))

        if (Notification.isSupported()) {
          new Notification({ title: '截图已复制', body: '截图已复制到剪贴板' }).show()
        }

        // 保存到截图历史
        try {
          const { saveScreenshotToHistory } = await import('../ipc/screenshotHistory')
          await saveScreenshotToHistory(buffer, {
            captureMode: (data.sourceType as 'screen' | 'window' | 'region') || 'region',
            sourceName: data.sourceName
          })
        } catch (historyError) {
          console.error('[ScreenshotService] 保存到历史记录失败:', historyError)
        }

        await this.endCapture()
      } catch (error) {
        console.error('[ScreenshotService] ok 处理错误:', error)
        this.emit('cancel')
        await this.endCapture()
      }
    })

    // 取消事件
    ipcMain.on('SCREENSHOT:cancel', async () => {
      this.emit('cancel')
      await this.endCapture()
    })

    // 保存事件
    ipcMain.on('SCREENSHOT:save', async (_e, buffer: Buffer, data: ScreenshotsData) => {
      this.emit('save', buffer, data)

      if (!this.$win || this.$win.isDestroyed()) {
        this.emit('afterSave', buffer, data, false)
        return
      }

      const time = new Date()
      const pad = (n: number, len = 2): string => String(n).padStart(len, '0')
      const timestamp = `${time.getFullYear()}${pad(time.getMonth() + 1)}${pad(time.getDate())}${pad(time.getHours())}${pad(time.getMinutes())}${pad(time.getSeconds())}${pad(time.getMilliseconds(), 3)}`

      this.$win.setAlwaysOnTop(false)

      const { canceled, filePath } = await dialog.showSaveDialog(this.$win, {
        defaultPath: `${timestamp}.png`,
        filters: [
          { name: 'Image (png)', extensions: ['png'] },
          { name: 'All Files', extensions: ['*'] }
        ]
      })

      if (!this.$win || this.$win.isDestroyed()) {
        this.emit('afterSave', buffer, data, false)
        return
      }

      this.$win.setAlwaysOnTop(true)
      if (canceled || !filePath) {
        this.emit('afterSave', buffer, data, false)
        return
      }

      try {
        writeFileSync(filePath, buffer)
        this.emit('afterSave', buffer, data, true)

        if (Notification.isSupported()) {
          new Notification({ title: '截图已保存', body: filePath }).show()
        }

        // 保存到截图历史
        try {
          const { screenshotRepository } = await import('../db/repos/ScreenshotRepository')
          const { basename } = await import('path')
          const { statSync } = await import('fs')
          const stats = statSync(filePath)
          screenshotRepository.add({
            filePath,
            fileName: basename(filePath),
            fileSize: stats.size,
            captureMode: (data.sourceType as 'screen' | 'window' | 'region') || 'region'
          })
        } catch (historyError) {
          console.error('[ScreenshotService] 保存到历史记录失败:', historyError)
        }

        await this.endCapture()
      } catch (error) {
        console.error('[ScreenshotService] Save error:', error)
        this.emit('afterSave', buffer, data, false)
      }
    })
  }
}

