/**
 * Frond · 录制 IPC（新通道）
 *
 * 通道集合：recording.list / get / delete / markers.* / settings.* / recovery.*
 *
 * 设计边界：
 * - 本文件**仅新增** typedHandle 注册；不动现有 screen-recorder:* / recording-history:* /
 *   recording-settings:*（这三条保留 6 个月，由 §6 实施计划逐步切换）
 * - 渲染端调用：window.api.recording.list(...) 等
 * - 业务实现全部走 SQLite Repository，不依赖 RecordingHistoryServiceLegacy
 */

import { randomUUID } from 'node:crypto'
import { existsSync, statSync, unlinkSync } from 'node:fs'
import {
  recordingRepository,
  type RecordingFilter,
  type RecordingRow
} from '../db/repos/RecordingRepository'
import { recordingSegmentRepository } from '../db/repos/RecordingSegmentRepository'
import {
  recordingSettingsRepository,
  type RecordingDefaultSettings
} from '../db/repos/RecordingSettingsRepository'
import { segmentService } from '../services/recording/SegmentService'
import { RegionOverlay, listDisplays } from '../services/recording/RegionOverlay'
import { CursorTracker } from '../services/recording/CursorTracker'
import { probeSystemAudio } from '../services/recording/systemAudioPatterns'
import {
  RecordingExportService,
  ensureExtension
} from '../services/recording/RecordingExportService'
import {
  GlobalShortcutService,
  SettingsRepoShortcutsStore
} from '../services/recording/GlobalShortcutService'
import { CountdownService } from '../services/recording/CountdownService'
import { getRecoveryManager } from '../services/recording/RecoveryManager'
import { resolveGrantedRecordingPath } from './recordingSavePathGrants'
import type { BrowserWindow } from 'electron'
import type { RecordingSummary } from '../../shared/ipc-contract'
import { typedHandle } from './typedIpc'

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
 * 绑定到 event，业务字段全为 undefined——这里剥掉 event 再传业务参数。
 *
 * 返回类型写 `Promise<Awaited<TResult>>` 而不是 `Promise<TResult>`：handler 本身
 * 常是 async（TResult 已是 Promise），再套一层就成了 `Promise<Promise<T>>`，
 * 与实际运行值（只 await 一次）不符，会让 typedHandle 的返回类型校验失败。 */
