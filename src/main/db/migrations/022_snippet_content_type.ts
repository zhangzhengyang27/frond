import type Database from 'better-sqlite3'
import type { Migration } from './index'

/**
 * 022: 片段富文本内容块
 *
 * snip_snippet_contents 加 content_type 列：
 * - 'text'（缺省）：纯文本，扩展时直接键入或纯文本粘贴
 * - 'rich'：value 存 HTML 源，扩展时写入剪贴板 text/html 双格式再粘贴，
 *   目标应用（邮件/文档/聊天）粘贴保留排版
 */
export const m022_snippet_content_type: Migration = {
  version: 22,
  name: 'snippet_content_type',
  up(db: Database.Database) {
    const cols = db.prepare(`PRAGMA table_info(snip_snippet_contents)`).all() as Array<{
      name: string
    }>
    if (!cols.some((c) => c.name === 'content_type')) {
      db.exec(
        `ALTER TABLE snip_snippet_contents ADD COLUMN content_type TEXT NOT NULL DEFAULT 'text'`
      )
    }
  }
}
