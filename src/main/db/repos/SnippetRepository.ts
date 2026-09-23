/**
 * Leaf · SnippetRepository
 *
 * 取代 SnippetDataStore（271 行）。
 *
 * Schema: snip_folders / snip_snippets + snip_snippets_fts / snip_snippet_contents / snip_tags
 *
 * Snippet.contents[] 已拆到 snip_snippet_contents 子表（migration 004）。
 * FTS5 用 external content 方式 + 手动同步（当前 schema 缺 trigger，写入时手动 upsert）。
 *
 * 业务接口（兼容旧 SnippetDataStore）：
 * - getSnippets(filters) 支持 folder/tag/favorite/trash/search/folderId null (inbox)
 * - getSnippetById / addSnippet / updateSnippet / deleteSnippet / restoreSnippet
 * - permanentlyDeleteSnippet / emptyTrash / getStatistics / duplicateSnippet
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { now } from '../repo'
import { encryptText, decryptText } from '../../utils/crypto'

export type SnippetContentType = 'text' | 'rich'

export interface SnippetContent {
  id: string
  label: string
  value: string
  language: string
  /** 'rich' 时 value 为 HTML 源，扩展走剪贴板 text/html 双格式粘贴 */
  contentType?: SnippetContentType
}

export interface Snippet {
  id: string
  name: string
  description?: string
  contents: SnippetContent[]
  /** 文本扩展触发词（M5.1，如 ";brb"）；空 = 不参与全局扩展 */
  trigger?: string
  folderId?: string | null
  tagIds: string[]
  isDeleted: boolean
  isFavorites: boolean
  createdAt: number
  updatedAt: number
}

export interface SnippetFilter {
  folderId?: string | null
  tagId?: string
  isFavorites?: boolean
  isDeleted?: boolean
  isInbox?: boolean
  search?: string
}

interface SnippetRow {
  id: string
  folder_id: string | null
  title: string
  content: string
  language: string
  description: string | null
  trigger: string | null
  is_favorite: number
  usage_count: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

interface ContentRow {
  id: string
  snippet_id: string
  label: string
  value: string
  language: string
  position: number
  content_type?: string | null
}

/** row.content_type → 'text' | 'rich'（历史行/异常值归一为 text） */
function contentTypeOf(row: Pick<ContentRow, 'content_type'>): SnippetContentType {
  return row.content_type === 'rich' ? 'rich' : 'text'
}

interface TagJunctionRow {
  snippet_id: string
  tag_id: string
}

export class SnippetRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  /** 高频单条查询的语句缓存：better-sqlite3 的 prepare 不缓存，逐次编译浪费 */
  private stmtsCache: { contents: Database.Statement; tagIds: Database.Statement } | null = null
  private get stmts(): { contents: Database.Statement; tagIds: Database.Statement } {
    if (!this.stmtsCache) {
      this.stmtsCache = {
        contents: this.db.prepare(
          `SELECT * FROM snip_snippet_contents WHERE snippet_id = ? ORDER BY position ASC, id ASC`
        ),
        tagIds: this.db.prepare(`SELECT tag_id FROM snip_tags WHERE snippet_id = ?`)
      }
    }
    return this.stmtsCache
  }

  // ---------- mapping ----------

  private hydrate(snippetId: string): Snippet {
    const row = this.db.prepare(`SELECT * FROM snip_snippets WHERE id = ?`).get(snippetId) as
      | SnippetRow
      | undefined
    if (!row) throw new Error('[SnippetRepository] snippet missing: ' + snippetId)
    return this.fromRow(row, this.getContents(snippetId), this.getTagIds(snippetId))
  }

