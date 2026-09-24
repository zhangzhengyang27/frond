/**
 * Frond · 轻量同步 IPC（V4 批次6）
 *
 * - syncdata:status   状态（上次应用时间 / 快照份数 / WebDAV 是否配置）
 * - syncdata:push     推送本地到云端（后写覆盖）
 * - syncdata:pull     拉平（LWW 决策；覆盖前本地快照）
 */
import { dataSyncStatus, pullDataSync, pushDataSync } from '../launcher/dataSync'
import { typedHandle } from './typedIpc'

export function registerDataSyncIpc(): void {
  typedHandle('syncdata:status', () => dataSyncStatus())
  typedHandle('syncdata:push', async () => pushDataSync())
  typedHandle('syncdata:pull', async () => pullDataSync())
}
