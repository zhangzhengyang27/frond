import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { createTestDb, closeTestDb } from './testDb'
import { SnippetRepository, type SnippetContent } from '../repos/SnippetRepository'

// SnippetRepository 落库时对 content 做真实 AES 加密（crypto.ts 需要 app.getPath）
// ——此前加密在测试环境静默降级为明文，encryptText fail-closed 后必须提供 userData
const __userData = join(mkdtempSync(join(tmpdir(), 'leaf-snippet-')), 'userData')
vi.mock('electron', () => ({ app: { getPath: () => __userData } }))

describe('SnippetRepository', () => {
  let db: Database.Database
  let repo: SnippetRepository

  beforeEach(() => {
