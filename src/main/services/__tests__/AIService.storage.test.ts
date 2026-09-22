import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * AIService 配置/会话存储回归（迁移到 pref_preferences 后行为保持）。
 * 覆盖：默认值合并、apiKey 加解密往返、会话持久化与清空。
 */
const __userData = join(mkdtempSync(join(tmpdir(), 'leaf-ai-service-')), 'userData')
vi.mock('electron', () => ({
  app: { getPath: () => __userData, getVersion: () => '0.0.0-test', isReady: () => true },
  ipcMain: { handle: () => {} },
  BrowserWindow: { getAllWindows: () => [] }
}))

import { migrations } from '../../db/migrations'
import { database } from '../../db/database'
import { DEFAULT_AI_CONFIG } from '../../../shared/ai'
import {
  getAIConfig,
  setAIConfig,
  isAIConfigured,
  saveSession,
  listSessions,
  clearSessions
} from '../AIService'
import type { AIChatSession } from '../../../shared/ai'

function injectDb(db: import('better-sqlite3').Database): void {
  ;(database as unknown as { db: import('better-sqlite3').Database | null }).db = db
}

function freshDb(): import('better-sqlite3').Database {
  const Database = require('better-sqlite3')
  const db = new Database(':memory:')
  db.pragma('foreign_keys = ON')
  for (const m of migrations) {
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
  }
  return db
}

describe('AIService（SQLite 存储）', () => {
  let db: import('better-sqlite3').Database

  beforeEach(() => {
    db = freshDb()
    injectDb(db)
    clearSessions()
  })

  afterEach(() => {
    injectDb(new (require('better-sqlite3'))(':memory:'))
    db.close()
  })

  it('默认配置：未设置时与 DEFAULT_AI_CONFIG 合并', () => {
    const cfg = getAIConfig()
    expect(cfg.enabled).toBe(DEFAULT_AI_CONFIG.enabled)
    expect(cfg.temperature).toBe(DEFAULT_AI_CONFIG.temperature)
  })

  it('setAIConfig → getAIConfig 往返，apiKey 加密落盘、读取解密', async () => {
    await setAIConfig({
      enabled: true,
      apiKey: 'sk-test-123',
      model: 'gpt-x',
      baseUrl: 'http://127.0.0.1:11434'
    })
    const cfg = getAIConfig()
    expect(cfg.apiKey).toBe('sk-test-123')

    // 落盘的是密文
    const raw = db.prepare('SELECT value FROM pref_preferences WHERE key = ?').get('ai.config') as
      | { value: string }
      | undefined
    const stored = JSON.parse(raw?.value ?? '{}') as { apiKey?: string }
    expect(stored.apiKey?.startsWith('enc:')).toBe(true)
    expect(stored.apiKey).not.toContain('sk-test-123')

    expect(isAIConfigured()).toBe(true)
  })

  it('会话保存 / 列表 / 清空', () => {
    const session: AIChatSession = {
      id: 's1',
      title: '测试会话',
      createdAt: Date.now(),
      updatedAt: Date.now(),
      messages: []
    } as AIChatSession
    saveSession(session)
    expect(listSessions()).toHaveLength(1)
    expect(listSessions()[0].id).toBe('s1')
    clearSessions()
    expect(listSessions()).toEqual([])
  })
})
