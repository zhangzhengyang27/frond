import { app } from 'electron'
import { join } from 'node:path'
import { mkdirSync, writeFileSync } from 'node:fs'
import type Database from 'better-sqlite3'
import { database } from '../db/database'
import { prefRepository } from '../db/repos/PrefRepository'
import type { TelemetryMode } from '../../shared/types'

/**
 * Frond · LogService
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
  stack?: string | undefined
  meta?: string | undefined
}

/** 内存里留多少条供导出（导出前先不落盘，避免为看日志而拖慢主流程） */
const RING_SIZE = 1000
/** SQLite 侧最多留多少行，超出按时间从旧到新裁（防长期运行无限涨表） */
const DB_KEEP_ROWS = 5000
/** 裁剪节流：每 N 条写入跑一次（单次是 5000 行级 DELETE，日志风暴时按条放大） */
const TRIM_EVERY_N_WRITES = 100
const TELEMETRY_KEY = 'telemetry_mode'

/** B53-11：info 微批阈值——攒满一个事务落库；warn/error 绕过批立即落 */
const LOG_BATCH_SIZE = 25

export class LogService {
  private ring: LogEntry[] = []
  private mode: TelemetryMode = 'local'
  private writesSinceTrim = 0
  /** 语句缓存：INSERT 只 prepare 一次（此前每条日志 prepare，启动装配段放大） */
  private insertStmt: ReturnType<Database.Database['prepare']> | null = null
  private stmtDb: Database.Database | null = null
  /** 微批队列（db 行形状）；warn/error 即时 flush */
  private pending: Array<{
    ts: number
    level: LogLevel
    scope: string
    msg: string
    stack: string | null
    meta: string | null
  }> = []

  info(scope: string, msg: string): void {
    this.write('info', scope, msg)
  }

  /**
   * debug（批 7b）：只进内存环与 console，不落盘——「尽力而为失败的观测点」
   * （空 catch 清账的落点）不该把日志文件撑爆；导出诊断包时随环带走。
   */
  debug(scope: string, msg: string, error?: unknown): void {
    const entry: LogEntry = {
      ts: Date.now(),
      level: 'info',
      scope,
      msg: `[debug] ${msg}${error instanceof Error ? ` :: ${error.message}` : ''}`,
      stack: error instanceof Error ? error.stack : undefined
    }
    this.ring.push(entry)
    if (this.ring.length > RING_SIZE) this.ring.splice(0, this.ring.length - RING_SIZE)
    if (this.mode !== 'off') console.debug(`[${scope}]`, msg, error ?? '')
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
    } catch (e) {
      // 批 7b 空 catch 清账：原注释「* 库还没起来：本次只在内存生效」
      console.debug('[log-service]', '* 库还没起来：本次只在内存生效', e)
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
    const filePath = join(dir, `frond-logs-${new Date().toISOString().replace(/[:.]/g, '-')}.json`)
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

  private write(level: LogLevel, scope: string, msg: string, stack?: string, meta?: string): void {
    // LogEntry 不含 meta（诊断环只留 stack；meta 随 DB 行落库）
    const entry: LogEntry = { ts: Date.now(), level, scope, msg, stack }
    this.ring.push(entry)
    if (this.ring.length > RING_SIZE) this.ring.splice(0, this.ring.length - RING_SIZE)

    const line = `[${level}] ${scope}: ${msg}`
    if (level === 'error') console.error(line, stack ?? '')
    else if (level === 'warn') console.warn(line)
    else console.log(line)

    if (this.mode === 'off') return
    try {
      // B53-11：语句缓存 + 微批——info 攒满 LOG_BATCH_SIZE 一个事务落库；
      // warn/error 立即 flush（诊断价值最高、不接受批窗口丢失，顺带带走积压）
      this.pending.push({
        ts: entry.ts,
        level,
        scope,
        msg,
        stack: stack ?? null,
        meta: meta ?? null
      })
      if (level !== 'info' || this.pending.length >= LOG_BATCH_SIZE) this.flush()
    } catch (e) {
      // 批 7b 空 catch 清账：原注释「* 库未就绪 / 表还没迁移：内存与 console 已经留下了这条」
      console.debug('[log-service]', '* 库未就绪 / 表还没迁移：内存与 console 已经留下了这条', e)
    }
  }

  /** 把微批队列落库（单个事务 + 语句缓存）；无积压时零开销 */
  flush(): void {
    if (this.pending.length === 0) return
    const db = database.handle
    if (this.insertStmt === null || this.stmtDb !== db) {
      this.insertStmt = db.prepare(
        `INSERT INTO log_entries (ts, level, scope, msg, stack, meta_json) VALUES (?, ?, ?, ?, ?, ?)`
      )
      this.stmtDb = db
    }
    const rows = this.pending
    this.pending = []
    db.transaction(() => {
      for (const r of rows) {
        this.insertStmt!.run(r.ts, r.level, r.scope, r.msg, r.stack, r.meta)
      }
    })()
    // 每 100 条裁一次：每条日志都跑一次 5000 行 DELETE 会在日志风暴时放大风暴（B41）
    this.writesSinceTrim += rows.length
    if (this.writesSinceTrim >= TRIM_EVERY_N_WRITES) {
      this.writesSinceTrim = 0
      this.trim(db)
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
