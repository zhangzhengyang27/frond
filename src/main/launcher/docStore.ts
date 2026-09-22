/**
 * Leaf · 启动器插件文档存储
 *
 * 每插件隔离的 KV 文档（launcher_docs 表，m019）。
 * doc_id 在存储层以 '<pluginId>:<docId>' 复合，插件侧永远只能触达自己的命名空间。
 */
import type Database from 'better-sqlite3'
import { database } from '../db/database'

export interface LauncherDocRow {
  doc_id: string
  plugin_id: string
  data: string
  updated_at: number
}

export interface ExportedDoc {
  docId: string
  pluginId: string
  data: unknown
  updatedAt: number
}

function qualify(pluginId: string, docId: string): string {
  return `${pluginId}:${docId}`
}

export class LauncherDocStore {
  constructor(private db: Database.Database) {}

  /** 当前绑定的连接句柄（单例失效检测用） */
  get handle(): Database.Database {
    return this.db
  }

  /** 插入/更新（覆盖写） */
  put(pluginId: string, docId: string, data: unknown): { id: string } {
    this.db
      .prepare(
        `INSERT INTO launcher_docs (doc_id, plugin_id, data, updated_at)
         VALUES (?, ?, ?, ?)
         ON CONFLICT(doc_id) DO UPDATE SET data = excluded.data, updated_at = excluded.updated_at`
      )
      .run(qualify(pluginId, docId), pluginId, JSON.stringify(data ?? null), Date.now())
    return { id: docId }
  }

  get(pluginId: string, docId: string): { id: string; data: unknown } | null {
    const row = this.db
      .prepare('SELECT data FROM launcher_docs WHERE doc_id = ?')
      .get(qualify(pluginId, docId)) as { data: string } | undefined
    if (!row) return null
    try {
      return { id: docId, data: JSON.parse(row.data) }
    } catch (error) {
      // 单行损坏不应永久打死该插件的读取
      console.error('[Launcher] doc 解析失败:', qualify(pluginId, docId), (error as Error).message)
      return null
    }
  }

  remove(pluginId: string, docId: string): { ok: boolean } {
    this.db.prepare('DELETE FROM launcher_docs WHERE doc_id = ?').run(qualify(pluginId, docId))
    return { ok: true }
  }

  /** 插件命名空间全量（按更新时间倒序） */
  list(pluginId: string): Array<{ id: string; data: unknown; updatedAt: number }> {
    const rows = this.db
      .prepare(
        'SELECT doc_id, data, updated_at FROM launcher_docs WHERE plugin_id = ? ORDER BY updated_at DESC'
      )
      .all(pluginId) as Array<{ doc_id: string; data: string; updated_at: number }>
    const out: Array<{ id: string; data: unknown; updatedAt: number }> = []
    for (const r of rows) {
      try {
        out.push({
          id: r.doc_id.slice(pluginId.length + 1),
          data: JSON.parse(r.data),
          updatedAt: r.updated_at
        })
      } catch (error) {
        console.error('[Launcher] doc 解析失败，跳过:', r.doc_id, (error as Error).message)
      }
    }
    return out
  }

  /** 卸载插件时清空其命名空间全部文档（ROADMAP 插件内功：卸载清理 KV） */
  deleteByPlugin(pluginId: string): number {
    const info = this.db.prepare('DELETE FROM launcher_docs WHERE plugin_id = ?').run(pluginId)
    return Number(info.changes ?? 0)
  }

  /** 该插件现有文档条数（条数配额用） */
  countByPlugin(pluginId: string): number {
    const row = this.db
      .prepare('SELECT COUNT(*) AS n FROM launcher_docs WHERE plugin_id = ?')
      .get(pluginId) as { n: number }
    return row.n
  }

  /** 文档是否存在（区分 put 的新增与覆盖） */
  exists(pluginId: string, docId: string): boolean {
    const row = this.db
      .prepare('SELECT 1 FROM launcher_docs WHERE doc_id = ? LIMIT 1')
      .get(qualify(pluginId, docId))
    return row !== undefined
  }

  /** WebDAV 备份用：全部文档导出 */
  exportAll(): ExportedDoc[] {
    const rows = this.db
      .prepare('SELECT doc_id, plugin_id, data, updated_at FROM launcher_docs')
      .all() as LauncherDocRow[]
    const out: ExportedDoc[] = []
    for (const r of rows) {
      try {
        out.push({
          docId: r.doc_id.slice(r.plugin_id.length + 1),
          pluginId: r.plugin_id,
          data: JSON.parse(r.data),
          updatedAt: r.updated_at
        })
      } catch (error) {
        console.error('[Launcher] doc 解析失败，跳过:', r.doc_id, (error as Error).message)
      }
    }
    return out
  }

  /** WebDAV 恢复用：全量替换（先清后写，单事务） */
  importAll(docs: ExportedDoc[]): number {
    const tx = this.db.transaction((rows: ExportedDoc[]) => {
      this.db.prepare('DELETE FROM launcher_docs').run()
      const stmt = this.db.prepare(
        `INSERT INTO launcher_docs (doc_id, plugin_id, data, updated_at) VALUES (?, ?, ?, ?)`
      )
      for (const r of rows) {
        stmt.run(
          qualify(r.pluginId, r.docId),
          r.pluginId,
          JSON.stringify(r.data ?? null),
          r.updatedAt
        )
      }
    })
    tx(docs)
    return docs.length
  }
}

/** 生产单例：惰性取 database.handle（调用时机在 installDatabase 之后）。
 * exportDb() 会 close 再懒重开，handle 换新 → 单例必须跟着换，否则持旧连接报错 */
let singleton: LauncherDocStore | null = null

export function getLauncherDocStore(): LauncherDocStore {
  if (!singleton || singleton.handle !== database.handle) {
    singleton = new LauncherDocStore(database.handle)
  }
  return singleton
}
