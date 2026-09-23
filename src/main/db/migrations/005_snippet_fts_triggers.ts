/**
 * Frond · Migration 005 — snip_snippets_fts trigger 补全
 *
 * 001_init 设计了 external-content FTS5 (content='snip_snippets', content_rowid='rowid')
 * 但没创建 trigger，导致外部 INSERT/UPDATE 时镜像不会同步。
 *
 * 5-2 时是 schema 设计阶段遗漏，5-5 单测时手写 INSERT INTO snip_snippets_fts 绕过，
 * 5-6b 时让 SnippetRepository 走 'rebuild' 全量重建（开销可接受但不优雅）。
 *
 * 5-6b fix-up：
 * - 加 AFTER INSERT / DELETE / UPDATE trigger，让 snip_snippets ↔ snip_snippets_fts 镜像自动同步
 * - Migration 首次跑时 'rebuild' 一次，把 existing rows 拉进镜像
 *
 * SQL 参考 SQLite 文档 external-content fts5 用法
 */

import type { Migration } from '.'

export const m005_snippet_fts_triggers: Migration = {
  version: 5,
  name: 'snippet_fts_sync_triggers',
  up(db) {
    db.exec(`
      CREATE TRIGGER IF NOT EXISTS snip_snippets_fts_ai
      AFTER INSERT ON snip_snippets BEGIN
        INSERT INTO snip_snippets_fts(rowid, title, content, description)
        VALUES (new.rowid, new.title, new.content, new.description);
      END;

      CREATE TRIGGER IF NOT EXISTS snip_snippets_fts_ad
      AFTER DELETE ON snip_snippets BEGIN
        INSERT INTO snip_snippets_fts(snip_snippets_fts, rowid, title, content, description)
        VALUES('delete', old.rowid, old.title, old.content, old.description);
      END;

      CREATE TRIGGER IF NOT EXISTS snip_snippets_fts_au
      AFTER UPDATE ON snip_snippets BEGIN
        INSERT INTO snip_snippets_fts(snip_snippets_fts, rowid, title, content, description)
        VALUES('delete', old.rowid, old.title, old.content, old.description);
        INSERT INTO snip_snippets_fts(rowid, title, content, description)
        VALUES (new.rowid, new.title, new.content, new.description);
      END;
    `)
    // 首次跑时把已有 rows 拉进 FTS 镜像
    db.exec(`INSERT INTO snip_snippets_fts(snip_snippets_fts) VALUES('rebuild')`)
  }
}
