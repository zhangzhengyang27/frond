/**
 * Leaf · PinService
 *
 * 贴图置顶服务 - Snipaste 的核心功能
 * 将截图作为窗口置顶显示，支持多种操作
 */

import { BrowserWindow, screen, globalShortcut } from 'electron'
import { join } from 'path'

export interface PinWindow {
  id: string
  window: BrowserWindow
  imagePath: string
  x: number
  y: number
  width: number
  height: number
  scale: number
  rotation: number
  opacity: number
  isTransparent: boolean
  createdAt: number
}

export interface CreatePinOptions {
  imagePath: string
  imageBuffer?: Buffer
  x?: number
  y?: number
  width?: number
  height?: number
}

export interface PinShortcutConfig {
  /** 关闭当前聚焦贴图，默认 'Escape' */
  close?: string
  /** 关闭所有贴图，默认 'CommandOrControl+Shift+W' */
  closeAll?: string
  /** 切换鼠标穿透，默认 'CommandOrControl+Shift+X' */
  toggleTransparent?: string
  /** 聚焦下一个贴图，默认 'CommandOrControl+Tab' */
  focusNext?: string
  /** 聚焦上一个贴图，默认 'CommandOrControl+Shift+Tab' */
  focusPrev?: string
}

const DEFAULT_SHORTCUTS: Required<PinShortcutConfig> = {
  close: 'Escape',
  closeAll: 'CommandOrControl+Shift+W',
  toggleTransparent: 'CommandOrControl+Shift+X',
  focusNext: 'CommandOrControl+Tab',
  focusPrev: 'CommandOrControl+Shift+Tab'
}

export default class PinService {
  private pins: Map<string, PinWindow> = new Map()
  private nextId = 1
  private shortcuts: Required<PinShortcutConfig> = { ...DEFAULT_SHORTCUTS }
  private focusedPinId: string | null = null
  private isRegistered = false

  constructor() {
    // 不在构造函数中注册快捷键，等待 explicit init()
  }

  /**
   * 初始化服务并注册快捷键
   */
  public init(shortcutConfig?: PinShortcutConfig): void {
    if (this.isRegistered) return

    // 合并自定义配置
    this.shortcuts = {
      close: shortcutConfig?.close ?? DEFAULT_SHORTCUTS.close,
      closeAll: shortcutConfig?.closeAll ?? DEFAULT_SHORTCUTS.closeAll,
      toggleTransparent: shortcutConfig?.toggleTransparent ?? DEFAULT_SHORTCUTS.toggleTransparent,
      focusNext: shortcutConfig?.focusNext ?? DEFAULT_SHORTCUTS.focusNext,
      focusPrev: shortcutConfig?.focusPrev ?? DEFAULT_SHORTCUTS.focusPrev
    }

    this.registerShortcuts()
    this.isRegistered = true
  }

  /**
   * 注册全局快捷键
   */
  private registerShortcuts(): void {
    const shortcuts = this.shortcuts

    // 关闭所有贴图
    globalShortcut.register(shortcuts.closeAll, () => {
      this.closeAllPins()
    })

    // 切换鼠标穿透（作用于当前聚焦的贴图）
    globalShortcut.register(shortcuts.toggleTransparent, () => {
      if (this.focusedPinId) {
        this.toggleTransparent(this.focusedPinId)
      }
    })
  }

  /**
   * 注销全局快捷键
   *
   * 只注销本服务注册的两个加速器：globalShortcut.unregisterAll() 会把
   * 截图/番茄钟/launcher 等其他模块的全局快捷键一并清掉且不会恢复
   */
  private unregisterShortcuts(): void {
    for (const accel of [this.shortcuts.closeAll, this.shortcuts.toggleTransparent]) {
      try {
        globalShortcut.unregister(accel)
      } catch {
        /* 未注册时 unregister 静默 */
      }
    }
  }

  /**
   * 获取所有注册的快捷键
   */
  public getShortcutBindings(): Required<PinShortcutConfig> {
    return { ...this.shortcuts }
  }

