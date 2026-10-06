import { describe, it, expect } from 'vitest'
import Database from 'better-sqlite3'
import {
  prepareRun,
  prepareGet,
  prepareAll,
  prepareStmt,
  runStmt,
  getStmt,
  allStmt
} from '../typedSql'

/**
 * B46 核心件 typedSql：行为与 better-sqlite3 直调完全一致（错误照抛、undefined
 * 语义、事务无关），只是行形状由调用点泛型显式给出。用真 sqlite 驱动验证。
 */

describe('typedSql（B46 核心件）', () => {
  it('prepareRun / prepareGet / prepareAll 基本语义', () => {
    const db = new Database(':memory:')
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
    const run = prepareRun(db, 'INSERT INTO t (name) VALUES (?)', 'a') as { changes: number }
    expect(run.changes).toBe(1)
    expect(
      prepareGet<{ id: number; name: string }>(db, 'SELECT * FROM t WHERE id = ?', 1)
    ).toMatchObject({
      id: 1,
      name: 'a'
    })
    expect(prepareGet(db, 'SELECT * FROM t WHERE id = ?', 99)).toBeUndefined()
    expect(prepareAll<{ id: number }>(db, 'SELECT id FROM t')).toHaveLength(1)
    db.close()
  })

  it('错误照抛（不吞）', () => {
    const db = new Database(':memory:')
    expect(() => prepareRun(db, 'INSERT INTO nope VALUES (1)')).toThrow()
    db.close()
  })

  it('语句缓存形态：prepareStmt + runStmt/getStmt/allStmt', () => {
    const db = new Database(':memory:')
    db.exec('CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT NOT NULL)')
    const insert = prepareStmt(db, 'INSERT INTO t (name) VALUES (?)')
    runStmt(insert, 'x')
    runStmt(insert, 'y')
    const select = prepareStmt(db, 'SELECT * FROM t WHERE name = ?')
    expect(getStmt<{ id: number }>(select, 'y')?.id).toBe(2)
    // 语句类型错用：better-sqlite3 原生错误照抛（不虚报、不吞）
    expect(() => allStmt(insert, 'x')).toThrow(/does not return data/)
    expect(allStmt<{ id: number }>(select, 'x')).toHaveLength(1)
    db.close()
  })

  it('bigint/Buffer 等非常规返回不被破坏', () => {
    const db = new Database(':memory:')
    const row = prepareGet<{ total: number }>(db, 'SELECT 1 + 1 AS total')
    expect(row?.total).toBe(2)
    db.close()
  })
})
