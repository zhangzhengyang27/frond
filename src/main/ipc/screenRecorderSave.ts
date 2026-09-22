import { app, ipcMain } from 'electron'
import {
  writeFileSync,
  statSync,
  createWriteStream,
  existsSync,
  unlinkSync,
  type WriteStream
} from 'fs'
import { basename } from 'path'
import { RecordingHistoryService } from '../services/RecordingHistoryService'
import { MarkerService } from '../services/MarkerService'
import { recordingSegmentRepository } from '../db/repos/RecordingSegmentRepository'
import { recordingRepository } from '../db/repos/RecordingRepository'
import { resolveGrantedRecordingPath, revokeRecordingSavePath } from './recordingSavePathGrants'

interface WriteSession {
  ws: WriteStream
  /** 流打开后发生的写错误；appendChunk / endWrite 据此返回失败而不是静默丢数据 */
  error: Error | null
}

/** 活跃的分片写盘会话：规范化路径 → 会话 */
const activeWriteSessions = new Map<string, WriteSession>()

function finalizeSavedFile(
  filePath: string,
  duration?: number,
  recordingId?: string
): { success: true; filePath: string; historyId: string } {
  const recordingHistoryService = RecordingHistoryService.getInstance()
  const filename = basename(filePath)
  const stats = statSync(filePath)

  // PR-3: 如果有 recordingId，优先以录制段聚合时长为准（扣除暂停）
  let finalDurationSeconds = duration || 0
  if (recordingId) {
    const totalMs = recordingSegmentRepository.totalDurationMs(recordingId)
    if (totalMs > 0) {
      finalDurationSeconds = Math.floor(totalMs / 1000)
    }
    // 同步：写回 file_path / file_size / duration_ms / status / ended_at 到 SQLite
    try {
      recordingRepository.finalize(recordingId, {
        file_path: filePath,
        file_size: stats.size,
        duration_ms: finalDurationSeconds * 1000,
        ended_at: Date.now(),
        status: 'completed'
      })
    } catch (e) {
      console.warn('[screenRecorderSave] finalize SQLite failed:', e)
    }
    // 关闭最后一个 open 段（如有）
    const open = recordingSegmentRepository.findOpen(recordingId)
    if (open) recordingSegmentRepository.close(open.id)
  }

  const historyItem = recordingHistoryService.addHistory({
    filename,
    filePath,
    duration: finalDurationSeconds,
    fileSize: stats.size
  })

  // 如果提供了 recordingId，将标记从临时ID迁移到历史记录ID
  if (recordingId) {
    const migrated = MarkerService.getInstance().migrateMarkers(recordingId, historyItem.id)
    if (migrated) {
      console.log(`标记迁移成功: ${recordingId} -> ${historyItem.id}`)
    }
  }

  // 异步生成缩略图（不阻塞保存流程）
  recordingHistoryService
    .updateThumbnail(historyItem.id)
    .then((thumbnail) => {
      if (thumbnail) {
        console.log('缩略图自动生成成功:', thumbnail)
      } else {
        console.warn('缩略图自动生成失败，用户可以在历史记录中手动生成')
      }
    })
    .catch((error) => {
      console.error('自动生成缩略图时出错:', error)
    })

  revokeRecordingSavePath(filePath)
  return { success: true, filePath, historyId: historyItem.id }
}

/** 等待写流真正打开：createWriteStream 的 open 失败是异步 error 事件，try/catch 接不到 */
function openWriteStream(filePath: string): Promise<WriteStream> {
  return new Promise((resolve, reject) => {
    const ws = createWriteStream(filePath)
    const onOpen = (): void => {
      ws.off('error', onError)
      resolve(ws)
    }
    const onError = (err: Error): void => {
      ws.off('open', onOpen)
      reject(err)
    }
    ws.once('open', onOpen)
    ws.once('error', onError)
  })
}

function endStream(ws: WriteStream): Promise<void> {
  return new Promise((resolve, reject) => {
    ws.end((err?: Error | null) => (err ? reject(err) : resolve()))
  })
}

/** 应用退出：把仍在写的分片流收尾，避免最后一批数据丢失 */
async function flushActiveSessionsOnQuit(): Promise<void> {
  const sessions = [...activeWriteSessions.entries()]
  activeWriteSessions.clear()
  await Promise.all(
    sessions.map(async ([path, session]) => {
      try {
        await endStream(session.ws)
      } catch (error) {
        console.warn('[screenRecorderSave] flush on quit failed:', path, error)
      }
    })
  )
}

