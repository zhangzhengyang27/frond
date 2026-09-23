/**
 * Leaf · 数据迁移器（版本 2）
 *
 * 触发：installDatabase() 完成后调用一次。
 * 职责：把旧 electron-store JSON 文件一次性导入 SQLite。
 * 幂等：用 leaf_meta 表的 data_migration_v2 标志位。
 *
 * 覆盖（v1 → v2）：
 * - v1 (5-4) Preferences / Tag
 * - v2 (新增) Pomodoro / Snippet / Folder
 *
 * 注：Music / OnlineMusic / Wallpaper / LocalFileLibrary 模块已下线，
 *     legacy JSON 不再导入（对应 Data.json 仍会随归档流程搬到 legacy-backup）。
 *
 * 失败策略：单条失败不阻断整个迁移，记录到 log_entries 由 LogService 兜底。
 */

import { app } from 'electron'
import type Database from 'better-sqlite3'
import { join } from 'node:path'
import { existsSync, readFileSync } from 'node:fs'
import { database } from './database'
import {
  prefRepository,
  tagRepository,
  pomodoroRepository,
  snippetRepository,
  folderRepository
} from './repos'
import { archiveLegacyJsonInDir } from './legacyArchive'
import { readdirSync } from 'node:fs'
import type { Snippet } from './repos/SnippetRepository'
import type { Folder } from './repos/FolderRepository'
import type { PomodoroSettings } from './repos'
import { log } from '../services/LogService'

const DATA_MIGRATION_KEY = 'data_migration_v2'

interface LegacyTag {
  id: string
  name: string
  createdAt: number
}

interface LegacyPreferences {
  editor?: Record<string, unknown>
  theme?: 'light' | 'dark' | 'auto'
}

interface LegacyPomodoro {
  tasks?: Array<{
    id: string
    title: string
    completed: boolean
    createdAt: number
    completedAt?: number
  }>
  records?: Array<{
    id: string
    taskId?: string
    taskTitle?: string
    type: 'work' | 'shortBreak' | 'longBreak'
    duration: number
    completedAt: number
    date: string
  }>
  settings?: PomodoroSettings
}

interface MigrationResult {
  ran: boolean
  prefsImported: number
  tagsImported: number
  pomodoroTasksImported: number
  pomodoroRecordsImported: number
  pomodoroSettingsImported: boolean
  snippetsImported: number
  foldersImported: number
  errors: string[]
}

