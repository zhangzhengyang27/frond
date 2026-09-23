/**
 * Frond · SQLite 数据库单例
 *
 * 职责：
 * - 维护全局唯一的 better-sqlite3.Database handle
 * - 首次访问时懒打开 userData/frond.db
 * - 启用 WAL / foreign_keys / synchronous=NORMAL
 * - 按版本号顺序跑 migrations
 * - app.on('will-quit') 时 close
 *
 * 任何 prepare / exec 失败必须抛错，不静默吞错。
 */

import { app } from 'electron'
import Database from 'better-sqlite3'
import { join } from 'node:path'
import { copyFileSync, existsSync, statSync, readdirSync, unlinkSync } from 'node:fs'
import { migrations, type Migration } from './migrations'

const DB_FILE = 'frond.db'
const BACKUP_THRESHOLD_BYTES = 50 * 1024 * 1024 // 50 MB
const BACKUP_KEEP = 3

class FrondDatabase {
  private db: Database.Database | null = null
  private dbPath: string | null = null

  /** 拿到 raw Database handle（仅供 service 层使用，不外泄到 IPC） */
  get handle(): Database.Database {
    this.ensureOpen()
    return this.db as Database.Database
  }

  /** 主动打开数据库（幂等）；通常用于 app.whenReady() 之后的预热 */
  open(): void {
    this.ensureOpen()
  }

  /** 仅在已打开时返回，否则 null（用于 service 容错） */
  get maybeHandle(): Database.Database | null {
    return this.db
  }

  /** 解析 frond.db 绝对路径 */
  resolvePath(): string {
    return join(app.getPath('userData'), DB_FILE)
  }

  private ensureOpen(): void {
    if (this.db) return
    if (!app.isReady()) {
      throw new Error('[database] called before app.isReady(); defer until whenReady')
    }

    const dbPath = this.resolvePath()
    this.dbPath = dbPath

    this.maybeBackup(dbPath)

    const db = new Database(dbPath)
    db.pragma('journal_mode = WAL')
    db.pragma('foreign_keys = ON')
    db.pragma('synchronous = NORMAL')
    db.pragma('temp_store = MEMORY')

    this.db = db
    this.runMigrations()
  }

  private maybeBackup(dbPath: string): void {
    try {
      if (!existsSync(dbPath)) return
      const size = statSync(dbPath).size
      if (size < BACKUP_THRESHOLD_BYTES) return

      const dir = join(app.getPath('userData'))
      const ts = Date.now()
      const bak = join(dir, `${DB_FILE}.bak.${ts}`)
      // 打开前先截断 WAL：只拷主库文件时，未 checkpoint 的 WAL 内容不会进备份。
      // 必须用可写连接——上次崩溃残留 WAL 时 readonly 连接可能建不了 -shm，checkpoint 会失败
      try {
        const wal = new Database(dbPath)
        wal.pragma('wal_checkpoint(TRUNCATE)')
        wal.close()
      } catch (e) {
        console.warn('[database] wal checkpoint before backup failed:', (e as Error).message)
      }
      copyFileSync(dbPath, bak)
      // 校验备份可用性：坏备份直接丢弃，避免「以为有备份，恢复时才发现是坏的」
      if (!this.verifySqliteFile(bak)) {
        try {
          unlinkSync(bak)
        } catch {
          // ignore
        }
        console.warn('[database] backup discarded: integrity check failed')
        return
      }
      this.pruneOldBackups(dir)
    } catch (e) {
      // 备份失败不应阻塞启动；交给 LogService 上层记录
      console.warn('[database] backup skipped:', (e as Error).message)
    }
  }

  /** SQLite 文件校验：魔数 + quick_check（导入/备份前的最后一道防线） */
  private verifySqliteFile(file: string): boolean {
    try {
      const probe = new Database(file, { readonly: true })
      try {
        const rows = probe.pragma('quick_check') as Array<Record<string, unknown>>
        return rows.length > 0 && Object.values(rows[0]).some((v) => v === 'ok')
      } finally {
        probe.close()
      }
    } catch {
      return false
    }
  }

  private pruneOldBackups(dir: string): void {
    try {
      const baks = readdirSync(dir)
        .filter((f) => f.startsWith(`${DB_FILE}.bak.`))
        .sort()
        .reverse()
      const stale = baks.slice(BACKUP_KEEP)
      for (const f of stale) {
        try {
          unlinkSync(join(dir, f))
        } catch {
          // ignore
        }
      }
    } catch {
      // ignore
    }
  }

  private runMigrations(): void {
    const db = this.db as Database.Database

    // meta 表用于跟踪 migration 版本
    db.exec(`CREATE TABLE IF NOT EXISTS meta (
      version INTEGER PRIMARY KEY,
      applied_at INTEGER NOT NULL
    )`)

    const row = db.prepare('SELECT MAX(version) AS v FROM meta').get() as { v: number | null }
    let current = row.v ?? 0

    // 降级防护：DB schema 版本高于当前代码时，高版本结构会静默跑旧代码，
    // 字段缺失/语义变化可能造成静默数据损坏——至少要在日志里喊出来
    const maxKnown = migrations[migrations.length - 1]?.version ?? 0
    if (current > maxKnown) {
      console.warn(
        `[database] schema v${current} 来自更高版本的应用（当前代码最高 v${maxKnown}），` +
          `请升级应用或恢复备份，继续运行有数据风险`
      )
    }

    for (const m of migrations) {
      if (m.version <= current) continue
      const tx = db.transaction(() => {
        m.up(db)
        db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(
          m.version,
          Date.now()
        )
      })
      tx()
      current = m.version
    }
  }

  close(): void {
    if (this.db) {
      try {
        this.db.close()
      } catch (e) {
        console.warn('[database] close failed:', (e as Error).message)
      }
      this.db = null
    }
  }

  /** 调试/测试用：拿到当前已应用版本 */
  currentVersion(): number {
    this.ensureOpen()
    const row = this.db.prepare('SELECT MAX(version) AS v FROM meta').get() as { v: number | null }
    return row.v ?? 0
  }

  /** 调试/测试用：db 文件绝对路径 */
  path(): string {
    if (!this.dbPath) this.dbPath = this.resolvePath()
    return this.dbPath
  }
}

export const database = new FrondDatabase()

/**
 * 主进程入口安装函数。
 * 必须在 app.whenReady() 之后调用一次。
 */
export function installDatabase(): void {
  database.open()
}

/**
 * 主进程退出前清理。
 */
export function uninstallDatabase(): void {
  database.close()
}

export type { Migration }