let quitHookInstalled = false

export function registerScreenRecorderSaveIpcHandlers(): void {
  if (!quitHookInstalled) {
    quitHookInstalled = true
    app.on('will-quit', (event) => {
      if (activeWriteSessions.size === 0) return
      event.preventDefault()
      void flushActiveSessionsOnQuit().finally(() => app.quit())
    })
  }

  // ── 分片流式写盘（长录制内存 O(1)，替代一次性 IPC 传整段视频） ──
  ipcMain.handle('screen-recorder:beginWrite', async (_event, filePath: string) => {
    const target = resolveGrantedRecordingPath(filePath)
    if (!target) {
      return { ok: false, error: 'refused: path was not issued by the main process' }
    }
    try {
      const existing = activeWriteSessions.get(target)
      if (existing) {
        activeWriteSessions.delete(target)
        await endStream(existing.ws).catch(() => undefined)
      }
      const ws = await openWriteStream(target)
      const session: WriteSession = { ws, error: null }
      // 打开后的写错误必须有监听者，否则会以 uncaughtException 形式抛到进程级
      ws.on('error', (err) => {
        session.error = err
        console.error('[screenRecorderSave] write stream error:', target, err)
      })
      activeWriteSessions.set(target, session)
      return { ok: true }
    } catch (error) {
      console.error('[screenRecorderSave] beginWrite failed:', error)
      return { ok: false, error: (error as Error).message }
    }
  })

  ipcMain.handle(
    'screen-recorder:appendChunk',
    async (_event, filePath: string, chunk: Uint8Array) => {
      const target = resolveGrantedRecordingPath(filePath)
      const session = target ? activeWriteSessions.get(target) : undefined
      if (!session) return { ok: false, error: 'no active write session' }
      if (session.error) return { ok: false, error: session.error.message }
      try {
        const nodeBuffer = Buffer.from(chunk)
        await new Promise<void>((resolve, reject) => {
          session.ws.write(nodeBuffer, (err) => (err ? reject(err) : resolve()))
        })
        return { ok: true }
      } catch (error) {
        console.error('[screenRecorderSave] appendChunk failed:', error)
        return { ok: false, error: (error as Error).message }
      }
    }
  )

  // 中止写盘会话：关闭流并删除半截文件，不写历史（写盘出错/启动失败时用）
  ipcMain.handle('screen-recorder:abortWrite', async (_event, filePath: string) => {
    const target = resolveGrantedRecordingPath(filePath)
    const session = target ? activeWriteSessions.get(target) : undefined
    if (!target || !session) return { ok: false }
    activeWriteSessions.delete(target)
    await endStream(session.ws).catch(() => undefined)
    try {
      if (existsSync(target)) unlinkSync(target)
    } catch {
      // 删除失败保留现场
    }
    revokeRecordingSavePath(target)
    return { ok: true }
  })

  ipcMain.handle(
    'screen-recorder:endWrite',
    async (_event, filePath: string, duration?: number, recordingId?: string) => {
      const target = resolveGrantedRecordingPath(filePath)
      const session = target ? activeWriteSessions.get(target) : undefined
      if (!target || !session) return { success: false, error: 'no active write session' }
      activeWriteSessions.delete(target)
      try {
        await endStream(session.ws)
        if (session.error) throw session.error
        return finalizeSavedFile(target, duration, recordingId)
      } catch (error) {
        console.error('[screenRecorderSave] endWrite failed:', error)
        return { success: false, error: (error as Error).message }
      }
    }
  )

  // 保存录制文件（一次性写盘：旧链路兜底，渲染端优先走上面的分片写盘）
  ipcMain.handle(
    'screen-recorder:saveFile',
    async (
      _event,
      filePath: string,
      buffer: Uint8Array,
      duration?: number,
      recordingId?: string
    ) => {
      const target = resolveGrantedRecordingPath(filePath)
      if (!target) {
        return { success: false, error: 'refused: path was not issued by the main process' }
      }
      try {
        const nodeBuffer = Buffer.from(buffer)
        writeFileSync(target, nodeBuffer)
        return finalizeSavedFile(target, duration, recordingId)
      } catch (error) {
        console.error('保存录制文件失败:', error)
        return { success: false, error: (error as Error).message }
      }
    }
  )
}

