import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * encryptText 失败语义：拒绝静默降级为明文落盘。
 * 历史行为：加密失败时 catch 返回原文——与「敏感数据必须加密」的目标相反。
 */
const { log } = vi.hoisted(() => ({ log: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }))

vi.mock('electron', () => ({
  app: { getPath: () => join(mkdtempSync(join(tmpdir(), 'frond-crypto-')), 'userData') }
}))
vi.mock('../../services/LogService', () => ({ log }))
// 强制 createCipheriv 抛错，模拟加密能力不可用（密钥环境损坏等）
vi.mock('crypto', async (importOriginal) => {
  const actual = await importOriginal<typeof import('crypto')>()
  return {
    ...actual,
    createCipheriv: () => {
      throw new Error('simulated cipher failure')
    }
  }
})

describe('encryptText 失败时 fail closed', () => {
  beforeEach(() => {
    vi.resetModules()
  })

  it('加密失败应抛错，而不是返回明文', async () => {
    const { encryptText } = await import('../crypto')
    expect(() => encryptText('secret-token')).toThrow('加密失败')
  })

  it('空串按原语义原样返回', async () => {
    const { encryptText } = await import('../crypto')
    expect(encryptText('')).toBe('')
  })
})
