/**
 * Frond · 轻量同步 IPC（V4 批次6）
 *
 * - syncdata:status   状态（上次应用时间 / 快照份数 / WebDAV 是否配置）
 * - syncdata:push     推送本地到云端（后写覆盖）
 * - syncdata:pull     拉平（LWW 决策；覆盖前本地快照）
 */
import { ipcMain } from 'electron'
import { dataSyncStatus, pullDataSync, pushDataSync } from '../launcher/dataSync'

export function registerDataSyncIpc(): void {
  ipcMain.handle('syncdata:status', () => dataSyncStatus())
  ipcMain.handle('syncdata:push', async () => pushDataSync())
  ipcMain.handle('syncdata:pull', async () => pullDataSync())
}
