import { showOpenDialogFor, showSaveDialogFor } from '../modules/dialogs'
import { ClipService } from '../services/ClipService'
import { grantRecordingSavePath, resolveGrantedRecordingPath } from './recordingSavePathGrants'
import { typedHandle, typedHandleLogged } from './typedIpc'
import type { BrowserWindow } from 'electron'

export function registerClipsIpcHandlers(getMainWindow: () => BrowserWindow | null): void {
  const clipService = ClipService.getInstance()

  // 添加剪辑片段
  typedHandleLogged('clip:addClip', (_event, { videoId, startTime, endTime, label }) =>
    clipService.addClip(videoId, startTime, endTime, label)
  )

  // 删除剪辑片段
  typedHandle('clip:removeClip', (_event, { videoId, clipId }) =>
    clipService.removeClip(videoId, clipId)
  )

  // 更新剪辑片段
  typedHandle('clip:updateClip', (_event, { videoId, clipId, updates }) =>
    clipService.updateClip(videoId, clipId, updates)
  )

  // 获取所有剪辑片段
  typedHandle('clip:getClips', (_event, { videoId }) => clipService.getClips(videoId))

  // 清空所有剪辑片段
  typedHandle('clip:clearClips', (_event, { videoId }) => {
    clipService.clearClips(videoId)
  })

  // 预览剪辑片段
  typedHandleLogged('clip:previewClip', async (_event, { videoPath, clip }) =>
    clipService.previewClip(videoPath, clip)
  )

  // 导出剪辑后的视频
  typedHandle('clip:exportClips', async (event, { videoPath, options }) => {
    try {
      // 输出路径必须由主进程对话框签发（clip:selectSavePath），否则 ffmpeg -y
      // 可被用来覆盖任意文件
      if (!resolveGrantedRecordingPath(options?.outputPath, ['.mp4', '.webm', '.gif'])) {
        throw new Error('导出路径未经主进程签发，已拒绝')
      }
      // B7 修复：进度发给发起导出的窗口（event.sender），而不是写死的 mainWindow；
      // 旧版从副窗口导出时进度条永远不动
      const sender = event.sender
      // 创建进度回调
      const progressCallback = (progress: {
        percent: number
        currentClip: number
        totalClips: number
        message: string
      }): void => {
        if (!sender.isDestroyed()) {
          sender.send('clip:exportProgress', progress)
        }
      }

      const outputPath = await clipService.exportClips(videoPath, options, progressCallback)
      return { success: true, outputPath }
    } catch (error) {
      console.error('导出剪辑失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 获取视频信息
  typedHandleLogged('clip:getVideoInfo', async (_event, { videoPath }) =>
    clipService.getVideoInfo(videoPath)
  )

  // 通用的文件选择 API（用于剪辑功能）
  typedHandle('clip:selectVideoFile', async () => {
    const mainWindow = getMainWindow()
    const result = await showOpenDialogFor(mainWindow, {
      title: '选择视频文件',
      filters: [
        { name: '视频文件', extensions: ['mp4', 'webm', 'mov', 'avi', 'mkv'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  typedHandle('clip:selectAudioFile', async () => {
    const mainWindow = getMainWindow()
    const result = await showOpenDialogFor(mainWindow, {
      title: '选择音频文件',
      filters: [
        { name: '音频文件', extensions: ['mp3', 'wav', 'm4a', 'aac', 'ogg'] },
        { name: '所有文件', extensions: ['*'] }
      ],
      properties: ['openFile']
    })
    if (result.canceled || !result.filePaths || result.filePaths.length === 0) {
      return null
    }
    return result.filePaths[0]
  })

  typedHandle('clip:selectSavePath', async () => {
    const mainWindow = getMainWindow()
    const result = await showSaveDialogFor(mainWindow, {
      title: '保存导出视频',
      defaultPath: `clip-export-${Date.now()}.mp4`,
      filters: [
        { name: 'MP4 视频', extensions: ['mp4'] },
        { name: '所有文件', extensions: ['*'] }
      ]
    })
    if (result.canceled || !result.filePath) {
      return null
    }
    // 签发：clip:exportClips 只接受这里登记过的输出路径
    grantRecordingSavePath(result.filePath)
    return result.filePath
  })
}
