import type Database from 'better-sqlite3'
import type { Migration } from './index'
import { decryptText } from '../../utils/crypto'
import { log } from '../../services/LogService'

/**
 * Frond · Migration 033 — 片段搜索投影补 trigger（批3）
 *
 * 032 的 search_text 投影为 title/description/contents；批3 搜索全量下沉 SQL 后
 * （SnippetList 分页列表），与旧客户端过滤的唯一语义差是 trigger——旧 includes
 * 会多搜触发词。本条把 trigger 拼入投影并遍历重建存量（contents 密文须解密后
 * 明文拼接，照 032 模式）。单条密文不可解时 value 不进投影，宁可漏不可崩。
 */
export const m033_snippet_search_text_trigger: Migration = {
  version: 33,
  name: 'snippet_search_text_trigger',
  up(db: Database.Database) {
    db.transaction(() => {
      const rows = db
        .prepare(`SELECT id, title, description, trigger FROM snip_snippets`)
        .all() as Array<{
        id: string
        title: string
        description: string | null
        trigger: string | null
      }>
      const contentsStmt = db.prepare(
        `SELECT label, value FROM snip_snippet_contents WHERE snippet_id = ? ORDER BY position ASC, id ASC`
      )
      const updateStmt = db.prepare(`UPDATE snip_snippets SET search_text = ? WHERE id = ?`)

      for (const row of rows) {
        const parts: string[] = [row.title ?? '', row.description ?? '', row.trigger ?? '']
        const contents = contentsStmt.all(row.id) as Array<{ label: string; value: string }>
        for (const c of contents) {
          parts.push(c.label ?? '')
          try {
            parts.push(decryptText(c.value))
          } catch (e) {
            // 密文不可解：value 不进投影，label 仍可搜（与 032 同立场）
            log.debug('033_snippet_search_text_trigger', '密文不可解：value 不进投影', e)
          }
        }
        updateStmt.run(parts.join('\n'), row.id)
      }
    })()
  }
}
