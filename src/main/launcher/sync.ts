/**
 * Frond · 启动器 WebDAV 同步
 *
 * 快照式备份/恢复：launcher_docs 全量 + 已安装插件清单 → 单个 JSON 上传。
 * 插件本体（目录）不参与同步——恢复后需重新导入插件目录。
 * 配置存 pref_preferences（key = launcher.sync；v1 明文存储）。
 */
import { prefRepository } from '../db/repos'
import { getLauncherDocStore, type ExportedDoc } from './docStore'
import { listPlugins } from './pluginStore'
import { encryptText, decryptText } from '../utils/crypto'
import type { WebDAVClient } from 'webdav'

const SYNC_PREF_KEY = 'launcher.sync'

export interface SyncConfig {
  url: string
  username: string
  password: string
  /** 远端目录（不含文件名），默认 /frond-launcher */
  remoteDir: string
  /** 仅回传方向：本机是否存有口令（此时 password 恒为 ''，脱敏回传） */
  hasPassword?: boolean
  /** 仅写入方向：true = 显式清除已存口令（与「留空保持原值」区分开） */
  clearPassword?: boolean
}

const REMOTE_FILE = 'launcher-backup.json'

/** 网络挂起兜底：所有 WebDAV 请求包一层超时，防止 UI 无限等待 */
const WEBDAV_TIMEOUT_MS = 30_000

