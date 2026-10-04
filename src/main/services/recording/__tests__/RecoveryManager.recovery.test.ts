import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import type Database from 'better-sqlite3'
import {
  mkdtempSync,
  mkdirSync,
  rmSync,
  writeFileSync,
  existsSync,
  readdirSync,
  statSync
} from 'fs'
import { join } from 'path'
import { tmpdir } from 'os'
import { createTestDb, closeTestDb } from '../../../db/__tests__/testDb'
import { RecordingRepository } from '../../../db/repos/RecordingRepository'
import { RecoveryManager, findMp4RecoveryPoint } from '../RecoveryManager'

/**
 * B57-1 清账（D4 重写，RECORDING_MEDIABUNNY_DESIGN.md P2）：
 *  1. scan 主源 = DB 孤儿行（status recording/paused 且文件存在）——真实崩溃
 *     残留（旧引擎 webm / 新引擎 mp4）都能列出来，不再只认没人产出的
 *     .partial.mp4 后缀（旧实现对真实场景整体空转）
 *  2. recover = moof 边界截断 + 原地恢复：不 rename（消灭静默覆盖 P0-1）、
 *     先文件后 DB（DB 失败下次 scan 可重试，消灭「文件消失」P0-2）
 *  3. discard 按 recordingId 精确行删（消灭按 basename 跨目录误删 P0-4）
 */

function box(type: string, payloadLen: number, filler = 0x11): Buffer {
  const buf = Buffer.alloc(8 + payloadLen)
  buf.writeUInt32BE(8 + payloadLen, 0)
  buf.write(type, 4, 'latin1')
  buf.fill(filler, 8)
  return buf
}

/** 最小 fMP4：ftyp+moov+若干 (moof+mdat) 片段；tailGarbage 模拟崩溃半截写入 */
function fmp4Fixture(fragmentCount: number, tailGarbage = 0): Buffer {
  const parts: Buffer[] = [box('ftyp', 8), box('moov', 16)]
  for (let i = 0; i < fragmentCount; i++) {
    parts.push(box('moof', 8), box('mdat', 32, 0x22))
  }
  if (tailGarbage > 0) parts.push(Buffer.alloc(tailGarbage, 0xff))
  return Buffer.concat(parts)
}

/** 3 片段夹具的完整前缀字节数（16+24+3*(16+40)） */
const GOOD_END_3_FRAGS = 208

let db: Database.Database
let repo: RecordingRepository
let tmpDir: string
let manager: RecoveryManager

beforeEach(() => {
  db = createTestDb()
  repo = new RecordingRepository(db)
  tmpDir = mkdtempSync(join(tmpdir(), 'recovery-test-'))
  manager = new RecoveryManager({
    repo,
    probeDuration: async () => 10,
    defaultSaveDir: () => tmpDir,
    generateId: () => 'gen-id-1'
  })
})

afterEach(() => {
  closeTestDb(db)
  rmSync(tmpDir, { recursive: true, force: true })
  vi.restoreAllMocks()
})

function writeFixture(name: string, content: Buffer, subdir?: string): string {
  const dir = subdir ? join(tmpDir, subdir) : tmpDir
  if (subdir) mkdirSync(dir, { recursive: true })
  const p = join(dir, name)
  writeFileSync(p, content)
  return p
}

describe('findMp4RecoveryPoint（moof 边界扫描）', () => {
  it('完整 fMP4：无需截断（complete=true）', () => {
    const p = writeFixture('full.mp4', fmp4Fixture(3))
    const r = findMp4RecoveryPoint(p)
    expect(r.sawIsoBmff).toBe(true)
    expect(r.complete).toBe(true)
    expect(r.goodEnd).toBe(GOOD_END_3_FRAGS)
  })

  it('垃圾尾：goodEnd 指向最后一个完整 mdat 末尾，complete=false', () => {
    const p = writeFixture('crashed.mp4', fmp4Fixture(3, 100))
    const r = findMp4RecoveryPoint(p)
    expect(r.sawIsoBmff).toBe(true)
    expect(r.complete).toBe(false)
    expect(r.goodEnd).toBe(GOOD_END_3_FRAGS)
  })

  it('webm（非 ISO-BMFF）：sawIsoBmff=false，绝不截断', () => {
    const p = writeFixture('crashed.webm', Buffer.alloc(500, 0x1a))
    const r = findMp4RecoveryPoint(p)
    expect(r.sawIsoBmff).toBe(false)
  })

  it('moov 后第一个 mdat 就被截断：goodEnd=0（无完整媒体，交给 probe 拒绝）', () => {
    const full = fmp4Fixture(1)
    const p = writeFixture('halftail.mp4', full.subarray(0, full.length - 10))
    const r = findMp4RecoveryPoint(p)
    expect(r.sawIsoBmff).toBe(true)
    expect(r.complete).toBe(false)
    expect(r.goodEnd).toBe(0)
  })
})

