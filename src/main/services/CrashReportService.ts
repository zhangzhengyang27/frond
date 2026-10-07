/**
 * Frond · 崩溃上报（opt-in）
 *
 * 策略（2026-10-07 拍板，对齐「无账号、无云端」）：
 * - 默认关。开启后 crashReporter 只做**本地收集**（uploadToServer: false）——
 *   没有 SaaS、没有自动上传，转储留在本机 crashDumps 目录。
 * - 下次启动发现新转储时弹一次对话框：诊断摘要进剪贴板 + 一键打开 GitHub
 *   Issue 模板（zhangzhengyang27/frond），发不发由用户决定。
 * - 关闭只停「下次启动不再收集」：Electron 的 crashReporter 没有 stop，
 *   本会话内已启动的收集不撤销（转储仍只落本机，且不再弹提醒）。
 * - crashReporter.start 需要 pref（DB）就绪，所以在 whenReady 里调 startup()，
 *   放弃 ready 之前那小段窗口期的主进程转储（可接受：那段只有协议注册与开库）。
 */
import { app, clipboard, crashReporter, dialog, shell } from 'electron'
import { join } from 'path'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs'
import { release as osRelease } from 'os'
import type { CrashReportStatus } from '../../shared/types'
import { preferencesStore } from '../stores'
import { log } from './LogService'
import {
  CRASH_STATE_FILENAME,
  buildDiagnosticSummary,
  buildIssueTitle,
  buildIssueUrl,
  diffPendingDumps,
  isDumpFile,
  parseState,
  pruneSeen,
  serializeState,
  type CrashDumpInfo
} from './crashReportCore'

const ISSUES_BASE_URL = 'https://github.com/zhangzhengyang27/frond'

let reporterStarted = false

const stateFilePath = (): string => join(app.getPath('userData'), CRASH_STATE_FILENAME)

function listDumps(): CrashDumpInfo[] {
  const dir = app.getPath('crashDumps')
  try {
    return readdirSync(dir)
      .filter(isDumpFile)
      .map((file) => {
        const st = statSync(join(dir, file))
        return { file, sizeBytes: st.size, modifiedAt: st.mtimeMs }
      })
  } catch {
    // 目录不存在（从未崩溃过）按空处理
    return []
  }
}

function loadState(): { seen: string[] } {
  try {
    return parseState(readFileSync(stateFilePath(), 'utf-8'))
  } catch {
    return { seen: [] }
  }
}

function saveState(seen: string[]): void {
  try {
    mkdirSync(app.getPath('userData'), { recursive: true })
    writeFileSync(stateFilePath(), serializeState({ seen }), 'utf-8')
  } catch (e) {
    log.warn('crash', `状态文件写入失败: ${(e as Error).message}`)
  }
}

function diagnosticSummary(dumps: CrashDumpInfo[]): string {
  return buildDiagnosticSummary({
    appVersion: app.getVersion(),
    electronVersion: process.versions.electron ?? '',
    platform: process.platform,
    arch: process.arch,
    osRelease: osRelease(),
    locale: app.getLocale(),
    optIn: preferencesStore.getCrashReportOptIn(),
    dumps,
    userDataDir: app.getPath('userData'),
    crashDumpsDir: app.getPath('crashDumps')
  })
}

/** 开关打开才启动收集；重复开启无害（reporterStarted 挡住） */
function ensureReporter(): void {
  if (reporterStarted) return
  try {
    crashReporter.start({ uploadToServer: false, compress: true })
    reporterStarted = true
    log.info('crash', 'crashReporter 已启动（仅本地收集，无自动上传）')
  } catch (e) {
    log.warn('crash', `crashReporter 启动失败: ${(e as Error).message}`)
  }
}

function getStatus(): CrashReportStatus {
  const pending = diffPendingDumps(listDumps(), loadState().seen)
  return { optIn: preferencesStore.getCrashReportOptIn(), pendingCount: pending.length }
}

function setOptIn(enabled: boolean): CrashReportStatus {
  const next = enabled === true
  preferencesStore.setCrashReportOptIn(next)
  if (next) ensureReporter()
  log.info('crash', `崩溃收集${next ? '已开启' : '已关闭'}`)
  return getStatus()
}

/** 诊断摘要进剪贴板（不进 URL）+ 打开 Issue 模板 */
function openIssueTemplate(): { ok: boolean; error?: string } {
  try {
    const summary = diagnosticSummary(listDumps())
    const title = buildIssueTitle({
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch
    })
    clipboard.writeText(summary)
    void shell.openExternal(buildIssueUrl(ISSUES_BASE_URL, title))
    log.info('crash', '已复制诊断摘要并打开 Issue 模板')
    return { ok: true }
  } catch (e) {
    log.warn('crash', `打开 Issue 模板失败: ${(e as Error).message}`)
    return { ok: false, error: (e as Error).message }
  }
}

/** 主进程级进程异常退出观察者：进 LogService（诊断时随导出日志可见） */
function installProcessObservers(): void {
  app.on('child-process-gone', (_event, details) => {
    log.error(
      'crash',
      `子进程异常退出: ${details.type} reason=${details.reason} exitCode=${details.exitCode}`
    )
  })
  app.on('render-process-gone', (_event, _contents, details) => {
    log.error('crash', `渲染进程异常退出: reason=${details.reason} exitCode=${details.exitCode}`)
  })
}

/** whenReady（数据库就绪后）调用：开过收集就启动 reporter + 挂进程观察者 */
function startup(): void {
  if (preferencesStore.getCrashReportOptIn()) ensureReporter()
  installProcessObservers()
}

/** 启动收尾（托盘/快捷键之后）调用：发现上次运行的新转储时提醒一次 */
async function notifyPendingCrashes(): Promise<void> {
  const dumps = listDumps()
  const survivingSeen = pruneSeen(dumps, loadState().seen)
  const pending = diffPendingDumps(dumps, survivingSeen)
  if (pending.length === 0) {
    saveState(survivingSeen)
    return
  }
  const allSeen = [...survivingSeen, ...pending.map((d) => d.file)]
  // 没开收集 / e2e 环境都不打扰用户，但这批要记成已见：否则将来开启收集后
  // 会把历史遗留转储当成新崩溃误报
  if (!preferencesStore.getCrashReportOptIn() || process.env.FROND_E2E === '1') {
    saveState(allSeen)
    return
  }
  try {
    const summary = diagnosticSummary(dumps)
    const title = buildIssueTitle({
      appVersion: app.getVersion(),
      platform: process.platform,
      arch: process.arch
    })
    const { response } = await dialog.showMessageBox({
      type: 'warning',
      title: 'Frond 异常退出',
      message: `检测到 ${pending.length} 份崩溃记录`,
      detail: '可以把诊断信息发到 GitHub 帮助修复，也可以只复制信息稍后处理。',
      buttons: ['打开 Issue 页面', '复制诊断信息', '忽略'],
      defaultId: 0,
      cancelId: 2,
      noLink: true
    })
    if (response === 0 || response === 1) clipboard.writeText(summary)
    if (response === 0) await shell.openExternal(buildIssueUrl(ISSUES_BASE_URL, title))
    saveState(allSeen)
  } catch (e) {
    // 弹窗失败（如应用正在退出）不标记，下次启动再问一次
    log.warn('crash', `崩溃提醒弹窗失败: ${(e as Error).message}`)
  }
}

export const crashReport = {
  getStatus,
  setOptIn,
  openIssueTemplate,
  startup,
  notifyPendingCrashes
}