export function runDataMigrations(): MigrationResult {
  const result: MigrationResult = {
    ran: false,
    prefsImported: 0,
    tagsImported: 0,
    pomodoroTasksImported: 0,
    pomodoroRecordsImported: 0,
    pomodoroSettingsImported: false,
    snippetsImported: 0,
    foldersImported: 0,
    errors: []
  }

  const db = database.handle

  // 确保 leaf_meta 表存在
  db.exec(
    `CREATE TABLE IF NOT EXISTS leaf_meta (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at INTEGER NOT NULL
     )`
  )

  // 兼容旧 v1 标记：如果发现 v1 done，标记为 v2 done（v1 已包含的 4 类不再重复执行）
  const v1Done = db
    .prepare('SELECT value FROM leaf_meta WHERE key = ?')
    .get('data_migration_v1') as { value: string } | undefined
  const v2Done = db.prepare('SELECT value FROM leaf_meta WHERE key = ?').get(DATA_MIGRATION_KEY) as
    { value: string } | undefined
  // 两段都完成才跳过；任一段上次因导入失败未标记，本次都要补跑
  // （importMany 均为 ON CONFLICT(id) DO UPDATE，重跑幂等）
  if (v1Done?.value === 'done' && v2Done?.value === 'done') {
    log.info('dataMigration', 'v1+v2 already done, skip')
    return result
  }

  result.ran = true
  const userData = app.getPath('userData')

  // === v1: Preferences / Tag ===
  if (v1Done?.value !== 'done') {
    const v1ErrorsBefore = result.errors.length

    // 1. Preferences
    try {
      const prefFile = join(userData, 'Preferences.json')
      if (existsSync(prefFile)) {
        const raw = readFileSync(prefFile, 'utf-8')
        const parsed = JSON.parse(raw) as LegacyPreferences
        const entries: Array<{ key: string; value: string }> = []
        if (parsed.theme) entries.push({ key: 'theme', value: JSON.stringify(parsed.theme) })
        if (parsed.editor) entries.push({ key: 'editor', value: JSON.stringify(parsed.editor) })
        if (entries.length > 0) {
          result.prefsImported = prefRepository.importMany(entries)
        }
      }
    } catch (e) {
      const msg = (e as Error).message
      result.errors.push(`prefs: ${msg}`)
      log.error('dataMigration', `prefs import failed: ${msg}`, e)
    }

    // 2. Tags
    try {
      const tagFile = join(userData, 'Tag Data.json')
      if (existsSync(tagFile)) {
        const raw = readFileSync(tagFile, 'utf-8')
        const parsed = JSON.parse(raw) as { tags?: LegacyTag[] } | LegacyTag[]
        const tags: LegacyTag[] = Array.isArray(parsed) ? parsed : (parsed.tags ?? [])
        if (tags.length > 0) {
          result.tagsImported = tagRepository.importMany(
            tags.map((t) => ({ id: t.id, name: t.name, createdAt: t.createdAt }))
          )
        }
      }
    } catch (e) {
      const msg = (e as Error).message
      result.errors.push(`tags: ${msg}`)
      log.error('dataMigration', `tags import failed: ${msg}`, e)
    }

    // 标记 v1 完成（兼容旧 leaf_meta 标志位）——仅当本段没有导入失败时。
    // 失败时不标记、不归档：下次启动重跑（导入幂等），避免数据静默缺失。
    if (result.errors.length === v1ErrorsBefore) {
      db.prepare(
        `INSERT INTO leaf_meta (key, value, updated_at) VALUES (?, ?, ?)
         ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
      ).run('data_migration_v1', 'done', Date.now())
    } else {
      log.warn(
        'dataMigration',
        `v1 import had errors, defer v1 done marking (errors=${result.errors.length - v1ErrorsBefore})`
      )
    }
  } else {
    // v1 已完成：把 result 字段补 0
    result.prefsImported = prefRepository.all().filter((p) => p.key !== 'pomodoro_settings').length
    result.tagsImported = tagRepository.all().length
  }

  // === v2: Pomodoro / Snippet / Folder ===
  const v2ErrorsBefore = result.errors.length
  const runV2 = v2Done?.value !== 'done'
  if (runV2) {
    // 5. Pomodoro
    try {
      const pomFile = join(userData, 'pomodoro-data.json')
      if (existsSync(pomFile)) {
        const raw = readFileSync(pomFile, 'utf-8')
        const parsed = JSON.parse(raw) as LegacyPomodoro
        if (parsed.tasks && parsed.tasks.length > 0) {
          result.pomodoroTasksImported = pomodoroRepository.importTasks(
            parsed.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              completed: t.completed,
              priority: 0,
              estimateMs: null,
              projectId: null,
              createdAt: t.createdAt,
              ...(t.completedAt !== undefined ? { completedAt: t.completedAt } : {})
            }))
          )
        }
        if (parsed.records && parsed.records.length > 0) {
          result.pomodoroRecordsImported = pomodoroRepository.importRecords(
            parsed.records.map((r) => ({
              id: r.id,
              type: r.type,
              duration: r.duration,
              completedAt: r.completedAt,
              date: r.date,
              ...(r.taskId !== undefined ? { taskId: r.taskId } : {}),
              ...(r.taskTitle !== undefined ? { taskTitle: r.taskTitle } : {})
            }))
          )
        }
        if (parsed.settings) {
          pomodoroRepository.importSettings(parsed.settings)
          result.pomodoroSettingsImported = true
        }
      }
    } catch (e) {
      const msg = (e as Error).message
      result.errors.push(`pomodoro: ${msg}`)
      log.error('dataMigration', `pomodoro import failed: ${msg}`, e)
    }

    // 6. Snippet
    try {
      const snipFile = join(userData, 'Snippet Data.json')
      if (existsSync(snipFile)) {
        const raw = readFileSync(snipFile, 'utf-8')
        const parsed = JSON.parse(raw) as { snippets?: Snippet[] } | Snippet[]
        const list: Snippet[] = Array.isArray(parsed) ? parsed : (parsed.snippets ?? [])
        if (list.length > 0) {
          result.snippetsImported = snippetRepository.importMany(list)
        }
      }
    } catch (e) {
      const msg = (e as Error).message
      result.errors.push(`snippets: ${msg}`)
      log.error('dataMigration', `snippets import failed: ${msg}`, e)
    }

    // 7. Folder
    try {
      const folderFile = join(userData, 'Folder Data.json')
      if (existsSync(folderFile)) {
        const raw = readFileSync(folderFile, 'utf-8')
        const parsed = JSON.parse(raw) as { folders?: Folder[] } | Folder[]
        const list: Folder[] = Array.isArray(parsed) ? parsed : (parsed.folders ?? [])
        if (list.length > 0) {
          result.foldersImported = folderRepository.importMany(list)
        }
      }
    } catch (e) {
      const msg = (e as Error).message
      result.errors.push(`folders: ${msg}`)
      log.error('dataMigration', `folders import failed: ${msg}`, e)
    }
  }

  // 标记 v2 完成——仅当本段没有导入失败时（v1 的失败不应阻止 v2 标记，
  // 否则 v2 会跟着重跑；早退条件是 v1&&v2 都 done，v1 下次仍会补跑）。
  // 失败时不标记：下次启动重跑（导入幂等）。
  if (result.errors.length === v2ErrorsBefore) {
    db.prepare(
      `INSERT INTO leaf_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(DATA_MIGRATION_KEY, 'done', Date.now())
  } else {
    log.warn(
      'dataMigration',
      `v2 import had errors, defer v2 done marking (errors=${result.errors.length - v2ErrorsBefore})`
    )
  }

  // 归档旧 JSON 到 userData/legacy-backup/<ts>/——必须两段全部无错才执行：
  // v1 失败 + v2 成功时归档会把 v1 还没导入成功的 Preferences.json / Tag Data.json
  // 搬走，v1 重跑时 existsSync 短路、零错误被标 done，数据静默永久缺失
  if (result.errors.length === 0) {
    // archiveLegacyJsonInDir 内部 try/catch，失败不影响主流程
    archiveLegacyJsonInDir(userData)

    // 记录归档目录到 leaf_meta（供 SettingsView 展示）
    try {
      const dir = join(userData, 'legacy-backup')
      const subs = readdirSync(dir).sort().reverse()
      if (subs.length > 0) {
        const latest = join(dir, subs[0])
        db.prepare(
          `INSERT INTO leaf_meta (key, value, updated_at) VALUES (?, ?, ?)
           ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
        ).run('legacy_archive_dir', latest, Date.now())
      }
    } catch (e) {
      log.warn('dataMigration', `legacy_archive_dir meta update failed: ${(e as Error).message}`)
    }
  }

  log.info(
    'dataMigration',
    `v2 done: prefs=${result.prefsImported}, tags=${result.tagsImported}, ` +
      `pom[tasks=${result.pomodoroTasksImported},records=${result.pomodoroRecordsImported},settings=${result.pomodoroSettingsImported}], ` +
      `snippets=${result.snippetsImported}, folders=${result.foldersImported}, ` +
      `errors=${result.errors.length}`
  )

  // electron-store 双栈收尾：这几个域迁 SQLite（config.json 其余键仍在用，只读不归档）
  migrateAliasesFromLegacyStore()
  migrateAiFromLegacyStore()
  migrateClipsFromLegacyStore()
  migrateRecordingSettingsFromLegacyStore()
  migrateMarkersFromLegacyStore()

  return result
}

const ALIAS_MIGRATION_KEY = 'data_migration_aliases'

/**
 * 别名存储迁移：electron-store 默认文件 config.json 的 aliases 键 → pref_preferences。
 * - 幂等：leaf_meta 标志位，成功跑过后跳过
 * - 现值优先：pref 已有 aliases 时只打标志不覆盖
 * - 只读不删：config.json 还有 AI 配置 / 标记等其他域在用，不能归档或删除
 */
export function migrateAliasesFromLegacyStore(): void {
  const db = database.handle
  try {
    // 自包含：独立调用（早于 runDataMigrations 主流程）时 leaf_meta 可能尚未创建
    db.exec(`CREATE TABLE IF NOT EXISTS leaf_meta (
       key TEXT PRIMARY KEY,
       value TEXT,
       updated_at INTEGER NOT NULL
     )`)
    const done = db
      .prepare('SELECT value FROM leaf_meta WHERE key = ?')
      .get(ALIAS_MIGRATION_KEY) as { value: string } | undefined
    if (done) return

    // electron-store 默认文件：<userData>/config.json
    let legacy: unknown
    try {
      const raw = readFileSync(join(app.getPath('userData'), 'config.json'), 'utf-8')
      legacy = (JSON.parse(raw) as Record<string, unknown>)['aliases']
    } catch {
      legacy = undefined // 文件不存在 / 解析失败都按无旧数据处理
    }

    const existing = prefRepository.get('aliases')
    if (legacy && !existing) {
      prefRepository.set('aliases', JSON.stringify(legacy))
      log.info('dataMigration', 'aliases imported from legacy electron-store config.json')
    }

    db.prepare(
      `INSERT INTO leaf_meta (key, value, updated_at) VALUES (?, ?, ?)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
    ).run(ALIAS_MIGRATION_KEY, 'done', Date.now())
  } catch (e) {
    // 失败不阻断启动；不打标志，下次启动重试
    log.warn('dataMigration', `aliases migration failed: ${(e as Error).message}`)
  }
}

/** 幂等标志位前缀：每个域一个键，跑成功才落，失败下次启动重试 */
const LEGACY_MIGRATION_KEYS = {
  ai: 'data_migration_ai',
  clips: 'data_migration_clips',
  recordingSettings: 'data_migration_recording_settings',
  markers: 'data_migration_markers'
} as const

/** 读 <userData>/<file> 的 JSON；文件不存在或坏了都返回 undefined（按无旧数据处理） */
function readLegacyJson(file: string, key?: string): unknown {
  try {
    const raw = readFileSync(join(app.getPath('userData'), file), 'utf-8')
    const parsed = JSON.parse(raw) as unknown
    return key === undefined ? parsed : (parsed as Record<string, unknown>)[key]
  } catch {
    return undefined
  }
}

function readMigrationFlag(db: Database.Database, key: string): boolean {
  return (
    (db.prepare('SELECT value FROM leaf_meta WHERE key = ?').get(key) as
      { value: string } | undefined) !== undefined
  )
}

function writeMigrationFlag(db: Database.Database, key: string): void {
  db.prepare(
    `INSERT INTO leaf_meta (key, value, updated_at) VALUES (?, ?, ?)
     ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`
  ).run(key, 'done', Date.now())
}

/**
 * AI 配置与会话：electron-store config.json 的 `ai.config` / `ai.sessions` → pref_preferences。
 * **密文原样搬运**：apiKey 存的就是 `enc:` 开头的密文，这里不解密也不重加密
 * （解密要用本机 .leaf-key，两台机器之间搬不动）。
 */
export function migrateAiFromLegacyStore(): void {
  const db = database.handle
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS leaf_meta (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL)`
    )
    if (readMigrationFlag(db, LEGACY_MIGRATION_KEYS.ai)) return
    const legacy = readLegacyJson('config.json') as Record<string, unknown> | undefined
    if (legacy && typeof legacy === 'object') {
      for (const key of ['ai.config', 'ai.sessions']) {
        if (legacy[key] === undefined) continue
        // 现值优先：用户已经在本机配过就不动他的
        if (prefRepository.get(key) === null) prefRepository.set(key, JSON.stringify(legacy[key]))
      }
      log.info('dataMigration', 'ai config/sessions imported from legacy electron-store')
    }
    writeMigrationFlag(db, LEGACY_MIGRATION_KEYS.ai)
  } catch (e) {
    log.warn('dataMigration', `ai migration failed: ${(e as Error).message}`)
  }
}

/**
 * 录屏片段（clips）：`clips.json`（Record<videoId, Clip[]>）整坨搬进 pref "clips"。
 * 结构由消费方自己解释，这里不摊平 —— 摊平一次就要维护两套形状。
 */
export function migrateClipsFromLegacyStore(): void {
  const db = database.handle
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS leaf_meta (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL)`
    )
    if (readMigrationFlag(db, LEGACY_MIGRATION_KEYS.clips)) return
    const legacy = readLegacyJson('clips.json')
    if (legacy !== undefined && prefRepository.get('clips') === null) {
      prefRepository.set('clips', JSON.stringify(legacy))
      log.info('dataMigration', 'clips imported from legacy clips.json')
    }
    writeMigrationFlag(db, LEGACY_MIGRATION_KEYS.clips)
  } catch (e) {
    log.warn('dataMigration', `clips migration failed: ${(e as Error).message}`)
  }
}

/**
 * 录屏设置：`recording-settings.json` 的 `settings` → pref "recording.settings"。
 * **整份搬而不是按 repo 投影挑字段**：旧文件里有 audioCodec / systemAudio 等
 * RecordingSettingsDataStore 不认的项，挑着搬就等于把这些设置静默丢掉。
 */
export function migrateRecordingSettingsFromLegacyStore(): void {
  const db = database.handle
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS leaf_meta (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL)`
    )
    if (readMigrationFlag(db, LEGACY_MIGRATION_KEYS.recordingSettings)) return
    const file = readLegacyJson('recording-settings.json') as { settings?: unknown } | undefined
    const settings = file && typeof file === 'object' ? file.settings : undefined
    if (settings !== undefined && prefRepository.get('recording.settings') === null) {
      prefRepository.set('recording.settings', JSON.stringify(settings))
      log.info('dataMigration', 'recording settings imported from legacy recording-settings.json')
    }
    writeMigrationFlag(db, LEGACY_MIGRATION_KEYS.recordingSettings)
  } catch (e) {
    log.warn('dataMigration', `recording settings migration failed: ${(e as Error).message}`)
  }
}

/**
 * 时间标记：`markers.json`（`Record<recordingId, Marker[]>`，timestamp 单位**秒**）
 * → `rec_markers` 表（time_ms 单位**毫秒**）。
 * - id 原样保留（片段/标记之间靠它互相引用）
 * - recordingId 缺失时用外层 key；label 空串按 null 存（列表渲染时不显示空标签）
 * - 幂等靠 leaf_meta 标志：表里没有可判「是不是旧数据」的字段，只能记账
 */
export function migrateMarkersFromLegacyStore(): void {
  const db = database.handle
  try {
    db.exec(
      `CREATE TABLE IF NOT EXISTS leaf_meta (key TEXT PRIMARY KEY, value TEXT, updated_at INTEGER NOT NULL)`
    )
    if (readMigrationFlag(db, LEGACY_MIGRATION_KEYS.markers)) return
    const legacy = readLegacyJson('markers.json') as
      Record<string, Array<Record<string, unknown>>> | undefined
    if (legacy && typeof legacy === 'object') {
      const insert = db.prepare(
        `INSERT OR IGNORE INTO rec_markers (id, recording_id, time_ms, label, color, created_at)
         VALUES (?, ?, ?, ?, ?, ?)`
      )
      let n = 0
      const tx = db.transaction(() => {
        for (const [recordingId, list] of Object.entries(legacy)) {
          if (!Array.isArray(list)) continue
          for (const m of list) {
            const id = typeof m.id === 'string' ? m.id : ''
            if (!id) continue
            const seconds = Number(m.timestamp ?? 0)
            if (!Number.isFinite(seconds)) continue
            insert.run(
              id,
              typeof m.recordingId === 'string' && m.recordingId ? m.recordingId : recordingId,
              Math.round(seconds * 1000),
              typeof m.label === 'string' && m.label !== '' ? m.label : null,
              typeof m.color === 'string' ? m.color : null,
              Date.now()
            )
            n++
          }
        }
      })
      tx()
      if (n > 0) log.info('dataMigration', `${n} markers imported from legacy markers.json`)
    }
    writeMigrationFlag(db, LEGACY_MIGRATION_KEYS.markers)
  } catch (e) {
    log.warn('dataMigration', `markers migration failed: ${(e as Error).message}`)
  }
}
