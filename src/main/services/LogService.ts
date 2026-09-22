import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import type Database from 'better-sqlite3'
import { database } from '../db/database'
import { prefRepository } from '../db/repos/PrefRepository'
import type { TelemetryMode } from '../../shared/types'

/**
 * Leaf · LogService
 *
 * 三路输出：console（开发期观察）+ 内存 ring buffer（导出用）+ SQLite log_entries
 * （telemetry 非 off 时才落库/落盘）。
 *
 * 关键约束：日志在 app 装配早期就会被打，那时 installDatabase() 还没跑，
 * 所以任何一层失败都只吞不抛——日志器绝不能把调用方带崩。
 */

export type LogLevel = 'info' | 'warn' | 'error'

interface LogEntry {
  ts: number
  level: LogLevel
  scope: string
  msg: string
  stack?: string
  meta?: string
}

/** 内存里留多少条供导出（导出前先不落盘，避免为看日志而拖慢主流程） */
const RING_SIZE = 1000
/** SQLite 侧最多留多少行，超出按时间从旧到新裁（防长期运行无限涨表） */
const DB_KEEP_ROWS = 5000
const TELEMETRY_KEY = 'telemetry_mode'

class LogService {
  private ring: LogEntry[] = []
  private mode: TelemetryMode = 'local'

  info(scope: string, msg: string): void {
    this.write('info', scope, msg)
  }

  warn(scope: string, msg: string): void {
    this.write('warn', scope, msg)
  }

  /**
   * 第三个参数可选：Error 时取其 stack，普通对象时 JSON 化进 meta_json。
   * 传 error 而不是把 message 拼进 msg，导出时才看得出是哪条调用栈。
   */
  error(scope: string, msg: string, error?: unknown): void {
    const stack = error instanceof Error ? (error.stack ?? undefined) : undefined
    const meta = error !== undefined && !(error instanceof Error) ? this.safeJson(error) : undefined
    this.write('error', scope, msg, stack, meta)
  }

  getMode(): TelemetryMode {
    return this.mode
  }

  setMode(mode: TelemetryMode): void {
    this.mode = mode
    try {
      prefRepository.set(TELEMETRY_KEY, mode)
    } catch {
      /* 库还没起来：本次只在内存生效 */
    }
  }

  /** 由 src/main/index.ts 在 installDatabase() 之后调用 */
  loadTelemetryMode(): void {
    const stored = prefRepository.get(TELEMETRY_KEY)
    if (stored === 'off' || stored === 'local' || stored === 'remote') this.mode = stored
  }

  /** 导出当前 ring buffer + meta 为 JSON 文件，返回绝对路径；写失败返回 null */
  async export(): Promise<string | null> {
    const dir = join(app.getPath('userData'), 'logs')
    const filePath = join(dir, `leaf-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
    try {
      mkdirSync(dir, { recursive: true })
      const payload = {
        meta: {
          exportedAt: new Date().toISOString(),
          appVersion: app.getVersion(),
          platform: process.platform,
          telemetryMode: this.mode,
          entries: this.ring.length
        },
        entries: this.ring
      }
      writeFileSync(filePath, JSON.stringify(payload, null, 2), 'utf-8')
      return filePath
    } catch {
      return null
    }
  }

  private write(
    level: LogLevel,
    scope: string,
    msg: string,
    stack?: string,
    meta?: string
  ): void {
    const entry: LogEntry = { ts: Date.now(), level, scope, msg, stack, meta }
    this.ring.push(entry)
    if (this.ring.length > RING_SIZE) this.ring.splice(0, this.ring.length - RING_SIZE)

    const line = `[${level}] ${scope}: ${msg}`
    if (level === 'error') console.error(line, stack ?? '')
    else if (level === 'warn') console.warn(line)
    else console.log(line)

    if (this.mode === 'off') return
    try {
      const db = database.handle
      db.prepare(
        `INSERT INTO log_entries (ts, level, scope, msg, stack, meta_json) VALUES (?, ?, ?, ?, ?, ?)`
      ).run(entry.ts, level, scope, msg, stack ?? null, meta ?? null)
      this.trim(db)
    } catch {
      /* 库未就绪 / 表还没迁移：内存与 console 已经留下了这条 */
    }
  }

  private trim(db: Database.Database): void {
    db.prepare(
      `DELETE FROM log_entries WHERE id NOT IN (
         SELECT id FROM log_entries ORDER BY ts DESC LIMIT ?
       )`
    ).run(DB_KEEP_ROWS)
  }

  private safeJson(value: unknown): string | undefined {
    try {
      return JSON.stringify(value)
    } catch {
      return undefined
    }
  }
}

export const log = new LogService()

/** 主进程全局兜底（接 uncaughtException / unhandledRejection）。
 * 由 src/main/index.ts 在装配时调用；console 输出便于开发期观察，
 * log.error 负责内存 ring buffer / SQLite / 磁盘持久化（telemetry 非 off 时）。 */
export function installGlobalLogHandlers(): void {
  process.on('uncaughtException', (err) => {
    console.error('[Main] Uncaught Exception:', err)
    log.error('uncaughtException', err.message, err)
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[Main] Unhandled Rejection:', reason)
    log.error(
      'unhandledRejection',
      reason instanceof Error ? reason.message : String(reason),
      reason
    )
  })
}
