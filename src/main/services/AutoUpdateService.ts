/**
 * Frond · AutoUpdateService（自动更新服务）
 *
 * 封装 electron-updater 6.x API，对外提供 4 个方法：
 * - checkForUpdates()    检查更新（拉远端 version manifest）
 * - downloadUpdate()     下载新版本（不安装）
 * - quitAndInstall()     退出并安装（用户确认后调）
 * - getStatus()          当前状态（idle / checking / available / downloading / downloaded / error）
 *
 * mac 未签名兜底（决策 D2，2026-09-28 落地）：打包态 codesign 探测失败 → 走
 * manual 模式（照 MelodyAir 方案，纯逻辑在 autoUpdateManual.ts）——检查 =
 * GitHub releases/latest 比版本，downloadUpdate = 打开下载页引导手动安装；
 * 将来一旦真签名，codesign 探测通过即自动回到 electron-updater 正道，无需改码。
 *
 * 事件通过 BrowserWindow.webContents.send('update:event', payload) 推给渲染端，
 * 渲染端用 window.api.update.onEvent(cb) 订阅。
 *
 * 来源：docs/MODULE_TIERS.md「1.0 必须补的非功能模块」之「自动更新」。
 * 更新源：electron-builder.yml 的 publish 配置（GitHub Releases provider，
 * 2026-09-24 已由占位 frond-app/frond-desktop 落地为 zhangzhengyang27/frond；
 * manual 模式的仓库常量由 autoUpdateManual.test.ts 与该配置互相钉住）。
 */

import { BrowserWindow, app, shell } from 'electron'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { autoUpdater, ProgressInfo, UpdateInfo } from 'electron-updater'
import { log } from './LogService'
import { GITHUB_LATEST_API, parseLatestRelease, type ManualUpdateInfo } from './autoUpdateManual'
import type { UpdateEvent, UpdateStatus } from '../../renderer/src/types/update'

export type { UpdateEvent, UpdateStatus }

type Listener = (e: UpdateEvent) => void

const listeners = new Set<Listener>()
let currentStatus: UpdateStatus = 'idle'
let cachedInfo: UpdateInfo | null = null
/** manual 模式最近一次检查的结果（downloadUpdate 从这里取下载地址） */
let manualInfo: ManualUpdateInfo | null = null

function broadcast(e: UpdateEvent): void {
  currentStatus = e.status
  log.info(
    'autoUpdate',
    `${e.status}${e.version ? ` v${e.version}` : ''}${e.error ? ` err=${e.error}` : ''}`
  )
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send('update:event', e)
    }
  }
  for (const l of listeners) l(e)
}

function wireAutoUpdater(): void {
  // 不自动下载 — 用户手动触发更友好
  autoUpdater.autoDownload = false
  autoUpdater.autoInstallOnAppQuit = false

  autoUpdater.on('checking-for-update', () => broadcast({ status: 'checking' }))
  autoUpdater.on('update-available', (info: UpdateInfo) => {
    cachedInfo = info
    broadcast({
      status: 'available',
      version: info.version,
      releaseNotes: typeof info.releaseNotes === 'string' ? info.releaseNotes : null
    })
  })
  autoUpdater.on('update-not-available', () => broadcast({ status: 'not-available' }))
  autoUpdater.on('download-progress', (progress: ProgressInfo) =>
    broadcast({ status: 'downloading', progress })
  )
  autoUpdater.on('update-downloaded', (info: UpdateInfo) => {
    cachedInfo = info
    broadcast({ status: 'downloaded', version: info.version })
  })
  autoUpdater.on('error', (err: Error) => broadcast({ status: 'error', error: err.message }))
}

let wired = false

/** 在 app.whenReady() 后调一次（确保已 ready） */
export function ensureAutoUpdater(): void {
  if (wired) return
  wired = true
  wireAutoUpdater()
}

// ─── mac 未签名 manual 模式（D2 兜底，纯逻辑在 autoUpdateManual.ts）───

