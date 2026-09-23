import { describe, it, expect, beforeEach } from 'vitest'
import Database from 'better-sqlite3'
import { database } from '../database'
import { migrations } from '../migrations'
import { PomodoroRepository } from '../repos/PomodoroRepository'

/**
 * Frond · PomodoroRepository 存储测试
 *
 * ⚠ 恢复说明：本文件的头（imports / beforeEach / 首个 it 的头部）与末（最后一条 it 的
 * 断言主体）随 2026-09-22 删除事故丢失。下面保留的是找回的断言原文；两处丢失分别记作
 * it.todo 与「跨度重建」注释，没有据此编造断言。
 */

/** settings 走全局 prefRepository 单例，只给 repo 构造参数注入内存库不够，得同时换 handle */
function injectDb(db: Database.Database): void {
  ;(database as unknown as { db: Database.Database | null }).db = db
}

function freshDb(): Database.Database {
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const m of migrations) m.up(db)
  return db
}

describe('PomodoroRepository', () => {
  let db: Database.Database
  let repo: PomodoroRepository

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
    repo = new PomodoroRepository(db)
  })

  describe('statistics / trend', () => {
    it('getDailyTrend 同时能取到周与月跨度', () => {
      // 恢复期重建：原 it 的头部丢失，只剩下面两行断言，故按名字里的「week / month」重取跨度
      repo.addRecord({ type: 'work', duration: 1500, completedAt: Date.now() })
      const week = repo.getDailyTrend(7)
      const month = repo.getDailyTrend(30)
      expect(week.length).toBeGreaterThanOrEqual(2)
      expect(month.length).toBeGreaterThanOrEqual(2)
    })

    it('getStatistics 分类计数', () => {
      repo.addRecord({ type: 'work', duration: 1500, completedAt: 100 })
      repo.addRecord({ type: 'shortBreak', duration: 300, completedAt: 200 })
      const s = repo.getStatistics()
      expect(s.today.work).toBe(1)
      expect(s.today.shortBreak).toBe(1)
    })

    it('duration 毫秒语义：25 分钟番茄统计为 25 workMinutes（v4 单位契约）', () => {
      repo.addRecord({ type: 'work', duration: 25 * 60_000, completedAt: Date.now() })
      const trend = repo.getDailyTrend(1)
      expect(trend).toHaveLength(1)
      expect(trend[0].workMinutes).toBe(25)
      expect(trend[0].completedPomodoros).toBe(1)
    })
  })

  describe('settings (K-V via pref_preferences)', () => {
    it.todo('getSettings 无值返回 DEFAULT_SETTINGS')
  })
})
