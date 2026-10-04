/**
 * Frond · SnippetRepository
 *
 * 取代 SnippetDataStore（271 行）。
 *
 * Schema: snip_folders / snip_snippets / snip_snippet_contents / snip_tags
 * （批4 迁移 034 已删除只写不读的 snip_snippets_fts 镜像）
 *
 * Snippet.contents[] 已拆到 snip_snippet_contents 子表（migration 004）。
 * 搜索走 search_text 明文列（032 建、033 补 trigger）的 SQL LIKE。
 *
 * 业务接口（兼容旧 SnippetDataStore）：
 * - getSnippets(filters) 支持 folder/tag/favorite/trash/search/folderId null (inbox)
 * - getSnippetById / addSnippet / updateSnippet / deleteSnippet / restoreSnippet
 * - permanentlyDeleteSnippet / emptyTrash / getStatistics / duplicateSnippet
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { sqlFacade, type SqlDb } from '../typedSql'
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
  description?: string | undefined
  contents: SnippetContent[]
  /** 文本扩展触发词（M5.1，如 ";brb"）；空 = 不参与全局扩展 */
  trigger?: string
  folderId?: string | null | undefined
  tagIds: string[]
  isDeleted: boolean
  isFavorites: boolean
  createdAt: number
  updatedAt: number
}

export interface SnippetFilter {
  folderId?: string | null | undefined
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

