import { ipcMain, shell } from 'electron'
import { readFile, stat } from 'node:fs/promises'
import { RecordingHistoryService, type RecordingHistory } from '../services/RecordingHistoryService'
import { safeOpenablePath } from '../utils/openPathGuard'
import { resolveGrantedRecordingPath } from './recordingSavePathGrants'
import { typedHandle } from './typedIpc'

/**
 * 整段读入内存的上限：超过直接拒绝。
 * 回放已改走 video:// 流式加载（Range 分片），此通道仅为兜底；512MB 上限
 * 曾允许把大录制整块读进主进程内存再经 IPC 克隆（峰值 2-3 倍文件大小），
 * 收窄到 128MB（约 8 分钟 2.5Mbps 录制）。
 */
const MAX_INLINE_READ_BYTES = 128 * 1024 * 1024

export function registerRecordingHistoryIpcHandlers(): void {
  const recordingHistoryService = RecordingHistoryService.getInstance()

  // 白名单数据源守卫：video:readFile / showInFolder / generateThumbnail 都只认
  // 「录制历史里记过的路径」，所以历史本身不得被渲染端注入任意路径。
  const isKnownRecordingPath = (filePath: unknown): boolean =>
    typeof filePath === 'string' &&
    recordingHistoryService.getHistory().some((r) => r.filePath === filePath)

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
      // 历史行是上面三条通道的白名单数据源：渲染端只能登记主进程当前签发过的
      // 录制路径（saveFile/endWrite 落库时签发尚未撤销）。主进程内部直接调
      // RecordingHistoryService，不经这条 IPC，不受此限。
      // 白名单跟随引擎（P3·B57-14）：mediarecorder=webm；webcodecs 直出 mp4；
      // 导出产物为 mp4/gif
      if (!resolveGrantedRecordingPath(recording?.filePath, ['.webm', '.mp4', '.gif'])) {
        throw new Error('录制路径未经主进程签发，已拒绝登记')
      }
      return recordingHistoryService.addHistory(recording)
    }
  )

  // 删除历史记录
  typedHandle('recording-history:deleteHistory', (_event, req) => {
    return recordingHistoryService.deleteHistory(req.id)
  })

  // 清空历史记录（B57-15：返回布尔供渲染端区分成败）
  typedHandle('recording-history:clearHistory', () => {
    return recordingHistoryService.clearHistory()
  })

  // 生成缩略图
  typedHandle('recording-history:generateThumbnail', async (_event, req) => {
    // 输入必须命中历史行（ffmpeg -i 任意文件 = 解析探针），输出钉在输入同名 .jpg
    if (!isKnownRecordingPath(req?.videoPath)) {
      throw new Error('只能为录制历史中的录像生成缩略图')
    }
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
    if (!isKnownRecordingPath(filePath)) throw new Error('只能读取录制历史中记录的录像文件')
    // 文件头注释承诺的大小上限（此前缺失）：超限走 video:// 流式，不整段进内存
    const st = await stat(filePath)
    if (st.size > MAX_INLINE_READ_BYTES) {
      throw new Error('录制文件过大（>128MB），请改用流式回放')
    }
    const buf = await readFile(filePath)
    return new Uint8Array(buf).buffer
  })

  // 在文件夹中显示文件
  typedHandle('recording-history:showInFolder', async (_event, req) => {
    try {
      // 同文件 openFile 有 safeOpenablePath、这里也得有界：只认历史行，
      // 否则是任意路径存在性探测 + 无限弹 Finder
      if (!isKnownRecordingPath(req?.filePath)) {
        return { success: false, error: '只能显示录制历史中的文件' }
      }
      shell.showItemInFolder(req.filePath)
      return { success: true }
    } catch (error) {
      console.error('显示文件失败:', error)
      return { success: false, error: (error as Error).message }
    }
  })
}
