import { ipcMain, shell } from 'electron'
import { RecordingHistoryService, type RecordingHistory } from '../services/RecordingHistoryService'
import { safeOpenablePath } from '../utils/openPathGuard'

/**
 * 整段读入内存的上限：超过直接拒绝。
 * 回放已改走 video:// 流式加载（Range 分片），此通道仅为兜底；512MB 上限
 * 曾允许把大录制整块读进主进程内存再经 IPC 克隆（峰值 2-3 倍文件大小），
 * 收窄到 128MB（约 8 分钟 2.5Mbps 录制）。
 */

export function registerRecordingHistoryIpcHandlers(): void {
  const recordingHistoryService = RecordingHistoryService.getInstance()

  // 获取录制历史
  ipcMain.handle('recording-history:getHistory', () => {
    return recordingHistoryService.getHistory()
  })

  // 根据日期范围获取历史
  ipcMain.handle(
    'recording-history:getHistoryByDateRange',
    (_event, start: number, end: number) => {
      return recordingHistoryService.getHistoryByDateRange(new Date(start), new Date(end))
    }
  )

  // 添加录制历史
  ipcMain.handle(
    'recording-history:addHistory',
    (_event, recording: Omit<RecordingHistory, 'id' | 'createdAt'>) => {
      return recordingHistoryService.addHistory(recording)
    }
  )

  // 删除历史记录
  ipcMain.handle('recording-history:deleteHistory', (_event, id: string) => {
    return recordingHistoryService.deleteHistory(id)
  })

  // 清空历史记录
  ipcMain.handle('recording-history:clearHistory', () => {
    recordingHistoryService.clearHistory()
  })

  // 生成缩略图
  ipcMain.handle('recording-history:generateThumbnail', async (_event, videoPath: string) => {
    return await recordingHistoryService.generateThumbnail(videoPath)
  })

  // 更新缩略图
  ipcMain.handle('recording-history:updateThumbnail', async (_event, id: string) => {
    return await recordingHistoryService.updateThumbnail(id)
  })

  // 获取统计信息
  ipcMain.handle('recording-history:getStatistics', () => {
    return recordingHistoryService.getStatistics()
  })

  // 打开文件
  ipcMain.handle('recording-history:openFile', async (_event, filePath: string) => {
    try {
      const target = safeOpenablePath(filePath)
      if (!target) return { success: false, error: 'File not found' }
      await shell.openPath(target)
      return { success: true }
    } catch (error) {
      console.error('打开文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  // 在文件夹中显示文件
  ipcMain.handle('recording-history:showInFolder', async (_event, filePath: string) => {
    try {
      shell.showItemInFolder(filePath)
      return { success: true }
    } catch (error) {
      console.error('显示文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
