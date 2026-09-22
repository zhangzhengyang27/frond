/**
 * Leaf · FolderRepository
 *
 * 取代 FolderDataStore（299 行）。
 *
 * Schema: folder_folders(id, name, path, parent_id, icon, is_pinned,
 *                       sort_order, created_at, updated_at, last_scan_at,
 *                       default_language, is_open, order_index)
 *
 * 业务接口：getAllFolders / getFolderById / getFoldersByParentId /
 * getFolderTree / getAllSubfolderIds / addFolder / updateFolder /
 * deleteFolder / updateFolderOrder / canMoveFolder
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { now } from '../repo'

export interface Folder {
  id: string
  name: string
  parentId: string | null
  icon: string | null
  defaultLanguage: string
  isOpen: boolean
  orderIndex: number
  createdAt: number
  updatedAt: number
}

interface FolderRow {
  id: string
  name: string
  path: string | null
  parent_id: string | null
  icon: string | null
  is_pinned: number
  sort_order: number
  created_at: number
  updated_at: number
  last_scan_at: number | null
  default_language: string | null
  is_open: number | null
  order_index: number | null
}

export type FolderWithChildren = Folder & { children: FolderWithChildren[] }

export class FolderRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  private fromRow(row: FolderRow): Folder {
    return {
      id: row.id,
      name: row.name,
      parentId: row.parent_id,
      icon: row.icon,
      defaultLanguage: row.default_language ?? 'plaintext',
      isOpen: (row.is_open ?? 0) === 1,
      orderIndex: row.order_index ?? 0,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  /** 全部 */
  getAllFolders(): Folder[] {
    const rows = this.db
      .prepare(`SELECT * FROM folder_folders ORDER BY order_index ASC, name ASC`)
      .all() as FolderRow[]
    return rows.map((r) => this.fromRow(r))
  }

  getFolderById(id: string): Folder | undefined {
    const row = this.db.prepare(`SELECT * FROM folder_folders WHERE id = ?`).get(id) as
      | FolderRow
      | undefined
    return row ? this.fromRow(row) : undefined
  }

  getFoldersByParentId(parentId: string | null): Folder[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM folder_folders WHERE parent_id ${parentId === null ? 'IS NULL' : '= ?'}
         ORDER BY order_index ASC, name ASC`
      )
      .all(...(parentId === null ? [] : [parentId])) as FolderRow[]
    return rows.map((r) => this.fromRow(r))
  }

  /** 递归构建树 */
  getFolderTree(): FolderWithChildren[] {
    const folders = this.getAllFolders()
    const map = new Map<string, FolderWithChildren>()
    for (const f of folders) map.set(f.id, { ...f, children: [] })

    const roots: FolderWithChildren[] = []
    for (const f of folders) {
      const node = map.get(f.id)!
      if (f.parentId === null) {
        roots.push(node)
      } else {
        const parent = map.get(f.parentId)
        if (parent) parent.children.push(node)
      }
    }
    return this.sortTreeRecursive(roots)
  }

  private sortTreeRecursive(nodes: FolderWithChildren[]): FolderWithChildren[] {
    return nodes
      .sort((a, b) => a.orderIndex - b.orderIndex)
      .map((n) => ({ ...n, children: this.sortTreeRecursive(n.children) }))
  }

  /** 递归取所有子节点 id */
  getAllSubfolderIds(folderId: string): string[] {
    const out: string[] = []
    const stack = [folderId]
    while (stack.length > 0) {
      const id = stack.pop()!
      const children = this.getFoldersByParentId(id)
      for (const c of children) {
        out.push(c.id)
        stack.push(c.id)
      }
    }
    return out
  }

  addFolder(folder: Omit<Folder, 'id' | 'createdAt' | 'updatedAt'>): Folder {
    const ts = now()
    const id = uuidv4()
    const siblings = this.getFoldersByParentId(folder.parentId)
    const maxOrder = siblings.reduce((m, s) => Math.max(m, s.orderIndex), -1)

    this.db
      .prepare(
        `INSERT INTO folder_folders (id, name, path, parent_id, icon, is_pinned, sort_order,
                                     created_at, updated_at, default_language, is_open, order_index)
         VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)`
      )
      .run(
        id,
        folder.name,
        folder.name, // path = name (FolderDataStore 接口无 path 字段，沿用 name)
        folder.parentId,
        folder.icon,
        ts,
        ts,
        folder.defaultLanguage,
        folder.isOpen ? 1 : 0,
        maxOrder + 1
      )
    return { ...folder, id, createdAt: ts, updatedAt: ts, orderIndex: maxOrder + 1 }
  }

  updateFolder(id: string, updates: Partial<Folder>): Folder | undefined {
    const existing = this.getFolderById(id)
    if (!existing) return undefined

    const next: Folder = { ...existing, ...updates, id, updatedAt: now() }

    this.db
      .prepare(
        `UPDATE folder_folders
         SET name = ?, parent_id = ?, icon = ?, default_language = ?, is_open = ?, updated_at = ?
         WHERE id = ?`
      )
      .run(
        next.name,
        next.parentId,
        next.icon,
        next.defaultLanguage,
        next.isOpen ? 1 : 0,
        next.updatedAt,
        id
      )
    return next
  }

  /** 递归硬删除（带子节点）；子片段的 folder_id 置空回落到收件箱，不留悬挂引用 */
  deleteFolder(id: string): boolean {
    const existing = this.getFolderById(id)
    if (!existing) return false
    const idsToDelete = [id, ...this.getAllSubfolderIds(id)]
    const placeholders = idsToDelete.map(() => '?').join(',')
    const tx = this.db.transaction(() => {
      // 先摘除引用（inbox 条件是 folder_id IS NULL，悬挂 id 会让片段从所有视图消失）
      this.db
        .prepare(
          `UPDATE snip_snippets SET folder_id = NULL, updated_at = ? WHERE folder_id IN (${placeholders})`
        )
        .run(Date.now(), ...idsToDelete)
      this.db
        .prepare(`DELETE FROM folder_folders WHERE id IN (${placeholders})`)
        .run(...idsToDelete)
    })
    tx()
    return true
  }

  /** 重排（同父级 / 跨父级皆支持） */
  updateFolderOrder(folderId: string, newParentId: string | null, newOrderIndex: number): void {
    const folder = this.getFolderById(folderId)
    if (!folder) return

    const oldParentId = folder.parentId
    const oldOrderIndex = folder.orderIndex
    if (oldParentId === newParentId && oldOrderIndex === newOrderIndex) return

    const ts = now()
    const tx = this.db.transaction(() => {
      if (oldParentId === newParentId) {
        if (newOrderIndex > oldOrderIndex) {
          this.db
            .prepare(
              `UPDATE folder_folders SET order_index = order_index - 1
               WHERE parent_id ${oldParentId === null ? 'IS NULL' : '= ?'}
                 AND id != ? AND order_index > ? AND order_index <= ?`
            )
            .run(
              ...(oldParentId === null ? [] : [oldParentId]),
              folderId,
              oldOrderIndex,
              newOrderIndex
            )
        } else {
          this.db
            .prepare(
              `UPDATE folder_folders SET order_index = order_index + 1
               WHERE parent_id ${oldParentId === null ? 'IS NULL' : '= ?'}
                 AND id != ? AND order_index >= ? AND order_index < ?`
            )
            .run(
              ...(oldParentId === null ? [] : [oldParentId]),
              folderId,
              newOrderIndex,
              oldOrderIndex
            )
        }
      } else {
        this.db
          .prepare(
            `UPDATE folder_folders SET order_index = order_index - 1
             WHERE parent_id ${oldParentId === null ? 'IS NULL' : '= ?'} AND order_index > ?`
          )
          .run(...(oldParentId === null ? [] : [oldParentId]), oldOrderIndex)
        this.db
          .prepare(
            `UPDATE folder_folders SET order_index = order_index + 1
             WHERE parent_id ${newParentId === null ? 'IS NULL' : '= ?'} AND order_index >= ?`
          )
          .run(...(newParentId === null ? [] : [newParentId]), newOrderIndex)
      }
      this.db
        .prepare(
          `UPDATE folder_folders SET parent_id = ?, order_index = ?, updated_at = ? WHERE id = ?`
        )
        .run(newParentId, newOrderIndex, ts, folderId)
    })
    tx()
  }

  canMoveFolder(folderId: string, targetParentId: string | null): boolean {
    if (targetParentId === null) return true
    if (folderId === targetParentId) return false
    const subIds = this.getAllSubfolderIds(folderId)
    return !subIds.includes(targetParentId)
  }

  /** 批量导入（迁移用） */
  importMany(folders: Folder[]): number {
    const stmt = this.db.prepare(
      `INSERT INTO folder_folders (id, name, path, parent_id, icon, is_pinned, sort_order,
                                   created_at, updated_at, default_language, is_open, order_index)
       VALUES (?, ?, ?, ?, ?, 0, 0, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         parent_id = excluded.parent_id,
         icon = excluded.icon,
         default_language = excluded.default_language,
         is_open = excluded.is_open,
         order_index = excluded.order_index,
         updated_at = excluded.updated_at`
    )
    const tx = this.db.transaction((rows: Folder[]) => {
      let n = 0
      for (const f of rows) {
        stmt.run(
          f.id,
          f.name,
          f.name, // path = name（FolderDataStore 接口无 path）
          f.parentId,
          f.icon,
          f.createdAt,
          f.updatedAt,
          f.defaultLanguage,
          f.isOpen ? 1 : 0,
          f.orderIndex
        )
        n += 1
      }
      return n
    })
    return tx(folders)
  }
}

export const folderRepository = new FolderRepository()
