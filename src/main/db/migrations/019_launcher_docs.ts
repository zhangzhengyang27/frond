import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 019: 启动器插件文档存储
 *
 * launcher_docs：按插件隔离的 KV 文档（data 为 JSON 字符串），
 * doc_id 以 '<pluginId>:<docId>' 复合主键，杜绝跨插件越权访问。
 */
export const m019_launcher_docs: Migration = {
  version: 19,
  name: 'launcher_docs',
  up(db: Database.Database) {
    db.transaction(() => {
      db.exec(`CREATE TABLE IF NOT EXISTS launcher_docs (
        doc_id TEXT PRIMARY KEY,
        plugin_id TEXT NOT NULL,
        data TEXT NOT NULL,
        updated_at INTEGER NOT NULL
      )`)
      db.exec(`CREATE INDEX IF NOT EXISTS idx_launcher_docs_plugin ON launcher_docs(plugin_id)`)
    })()
  }
}
