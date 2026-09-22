import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 020: 片段文本扩展（M5.1）
 *
 * snip_snippets 加 trigger 列：全局文本扩展的触发关键词（如 ";brb"）。
 * 非空即参与扩展引擎；NULL/空串 = 不参与。
 */
export const m020_snippet_trigger: Migration = {
  version: 20,
  name: 'snippet_trigger',
  up(db: Database.Database) {
    const cols = db.prepare(`PRAGMA table_info(snip_snippets)`).all() as Array<{ name: string }>
    if (!cols.some((c) => c.name === 'trigger')) {
      db.exec(`ALTER TABLE snip_snippets ADD COLUMN trigger TEXT`)
    }
  }
}
