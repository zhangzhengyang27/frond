/**
 * Frond · 云端整库备份 IPC
 *
 * - cloudBackup:list     列出云端备份（供还原选择）
 * - cloudBackup:backup   整库快照加密上传（密码不落盘，仅本次调用使用）
 * - cloudBackup:restore  下载解密校验后换库重启（applyDbFile 内含安全备份）
 *
 * 密码经 IPC 传入主进程：与 ai:setConfig 携带 apiKey 同一信任边界
 * （preload 是唯一入口，渲染进程沙箱化）。
 */
import { backupFullDb, listCloudBackups, restoreFullDb } from '../launcher/cloudBackup'
import { typedHandle } from './typedIpc'

export function registerCloudBackupIpcHandlers(): void {
  typedHandle('cloudBackup:list', () => listCloudBackups())

  typedHandle('cloudBackup:backup', (_e, req) => {
    if (typeof req.password !== 'string' || !req.password.trim()) {
      return { ok: false, error: '密码不能为空' }
    }
    return backupFullDb(req.password)
  })

  typedHandle('cloudBackup:restore', (_e, req) => {
    if (typeof req.password !== 'string' || !req.password.trim()) {
      return { ok: false, error: '密码不能为空' }
    }
    return restoreFullDb(req.password, typeof req.fileName === 'string' ? req.fileName : undefined)
  })
}
