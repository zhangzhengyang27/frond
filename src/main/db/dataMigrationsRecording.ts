/**
 * Frond · 录制历史数据迁移（v3）
 *
 * 职责：把 userData/recording-history.json 一次性导入 SQLite rec_recordings。
 * 触发：installDatabase() + runDataMigrations() 完成后调用一次。
 * 幂等：用 frond_meta.data_migration_v3 标志位（PR-2 引入）。
 *
 * 设计要点：
 * - 旧 JSON id (Date.now()+random) 不兼容 SQLite UUIDv4 约定 → 生成新 UUID，
 *   旧 id 写进新行的 description 字段，格式 `legacy:<oldid>`，可逆溯源
 * - 旧 JSON 字段映射：
 *   filePath      → file_path
 *   filename      → file_name
 *   fileSize      → file_size
 *   duration(秒)  → duration_ms（× 1000）
 *   thumbnail     → thumbnail_path
 *   createdAt     → started_at + ended_at
 * - status 旧 JSON 没有 → 全部置为 'completed'
 * - 失败策略：单条失败不阻断；汇总 errors
 */

import { app } from 'electron'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { randomUUID } from 'node:crypto'
import { database } from './database'
import { recordingRepository } from './repos/RecordingRepository'
import { log } from '../services/LogService'

const DATA_MIGRATION_KEY = 'data_migration_v3'

const LEGACY_RECORDING_FILE = 'recording-history.json'

interface LegacyRecordingHistory {
  id: string
  filename: string
  filePath: string
  duration: number // 秒
  fileSize: number
  createdAt: number
  thumbnail?: string
}

export interface RecordingMigrationResult {
  ran: boolean
  recordingsImported: number
  recordingsSkipped: number
  errors: string[]
}

/**
 * 独立函数：把 userData/recording-history.json 搬到 rec_recordings。
 * 多次调用幂等（v3 done 标记）。
 */
export function runRecordingHistoryMigration(userDataDir?: string): RecordingMigrationResult {
  // 注意：必须新建 errors 数组（不能用 {...EMPTY}.errors 浅拷贝，避免跨调用共享引用）
  const result: RecordingMigrationResult = {
    ran: false,
    recordingsImported: 0,
    recordingsSkipped: 0,
    errors: []
  }

  // 检查 SQLite 是否可用（PR-2 单测注入 :memory: 时也可走此路径）
  let db
  try {
    db = database.handle
  } catch (e) {
    result.errors.push(`database unavailable: ${(e as Error).message}`)
    return result
  }

  // 确保 frond_meta 表存在（v1/v2 已建，但保险）
  db.exec(
    `CREATE TABLE IF NOT EXISTS frond_meta (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at INTEGER NOT NULL
     )`
  )

  // 幂等：v3 已 done 直接返回
  const v3Done = db.prepare('SELECT value FROM frond_meta WHERE key = ?').get(DATA_MIGRATION_KEY) as
    | { value: string }
    | undefined
  if (v3Done?.value === 'done') {
    log.info('dataMigration.v3', 'already done, skip')
    return result
  }
  result.ran = true

  // 解析 userData 路径（PR-2: 接受参数，让单测可显式注入）
  let userData: string
  if (userDataDir) {
    userData = userDataDir
  } else {
    try {
      userData = app.getPath('userData')
    } catch (e) {
      result.errors.push(`getPath: ${(e as Error).message}`)
      return result
    }
  }

  const fp = join(userData, LEGACY_RECORDING_FILE)
  if (!existsSync(fp)) {
    log.info('dataMigration.v3', `no ${LEGACY_RECORDING_FILE} in ${userData}, skip`)
    // 仍然标记 done 避免每次启动都检查
    db.prepare(
      `INSERT INTO frond_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(DATA_MIGRATION_KEY, 'done', Date.now())
    return result
  }

  let parsed: LegacyRecordingHistory[] = []
  try {
    const raw = readFileSync(fp, 'utf-8')
    parsed = JSON.parse(raw) as LegacyRecordingHistory[]
  } catch (e) {
    const msg = (e as Error).message
    result.errors.push(`parse: ${msg}`)
    log.error('dataMigration.v3', `parse ${fp} failed: ${msg}`, e)
    return result
  }
  if (!Array.isArray(parsed) || parsed.length === 0) {
    log.info('dataMigration.v3', `${LEGACY_RECORDING_FILE} empty, skip`)
    db.prepare(
      `INSERT INTO frond_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(DATA_MIGRATION_KEY, 'done', Date.now())
    return result
  }

  // 单条事务导入；每条独立 try/catch
  for (const r of parsed) {
    try {
      // 文件名同名 → 已迁移过：跳过（id 不唯一所以按 file_name 去重）
      // 但 RecordingRepository 没按 file_name 查的方法，用 SQL 直查
      const existing = db
        .prepare(
          `SELECT id FROM rec_recordings
           WHERE file_name = ? AND deleted_at IS NULL LIMIT 1`
        )
        .get(r.filename) as { id: string } | undefined
      if (existing) {
        result.recordingsSkipped += 1
        continue
      }

      recordingRepository.insert({
        id: randomUUID(),
        file_path: r.filePath,
        file_name: r.filename,
        duration_ms: Math.round((r.duration ?? 0) * 1000),
        file_size: r.fileSize ?? 0,
        fps: 30,
        status: 'completed',
        description: `legacy:${r.id}`,
        thumbnail_path: r.thumbnail ?? null,
        started_at: r.createdAt
      })
      result.recordingsImported += 1
    } catch (e) {
      const msg = (e as Error).message
      result.errors.push(`${r.id}: ${msg}`)
      log.error('dataMigration.v3', `import ${r.id} failed: ${msg}`, e)
    }
  }

  // 标记 v3 done
  db.prepare(
    `INSERT INTO frond_meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(DATA_MIGRATION_KEY, 'done', Date.now())

  log.info(
    'dataMigration.v3',
    `done: imported=${result.recordingsImported}, skipped=${result.recordingsSkipped}, errors=${result.errors.length}`
  )

  return result
}

