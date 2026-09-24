import { ipcMain, shell } from 'electron'
import { readFile } from 'node:fs/promises'
import { RecordingHistoryService, type RecordingHistory } from '../services/RecordingHistoryService'
import { safeOpenablePath } from '../utils/openPathGuard'
import { typedHandle } from './typedIpc'

/**
 * 整段读入内存的上限：超过直接拒绝。
 * 回放已改走 video:// 流式加载（Range 分片），此通道仅为兜底；512MB 上限
 * 曾允许把大录制整块读进主进程内存再经 IPC 克隆（峰值 2-3 倍文件大小），
 * 收窄到 128MB（约 8 分钟 2.5Mbps 录制）。
 */

export function registerRecordingHistoryIpcHandlers(): void {
  const recordingHistoryService = RecordingHistoryService.getInstance()

  // 获取录制历史
  typedHandle('recording-history:getHistory', () => {
    return recordingHistoryService.getHistory()
  })

  // 根据日期范围获取历史
  typedHandle('recording-history:getHistoryByDateRange', (_event, req) => {
    return recordingHistoryService.getHistoryByDateRange(new Date(req.start), new Date(req.end))
  })

  // 添加录制历史
  typedHandle(
    'recording-history:addHistory',
    (_event, recording: Omit<RecordingHistory, 'id' | 'createdAt'>) => {
      return recordingHistoryService.addHistory(recording)
    }
  )

  // 删除历史记录
  typedHandle('recording-history:deleteHistory', (_event, req) => {
    return recordingHistoryService.deleteHistory(req.id)
  })

  // 清空历史记录
  typedHandle('recording-history:clearHistory', () => {
    recordingHistoryService.clearHistory()
  })

  // 生成缩略图
  typedHandle('recording-history:generateThumbnail', async (_event, req) => {
    return await recordingHistoryService.generateThumbnail(req.videoPath)
  })

  // 更新缩略图
  typedHandle('recording-history:updateThumbnail', async (_event, req) => {
    return await recordingHistoryService.updateThumbnail(req.id)
  })

  // 获取统计信息
  typedHandle('recording-history:getStatistics', () => {
    return recordingHistoryService.getStatistics()
  })

  // 打开文件
  typedHandle('recording-history:openFile', async (_event, req) => {
    try {
      const target = safeOpenablePath(req.filePath)
      if (!target) return { success: false, error: 'File not found' }
      await shell.openPath(target)
      return { success: true }
    } catch (error) {
      console.error('打开文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })

  /**
   * 回放读文件（2026-09-23 补）：PlaybackPanel 要把录像读进内存再挂 blob URL。
   * 路径来自渲染端，所以只认「录制历史里记过的路径」——否则这条通道就是任意文件读取。
   *
   * ⚠ 刻意留在 ipc-contract 之外：preload 侧用裸 ipcRenderer.invoke + 位置参数
   * （见 src/preload/index.ts 的 video.readFile），两边形状一致。收进契约是另一件事。
   */
  ipcMain.handle('video:readFile', async (_event, filePath: string): Promise<ArrayBuffer> => {
    const known = recordingHistoryService.getHistory().some((r) => r.filePath === filePath)
    if (!known) throw new Error('只能读取录制历史中记录的录像文件')
    const buf = await readFile(filePath)
    return new Uint8Array(buf).buffer as ArrayBuffer
  })

  // 在文件夹中显示文件
  typedHandle('recording-history:showInFolder', async (_event, req) => {
    try {
      shell.showItemInFolder(req.filePath)
      return { success: true }
    } catch (error) {
      console.error('显示文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
