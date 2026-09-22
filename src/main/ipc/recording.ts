/**
 * Leaf · 录制 IPC（新通道）
 *
 * 通道集合：recording.list / get / delete / markers.* / settings.* / recovery.*
 *
 * 设计边界：
 * - 本文件**仅新增** ipcMain.handle 注册；不动现有 screen-recorder:* / recording-history:* /
 *   recording-settings:*（这三条保留 6 个月，由 §6 实施计划逐步切换）
 * - 渲染端调用：window.api.recording.list(...) 等
 * - 业务实现全部走 SQLite Repository，不依赖 RecordingHistoryServiceLegacy
 */

import { ipcMain } from 'electron'
import { randomUUID } from 'node:crypto'
import {
  recordingRepository,
  type RecordingFilter,
  type RecordingRow
} from '../db/repos/RecordingRepository'
import { markerRepository } from '../db/repos/MarkerRepository'
import { recordingSegmentRepository } from '../db/repos/RecordingSegmentRepository'
import {
  recordingSettingsRepository,
  type RecordingDefaultSettings
} from '../db/repos/RecordingSettingsRepository'
import { segmentService } from '../services/recording/SegmentService'
import { RegionOverlay, listDisplays } from '../services/recording/RegionOverlay'
import { CursorTracker } from '../services/recording/CursorTracker'
import { probeSystemAudio } from '../services/recording/systemAudioPatterns'
import { RecordingExportService } from '../services/recording/RecordingExportService'
import {
  GlobalShortcutService,
  SettingsRepoShortcutsStore
} from '../services/recording/GlobalShortcutService'
import { CountdownService } from '../services/recording/CountdownService'
import { getRecoveryManager } from '../services/recording/RecoveryManager'
import type { BrowserWindow } from 'electron'
import type { RecordingSummary } from '../../shared/ipc-contract'

/** RecordingRow (snake_case) → RecordingSummary (camelCase) */
function toSummary(row: RecordingRow): RecordingSummary {
  return {
    id: row.id,
    filePath: row.file_path,
    fileName: row.file_name,
    durationMs: row.duration_ms,
    fileSize: row.file_size,
    width: row.width,
    height: row.height,
    fps: row.fps,
    hasCamera: row.has_camera === 1,
    hasMic: row.has_mic === 1,
    hasSystemAudio: row.has_system_audio === 1,
    status: row.status,
    quality: row.quality,
    cursorStyle: row.cursor_style,
    startedAt: row.started_at,
    endedAt: row.ended_at,
    recoveredAt: row.recovered_at,
    thumbnailPath: row.thumbnail_path,
    description: row.description
  }
}

/** 通用 wrap：异常 → console.error + 重抛（支持同步和异步 handler）。
 * ipcMain.handle 回调签名是 (event, ...payload)：此前单参 handler 的 req
 * 绑定到 event，业务字段全为 undefined——这里剥掉 event 再传业务参数 */
function wrap<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => TResult
): (_event: Electron.IpcMainInvokeEvent, ...payload: TArgs) => Promise<TResult> {
  return async (_event, ...payload) => {
    try {
      return await handler(...payload)
    } catch (err) {
      console.error('[recording IPC] error:', err)
      throw err
    }
  }
}

// PR-5b: 导出服务单例 + 活动 jobs
const exportService = new RecordingExportService()
const activeExports = new Map<string, { ac: AbortController; recordingId: string }>()
// 使用 getter 按需获取窗口引用，避免 setInterval 轮询泄漏
let getMainWindowFn: (() => BrowserWindow | null) | null = null
// PR-7a/b: shortcut + countdown
// 传入持久化 store（落 rec_settings.shortcuts），否则用户自定义快捷键重启即丢
const shortcutService = new GlobalShortcutService(undefined, new SettingsRepoShortcutsStore())
let countdownService: CountdownService | null = null