const execFileP = promisify(execFile)
/** 探测结果进程内缓存：签名状态在安装后才会变，而安装即重启 */
let manualModePromise: Promise<boolean> | null = null

/**
 * 是否走 manual 模式：仅 mac + 打包态 + codesign 探测失败。
 * dev 模式与非 mac 一律 false（维持 electron-updater 原路径）；一旦真签名，
 * 探测通过自动回到正道，本函数无需改动。
 */
function isManualMode(): Promise<boolean> {
  if (!manualModePromise) {
    manualModePromise =
      process.platform === 'darwin' && app.isPackaged
        ? execFileP('codesign', ['--verify', '--deep', process.execPath])
            .then(() => false)
            .catch(() => true)
        : Promise.resolve(false)
  }
  return manualModePromise
}

/** manual 检查：GitHub releases/latest 比版本，结果全走 broadcast（含失败显式 error） */
async function checkForUpdatesManual(): Promise<UpdateStatus> {
  broadcast({ status: 'checking' })
  try {
    const res = await fetch(GITHUB_LATEST_API, {
      headers: { Accept: 'application/vnd.github+json', 'User-Agent': 'Frond' },
      signal: AbortSignal.timeout(10_000)
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const info = parseLatestRelease(await res.json(), app.getVersion(), process.arch)
    if (!info) {
      manualInfo = null
      broadcast({ status: 'not-available' })
    } else {
      manualInfo = info
      broadcast({
        status: 'manual-available',
        version: info.version,
        downloadUrl: info.downloadUrl,
        releasesUrl: info.releasesUrl
      })
    }
  } catch (e) {
    broadcast({ status: 'error', error: `检查更新失败：${(e as Error).message}` })
  }
  return currentStatus
}

export const AutoUpdateService = {
  async checkForUpdates(): Promise<UpdateStatus> {
    if (await isManualMode()) return checkForUpdatesManual()
    ensureAutoUpdater()
    if (currentStatus === 'checking') return currentStatus
    try {
      await autoUpdater.checkForUpdates()
    } catch (e) {
      // 错误已被 error 事件处理；这里不再 throw
      log.warn('autoUpdate', `checkForUpdates threw: ${(e as Error).message}`)
    }
    return currentStatus
  },

  async downloadUpdate(): Promise<void> {
    if (await isManualMode()) {
      // manual 模式「下载」= 打开下载页引导手动安装（没有应用内下载与安装）
      if (!manualInfo) {
        log.warn('autoUpdate', 'manual downloadUpdate before check; running check first')
        await this.checkForUpdates()
      }
      const url = manualInfo?.downloadUrl ?? manualInfo?.releasesUrl
      if (url) await shell.openExternal(url)
      else log.warn('autoUpdate', 'manual downloadUpdate: no download url after check')
      return
    }
    ensureAutoUpdater()
    if (!cachedInfo) {
      log.warn('autoUpdate', 'downloadUpdate called before checkForUpdates; running check first')
      await this.checkForUpdates()
    }
    try {
      await autoUpdater.downloadUpdate()
    } catch (e) {
      log.warn('autoUpdate', `downloadUpdate threw: ${(e as Error).message}`)
    }
  },

  quitAndInstall(): void {
    // manual 模式永远到不了 downloaded 档（渲染端按钮按档位 gating），这里是防御兜底
    if (currentStatus === 'manual-available') {
      log.warn('autoUpdate', 'quitAndInstall ignored in manual mode; use manual download')
      return
    }
    ensureAutoUpdater()
    autoUpdater.quitAndInstall()
  },

  getStatus(): UpdateStatus {
    return currentStatus
  },

  getCachedInfo(): UpdateInfo | null {
    return cachedInfo
  },

  getCurrentVersion(): string {
    return app.getVersion()
  },

  onEvent(cb: Listener): () => void {
    listeners.add(cb)
    return () => listeners.delete(cb)
  }
}