describe('RecoveryManager scan（D4 孤儿行主源）', () => {
  it('status=recording 且文件存在 → 列出（mp4/webm 均认），recordingId 正确', () => {
    const mp4 = writeFixture('a.mp4', fmp4Fixture(2))
    const webm = writeFixture('b.webm', Buffer.alloc(64, 0x1a))
    repo.insert({ id: 'r1', file_path: mp4, file_name: 'a.mp4' })
    repo.insert({ id: 'r2', file_path: webm, file_name: 'b.webm' })
    const { orphans } = manager.scan()
    expect(orphans.map((o) => o.recordingId).sort()).toEqual(['r1', 'r2'])
  })

  it('completed 行、文件已不存在的行、软删行都不列', () => {
    const gone = writeFixture('gone.mp4', fmp4Fixture(1))
    repo.insert({
      id: 'r-done',
      file_path: writeFixture('done.mp4', fmp4Fixture(1)),
      file_name: 'done.mp4'
    })
    repo.setStatus('r-done', 'completed')
    repo.insert({ id: 'r-gone', file_path: gone, file_name: 'gone.mp4' })
    rmSync(gone)
    repo.insert({
      id: 'r-del',
      file_path: writeFixture('del.mp4', fmp4Fixture(1)),
      file_name: 'del.mp4'
    })
    repo.softDelete('r-del')
    expect(manager.scan().orphans).toHaveLength(0)
  })

  it('无行但目录里有 .partial.mp4（历史约定）仍列出，recordingId=null', () => {
    writeFixture('legacy.mp4.partial.mp4', fmp4Fixture(1))
    const { orphans } = manager.scan()
    expect(orphans).toHaveLength(1)
    expect(orphans[0]!.recordingId).toBeNull()
  })
})

describe('RecoveryManager recover（原地截断恢复）', () => {
  it('垃圾尾 fMP4：截断到 lastGoodEnd、不 rename、行标记 recovered', async () => {
    const p = writeFixture('crashed.mp4', fmp4Fixture(3, 100))
    repo.insert({ id: 'r1', file_path: p, file_name: 'crashed.mp4' })

    const { recordingId } = await manager.recover({ filePath: p, recordingId: 'r1' })
    expect(recordingId).toBe('r1')

    // 原地截断：同一路径、垃圾尾消失
    expect(existsSync(p)).toBe(true)
    expect(statSync(p).size).toBe(GOOD_END_3_FRAGS)
    // 不产生 rename 副本（P0-1：静默覆盖的根源）
    expect(readdirSync(tmpDir)).toEqual(['crashed.mp4'])
    // DB 行指向原路径、状态 recovered
    const row = repo.findById('r1')!
    expect(row.status).toBe('recovered')
    expect(row.file_path).toBe(p)
  })

  it('完整 fMP4：不截断，直接标记 recovered', async () => {
    const p = writeFixture('ok.mp4', fmp4Fixture(2))
    repo.insert({ id: 'r2', file_path: p, file_name: 'ok.mp4' })
    await manager.recover({ filePath: p, recordingId: 'r2' })
    expect(statSync(p).size).toBe(fmp4Fixture(2).length)
    expect(repo.findById('r2')!.status).toBe('recovered')
  })

  it('webm 崩溃残留：不截断（无 ISO-BMFF 结构），标记 recovered', async () => {
    const p = writeFixture('c.webm', Buffer.alloc(256, 0x1a))
    repo.insert({ id: 'r3', file_path: p, file_name: 'c.webm' })
    await manager.recover({ filePath: p })
    expect(statSync(p).size).toBe(256)
    expect(repo.findById('r3')!.status).toBe('recovered')
  })

  it('无行文件：新建 recovered 行挂原路径', async () => {
    const p = writeFixture('orphan.mp4', fmp4Fixture(2))
    const { recordingId } = await manager.recover({ filePath: p })
    const row = repo.findById(recordingId)!
    expect(row.status).toBe('recovered')
    expect(row.file_path).toBe(p)
  })

  it('probe 时长过短 → 抛错，状态与文件保持原样', async () => {
    const p = writeFixture('short.mp4', fmp4Fixture(1))
    repo.insert({ id: 'r4', file_path: p, file_name: 'short.mp4' })
    const strict = new RecoveryManager({
      repo,
      probeDuration: async () => 0.2,
      defaultSaveDir: () => tmpDir
    })
    await expect(strict.recover({ filePath: p, recordingId: 'r4' })).rejects.toThrow(
      /too short|corrupted/
    )
    expect(repo.findById('r4')!.status).toBe('recording')
    expect(statSync(p).size).toBe(fmp4Fixture(1).length)
  })
})

describe('RecoveryManager discard（行级精确删除）', () => {
  it('按 recordingId：删行 + 删文件；另一目录同名文件与行不受影响（P0-4）', () => {
    const a = writeFixture('same.mp4', fmp4Fixture(1), 'dirA')
    const b = writeFixture('same.mp4', fmp4Fixture(1), 'dirB')
    repo.insert({ id: 'rA', file_path: a, file_name: 'same.mp4' })
    repo.insert({ id: 'rB', file_path: b, file_name: 'same.mp4' })

    const r = manager.discard({ recordingId: 'rA' })
    expect(r.ok).toBe(true)
    expect(repo.findById('rA')).toBeNull()
    expect(existsSync(a)).toBe(false)
    // 跨目录同名行完好
    expect(repo.findById('rB')!.file_path).toBe(b)
    expect(existsSync(b)).toBe(true)
  })

  it('按 filePath：只删精确路径对应的行（不按 basename 跨目录匹配）', () => {
    const a = writeFixture('same2.mp4', fmp4Fixture(1), 'dirA')
    const b = writeFixture('same2.mp4', fmp4Fixture(1), 'dirB')
    repo.insert({ id: 'rA2', file_path: a, file_name: 'same2.mp4' })
    repo.insert({ id: 'rB2', file_path: b, file_name: 'same2.mp4' })

    const r = manager.discard({ filePath: a })
    expect(r.ok).toBe(true)
    expect(repo.findById('rA2')).toBeNull()
    expect(repo.findById('rB2')).not.toBeNull()
  })

  it('recordingId 不存在 → ok:false', () => {
    expect(manager.discard({ recordingId: 'nope' }).ok).toBe(false)
  })
})