  /**
   * 更新快捷键配置
   */
  public updateShortcuts(config: Partial<PinShortcutConfig>): void {
    this.unregisterShortcuts()
    this.shortcuts = {
      close: config.close ?? this.shortcuts.close,
      closeAll: config.closeAll ?? this.shortcuts.closeAll,
      toggleTransparent: config.toggleTransparent ?? this.shortcuts.toggleTransparent,
      focusNext: config.focusNext ?? this.shortcuts.focusNext,
      focusPrev: config.focusPrev ?? this.shortcuts.focusPrev
    }
    this.registerShortcuts()
  }

  /**
   * 创建贴图窗口
   */
  public createPin(options: CreatePinOptions): string {
    const id = `pin_${Date.now()}_${this.nextId++}`

    // 获取当前鼠标位置附近作为初始位置
    const cursorPoint = screen.getCursorScreenPoint()
    const display = screen.getDisplayNearestPoint(cursorPoint)

    const x = options.x ?? display.bounds.x + 100
    const y = options.y ?? display.bounds.y + 100
    const width = options.width ?? 400
    const height = options.height ?? 300

    // 创建贴图窗口
    const pinWindow = new BrowserWindow({
      title: `Pin ${id}`,
      x,
      y,
      width,
      height,
      frame: false,
      transparent: true,
      resizable: true,
      movable: true,
      minimizable: false,
      maximizable: false,
      fullscreenable: false,
      alwaysOnTop: true,
      skipTaskbar: true,
      hasShadow: false,
      backgroundColor: '#00000000',
      webPreferences: {
        preload: join(__dirname, '../preload/index.js'),
        nodeIntegration: false,
        contextIsolation: true
      }
    })

    // 加载贴图页面
    const loadUrl = process.env['ELECTRON_RENDERER_URL']
      ? `${process.env['ELECTRON_RENDERER_URL']}#/screenshot/pin`
      : `file://${join(__dirname, '../renderer/index.html')}#/screenshot/pin`

    pinWindow.loadURL(loadUrl)

    // 窗口准备好后发送图片数据
    pinWindow.webContents.once('did-finish-load', () => {
      pinWindow.webContents.send('pin:setImage', {
        id,
        imagePath: options.imagePath,
        imageBuffer: options.imageBuffer?.toString('base64')
      })

      // 聚焦时发送快捷键信息
      pinWindow.webContents.send('pin:setShortcuts', {
        close: this.shortcuts.close
      })
    })

    // 监听窗口聚焦事件
    pinWindow.on('focus', () => {
      this.focusedPinId = id
    })

    pinWindow.on('blur', () => {
      if (this.focusedPinId === id) {
        this.focusedPinId = null
      }
    })

    // 监听窗口事件
    pinWindow.on('moved', () => {
      const bounds = pinWindow.getBounds()
      this.updatePinPosition(id, bounds.x, bounds.y)
    })

    pinWindow.on('resized', () => {
      const bounds = pinWindow.getBounds()
      this.updatePinSize(id, bounds.width, bounds.height)
    })

    pinWindow.on('closed', () => {
      this.pins.delete(id)
      if (this.focusedPinId === id) {
        this.focusedPinId = null
      }
    })

    // 存储贴图信息
    const pinInfo: PinWindow = {
      id,
      window: pinWindow,
      imagePath: options.imagePath,
      x,
      y,
      width,
      height,
      scale: 1,
      rotation: 0,
      opacity: 1,
      isTransparent: false,
      createdAt: Date.now()
    }

    this.pins.set(id, pinInfo)

    // 自动聚焦新创建的贴图
    pinWindow.focus()

    return id
  }

  /**
   * 从剪贴板创建贴图
   */
  public async createPinFromClipboard(): Promise<string | null> {
    try {
      const { clipboard } = await import('electron')

      const image = clipboard.readImage()
      if (image.isEmpty()) {
        console.warn('[PinService] Clipboard is empty or not an image')
        return null
      }

      // 转换为 base64
      const buffer = image.toPNG()
      const base64 = buffer.toString('base64')
      const dataUrl = `data:image/png;base64,${base64}`

      return this.createPin({
        imagePath: dataUrl,
        imageBuffer: buffer
      })
    } catch (error) {
      console.error('[PinService] Failed to create pin from clipboard:', error)
      return null
    }
  }

  /**
   * 关闭贴图
   */
  public closePin(id: string): boolean {
    const pin = this.pins.get(id)
    if (!pin) return false

    try {
      // 先从 Map 中移除，防止 closed 事件处理器重复删除
      this.pins.delete(id)
      if (this.focusedPinId === id) {
        this.focusedPinId = null
      }
      pin.window.close()
      return true
    } catch (error) {
      console.error('[PinService] Failed to close pin:', error)
      return false
    }
  }

