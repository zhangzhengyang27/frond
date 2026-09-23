/**
 * Frond · ProjectRepository
 *
 * 管理 pom_projects 表，为番茄钟任务提供轻量项目分组。
 */

import { v4 as uuidv4 } from 'uuid'
import type Database from 'better-sqlite3'
import { database } from '../database'
import { now } from '../repo'

export interface PomodoroProject {
  id: string
  name: string
  color: string
  sortOrder: number
  createdAt: number
  updatedAt: number
}

interface ProjectRow {
  id: string
  name: string
  color: string
  sort_order: number
  created_at: number
  updated_at: number
  deleted_at: number | null
}

const DEFAULT_PROJECT_COLOR = '#4a90e2'

export class ProjectRepository {
  constructor(private readonly _db?: Database.Database) {}

  private get db(): Database.Database {
    return this._db ?? database.handle
  }

  private fromRow(row: ProjectRow): PomodoroProject {
    return {
      id: row.id,
      name: row.name,
      color: row.color,
      sortOrder: row.sort_order,
      createdAt: row.created_at,
      updatedAt: row.updated_at
    }
  }

  getAll(): PomodoroProject[] {
    const rows = this.db
      .prepare(
        `SELECT * FROM pom_projects
         WHERE deleted_at IS NULL
         ORDER BY sort_order ASC, created_at ASC`
      )
      .all() as ProjectRow[]
    return rows.map((row) => this.fromRow(row))
  }

  getById(id: string): PomodoroProject | null {
    const row = this.db
      .prepare(`SELECT * FROM pom_projects WHERE id = ? AND deleted_at IS NULL`)
      .get(id) as ProjectRow | undefined
    return row ? this.fromRow(row) : null
  }

  add(name: string, color = DEFAULT_PROJECT_COLOR): PomodoroProject {
    const trimmedName = name.trim()
    if (!trimmedName) throw new Error('[ProjectRepository] name is required')

    const ts = now()
    const id = uuidv4()
    const maxOrder = this.db
      .prepare(
        `SELECT COALESCE(MAX(sort_order), -1) AS max_order
         FROM pom_projects WHERE deleted_at IS NULL`
      )
      .get() as { max_order: number }
    const sortOrder = maxOrder.max_order + 1

    this.db
      .prepare(
        `INSERT INTO pom_projects
         (id, name, color, sort_order, created_at, updated_at, deleted_at)
         VALUES (?, ?, ?, ?, ?, ?, NULL)`
      )
      .run(id, trimmedName, color, sortOrder, ts, ts)

    return {
      id,
      name: trimmedName,
      color,
      sortOrder,
      createdAt: ts,
      updatedAt: ts
    }
  }

  update(
    id: string,
    updates: { name?: string; color?: string; sortOrder?: number }
  ): PomodoroProject | null {
    const existing = this.getById(id)
    if (!existing) return null

    const name = updates.name === undefined ? existing.name : updates.name.trim()
    if (!name) throw new Error('[ProjectRepository] name cannot be empty')

    const next = {
      name,
      color: updates.color ?? existing.color,
      sortOrder: updates.sortOrder ?? existing.sortOrder
    }
    const ts = now()

    this.db
      .prepare(
        `UPDATE pom_projects
         SET name = ?, color = ?, sort_order = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(next.name, next.color, next.sortOrder, ts, id)

    return { ...existing, ...next, updatedAt: ts }
  }

  softDelete(id: string): boolean {
    const ts = now()
    const result = this.db
      .prepare(
        `UPDATE pom_projects SET deleted_at = ?, updated_at = ?
         WHERE id = ? AND deleted_at IS NULL`
      )
      .run(ts, ts, id)
    return result.changes > 0
  }
}

export const projectRepository = new ProjectRepository()
