import type Database from 'better-sqlite3'
import type { Migration } from './index'
import { decryptText } from '../../utils/crypto'

/**
 * Frond · Migration 032 — 片段明文搜索列（B42）
 *
 * contents.value 自 004 起加密存储（AES-GCM），SQL/FTS 无法匹配密文——
 * 搜索只能在 JS 层对候选全量解密（千条级每键数十 ms）。本条给
 * snip_snippets 加 `search_text`（title/description/contents 明文投影，
 * 写入路径由仓库层同步维护），搜索下沉到 SQL LIKE。
 *
 * 回填：逐条解密 contents 拼进 search_text；单条解不开（密钥缺失/密文损坏）
 * 该条置空——搜索漏报直到下次编辑重写，宁可漏不可崩（与加密「拒绝静默降级
 * 为明文」的立场一致：这里降级的只是搜索投影，不是内容本体）。
 */
export const m032_snippet_search_text: Migration = {
  version: 32,
  name: 'snippet_search_text',
  up(db: Database.Database) {
    db.transaction(() => {
      const columns = db.prepare('PRAGMA table_info(snip_snippets)').all() as Array<{
        name: string
      }>
      if (!columns.some((c) => c.name === 'search_text')) {
        db.exec(`ALTER TABLE snip_snippets ADD COLUMN search_text TEXT NOT NULL DEFAULT ''`)
      }

      const rows = db
        .prepare(`SELECT id, title, description FROM snip_snippets`)
        .all() as Array<{ id: string; title: string; description: string | null }>
      const contentsStmt = db.prepare(
        `SELECT label, value FROM snip_snippet_contents WHERE snippet_id = ? ORDER BY position ASC, id ASC`
      )
      const updateStmt = db.prepare(`UPDATE snip_snippets SET search_text = ? WHERE id = ?`)

      for (const row of rows) {
        const parts: string[] = [row.title ?? '', row.description ?? '']
        const contents = contentsStmt.all(row.id) as Array<{ label: string; value: string }>
        for (const c of contents) {
          parts.push(c.label ?? '')
          try {
            parts.push(decryptText(c.value))
          } catch {
            /* 密文不可解：value 不进投影，label 仍可搜 */
          }
        }
        updateStmt.run(parts.join('\n'), row.id)
      }
    })()
  }
}