export function registerRecordingIpcHandlers(getMainWindow?: () => BrowserWindow | null): void {
  // PR-5b: 保存 mainWindow getter，导出进度推送需要
  if (getMainWindow) {
    getMainWindowFn = getMainWindow
    countdownService = new CountdownService(getMainWindow)
  }

  // PR-7a: 加载持久化快捷键配置（不注册，直到有 renderer attach 回调）
  shortcutService.load()
  // ── Library ────────────────────────────────────────────────
  ipcMain.handle(
    'recording.list',
    wrap((req: { filter?: RecordingFilter; limit?: number; offset?: number }) => {
      const filter: RecordingFilter = {}
      if (req.filter?.status) filter.status = req.filter.status
      if (req.filter?.search) filter.search = req.filter.search
      if (typeof req.filter?.sinceMs === 'number') filter.sinceMs = req.filter.sinceMs
      if (typeof req.filter?.untilMs === 'number') filter.untilMs = req.filter.untilMs

      const items = recordingRepository
        .list({ filter, limit: req.limit, offset: req.offset })
        .map(toSummary)
      const total = recordingRepository.count(filter)
      return { items, total }
    })
  )

  ipcMain.handle(
    'recording.get',
    wrap((req: { id: string }) => {
      const row = recordingRepository.findById(req.id)
      return { recording: row ? toSummary(row) : null }
    })
  )

  ipcMain.handle(
    'recording.delete',
    wrap((req: { id: string; hard?: boolean; deleteFile?: boolean }) => {
      if (req.hard) {
        recordingRepository.hardDelete(req.id)
      } else {
        recordingRepository.softDelete(req.id)
      }
      // 物理文件删除留由调用方（渲染层 / 后台调度器）决定；此处不引入 fs
      return { ok: true }
    })
  )

  // ── Markers ────────────────────────────────────────────────
  ipcMain.handle(
    'recording.markers.list',
    wrap((req: { recordingId: string }) => {
      const items = markerRepository.listByRecording(req.recordingId).map((m) => ({
        id: m.id,
        timeMs: m.time_ms,
        label: m.label,
        createdAt: m.created_at
      }))
      return { items }
    })
  )

  ipcMain.handle(
    'recording.markers.add',
    wrap((req: { recordingId: string; timeMs: number; label?: string | null }) => {
      const markerId = randomUUID()
      markerRepository.add({
        id: markerId,
        recording_id: req.recordingId,
        time_ms: req.timeMs,
        label: req.label ?? null
      })
      return { markerId }
    })
  )

  ipcMain.handle(
    'recording.markers.remove',
    wrap((req: { markerId: string }) => {
      return { ok: markerRepository.remove(req.markerId) }
    })
  )

  ipcMain.handle(
    'recording.markers.rename',
    wrap((req: { markerId: string; label: string }) => {
      return { ok: markerRepository.rename(req.markerId, req.label) }
    })
  )

  // ── Settings ───────────────────────────────────────────────
  ipcMain.handle(
    'recording.settings.get',
    wrap((): RecordingDefaultSettings => recordingSettingsRepository.get())
  )

  ipcMain.handle(
    'recording.settings.patch',
    wrap((req: Partial<RecordingDefaultSettings>): RecordingDefaultSettings =>
      recordingSettingsRepository.patch(req)
    )
  )

  ipcMain.handle(
    'recording.settings.reset',
    wrap((): RecordingDefaultSettings => recordingSettingsRepository.reset())
  )

  // ── Recovery ───────────────────────────────────────────────
  ipcMain.handle(
    'recording.recovery.scan',
    wrap(() => {
      const r = getRecoveryManager().scan()
      return {
        orphans: r.orphans.map((o) => ({
          recordingId: o.recordingId,
          filePath: o.filePath,
          fileSize: o.fileSize,
          mtimeMs: o.mtimeMs
        }))
      }
    })
  )

  // 恢复对话框的两个动作。实现一直在 RecoveryManager 里（recover 认「DB 有行/没行」两种崩法，
  // discard 只删临时片），注册被恢复事故吞掉后：scan 列得出来、按钮按下去永远 reject。
  ipcMain.handle(
    'recording.recovery.recover',
    wrap(async (req: { filePath: string }) => getRecoveryManager().recover(req.filePath))
  )

  ipcMain.handle(
    'recording.recovery.discard',
    wrap((req: { filePath: string }) => getRecoveryManager().discard(req.filePath))
  )

  // ── Segments（PR-3 暂停/恢复） ──────────────────────────────
  // 注意：recordingId 参数直接传入（renderer 端已生成 UUID），无需后端分配
  // 段序号（seg_index）由 RecordingSegmentRepository 自动维护
  ipcMain.handle(
    'recording.segments.open',
    wrap((req: { recordingId: string }) => {
      const row = segmentService.openSegment(req.recordingId)
      return { segmentId: row.id, segIndex: row.seg_index, startedAt: row.started_at }
    })
  )

  ipcMain.handle(
    'recording.segments.close',
    wrap((req: { recordingId: string; segmentId?: number }) => {
      return segmentService.closeOpenSegment(req.recordingId, req.segmentId)
    })
  )

  ipcMain.handle(
    'recording.segments.list',
    wrap((req: { recordingId: string }) => {
      const items = recordingSegmentRepository.listByRecording(req.recordingId).map((s) => ({
        id: s.id,
        segIndex: s.seg_index,
        startedAt: s.started_at,
        endedAt: s.ended_at,
        state: s.state
      }))
      return { items }
    })
  )

  ipcMain.handle(
    'recording.segments.totalDuration',
    wrap((req: { recordingId: string; asOf?: number }) => {
      const totalMs = recordingSegmentRepository.totalDurationMs(req.recordingId, req.asOf)
      return { totalMs }
    })
  )

  // PR-3: 录制启动时新建 recording 行（status='recording'），返回 id 供 renderer 使用
  ipcMain.handle(
    'recording.start',
    wrap((req: { fileName: string; defaultSavePath?: string | null }) => {
      const recordingId = randomUUID()
      recordingRepository.insert({
        id: recordingId,
        file_path: req.defaultSavePath ?? '', // path 真正写入在 saveFile 时
        file_name: req.fileName,
        status: 'recording'
      })
      return { recordingId }
    })
  )

  // PR-3: 录制结束 / 暂停时长合并 → 写回总时长
  ipcMain.handle(
    'recording.finalize',
    wrap(
      (req: {
        recordingId: string
        finalFilePath: string
        fileSize: number
        durationMs: number
      }) => {
        recordingRepository.finalize(req.recordingId, {
          file_path: req.finalFilePath,
          file_size: req.fileSize,
          duration_ms: req.durationMs,
          ended_at: Date.now(),
          status: 'completed'
        })
        // 关闭最后一个 open 段（如果 saveFile 路径未关闭）
        const open = recordingSegmentRepository.findOpen(req.recordingId)
        if (open) recordingSegmentRepository.close(open.id)
        return { ok: true as const }
      }
    )
  )

  // ── PR-4 + PR-6: 区域选择 / 多显示器 ────────────────────────────
  // 透明 overlay 唤起 user 选 region；返回主显示器坐标系下的 {x,y,w,h}
  ipcMain.handle(
    'recording.region.open',
    wrap(async () => {
      const region = await RegionOverlay.open()
      return { region }
    })
  )

  // PR-6: 在指定显示器内选择
  ipcMain.handle(
    'recording.region.openForDisplay',
    wrap(async (req: { displayId: number }) => {
      return await RegionOverlay.openForDisplay(req.displayId)
    })
  )

  // PR-6: 跨所有显示器一次性框选
  ipcMain.handle(
    'recording.region.openCrossDisplay',
    wrap(async () => {
      return await RegionOverlay.openCrossDisplay()
    })
  )

  // PR-6: 列出所有显示器
  ipcMain.handle(
    'recording.region.listDisplays',
    wrap(() => {
      return listDisplays()
    })
  )

  // 程序主动关闭 overlay（防 race）
  ipcMain.handle(
    'recording.region.cancel',
    wrap(() => {
      RegionOverlay.cancel()
      return { ok: true as const }
    })
  )

  // 系统音频探测（renderer 已先请求了 getUserMedia，把 audio track label 传回来做匹配）
  // 平台无关的"系统音频"探测：检查 label 是否匹配常见虚拟设备名
  // 返回：{ available: boolean, matches: string[], recommendedDeviceId?: string }
  ipcMain.handle(
    'recording.systemAudio.probe',
    wrap((req: { devices: Array<{ kind: string; deviceId: string; label: string }> }) => {
      return probeSystemAudio(req.devices)
    })
  )

  // PR-4: cursor 追踪（renderer 调用以开始/结束光圈推送）
  // 不走 wrap()：需要拿到 IpcMainInvokeEvent.webContents.id
  ipcMain.handle('recording.cursor.start', (e) => {
    CursorTracker.start(e.sender.id)
    return { ok: true as const }
  })
  ipcMain.handle('recording.cursor.stop', (e) => {
    CursorTracker.stop(e.sender.id)
    return { ok: true as const }
  })

  // PR-5b + PR-6 + PR-7c: 单录制导出（含可选 intro/outro/bgm/transition/fade/gif）
  ipcMain.handle(
    'recording.export.start',
    wrap(
      (req: {
        recordingId: string
        sourcePath: string
        outputPath: string
        format: 'mp4' | 'webm' | 'gif'
        resolution: 720 | 1080 | 1440 | 2160
        fps: 30 | 60
        videoBitrateKbps?: number
        audioBitrateKbps?: number
        // PR-6:
        introPath?: string
        outroPath?: string
        backgroundMusic?: { path: string; volume?: number }
        transition?: 'fade' | 'cut' | 'slide'
        fadeDurationSec?: number
        // PR-7c:
        gifPreset?: 'compact' | 'standard' | 'high'
      }) => {
        const jobId = randomUUID()
        const svc = exportService
        const ac = new AbortController()
        activeExports.set(jobId, { ac, recordingId: req.recordingId })
        void svc
          .export(
            {
              sourcePath: req.sourcePath,
              outputPath: req.outputPath,
              format: req.format,
              resolution: req.resolution,
              fps: req.fps,
              videoBitrateKbps: req.videoBitrateKbps,
              audioBitrateKbps: req.audioBitrateKbps,
              introPath: req.introPath,
              outroPath: req.outroPath,
              backgroundMusic: req.backgroundMusic,
              transition: req.transition,
              fadeDurationSec: req.fadeDurationSec,
              gifPreset: req.gifPreset
            },
            (p) => {
              const wc = getMainWindowFn?.()?.webContents ?? null
              if (wc && !wc.isDestroyed()) {
                wc.send('recording:export:progress', {
                  jobId,
                  recordingId: req.recordingId,
                  percent: p.percent,
                  message: p.message
                })
              }
            },
            ac.signal
          )
          .then(async (result) => {
            if (result.ok) {
              // 导出只是转码产物：只更新输出路径/大小，绝不能用 finalize 把
              // duration_ms 清零（旧实现传 duration_ms: 0 → 导出后历史时长归零）
              try {
                const row = recordingRepository.findById(req.recordingId)
                if (row) {
                  recordingRepository.finalize(req.recordingId, {
                    file_path: result.outputPath,
                    file_size: result.fileSize,
                    duration_ms: row.duration_ms || 0,
                    ended_at: row.ended_at || Date.now(),
                    status: 'completed'
                  })
                }
              } catch (e) {
                console.warn('[recording.export] finalize update failed:', e)
              }
            }
            const wc = getMainWindowFn?.()?.webContents ?? null
            if (wc && !wc.isDestroyed()) {
              wc.send('recording:export:done', {
                jobId,
                recordingId: req.recordingId,
                ok: result.ok,
                outputPath: result.ok ? result.outputPath : undefined,
                fileSize: result.ok ? result.fileSize : undefined,
                error: result.ok ? undefined : result.error
              })
            }
          })
          .catch((err) => {
            // 无 catch 的话：unhandledRejection + activeExports 条目泄漏 + 渲染端进度框等不到 done
            console.error('[recording.export] job failed:', err)
            activeExports.delete(jobId)
            const wc = getMainWindowFn?.()?.webContents ?? null
            if (wc && !wc.isDestroyed()) {
              wc.send('recording:export:done', {
                jobId,
                recordingId: req.recordingId,
                ok: false,
                error: (err as Error)?.message ?? String(err)
              })
            }
          })
        return { jobId }
      }
    )
  )

  ipcMain.handle(
    'recording.export.cancel',
    wrap((req: { jobId: string }) => {
      const job = activeExports.get(req.jobId)
      if (!job) return { ok: false }
      job.ac.abort()
      activeExports.delete(req.jobId)
      return { ok: true }
    })
  )

  ipcMain.handle(
    'recording.export.getInfo',
    wrap(async (req: { filePath: string }) => {
      const sec = await exportService.probeDurationSec(req.filePath)
      return { ok: sec !== null, durationSec: sec ?? undefined }
    })
  )

  // ── PR-7a: 全局快捷键 ─────────────────────────────────────
  ipcMain.handle(
    'recording.shortcut.getConfig',
    wrap(() => shortcutService.getConfig())
  )
  ipcMain.handle(
    'recording.shortcut.setConfig',
    wrap((req: { enabled?: boolean; start?: string; togglePause?: string }) =>
      shortcutService.setConfig(req)
    )
  )
  ipcMain.handle(
    'recording.shortcut.registered',
    wrap(() => ({ accels: shortcutService.registeredList() }))
  )

  // PR-7a: shortcut 实际注册 — renderer attach 后通过 IPC 推回调
  // 这里用一个 internal handler for "renderer attach"（window.onload 单次调用）
  ipcMain.handle(
    'recording.shortcut.attach',
    wrap(() => {
      const sender = getMainWindowFn?.() ?? null
      if (!sender) return { ok: false }
      shortcutService.attach({
        onStart: () => {
          if (sender && !sender.isDestroyed()) {
            sender.webContents.send('recording:shortcut:start', {})
          }
        },
        onTogglePause: () => {
          if (sender && !sender.isDestroyed()) {
            sender.webContents.send('recording:shortcut:togglePause', {})
          }
        }
      })
      return { ok: true }
    })
  )
  ipcMain.handle(
    'recording.shortcut.detach',
    wrap(() => {
      shortcutService.detach()
      return { ok: true }
    })
  )

  // PR-7a: togglePause —— 转发为 renderer 事件（preload → leaf:shortcut-togglePause →
  // Layout → RecordPage 调单例 togglePause）。旧实现是空 handler，快捷键按了没效果。
  ipcMain.handle(
    'recording.togglePause',
    wrap(() => {
      const win = getMainWindowFn?.() ?? null
      if (win && !win.isDestroyed()) {
        win.webContents.send('recording:shortcut:togglePause', {})
      }
      return { ok: true }
    })
  )

  // ── PR-7b: 倒计时 ─────────────────────────────────────────
  ipcMain.handle(
    'recording.countdown.start',
    wrap((req: { seconds: number; reason: 'recording' }) => {
      if (!countdownService) {
        return { ok: false, error: 'countdown service not ready' }
      }
      const sender = getMainWindowFn?.() ?? null
      const ok = countdownService.start(req.seconds, () => {
        if (sender && !sender.isDestroyed()) {
          sender.webContents.send('recording:countdown:fire', {
            reason: req.reason
          })
        }
      })
      return ok ? { ok: true } : { ok: false, error: 'countdown already active' }
    })
  )
  ipcMain.handle(
    'recording.countdown.cancel',
    wrap(() => {
      if (countdownService) countdownService.cancel()
      return { ok: true as const }
    })
  )
}