  /**
   * 关闭聚焦的贴图（用于快捷键）
   */
  public closeFocusedPin(): boolean {
    if (this.focusedPinId) {
      return this.closePin(this.focusedPinId)
    }
    return false
  }

  /**
   * 关闭所有贴图
   */
  public closeAllPins(): void {
    for (const [id, pin] of this.pins) {
      try {
        pin.window.close()
      } catch (error) {
        console.error(`[PinService] Failed to close pin ${id}:`, error)
      }
    }
    this.pins.clear()
    this.focusedPinId = null
  }

  /**
   * 获取所有贴图
   */
  public getAllPins(): PinWindow[] {
    return Array.from(this.pins.values())
  }

  /**
   * 获取单个贴图
   */
  public getPin(id: string): PinWindow | undefined {
    return this.pins.get(id)
  }

  /**
   * 获取贴图数量
   */
  public getPinCount(): number {
    return this.pins.size
  }

  /**
   * 获取当前聚焦的贴图 ID
   */
  public getFocusedPinId(): string | null {
    return this.focusedPinId
  }

  /**
   * 更新贴图位置
   */
  private updatePinPosition(id: string, x: number, y: number): void {
    const pin = this.pins.get(id)
    if (pin) {
      pin.x = x
      pin.y = y
    }
  }

  /**
   * 更新贴图大小
   */
  private updatePinSize(id: string, width: number, height: number): void {
    const pin = this.pins.get(id)
    if (pin) {
      pin.width = width
      pin.height = height
    }
  }

  /**
   * 设置贴图缩放
   */
  public setPinScale(id: string, scale: number): void {
    const pin = this.pins.get(id)
    if (!pin) return

    pin.scale = scale
    const newWidth = Math.round(pin.width * scale)
    const newHeight = Math.round(pin.height * scale)

    pin.window.setBounds({
      x: pin.x,
      y: pin.y,
      width: newWidth,
      height: newHeight
    })

    // 更新存储的尺寸为实际窗口尺寸
    pin.width = newWidth
    pin.height = newHeight
  }

  /**
   * 设置贴图旋转
   */
  public setPinRotation(id: string, rotation: number): void {
    const pin = this.pins.get(id)
    if (!pin) return

    pin.rotation = rotation
    pin.window.webContents.send('pin:setRotation', rotation)
  }

  /**
   * 设置贴图透明度
   */
  public setPinOpacity(id: string, opacity: number): void {
    const pin = this.pins.get(id)
    if (!pin) return

    pin.opacity = Math.max(0.1, Math.min(1, opacity))
    pin.window.setOpacity(pin.opacity)
  }

  /**
   * 切换鼠标穿透
   */
  public toggleTransparent(id: string): void {
    const pin = this.pins.get(id)
    if (!pin) return

    pin.isTransparent = !pin.isTransparent
    pin.window.setIgnoreMouseEvents(pin.isTransparent, { forward: true })
  }

  /**
   * 设置贴图置顶
   */
  public setPinAlwaysOnTop(id: string, alwaysOnTop: boolean): void {
    const pin = this.pins.get(id)
    if (!pin) return

    pin.window.setAlwaysOnTop(alwaysOnTop)
  }

  /**
   * 聚焦下一个贴图
   */
  public focusNextPin(): void {
    const pins = this.getAllPins()
    if (pins.length === 0) return

    const currentIndex = this.focusedPinId ? pins.findIndex((p) => p.id === this.focusedPinId) : -1

    const nextIndex = (currentIndex + 1) % pins.length
    pins[nextIndex].window.focus()
  }

  /**
   * 聚焦上一个贴图
   */
  public focusPrevPin(): void {
    const pins = this.getAllPins()
    if (pins.length === 0) return

    const currentIndex = this.focusedPinId ? pins.findIndex((p) => p.id === this.focusedPinId) : 0

    const prevIndex = (currentIndex - 1 + pins.length) % pins.length
    pins[prevIndex].window.focus()
  }

  /**
   * 销毁服务
   */
  public destroy(): void {
    this.unregisterShortcuts()
    this.closeAllPins()
  }
}
