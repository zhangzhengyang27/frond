/**
 * Leaf · Pin IPC Handlers
 *
 * 贴图功能的 IPC 处理
 */

import { ipcMain } from 'electron'
import PinService from '../services/PinService'

let pinService: PinService | null = null
let isInitialized = false

function getPinService(): PinService {
  if (!pinService) {
    pinService = new PinService()
  }
  // 初始化服务（延迟初始化，确保 app 已 ready）
  if (!isInitialized) {
    pinService.init()
    isInitialized = true
  }
  return pinService
}

export function registerPinHandlers(): void {
  const service = getPinService()

  // 创建贴图
  ipcMain.handle(
    'pin:create',
    async (
      _event,
      options: {
        imagePath: string
        imageBuffer?: string
      }
    ) => {
      try {
        const buffer = options.imageBuffer ? Buffer.from(options.imageBuffer, 'base64') : undefined

        const id = service.createPin({
          imagePath: options.imagePath,
          imageBuffer: buffer
        })

        return { success: true, id }
      } catch (error) {
        console.error('[PinHandler] create error:', error)
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // 从剪贴板创建贴图
  ipcMain.handle('pin:createFromClipboard', async () => {
    try {
      const id = await service.createPinFromClipboard()
      if (id) {
        return { success: true, id }
      }
      return { success: false, error: 'Clipboard is empty or not an image' }
    } catch (error) {
      console.error('[PinHandler] createFromClipboard error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 关闭贴图
  ipcMain.handle('pin:close', async (_event, id: string) => {
    try {
      const success = service.closePin(id)
      return { success }
    } catch (error) {
      console.error('[PinHandler] close error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 关闭所有贴图
  ipcMain.handle('pin:closeAll', async () => {
    try {
      service.closeAllPins()
      return { success: true }
    } catch (error) {
      console.error('[PinHandler] closeAll error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取所有贴图
  ipcMain.handle('pin:getAll', async () => {
    try {
      const pins = service.getAllPins()
      return {
        success: true,
        pins: pins.map((p) => ({
          id: p.id,
          x: p.x,
          y: p.y,
          width: p.width,
          height: p.height,
          scale: p.scale,
          rotation: p.rotation,
          opacity: p.opacity,
          isTransparent: p.isTransparent,
          createdAt: p.createdAt
        }))
      }
    } catch (error) {
      console.error('[PinHandler] getAll error:', error)
      return { success: false, error: (error as Error).message, pins: [] }
    }
  })

  // 获取贴图数量
  ipcMain.handle('pin:getCount', async () => {
    try {
      const count = service.getPinCount()
      return { success: true, count }
    } catch (error) {
      console.error('[PinHandler] getCount error:', error)
      return { success: false, error: (error as Error).message, count: 0 }
    }
  })

  // 设置缩放
  ipcMain.handle('pin:setScale', async (_event, id: string, scale: number) => {
    try {
      service.setPinScale(id, scale)
      return { success: true }
    } catch (error) {
      console.error('[PinHandler] setScale error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 设置旋转
  ipcMain.handle('pin:setRotation', async (_event, id: string, rotation: number) => {
    try {
      service.setPinRotation(id, rotation)
      return { success: true }
    } catch (error) {
      console.error('[PinHandler] setRotation error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 设置透明度
  ipcMain.handle('pin:setOpacity', async (_event, id: string, opacity: number) => {
    try {
      service.setPinOpacity(id, opacity)
      return { success: true }
    } catch (error) {
      console.error('[PinHandler] setOpacity error:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 切换鼠标穿透
  ipcMain.handle('pin:toggleTransparent', async (_event, id: string) => {
    try {
      service.toggleTransparent(id)
      return { success: true }
    } catch (error) {
      console.error('[PinHandler] toggleTransparent error:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}

export function getPinServiceInstance(): PinService {
  return getPinService()
}

export function destroyPinService(): void {
  if (pinService) {
    pinService.destroy()
    pinService = null
  }
}
