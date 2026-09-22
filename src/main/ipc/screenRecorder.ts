import { ipcMain, desktopCapturer, shell, app, systemPreferences } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { showSaveDialogFor } from '../modules/dialogs'
import { grantRecordingSavePath } from './recordingSavePathGrants'
import type { BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'

const execAsync = promisify(exec)

export function registerScreenRecorderIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // 获取可用的屏幕源
  ipcMain.handle('screen-recorder:getSources', async (_event, options: Electron.SourcesOptions) => {
    try {
      // 确保 options 有合理的默认值（避免重复指定同名属性）
      const defaultOptions: Electron.SourcesOptions = {
        thumbnailSize: { width: 200, height: 150 },
        ...options
      }
      if (!defaultOptions.types || defaultOptions.types.length === 0) {
        defaultOptions.types = ['screen', 'window']
      }

      console.log('获取屏幕源，选项:', JSON.stringify(defaultOptions))

      const sources = await desktopCapturer.getSources(defaultOptions)

      console.log(`成功获取 ${sources.length} 个屏幕源`)

      // 将 NativeImage 转换为 base64 字符串，以便在渲染进程中直接使用
      return sources.map((source) => {
        try {
          const thumbnail = source.thumbnail
          if (!thumbnail || thumbnail.isEmpty()) {
            console.warn(`源 ${source.name} (${source.id}) 的缩略图为空`)
            return {
              id: source.id,
              name: source.name,
              thumbnail: '' // 返回空字符串，前端会显示占位符
            }
          }
          const dataURL = thumbnail.toDataURL()
          if (!dataURL || dataURL.trim() === '') {
            console.warn(`源 ${source.name} (${source.id}) 的缩略图转换失败`)
            return {
              id: source.id,
              name: source.name,
              thumbnail: ''
            }
          }
          return {
            id: source.id,
            name: source.name,
            thumbnail: dataURL // 转换为 base64 字符串（包含 data:image/png;base64, 前缀）
          }
        } catch (error) {
          console.error(`处理源 ${source.name} (${source.id}) 的缩略图时出错:`, error)
          return {
            id: source.id,
            name: source.name,
            thumbnail: ''
          }
        }
      })
    } catch (error) {
      const errorMessage = (error as Error).message || String(error)
      console.error('获取屏幕源失败:', {
        error: errorMessage,
        options: JSON.stringify(options),
        platform: process.platform
      })

      // 提供更友好的错误信息
      let friendlyMessage = '获取屏幕源失败'

      if (process.platform === 'darwin') {
        if (
          errorMessage.includes('permission') ||
          errorMessage.includes('权限') ||
          errorMessage.includes('Failed to get sources')
        ) {
          friendlyMessage =
            '需要屏幕录制权限。请在系统设置 > 安全性与隐私 > 隐私 > 屏幕录制中授予权限。'
        } else if (errorMessage.includes('denied') || errorMessage.includes('拒绝')) {
          friendlyMessage = '屏幕录制权限被拒绝。请在系统设置中授予权限。'
        }
      } else if (process.platform === 'linux') {
        if (errorMessage.includes('permission') || errorMessage.includes('权限')) {
          friendlyMessage = '需要屏幕录制权限。请确保应用有相应的权限。'
        }
      } else if (process.platform === 'win32') {
        if (errorMessage.includes('permission') || errorMessage.includes('权限')) {
          friendlyMessage = '需要屏幕录制权限。请检查 Windows 隐私设置。'
        }
      }

      // 创建一个包含详细信息的错误对象
      const enhancedError = new Error(friendlyMessage) as Error & {
        originalError: string
        platform: NodeJS.Platform
        needsPermission: boolean
      }
      enhancedError.originalError = errorMessage
      enhancedError.platform = process.platform
      enhancedError.needsPermission =
        process.platform === 'darwin' &&
        (errorMessage.includes('permission') ||
          errorMessage.includes('权限') ||
          errorMessage.includes('Failed to get sources'))

      throw enhancedError
    }
  })

  // 请求屏幕录制权限（打开系统设置）
  ipcMain.handle('screen-recorder:requestPermission', async () => {
    if (process.platform === 'darwin') {
      try {
        // macOS: 打开系统设置的屏幕录制权限页面
        // 该 URL scheme 在 macOS 12 及 13+ (Ventura) 均适用
        const urlScheme =
          'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

        await shell.openExternal(urlScheme)
        return { success: true, message: '已打开系统设置，请授予屏幕录制权限后重启应用' }
      } catch (error) {
        console.error('打开系统设置失败:', error)
        // 备用方案：使用命令行打开
        try {
          await execAsync(
            'open "x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture"'
          )
          return { success: true, message: '已打开系统设置，请授予屏幕录制权限后重启应用' }
        } catch (fallbackError) {
          console.error('备用方案也失败:', fallbackError)
          return {
            success: false,
            message:
              '无法自动打开系统设置，请手动前往：系统设置 > 隐私与安全性 > 屏幕录制，授予权限后重启应用'
          }
        }
      }
    } else if (process.platform === 'linux') {
      // Linux: 可以尝试打开系统设置（取决于发行版）
      return {
        success: false,
        message: '请在系统设置中授予屏幕录制权限'
      }
    } else if (process.platform === 'win32') {
      // Windows: 打开隐私设置
      try {
        await shell.openExternal('ms-settings:privacy-microphone')
        return { success: true, message: '已打开 Windows 隐私设置' }
      } catch {
        return {
          success: false,
          message: '请在 Windows 设置 > 隐私中授予屏幕录制权限'
        }
      }
    }
    return { success: false, message: '当前平台不支持自动打开权限设置' }
  })

  // 检查屏幕录制权限状态
  ipcMain.handle('screen-recorder:checkPermission', async () => {
    if (process.platform !== 'darwin') {
      return { hasPermission: true, message: '非 macOS 平台，无需检查' }
    }

    // 用 systemPermissions 精确判断。旧实现靠 getSources 是否抛错探测，
    // 但 macOS 未授权时 getSources 往往不抛错而是返回空缩略图 → 判定不可靠
    try {
      const status = systemPreferences.getMediaAccessStatus('screen')
      if (status === 'granted') {
        return { hasPermission: true, message: '已授予屏幕录制权限' }
      }
      const messages: Record<string, string> = {
        denied: '屏幕录制权限被拒绝，请在系统设置中授予',
        restricted: '屏幕录制权限受系统策略限制',
        'not-determined': '尚未请求屏幕录制权限'
      }
      return {
        hasPermission: false,
        message: messages[status] ?? `屏幕录制权限状态异常: ${status}`
      }
    } catch (error) {
      return { hasPermission: false, message: `检查权限时出错: ${(error as Error).message}` }
    }
  })

  // 获取默认保存路径（使用日期格式文件名）
  ipcMain.handle('screen-recorder:getDefaultSavePath', async () => {
    // 生成日期格式的文件名：2025-11-08 18-52-14
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const fileName = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`

    // 使用下载目录作为默认保存位置
    const downloadsPath = app.getPath('downloads')
    // 同一秒内连续录制（或已有同名文件）时追加序号，避免 writeFileSync 静默覆盖
    let candidate = join(downloadsPath, `${fileName}.webm`)
    for (let i = 1; existsSync(candidate); i++) {
      candidate = join(downloadsPath, `${fileName} (${i}).webm`)
    }
    grantRecordingSavePath(candidate)
    return candidate
  })

  // 选择保存录制文件的路径
  // 只允许 webm：MediaRecorder 输出固定是 webm 容器，旧实现同时提供 mp4 过滤器，
  // 用户选了 .mp4 会得到「webm 数据 + mp4 后缀」的假容器文件
  ipcMain.handle('screen-recorder:selectSavePath', async () => {
    const mainWindow = getMainWindow()
    const result = await showSaveDialogFor(mainWindow, {
      title: '保存录制文件',
      defaultPath: `screen-recording-${Date.now()}.webm`,
      filters: [{ name: 'WebM 视频', extensions: ['webm'] }]
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    grantRecordingSavePath(result.filePath)
    return result.filePath
  })
}