export async function withTimeout<T>(p: Promise<T>, label: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | null = null
  try {
    return await Promise.race([
      p,
      new Promise<never>((_, reject) => {
        timer = setTimeout(
          () => reject(new Error(`${label} 超时（${WEBDAV_TIMEOUT_MS / 1000}s）`)),
          WEBDAV_TIMEOUT_MS
        )
      })
    ])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/** 恢复前逐项校验云端数据：类型齐全 + pluginId 形态合法 + 条数/单条大小受限，
 * 防止被篡改的备份注入任意命名空间或撑爆本地库 */
function sanitizeDocs(docs: unknown): ExportedDoc[] {
  if (!Array.isArray(docs)) throw new Error('备份 docs 数据无效')
  if (docs.length > 1000) throw new Error('备份数据条数超出限制')
  const out: ExportedDoc[] = []
  for (const d of docs) {
    const item = d as Partial<ExportedDoc>
    if (
      typeof item?.pluginId !== 'string' ||
      typeof item?.docId !== 'string' ||
      item.docId.length === 0 ||
      typeof item?.updatedAt !== 'number'
    ) {
      continue
    }
    if (!/^[\w](?:[\w.-]*[\w])?$/.test(item.pluginId) || item.pluginId.includes('..')) continue
    const data = JSON.stringify(item.data ?? null)
    if (data.length > 256 * 1024) continue
    out.push({
      pluginId: item.pluginId,
      docId: item.docId,
      data: item.data ?? null,
      updatedAt: item.updatedAt
    })
  }
  return out
}

/**
 * 主进程内部用的完整配置（password 是解密后的真值）：dataSync/cloudBackup/
 * testConnection 等网络路径用。渲染端回传一律走 getSyncConfigMasked（B40：
 * 明文口令不进渲染进程——渲染层一旦被注入即可拖走网盘凭证）。
 */
export function getSyncConfig(): SyncConfig {
  const raw = prefRepository.get(SYNC_PREF_KEY)
  if (!raw) return { url: '', username: '', password: '', remoteDir: '/frond-launcher' }
  try {
    const parsed = JSON.parse(raw) as Partial<SyncConfig>
    // 逐项兜底，避免 null/'' 覆盖默认值拼出 "null/..." 路径；去掉尾部多余斜杠
    return {
      url: parsed.url ?? '',
      username: parsed.username ?? '',
      password: parsed.password ? decryptText(parsed.password) : '',
      remoteDir: parsed.remoteDir?.replace(/\/+$/, '') || '/frond-launcher'
    }
  } catch {
    return { url: '', username: '', password: '', remoteDir: '/frond-launcher' }
  }
}

/**
 * 回传渲染端的脱敏版：password 恒为 ''，只带 hasPassword 标记；
 * 设置页口令框显示「已保存，留空保持不变」。
 */
export function getSyncConfigMasked(): SyncConfig {
  const config = getSyncConfig()
  return { ...config, password: '', hasPassword: !!config.password }
}

/**
 * 写入配置：password 为空且未显式 clearPassword = 口令保持原值（设置页口令框
 * 留空的默认语义）；clearPassword: true 才真清。url/username/remoteDir 照传。
 */
export function setSyncConfig(config: SyncConfig): void {
  const keepExisting = !config.password && !config.clearPassword
  const password = keepExisting ? getSyncConfig().password : config.password
  const toSave = { ...config, password: password ? encryptText(password) : '' }
  prefRepository.set(SYNC_PREF_KEY, JSON.stringify(toSave))
}

/** 惰性创建 WebDAV 客户端（webdav 包较重，且需要配置存在）；云备份复用 */
export async function createClient(config: SyncConfig): Promise<WebDAVClient> {
  const { createClient: create } = await import('webdav')
  return create(config.url, {
    username: config.username,
    password: config.password
  })
}

/** 确保远端子目录存在（不存在则递归创建）；云备份与文档同步共用 */
export async function ensureRemoteDir(
  client: WebDAVClient,
  dir: string
): Promise<void> {
  if (!(await withTimeout(client.exists(dir), '检查目录'))) {
    await withTimeout(client.createDirectory(dir, { recursive: true }), '创建目录')
  }
}

export async function testConnection(
  configOverride?: SyncConfig
): Promise<{ ok: boolean; error?: string }> {
  let config = configOverride ?? getSyncConfig()
  if (configOverride) {
    // 脱敏表单：口令留空 = 按已存口令连接（显式 clearPassword 的空串才当真清）
    const stored = getSyncConfig()
    config = {
      ...configOverride,
      password: configOverride.password || (configOverride.clearPassword ? '' : stored.password)
    }
  }
  if (!config.url) return { ok: false, error: '未配置 WebDAV 地址' }
  try {
    const client = await createClient(config)
    await ensureRemoteDir(client, config.remoteDir || '/')
    return { ok: true }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

interface BackupPayload {
  app: 'frond-launcher'
  schema: 1
  exportedAt: number
  docs: ExportedDoc[]
  plugins: Array<{ id: string; name: string; version?: string }>
}

/** 备份：上传文档快照 + 插件清单 */
export async function backup(): Promise<{ ok: boolean; count?: number; error?: string }> {
  const config = getSyncConfig()
  if (!config.url) return { ok: false, error: '未配置 WebDAV 地址' }
  try {
    const client = await withTimeout(createClient(config), '连接 WebDAV')
    await ensureRemoteDir(client, config.remoteDir || '/')
    const payload: BackupPayload = {
      app: 'frond-launcher',
      schema: 1,
      exportedAt: Date.now(),
      docs: getLauncherDocStore().exportAll(),
      plugins: listPlugins().map((p) => ({ id: p.id, name: p.name, version: p.version }))
    }
    const remotePath = `${config.remoteDir}/${REMOTE_FILE}`
    await withTimeout(client.putFileContents(remotePath, JSON.stringify(payload)), '上传备份')
    return { ok: true, count: payload.docs.length }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}

/** 恢复：下载快照并全量替换本地文档 */
export async function restore(): Promise<{ ok: boolean; count?: number; error?: string }> {
  const config = getSyncConfig()
  if (!config.url) return { ok: false, error: '未配置 WebDAV 地址' }
  try {
    const client = await withTimeout(createClient(config), '连接 WebDAV')
    const remotePath = `${config.remoteDir}/${REMOTE_FILE}`
    if (!(await withTimeout(client.exists(remotePath), '检查备份'))) {
      return { ok: false, error: '云端不存在备份文件' }
    }
    const raw = (await withTimeout(
      client.getFileContents(remotePath, { format: 'text' }),
      '下载备份'
    )) as string
    const payload = JSON.parse(raw) as BackupPayload
    if (payload.app !== 'frond-launcher' || payload.schema !== 1) {
      return { ok: false, error: '备份文件格式不匹配' }
    }
    const count = getLauncherDocStore().importAll(sanitizeDocs(payload.docs))
    return { ok: true, count }
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
}
