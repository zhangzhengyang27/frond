import { desktopCapturer, shell, app, systemPreferences } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import { showSaveDialogFor } from '../modules/dialogs'
import { grantRecordingSavePath } from './recordingSavePathGrants'
import type { BrowserWindow } from 'electron'
import { exec } from 'child_process'
import { promisify } from 'util'
import { typedHandle } from './typedIpc'

const execAsync = promisify(exec)

// macOS 系统设置的屏幕录制面板；该 URL scheme 在 macOS 12 及 13+ (Ventura) 均适用
const DARWIN_PREFS_URL =
  'x-apple.systempreferences:com.apple.preference.security?Privacy_ScreenCapture'

/**
 * 按平台构造「打开权限设置」的结果。导出以便测试（B57-12）：
 * Windows 桌面应用的屏幕捕获没有系统级权限面板，旧实现误开「麦克风」隐私页
 * （复制粘贴错误）——任何平台都不应打开与屏幕录制无关的设置页。
 */
export async function openPermissionSettingsOutcome(
  platform: NodeJS.Platform,
  openExternal: (url: string) => Promise<unknown>
): Promise<{ success: boolean; message: string }> {
  if (platform === 'darwin') {
    await openExternal(DARWIN_PREFS_URL)
    return { success: true, message: '已打开系统设置，请授予屏幕录制权限后重启应用' }
  }
  if (platform === 'win32') {
    // Windows 无对应隐私面板；打开无关设置页只会误导，返回事实说明即可
    return {
      success: false,
      message: 'Windows 桌面应用录屏无需系统权限；若画面异常请检查捕获源或受版权保护的内容'
    }
  }
  return { success: false, message: '请在系统设置中授予屏幕录制权限' }
}

export function registerScreenRecorderIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  // 获取可用的屏幕源
  typedHandle('screen-recorder:getSources', async (_event, req) => {
    try {
      // 确保 options 有合理的默认值（避免重复指定同名属性）
      const defaultOptions: Electron.SourcesOptions = {
        thumbnailSize: { width: 200, height: 150 },
        ...req.options
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
        options: JSON.stringify(req.options),
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

  // 请求屏幕录制权限（打开系统设置；平台分支见 openPermissionSettingsOutcome）
  typedHandle('screen-recorder:requestPermission', async () => {
    try {
      return await openPermissionSettingsOutcome(process.platform, (url) => shell.openExternal(url))
    } catch (error) {
      console.error('打开系统设置失败:', error)
      // 备用方案：使用命令行打开（仅 macOS 会走到这里——其余平台不调 openExternal）
      try {
        await execAsync(`open "${DARWIN_PREFS_URL}"`)
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
  })

  // 检查屏幕录制权限状态
  typedHandle('screen-recorder:checkPermission', async () => {
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
  // extension 由录制引擎决定容器：mediarecorder=webm，webcodecs=mp4（缺省 webm 兼容旧渲染端）
  typedHandle('screen-recorder:getDefaultSavePath', async (_event, req) => {
    const extension = req?.extension === 'mp4' ? 'mp4' : 'webm'
    // 生成日期格式的文件名：2025-11-08 18-52-14
    const now = new Date()
    const pad = (n: number): string => String(n).padStart(2, '0')
    const fileName = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())} ${pad(now.getHours())}-${pad(now.getMinutes())}-${pad(now.getSeconds())}`

    // 使用下载目录作为默认保存位置
    const downloadsPath = app.getPath('downloads')
    // 同一秒内连续录制（或已有同名文件）时追加序号，避免 writeFileSync 静默覆盖
    let candidate = join(downloadsPath, `${fileName}.${extension}`)
    for (let i = 1; existsSync(candidate); i++) {
      candidate = join(downloadsPath, `${fileName} (${i}).${extension}`)
    }
    grantRecordingSavePath(candidate)
    return candidate
  })

  // 选择保存录制文件的路径
  // 过滤器跟随录制引擎的容器：旧链路只允许 webm（MediaRecorder 固定输出 webm 容器），
  // webcodecs 引擎直出 mp4
  typedHandle('screen-recorder:selectSavePath', async (_event, req) => {
    const extension = req?.extension === 'mp4' ? 'mp4' : 'webm'
    const mainWindow = getMainWindow()
    const result = await showSaveDialogFor(mainWindow, {
      title: '保存录制文件',
      defaultPath: `screen-recording-${Date.now()}.${extension}`,
      filters:
        extension === 'mp4'
          ? [{ name: 'MP4 视频', extensions: ['mp4'] }]
          : [{ name: 'WebM 视频', extensions: ['webm'] }]
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    grantRecordingSavePath(result.filePath)
    return result.filePath
  })
}