function wrap<TArgs extends unknown[], TResult>(
  handler: (...args: TArgs) => TResult
): (_event: Electron.IpcMainInvokeEvent, ...payload: TArgs) => Promise<Awaited<TResult>> {
  return async (_event, ...payload): Promise<Awaited<TResult>> => {
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
  typedHandle(
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

  typedHandle(
    'recording.get',
    wrap((req: { id: string }) => {
      const row = recordingRepository.findById(req.id)
      return { recording: row ? toSummary(row) : null }
    })
  )

  typedHandle(
    'recording.delete',
    wrap((req: { id: string; hard?: boolean; deleteFile?: boolean }) => {
      // 先取行（softDelete 后 findById 因 deleted_at 过滤取不到），再删行删文件
      const row = req.deleteFile ? recordingRepository.findById(req.id) : null
      if (req.hard) {
        recordingRepository.hardDelete(req.id)
      } else {
        recordingRepository.softDelete(req.id)
      }
      // B57-14：兑现契约承诺的 deleteFile——物理文件一并删除（行已删，文件幂等）
      if (req.deleteFile && row?.file_path && existsSync(row.file_path)) {
        try {
          unlinkSync(row.file_path)
        } catch (e) {
          // 行已删；文件删不掉（占用/权限）只告警，不回滚行
          console.warn('[recording.delete] unlink failed:', e)
        }
      }
      return { ok: true }
    })
  )

  // ── Settings ───────────────────────────────────────────────
  typedHandle(
    'recording.settings.get',
    wrap((): RecordingDefaultSettings => recordingSettingsRepository.get())
  )

  typedHandle(
    'recording.settings.patch',
    wrap((req: Partial<RecordingDefaultSettings>): RecordingDefaultSettings =>
      recordingSettingsRepository.patch(req)
    )
  )

  typedHandle(
    'recording.settings.reset',
    wrap((): RecordingDefaultSettings => recordingSettingsRepository.reset())
  )

  // ── Recovery ───────────────────────────────────────────────
  typedHandle(
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

  // 恢复对话框的两个动作。实现一直在 RecoveryManager 里（D4：孤儿行扫描 +
  // fMP4 原地截断恢复 + 行级精确 discard），注册被恢复事故吞掉后：
  // scan 列得出来、按钮按下去永远 reject。
  typedHandle(
    'recording.recovery.recover',
    wrap(async (req: { filePath: string; recordingId?: string }) =>
      getRecoveryManager().recover({ filePath: req.filePath, recordingId: req.recordingId })
    )
  )

  typedHandle(
    'recording.recovery.discard',
    wrap((req: { filePath?: string; recordingId?: string }) =>
      getRecoveryManager().discard({ filePath: req.filePath, recordingId: req.recordingId })
    )
  )

  // ── Segments（PR-3 暂停/恢复） ──────────────────────────────
  // 注意：recordingId 参数直接传入（renderer 端已生成 UUID），无需后端分配
  // 段序号（seg_index）由 RecordingSegmentRepository 自动维护
  typedHandle(
    'recording.segments.open',
    wrap((req: { recordingId: string }) => {
      const row = segmentService.openSegment(req.recordingId)
      return { segmentId: row.id, segIndex: row.seg_index, startedAt: row.started_at }
    })
  )

  typedHandle(
    'recording.segments.close',
    wrap((req: { recordingId: string; segmentId?: number }) => {
      return segmentService.closeOpenSegment(req.recordingId, req.segmentId)
    })
  )

  typedHandle(
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

  typedHandle(
    'recording.segments.totalDuration',
    wrap((req: { recordingId: string; asOf?: number }) => {
      const totalMs = recordingSegmentRepository.totalDurationMs(req.recordingId, req.asOf)
      return { totalMs }
    })
  )

  // PR-3: 录制启动时新建 recording 行（status='recording'），返回 id 供 renderer 使用
  typedHandle(
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
  typedHandle(
    'recording.finalize',
    wrap(
      (req: {
        recordingId: string
        finalFilePath: string
        fileSize: number
        durationMs: number
      }) => {
        // B57-2 后半：时长单一真相 = segments 聚合（含暂停扣除）。渲染端自报
        // durationMs 只作无段遗留路径的兜底——cleanup 路径自报 0 不得覆盖
        // segments 已算出的正确时长（双 finalize 互踩封死）。文件大小同理以
        // 磁盘 statSync 为准（渲染端字节数统计可能缺失）
        const row = recordingRepository.findById(req.recordingId)
        const segmentsMs = recordingSegmentRepository.totalDurationMs(req.recordingId)
        const durationMs = segmentsMs > 0 ? segmentsMs : row?.duration_ms || req.durationMs || 0
        let fileSize = req.fileSize
        try {
          const statPath = req.finalFilePath || row?.file_path
          if (statPath && existsSync(statPath)) fileSize = statSync(statPath).size
        } catch (e) {
          console.warn('[recording.finalize] stat size failed:', e)
        }
        recordingRepository.finalize(req.recordingId, {
          file_path: req.finalFilePath || row?.file_path || '',
          file_size: fileSize,
          duration_ms: durationMs,
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
  typedHandle(
    'recording.region.open',
    wrap(async () => {
      try {
        const region = await RegionOverlay.open()
        return { region }
      } catch (e) {
        // 取消统一转 { canceled: true }（B57-14：不再抛 Error 信封）
        if ((e as Error)?.message === 'canceled') return { canceled: true as const }
        throw e
      }
    })
  )

  // PR-6: 在指定显示器内选择
  typedHandle(
    'recording.region.openForDisplay',
    wrap(async (req: { displayId: number }) => {
      try {
        return await RegionOverlay.openForDisplay(req.displayId)
      } catch (e) {
        if ((e as Error)?.message === 'canceled') return { canceled: true as const }
        throw e
      }
    })
  )

  // PR-6: 跨所有显示器一次性框选
  typedHandle(
    'recording.region.openCrossDisplay',
    wrap(async () => {
      try {
        return await RegionOverlay.openCrossDisplay()
      } catch (e) {
        if ((e as Error)?.message === 'canceled') return { canceled: true as const }
        throw e
      }
    })
  )

  // PR-6: 列出所有显示器
  typedHandle(
    'recording.region.listDisplays',
    wrap(() => {
      return listDisplays()
    })
  )

  // 程序主动关闭 overlay（防 race）
  typedHandle(
    'recording.region.cancel',
    wrap(() => {
      RegionOverlay.cancel()
      return { ok: true as const }
    })
  )

  // 系统音频探测（renderer 已先请求了 getUserMedia，把 audio track label 传回来做匹配）
  // 平台无关的"系统音频"探测：检查 label 是否匹配常见虚拟设备名
  // 返回：{ available: boolean, matches: string[], recommendedDeviceId?: string }
  typedHandle(
    'recording.systemAudio.probe',
    wrap((req: { devices: Array<{ kind: string; deviceId: string; label: string }> }) => {
      return probeSystemAudio(req.devices)
    })
  )

  // PR-4: cursor 追踪（renderer 调用以开始/结束光圈推送）
  // 不走 wrap()：需要拿到 IpcMainInvokeEvent.webContents.id
  typedHandle('recording.cursor.start', (e) => {
    CursorTracker.start(e.sender.id)
    return { ok: true as const }
  })
  typedHandle('recording.cursor.stop', (e) => {
    CursorTracker.stop(e.sender.id)
    return { ok: true as const }
  })

  // PR-5b + PR-6 + PR-7c: 单录制导出（含可选 intro/outro/bgm/transition/fade/gif）
  typedHandle(
    'recording.export.start',
    wrap(
      (req: {
        recordingId: string
        sourcePath: string
        outputPath: string
        format: 'mp4' | 'webm' | 'gif'
        resolution: 720 | 1080 | 1440 | 2160
        fps: 30 | 60
        videoBitrateKbps?: number | undefined
        audioBitrateKbps?: number | undefined
        // PR-6:
        introPath?: string | undefined
        outroPath?: string | undefined
        backgroundMusic?: { path: string; volume?: number } | undefined
        transition?: 'fade' | 'cut' | 'slide' | undefined
        fadeDurationSec?: number | undefined
        // PR-7c:
        gifPreset?: 'compact' | 'standard' | 'high' | undefined
      }) => {
        // 输出路径必须由主进程签发（selectSavePath / getDefaultSavePath），否则
        // ffmpeg -y 可被用来覆盖任意文件——与 clip:exportClips 同一口径。
        // B57-4b：校验对象是 ensureExtension 之后的**实际写盘路径**——旧实现校验
        // 原始路径、service 内部改扩展名，签发校验可被「a.mp4 + format=gif」绕过
        const exportOutputPath = ensureExtension(req.outputPath, req.format)
        if (!resolveGrantedRecordingPath(exportOutputPath, ['.mp4', '.webm', '.gif'])) {
          throw new Error('导出路径未经主进程签发，已拒绝')
        }
        // 输入路径只认录制历史登记过的文件（B48）：否则任意文件可被 ffmpeg 转码进
        // 「合法」输出并经 video:readFile 回读 = 任意文件读取链。将来 §6 接线若需
        // 放行分段源文件，白名单须同步扩到 rec_segments 的已登记路径
        if (!recordingRepository.findByFilePath(req.sourcePath)) {
          throw new Error('sourcePath 不是录制历史中记录的录像文件，已拒绝')
        }
        // B57-4a：intro/outro/BGM 走同一条任意文件读取链（ffmpeg -i 拼进产物回读），
        // 只认登记录像或主进程签发路径（当前无 UI 挂载，收紧无 UX 影响；未来 UI
        // 须经文件对话框签发后再传入）
        const mediaInputs = [req.introPath, req.outroPath, req.backgroundMusic?.path]
        for (const p of mediaInputs) {
          if (!p) continue
          if (
            !recordingRepository.findByFilePath(p) &&
            !resolveGrantedRecordingPath(p, ['.mp4', '.webm'])
          ) {
            throw new Error('intro/outro/BGM 只能引用登记的录像文件或主进程签发的路径，已拒绝')
          }
        }
        // B57-14：数值运行时校验——负数/NaN 码率会被拼进 ffmpeg 参数（-5k）致导出失败
        const positiveOpt = (n: number | undefined): boolean =>
          n === undefined || (Number.isFinite(n) && n > 0)
        if (!positiveOpt(req.videoBitrateKbps) || !positiveOpt(req.audioBitrateKbps)) {
          throw new Error('码率必须为正数')
        }
        if (req.fps !== 30 && req.fps !== 60) {
          throw new Error('fps 仅支持 30/60')
        }
        if (![720, 1080, 1440, 2160].includes(req.resolution)) {
          throw new Error('分辨率仅支持 720/1080/1440/2160')
        }
        const jobId = randomUUID()
        const svc = exportService
        const ac = new AbortController()
        activeExports.set(jobId, { ac, recordingId: req.recordingId })
        void svc
          .export(
            {
              sourcePath: req.sourcePath,
              outputPath: exportOutputPath,
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
            // 成功路径同样清账（B48）：此前只有 .catch 与 cancel 清理，常驻进程
            // 每次成功导出泄漏一条 { AbortController, recordingId }
            activeExports.delete(jobId)
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

  typedHandle(
    'recording.export.cancel',
    wrap((req: { jobId: string }) => {
      const job = activeExports.get(req.jobId)
      if (!job) return { ok: false }
      job.ac.abort()
      activeExports.delete(req.jobId)
      return { ok: true }
    })
  )

  typedHandle(
    'recording.export.getInfo',
    wrap(async (req: { filePath: string }) => {
      // 白名单守卫（B48）：ffmpeg probe 只认录制历史登记过的文件——否则任意路径
      // 的存在性/格式都能被渲染端探测（同文件 generateThumbnail/video:readFile 同口径）
      if (!recordingRepository.findByFilePath(req.filePath)) {
        throw new Error('只能探测录制历史中记录的录像文件')
      }
      const sec = await exportService.probeDurationSec(req.filePath)
      return { ok: sec !== null, durationSec: sec ?? undefined }
    })
  )

  // ── PR-7a: 全局快捷键 ─────────────────────────────────────
  typedHandle(
    'recording.shortcut.getConfig',
    wrap(() => shortcutService.getConfig())
  )
  typedHandle(
    'recording.shortcut.setConfig',
    wrap((req: { enabled?: boolean; start?: string; togglePause?: string }) =>
      shortcutService.setConfig(req)
    )
  )
  typedHandle(
    'recording.shortcut.registered',
    wrap(() => ({ accels: shortcutService.registeredList() }))
  )

  // PR-7a: shortcut 实际注册 — renderer attach 后通过 IPC 推回调
  // 这里用一个 internal handler for "renderer attach"（window.onload 单次调用）
  typedHandle(
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
  typedHandle(
    'recording.shortcut.detach',
    wrap(() => {
      shortcutService.detach()
      return { ok: true }
    })
  )

  // PR-7a: togglePause —— 转发为 renderer 事件（preload → frond:shortcut-togglePause →
  // Layout → RecordPage 调单例 togglePause）。旧实现是空 handler，快捷键按了没效果。
  typedHandle(
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
  typedHandle(
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
  typedHandle(
    'recording.countdown.cancel',
    wrap(() => {
      if (countdownService) countdownService.cancel()
      return { ok: true as const }
    })
  )
}
