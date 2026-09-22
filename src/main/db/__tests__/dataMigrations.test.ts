import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync, rmSync, writeFileSync, existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'

/**
 * Leaf · 旧 JSON 数据迁移（runDataMigrations）的原子性测试
 *
 * 断言的核心是「失败段不得标记 done、原料不得被归档搬走」——标记 done 等于宣布该模块
 * 已迁移，用户数据就永久缺一段；归档搬走原料则让下一次重试无料可用。
 *
 * ⚠ 恢复说明：本文件随 2026-09-22 删除事故丢了头部（下面的 import / freshDb / env 是按
 * 同目录 dataMigrationsClips.test.ts 的既有写法重建的），首条 it 只剩一个收尾括号，
 * 已无从还原其断言，故该条测试永久丢失；文件内其余两条为找回的原文。
 */

vi.mock('electron', () => ({
  app: {
    getPath: (key: string) => {
      if (key !== 'userData') throw new Error(`unexpected getPath(${key})`)
      if (!process.env.__LEAF_TEST_USER_DATA) throw new Error('test env not set up')
      return process.env.__LEAF_TEST_USER_DATA
    },
    getVersion: () => '0.0.0-test',
    isReady: () => true
  }
}))

import { database } from '../database'
import { migrations } from '../migrations'
import { runDataMigrations } from '../dataMigrations'

function injectDb(db: Database.Database): void {
  ;(database as unknown as { db: Database.Database | null }).db = db
}

function freshDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const m of migrations) m.up(db)
  return db
}

interface TestEnv {
  tmpDir: string
  writeJson: (name: string, value: unknown) => void
}

function metaValue(db: Database.Database, key: string): string | undefined {
  const row = db.prepare('SELECT value FROM leaf_meta WHERE key = ?').get(key) as
    | { value: string }
    | undefined
  return row?.value
}

describe('runDataMigrations', () => {
  let db: Database.Database
  let env: TestEnv

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
    const tmpDir = mkdtempSync(join(tmpdir(), 'leaf-data-migration-'))
    process.env.__LEAF_TEST_USER_DATA = tmpDir
    env = {
      tmpDir,
      writeJson: (name, value) => writeFileSync(join(tmpDir, name), JSON.stringify(value), 'utf-8')
    }
  })

  afterEach(() => {
    rmSync(env.tmpDir, { recursive: true, force: true })
    delete process.env.__LEAF_TEST_USER_DATA
    db.close()
  })

  it('导入失败时不标记 v2 done、不归档旧 JSON，修复后可重跑', () => {
    writeFileSync(join(env.tmpDir, 'pomodoro-data.json'), '{ broken ===', 'utf-8')
    env.writeJson('Folder Data.json', {
      folders: [
        {
          id: 'f-1',
          name: 'F',
          parentId: null,
          icon: null,
          defaultLanguage: 'text',
          isOpen: false,
          orderIndex: 0,
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
    const r1 = runDataMigrations()
    expect(r1.errors.some((e) => e.startsWith('pomodoro:'))).toBe(true)
    expect(r1.foldersImported).toBe(1)
    // 失败段不得标记 done（否则该模块数据永久缺失）
    expect(metaValue(db, 'data_migration_v2')).toBeUndefined()
    // 旧 JSON 留在原地（未归档），供下次重试
    expect(existsSync(join(env.tmpDir, 'pomodoro-data.json'))).toBe(true)

    // 修复坏文件后重跑：v1 不重复执行，v2 导入成功并标记 done
    env.writeJson('pomodoro-data.json', {
      tasks: [{ id: 't-9', title: 'x', completed: false, createdAt: 1 }]
    })
    const r2 = runDataMigrations()
    expect(r2.errors).toEqual([])
    expect(r2.pomodoroTasksImported).toBe(1)
    expect(metaValue(db, 'data_migration_v2')).toBe('done')
  })

  it('v1 失败 + v2 成功：v2 标记 done 但不归档（v1 重跑原料必须保留）', () => {
    // v1 原料损坏：Preferences.json 是坏 JSON
    writeFileSync(join(env.tmpDir, 'Preferences.json'), '{ broken ===', 'utf-8')
    // v2 原料完好
    env.writeJson('Folder Data.json', {
      folders: [
        {
          id: 'f-9',
          name: 'F9',
          parentId: null,
          icon: null,
          defaultLanguage: 'text',
          isOpen: false,
          orderIndex: 0,
          createdAt: 1,
          updatedAt: 1
        }
      ]
    })
    const r1 = runDataMigrations()
    expect(r1.errors.some((e) => e.startsWith('prefs:'))).toBe(true)
    expect(r1.foldersImported).toBe(1)
    // v2 段成功 → v2 标记 done（下次只重跑 v1）
    expect(metaValue(db, 'data_migration_v2')).toBe('done')
    // v1 未标记
    expect(metaValue(db, 'data_migration_v1')).toBeUndefined()
    // 关键：v1 原料不得被归档搬走
    expect(existsSync(join(env.tmpDir, 'Preferences.json'))).toBe(true)

    // 修复后重跑：v1 导入成功，此时才允许归档
    env.writeJson('Preferences.json', { theme: 'dark' })
    const r2 = runDataMigrations()
    expect(r2.errors).toEqual([])
    expect(r2.prefsImported).toBe(1)
    expect(existsSync(join(env.tmpDir, 'Preferences.json'))).toBe(false)
  })
})
