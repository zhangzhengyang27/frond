/**
 * Frond · NotesRepository
 *
 * 轻量笔记数据访问层：
 * - notes 主表 + note_folders 文件夹表 + notes_fts 全文搜索
 * - 支持 CRUD、文件夹分类、置顶、软删除（回收站）、全文搜索
 *
 * 设计约束：
 * - 纯 Markdown 文本，不做富文本
 * - 本地优先，不做云同步
 * - 标题为空时自动取内容首行
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { now, likeContains } from '../repo'

export interface Note {
  id: string
  title: string
  content: string
  folderId: string | null
  isPinned: boolean
  isDeleted: boolean
  createdAt: number
  updatedAt: number
}

export interface NoteFolder {
  id: string
  name: string
  position: number
  createdAt: number
  updatedAt: number
}

export interface NoteFilter {
  folderId?: string | null
  isPinned?: boolean
  isDeleted?: boolean
  search?: string
}

interface NoteRow {
  id: string
  title: string
  content: string
  folder_id: string | null
  is_pinned: number
  is_deleted: number
  created_at: number
  updated_at: number
}

interface FolderRow {
  id: string
  name: string
  position: number
  created_at: number
  updated_at: number
}

export class NotesRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  private fromRow(row: NoteRow): Note {
    return {
      id: row.id,
      title: row.title,
      content: row.content,
      folderId: row.folder_id,
      isPinned: row.is_pinned === 1,
      isDeleted: row.is_deleted === 1,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  private folderFromRow(row: FolderRow): NoteFolder {
    return {
      id: row.id,
      name: row.name,
      position: row.position,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  /** 从内容首行自动生成标题 */
  private autoTitle(content: string): string {
    const firstLine = content.split('\n').find((l) => l.trim())
    if (!firstLine) return '无标题笔记'
    // 去除 Markdown 标题标记
    return (
      firstLine
        .replace(/^#+\s*/, '')
        .trim()
        .slice(0, 80) || '无标题笔记'
    )
  }

  // ---------- Notes CRUD ----------

  getNotes(filter?: NoteFilter): Note[] {
    const wheres: string[] = []
    const params: Array<string | number> = []

    if (filter?.isDeleted === true) {
      wheres.push('is_deleted = 1')
    } else if (filter?.isDeleted === false) {
      wheres.push('is_deleted = 0')
    }

    if (filter?.folderId !== undefined) {
      if (filter.folderId === null) {
        wheres.push('folder_id IS NULL')
      } else {
        wheres.push('folder_id = ?')
        params.push(filter.folderId)
      }
    }

    if (filter?.isPinned !== undefined) {
      wheres.push('is_pinned = ?')
      params.push(filter.isPinned ? 1 : 0)
    }

    // 子串搜索下推 SQL：只物化命中行（notes 明文存储，可直接 LIKE）。
    // 不用 FTS5——它按 token 匹配，给不了「子串包含」语义（中文搜索会退化）。
    // LIKE 默认对 ASCII 不区分大小写；% _ \ 已转义
    if (filter?.search) {
      const pat = likeContains(filter.search)
      wheres.push(`(title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\')`)
      params.push(pat, pat)
    }

    let sql = `SELECT * FROM notes`
    sql += wheres.length ? ` WHERE ${wheres.join(' AND ')}` : ''
    // 置顶优先，然后按更新时间倒序
    sql += ` ORDER BY is_pinned DESC, updated_at DESC, rowid DESC`

    const rows = this.db.prepare(sql).all(...params) as NoteRow[]
    return rows.map((r) => this.fromRow(r))
  }

  getNoteById(id: string): Note | undefined {
    const row = this.db.prepare(`SELECT * FROM notes WHERE id = ?`).get(id) as NoteRow | undefined
    return row ? this.fromRow(row) : undefined
  }

  addNote(data: { title?: string; content?: string; folderId?: string | null }): Note {
    const ts = now()
    const id = uuidv4()
    const content = data.content ?? ''
    const title = data.title?.trim() || this.autoTitle(content)

    this.db
      .prepare(
        `INSERT INTO notes (id, title, content, folder_id, is_pinned, is_deleted, created_at, updated_at)
         VALUES (?, ?, ?, ?, 0, 0, ?, ?)`
      )
      .run(id, title, content, data.folderId ?? null, ts, ts)

    return this.getNoteById(id)!
  }

  updateNote(
    id: string,
    updates: Partial<Pick<Note, 'title' | 'content' | 'folderId' | 'isPinned'>>
  ): Note | undefined {
    const existing = this.getNoteById(id)
    if (!existing) return undefined

    const ts = now()
    const content = updates.content !== undefined ? updates.content : existing.content
    const title =
      updates.title !== undefined ? updates.title.trim() || this.autoTitle(content) : existing.title

    this.db
      .prepare(
        `UPDATE notes SET title = ?, content = ?, folder_id = ?, is_pinned = ?, updated_at = ? WHERE id = ?`
      )
      .run(
        title,
        content,
        updates.folderId !== undefined ? updates.folderId : existing.folderId,
        updates.isPinned !== undefined ? (updates.isPinned ? 1 : 0) : existing.isPinned ? 1 : 0,
        ts,
        id
      )

    return this.getNoteById(id)
  }

  /** 软删除（移入回收站） */
  trashNote(id: string): boolean {
    const ts = now()
    const r = this.db
      .prepare(`UPDATE notes SET is_deleted = 1, updated_at = ? WHERE id = ?`)
      .run(ts, id)
    return r.changes > 0
  }

  /** 从回收站恢复 */
  restoreNote(id: string): boolean {
    const ts = now()
    const r = this.db
      .prepare(`UPDATE notes SET is_deleted = 0, updated_at = ? WHERE id = ?`)
      .run(ts, id)
    return r.changes > 0
  }

  /** 永久删除 */
  permanentlyDeleteNote(id: string): boolean {
    const r = this.db.prepare(`DELETE FROM notes WHERE id = ?`).run(id)
    return r.changes > 0
  }

  /** 清空回收站 */
  emptyTrash(): number {
    const r = this.db.prepare(`DELETE FROM notes WHERE is_deleted = 1`).run()
    return r.changes
  }

  /** 切换置顶状态 */
  togglePin(id: string): Note | undefined {
    const note = this.getNoteById(id)
    if (!note) return undefined
    return this.updateNote(id, { isPinned: !note.isPinned })
  }

  getStatistics(): { total: number; trash: number; pinned: number } {
    const total = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM notes WHERE is_deleted = 0`).get() as { n: number }
    ).n
    const trash = (
      this.db.prepare(`SELECT COUNT(*) AS n FROM notes WHERE is_deleted = 1`).get() as { n: number }
    ).n
    const pinned = (
      this.db
        .prepare(`SELECT COUNT(*) AS n FROM notes WHERE is_deleted = 0 AND is_pinned = 1`)
        .get() as { n: number }
    ).n
    return { total, trash, pinned }
  }

  // ---------- Folders CRUD ----------

  getFolders(): NoteFolder[] {
    const rows = this.db
      .prepare(`SELECT * FROM note_folders ORDER BY position ASC, created_at ASC`)
      .all() as FolderRow[]
    return rows.map((r) => this.folderFromRow(r))
  }

  addFolder(name: string): NoteFolder {
    const ts = now()
    const id = uuidv4()
    // position = 当前最大 + 1
    const maxPos = (
      this.db.prepare(`SELECT COALESCE(MAX(position), -1) AS p FROM note_folders`).get() as {
        p: number
      }
    ).p
    this.db
      .prepare(
        `INSERT INTO note_folders (id, name, position, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, name.trim() || '未命名文件夹', maxPos + 1, ts, ts)
    return this.getFolders().find((f) => f.id === id)!
  }

  updateFolder(id: string, name: string): NoteFolder | undefined {
    const ts = now()
    const r = this.db
      .prepare(`UPDATE note_folders SET name = ?, updated_at = ? WHERE id = ?`)
      .run(name.trim(), ts, id)
    if (r.changes === 0) return undefined
    return this.getFolders().find((f) => f.id === id)
  }

  deleteFolder(id: string): boolean {
    // 删除文件夹时，将其中的笔记移到"未分类"（folder_id = NULL）
    const tx = this.db.transaction(() => {
      this.db.prepare(`UPDATE notes SET folder_id = NULL WHERE folder_id = ?`).run(id)
      const r = this.db.prepare(`DELETE FROM note_folders WHERE id = ?`).run(id)
      return r.changes > 0
    })
    return tx()
  }
}

export const notesRepository = new NotesRepository()