  private fromRow(row: SnippetRow, contents: SnippetContent[], tagIds: string[]): Snippet {
    const s: Snippet = {
      id: row.id,
      name: row.title,
      contents,
      folderId: row.folder_id,
      tagIds,
      isDeleted: row.deleted_at !== null,
      isFavorites: row.is_favorite === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
    if (row.description) s.description = row.description
    if (row.trigger) s.trigger = row.trigger
    return s
  }

  private getContents(snippetId: string): SnippetContent[] {
    const rows = this.stmts.contents.all(snippetId) as ContentRow[]
    return rows.map((r) => ({
      id: r.id,
      label: r.label,
      value: decryptText(r.value),
      language: r.language,
      contentType: contentTypeOf(r)
    }))
  }

  private getTagIds(snippetId: string): string[] {
    const rows = this.stmts.tagIds.all(snippetId) as TagJunctionRow[]
    return rows.map((r) => r.tag_id)
  }

  /**
   * 批量取多条 snippet 的 contents / tagIds：单条查询在列表路径是 N+1，
   * 且 better-sqlite3 的 prepare 不缓存（此前每行每次调用都重新编译 SQL）。
   */
  private attachRelations(snippets: SnippetRow[]): Snippet[] {
    if (snippets.length === 0) return []
    const ids = snippets.map((r) => r.id)
    const placeholders = ids.map(() => '?').join(',')
    const contentRows = this.db
      .prepare(
        `SELECT * FROM snip_snippet_contents
         WHERE snippet_id IN (${placeholders})
         ORDER BY snippet_id, position ASC, id ASC`
      )
      .all(...ids) as ContentRow[]
    const tagRows = this.db
      .prepare(`SELECT snippet_id, tag_id FROM snip_tags WHERE snippet_id IN (${placeholders})`)
      .all(...ids) as TagJunctionRow[]

    const contentsBySnippet = new Map<string, SnippetContent[]>()
    for (const r of contentRows) {
      const list = contentsBySnippet.get(r.snippet_id) ?? []
      list.push({
        id: r.id,
        label: r.label,
        value: decryptText(r.value),
        language: r.language,
        contentType: contentTypeOf(r)
      })
      contentsBySnippet.set(r.snippet_id, list)
    }
    const tagsBySnippet = new Map<string, string[]>()
    for (const r of tagRows) {
      const list = tagsBySnippet.get(r.snippet_id) ?? []
      list.push(r.tag_id)
      tagsBySnippet.set(r.snippet_id, list)
    }
    return snippets.map((r) =>
      this.fromRow(r, contentsBySnippet.get(r.id) ?? [], tagsBySnippet.get(r.id) ?? [])
    )
  }

  // ---------- CRUD ----------

  getSnippets(filters?: SnippetFilter): Snippet[] {
    const wheres: string[] = []
    const params: Array<string | number> = []

    // isDeleted = undefined → 不加 deleted_at 过滤（让用户决定）
    if (filters?.isDeleted === true) {
      wheres.push('deleted_at IS NOT NULL')
    } else if (filters?.isDeleted === false) {
      wheres.push('deleted_at IS NULL')
    }
    // else: 不加 deleted_at 过滤
    if (filters?.folderId !== undefined) {
      if (filters.folderId === null && filters.isInbox) {
        wheres.push('folder_id IS NULL')
      } else if (filters.folderId !== null) {
        wheres.push('folder_id = ?')
        params.push(filters.folderId)
      }
    }
    if (filters?.isFavorites !== undefined) {
      wheres.push(`is_favorite = ?`)
      params.push(filters.isFavorites ? 1 : 0)
    }

    // tagId 需要 JOIN
    let sql = `SELECT * FROM snip_snippets`
    if (filters?.tagId) {
      sql = `SELECT s.* FROM snip_snippets s
             INNER JOIN snip_tags st ON st.snippet_id = s.id
             WHERE st.tag_id = ?`
      params.unshift(filters.tagId)
      // 业务默认软删除的 snippet 不显示
      wheres.forEach((w) => {
        sql += ` AND ${w}`
      })
    } else {
      sql += wheres.length ? ` WHERE ${wheres.join(' AND ')}` : ''
    }

    sql += ` ORDER BY updated_at DESC, rowid DESC`

    const rows = this.db.prepare(sql).all(...params) as SnippetRow[]

    let snippets = this.attachRelations(rows)

    // 搜索只能在 JS 层做：contents.value 加密存储（encryptText），SQL/FTS 无法
    // 匹配密文；且 FTS5 按 token 匹配给不了「子串包含」语义。代价是候选片段
    // 全量解密——数据量大时的根治方案是改存储格式（明文内容列或自研 tokenizer）
    if (filters?.search) {
      const lower = filters.search.toLowerCase()
      snippets = snippets.filter((s) => {
        const nameMatch = s.name.toLowerCase().includes(lower)
        const descMatch = s.description?.toLowerCase().includes(lower)
        const contentMatch = s.contents.some(
          (c) => c.label.toLowerCase().includes(lower) || c.value.toLowerCase().includes(lower)
        )
        return nameMatch || descMatch || contentMatch
      })
    }

    return snippets
  }

  getSnippetById(id: string): Snippet | undefined {
    const row = this.db.prepare(`SELECT * FROM snip_snippets WHERE id = ?`).get(id) as
      | SnippetRow
      | undefined
    if (!row) return undefined
    return this.fromRow(row, this.getContents(id), this.getTagIds(id))
  }

  addSnippet(snippet: Omit<Snippet, 'id' | 'createdAt' | 'updatedAt'>): Snippet {
    const ts = now()
    const id = uuidv4()
    const deletedAt = snippet.isDeleted ? ts : null
    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `INSERT INTO snip_snippets (id, folder_id, title, content, language, description, trigger, is_favorite, usage_count, created_at, updated_at, deleted_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)`
        )
        .run(
          id,
          snippet.folderId ?? null,
          snippet.name,
          snippet.contents[0]?.value ?? '',
          snippet.contents[0]?.language ?? 'plaintext',
          snippet.description ?? null,
          snippet.trigger?.trim() || null,
          snippet.isFavorites ? 1 : 0,
          ts,
          ts,
          deletedAt
        )
      const contentInsert = this.db.prepare(
        `INSERT INTO snip_snippet_contents (id, snippet_id, label, value, language, position, content_type)
         VALUES (?, ?, ?, ?, ?, ?, ?)`
      )
      snippet.contents.forEach((c, idx) => {
        contentInsert.run(
          c.id || uuidv4(),
          id,
          c.label,
          encryptText(c.value),
          c.language,
          idx,
          c.contentType === 'rich' ? 'rich' : 'text'
        )
      })
      // tag 关联
      const tagInsert = this.db.prepare(
        `INSERT INTO snip_tags (snippet_id, tag_id, created_at) VALUES (?, ?, ?)`
      )
      snippet.tagIds.forEach((tagId) => tagInsert.run(id, tagId, ts))
      // FTS 同步由 trigger 自动完成（migration 005）
    })
    tx()
    return this.hydrate(id)
  }

  updateSnippet(id: string, updates: Partial<Snippet>): Snippet | undefined {
    const existing = this.getSnippetById(id)
    if (!existing) return undefined

    const ts = now()
    const next: Snippet = {
      ...existing,
      ...updates,
      id,
      updatedAt: ts
    }

    const tx = this.db.transaction(() => {
      this.db
        .prepare(
          `UPDATE snip_snippets
           SET folder_id = ?, title = ?, description = ?, trigger = ?, is_favorite = ?, updated_at = ?
           WHERE id = ?`
        )
        .run(
          next.folderId ?? null,
          next.name,
          next.description ?? null,
          next.trigger?.trim() || null,
          next.isFavorites ? 1 : 0,
          ts,
          id
        )

      if (updates.contents) {
        this.db.prepare(`DELETE FROM snip_snippet_contents WHERE snippet_id = ?`).run(id)
        const ins = this.db.prepare(
          `INSERT INTO snip_snippet_contents (id, snippet_id, label, value, language, position, content_type)
           VALUES (?, ?, ?, ?, ?, ?, ?)`
        )
        updates.contents.forEach((c, idx) => {
          ins.run(
            c.id || uuidv4(),
            id,
            c.label,
            encryptText(c.value),
            c.language,
            idx,
            c.contentType === 'rich' ? 'rich' : 'text'
          )
        })
      }

      if (updates.tagIds) {
        this.db.prepare(`DELETE FROM snip_tags WHERE snippet_id = ?`).run(id)
        const ins = this.db.prepare(
          `INSERT INTO snip_tags (snippet_id, tag_id, created_at) VALUES (?, ?, ?)`
        )
        updates.tagIds.forEach((tagId) => ins.run(id, tagId, ts))
      }

      // FTS 同步由 trigger 自动完成
    })
    tx()
    return this.hydrate(id)
  }

  /** 软删除 */
  deleteSnippet(id: string): boolean {
    const ts = now()
    const r = this.db
      .prepare(`UPDATE snip_snippets SET deleted_at = ?, updated_at = ? WHERE id = ?`)
      .run(ts, ts, id)
    return r.changes > 0
  }

  /** 硬删除 */
  permanentlyDeleteSnippet(id: string): boolean {
    const r = this.db.prepare(`DELETE FROM snip_snippets WHERE id = ?`).run(id)
    return r.changes > 0
  }

  /** 恢复 */
  restoreSnippet(id: string): boolean {
    const ts = now()
    const r = this.db
      .prepare(`UPDATE snip_snippets SET deleted_at = NULL, updated_at = ? WHERE id = ?`)
      .run(ts, id)
    return r.changes > 0
  }

  getStatistics(): { total: number; trash: number } {
    const a = this.db
      .prepare(`SELECT COUNT(*) AS n FROM snip_snippets WHERE deleted_at IS NULL`)
      .get() as { n: number }
    const b = this.db
      .prepare(`SELECT COUNT(*) AS n FROM snip_snippets WHERE deleted_at IS NOT NULL`)
      .get() as { n: number }
    return { total: a.n, trash: b.n }
  }

  emptyTrash(): number {
    const r = this.db.prepare(`DELETE FROM snip_snippets WHERE deleted_at IS NOT NULL`).run()
    return r.changes
  }

  duplicateSnippet(id: string): Snippet | undefined {
    const orig = this.getSnippetById(id)
    if (!orig) return undefined
    return this.addSnippet({
      name: `${orig.name} (副本)`,
      description: orig.description,
      contents: orig.contents.map((c) => ({
        id: uuidv4(),
        label: c.label,
        value: c.value,
        language: c.language
      })),
      folderId: orig.folderId,
      tagIds: [...orig.tagIds],
      isDeleted: false,
      isFavorites: false
    })
  }

  /**
   * 批量导入（dataMigration 用）。
   *
   * 兼容旧 SnippetDataStore JSON 形态：snippets[] + 每条带 contents[]。
   * 幂等：ON CONFLICT(id) DO UPDATE；contents / tags 全量重写。
   */
  importMany(snippets: Snippet[]): number {
    const insertSnippet = this.db.prepare(
      `INSERT INTO snip_snippets (id, folder_id, title, content, language, description, trigger, is_favorite, usage_count, created_at, updated_at, deleted_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         folder_id = excluded.folder_id,
         title = excluded.title,
         content = excluded.content,
         language = excluded.language,
         description = excluded.description,
         trigger = excluded.trigger,
         is_favorite = excluded.is_favorite,
         created_at = excluded.created_at,
         updated_at = excluded.updated_at,
         deleted_at = excluded.deleted_at`
    )
    const deleteContents = this.db.prepare(`DELETE FROM snip_snippet_contents WHERE snippet_id = ?`)
    const insertContent = this.db.prepare(
      `INSERT INTO snip_snippet_contents (id, snippet_id, label, value, language, position, content_type)
       VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    const deleteTags = this.db.prepare(`DELETE FROM snip_tags WHERE snippet_id = ?`)
    const insertTag = this.db.prepare(
      `INSERT INTO snip_tags (snippet_id, tag_id, created_at) VALUES (?, ?, ?)`
    )

    const tx = this.db.transaction((rows: Snippet[]) => {
      let n = 0
      for (const s of rows) {
        const first = s.contents[0]
        insertSnippet.run(
          s.id,
          s.folderId ?? null,
          s.name,
          first?.value ?? '',
          first?.language ?? 'plaintext',
          s.description ?? null,
          s.trigger?.trim() || null,
          s.isFavorites ? 1 : 0,
          s.createdAt,
          s.updatedAt,
          s.isDeleted ? s.updatedAt : null
        )
        deleteContents.run(s.id)
        s.contents.forEach((c, idx) => {
          insertContent.run(
            c.id || uuidv4(),
            s.id,
            c.label,
            encryptText(c.value),
            c.language,
            idx,
            c.contentType === 'rich' ? 'rich' : 'text'
          )
        })
        deleteTags.run(s.id)
        s.tagIds.forEach((tagId) => insertTag.run(s.id, tagId, Date.now()))
        n += 1
      }
      return n
    })
    return tx(snippets)
  }
}

export const snippetRepository = new SnippetRepository()

