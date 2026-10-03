import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * Frond · Migration 034 — 删除片段 FTS5 死重（批4）
 *
 * snip_snippets_fts（001 建，005 建同步触发器）自创建以来**只写不读**：全仓无任何
 * MATCH 查询，搜索实际走 search_text LIKE（032/033）。每次片段写操作都要维护
 * FTS 镜像，纯开销。本条先删三个触发器（它们挂在 snip_snippets 上，不先删则
 * 虚拟表删除后每次写操作抛 no such table），再删虚拟表（影子表由 SQLite 级联删除）。
 *
 * 若未来需要全文检索，建议直接用 search_text 明文列建 FTS（external content），
 * 或在启用时再做一次完整迁移——不留半死不活的镜像。
 */
export const m034_drop_snippet_fts: Migration = {
  version: 34,
  name: 'drop_snippet_fts',
  up(db: Database.Database) {
    db.transaction(() => {
      db.exec(`DROP TRIGGER IF EXISTS snip_snippets_fts_ai`)
      db.exec(`DROP TRIGGER IF EXISTS snip_snippets_fts_ad`)
      db.exec(`DROP TRIGGER IF EXISTS snip_snippets_fts_au`)
      db.exec(`DROP TABLE IF EXISTS snip_snippets_fts`)
    })()
  }
}