  // B46：facade 化——链式 prepare 写法保持，行形状由调用点泛型给出
  private get db(): SqlDb {
    return sqlFacade(this._db ?? database.handle)
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
      SnippetRow | undefined
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

  /** 批3：过滤条件构建（getSnippets / listSnippets 共用），含 tagId JOIN 变体 */
  private buildSnippetQuery(filters?: SnippetFilter): {
    sql: string
    params: Array<string | number>
  } {
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
    // B42：搜索下沉 SQL——search_text 是 name/description/trigger/contents 的明文投影
    // （写入路径同步维护，迁移 032 建、033 补 trigger）。LIKE 默认 ASCII 大小写不敏感
    // （CJK 无大小写，语义等价旧 JS toLowerCase 比较）；通配符按字面义转义，
    // 与旧 includes 行为一致
    if (filters?.search) {
      wheres.push(`search_text LIKE ? ESCAPE '\\'`)
      params.push(`%${filters.search.replace(/[\\%_]/g, (m) => `\\${m}`)}%`)
    }

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
    return { sql, params }
  }

  getSnippets(filters?: SnippetFilter): Snippet[] {
    const { sql, params } = this.buildSnippetQuery(filters)
    const rows = this.db
      .prepare(`${sql} ORDER BY updated_at DESC, rowid DESC`)
      .all(...params) as SnippetRow[]
    return this.attachRelations(rows)
  }

  /**
   * B53-3b：胶囊根搜索轻路径——只投影 id/name/language 且 LIMIT 内返回，
   * 不做 attachRelations（逐行 AES 解密全部 contents 是每击键的主进程大头）。
   * 匹配口径与 buildSnippetQuery 的 search 一致（search_text LIKE + 同款转义）。
   * B56-8：必须排除回收站——此前的「不加 deleted 过滤」注释失实（getSnippets
   * 的业务入口经 SnippetDataStore 强制 isDeleted:false），直连 repo 的本方法
   * 曾把已删片段泄漏进胶囊搜索，回车还能复制已删内容。
   */
  quickSearch(query: string, limit: number): Array<{ id: string; name: string; language: string }> {
    const like = `%${query.replace(/[\\%_]/g, (m) => `\\${m}`)}%`
    return this.db
      .prepare(
        `SELECT id, title AS name, language FROM snip_snippets
         WHERE deleted_at IS NULL AND search_text LIKE ? ESCAPE '\\'
         ORDER BY updated_at DESC, rowid DESC LIMIT ?`
      )
      .all(like, limit) as Array<{ id: string; name: string; language: string }>
  }

  /** B56：触发词冲突查询——同触发词的其它在册片段（排除自身与回收站）；无冲突返回 undefined */
  findTriggerConflict(trigger: string, excludeId: string): { id: string; name: string } | undefined {
    const trimmed = trigger.trim()
    if (!trimmed) return undefined
    return (
      this.db
        .prepare(
          `SELECT id, title AS name FROM snip_snippets
           WHERE trigger = ? AND id != ? AND deleted_at IS NULL
           ORDER BY updated_at DESC, rowid DESC LIMIT 1`
        )
        .get(trimmed, excludeId) as { id: string; name: string } | undefined
    )
  }

  /** 批3：分页列表（SnippetList 专用）。total = 同过滤条件总数；写入后按已加载量重拉不跳页 */
  listSnippets(
    filters: SnippetFilter,
    limit: number,
    offset: number
  ): { items: Snippet[]; total: number } {
    const { sql, params } = this.buildSnippetQuery(filters)
    // 子查询包裹：tagId JOIN 变体的 WHERE 落在别名 s 上，COUNT 直接包一层最稳
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM (${sql})`).get(...params) as { n: number }
    ).n
    const rows = this.db
      .prepare(`${sql} ORDER BY updated_at DESC, rowid DESC LIMIT ? OFFSET ?`)
      .all(...params, limit, offset) as SnippetRow[]
    return { items: this.attachRelations(rows), total }
  }

  getSnippetById(id: string): Snippet | undefined {
    const row = this.db.prepare(`SELECT * FROM snip_snippets WHERE id = ?`).get(id) as
      SnippetRow | undefined
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
          `INSERT INTO snip_snippets (id, folder_id, title, content, language, description, trigger, is_favorite, usage_count, created_at, updated_at, deleted_at, search_text)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)`
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
          deletedAt,
          buildSnippetSearchText(snippet.name, snippet.description, snippet.contents, snippet.trigger)
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
    })
    tx()
    return this.hydrate(id)
  }

  updateSnippet(id: string, updates: Partial<Snippet>): Snippet | undefined {
    const existing = this.getSnippetById(id)
    if (!existing) return undefined

    // B56：updated_at 语义 = 「内容修改时间」。contents/name/description/trigger
    // 变更才 bump；folderId/isFavorites 等归档动作保持原值（否则收藏一下就把
    // 老片段顶到「最近修改」首位）
    const contentTouched =
      updates.contents !== undefined ||
      updates.name !== undefined ||
      updates.description !== undefined ||
      updates.trigger !== undefined
    const ts = contentTouched ? now() : existing.updatedAt
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
           SET folder_id = ?, title = ?, description = ?, trigger = ?, is_favorite = ?, updated_at = ?, search_text = ?,
               content = ?, language = ?
           WHERE id = ?`
        )
        .run(
          next.folderId ?? null,
          next.name,
          next.description ?? null,
          next.trigger?.trim() || null,
          next.isFavorites ? 1 : 0,
          ts,
          buildSnippetSearchText(next.name, next.description, next.contents, next.trigger),
          // B56-10：遗留反范式列与子表保持同步（quickSearch 副标题读 language）
          next.contents[0]?.value ?? '',
          next.contents[0]?.language ?? 'plaintext',
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
    })
    tx()
    return this.hydrate(id)
  }

  /** 软删除 */
  deleteSnippet(id: string): boolean {
    const ts = now()
    const r = this.db
      .prepare(`UPDATE snip_snippets SET deleted_at = ? WHERE id = ?`)
      .run(ts, id)
    return r.changes > 0
  }

  /** 硬删除（B56-10：snip_tags 无外键，junction 行必须手动清） */
  permanentlyDeleteSnippet(id: string): boolean {
    const tx = this.db.transaction(() => {
      this.db.prepare(`DELETE FROM snip_tags WHERE snippet_id = ?`).run(id)
      const r = this.db.prepare(`DELETE FROM snip_snippets WHERE id = ?`).run(id)
      return r.changes > 0
    })
    return tx()
  }

  /** 恢复 */
  restoreSnippet(id: string): boolean {
    const r = this.db
      .prepare(`UPDATE snip_snippets SET deleted_at = NULL WHERE id = ?`)
      .run(id)
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
    // B56-10：junction 行随库行一起清（同 permanentlyDeleteSnippet）
    const ids = (
      this.db
        .prepare(`SELECT id FROM snip_snippets WHERE deleted_at IS NOT NULL`)
        .all() as Array<{ id: string }>
    ).map((r) => r.id)
    if (ids.length === 0) return 0
    const tx = this.db.transaction(() => {
      const delTags = this.db.prepare(`DELETE FROM snip_tags WHERE snippet_id = ?`)
      for (const id of ids) delTags.run(id)
      const r = this.db.prepare(`DELETE FROM snip_snippets WHERE deleted_at IS NOT NULL`).run()
      return r.changes
    })
    return tx()
  }

  duplicateSnippet(id: string): Snippet | undefined {
    const orig = this.getSnippetById(id)
    if (!orig) return undefined
    return this.addSnippet({
      name: `${orig.name} (副本)`,
      description: orig.description,
      contents: orig.contents.map(
        (c): SnippetContent => ({
          id: uuidv4(),
          label: c.label,
          value: c.value,
          language: c.language,
          // B56-10：contentType 必须跟随（此前 rich 副本被降级成 text，HTML 源码
          // 被当纯文本渲染/粘贴）
          ...(c.contentType ? { contentType: c.contentType } : {})
        })
      ),
      folderId: orig.folderId,
      tagIds: [...orig.tagIds],
      isDeleted: false,
      isFavorites: false,
      // 副本不继承触发词：同名触发词会让全局展开的命中方随 updatedAt 抖动
      // （B56-12），副本先置空由用户显式设置
      trigger: ''
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
      `INSERT INTO snip_snippets (id, folder_id, title, content, language, description, trigger, is_favorite, usage_count, created_at, updated_at, deleted_at, search_text)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, ?, ?)
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
         deleted_at = excluded.deleted_at,
         search_text = excluded.search_text`
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
          s.isDeleted ? s.updatedAt : null,
          buildSnippetSearchText(s.name, s.description, s.contents, s.trigger)
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

/**
 * 明文搜索投影（B42）：name / description / contents 标签与明文值，\n 拼接。
 * 落在 snip_snippets.search_text（迁移 032），所有写入路径必须同步维护；
 * 搜索下沉 SQL LIKE 后，候选片段不再需要全量解密。
 */
export function buildSnippetSearchText(
  name: string,
  description: string | null | undefined,
  contents: Array<{ label?: string; value?: string }>,
  trigger?: string | null
): string {
  const parts: string[] = [name ?? '', description ?? '', trigger ?? '']
  for (const c of contents) {
    parts.push(c.label ?? '', c.value ?? '')
  }
  return parts.join('\n')
}
