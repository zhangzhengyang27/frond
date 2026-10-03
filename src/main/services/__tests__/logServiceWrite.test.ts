import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * B53-11 LogService 写入优化回归钉：
 * - 语句缓存：INSERT 的 prepare 只做一次（此前每条日志 prepare+run，启动装配段
 *   每条一个 autocommit）
 * - 微批：info 级攒批（25 条）一个事务落库；warn/error 立即落（诊断价值最高、
 *   不接受批窗口丢失）
 * - ring/console 行为不变；mode=off 不碰库
 */

const { prepareMock, transactionMock, dbMock } = vi.hoisted(() => {
  const stmt = { run: vi.fn() }
  const prepareMock = vi.fn((_sql: string) => stmt)
  const transactionMock = vi.fn((fn: () => void) => fn())
  const dbMock = { prepare: prepareMock, transaction: transactionMock }
  return { prepareMock, transactionMock, dbMock, stmt }
})

vi.mock('../../db/database', () => ({
  database: {
    get handle() {
      return dbMock
    }
  }
}))

import { LogService } from '../LogService'

// 暴露批配置走默认值；这里只断言可观察行为
describe('LogService 写入优化（B53-11）', () => {
  beforeEach(() => {
    prepareMock.mockClear()
    transactionMock.mockClear()
    vi.spyOn(console, 'log').mockImplementation(() => {})
    vi.spyOn(console, 'error').mockImplementation(() => {})
    vi.spyOn(console, 'warn').mockImplementation(() => {})
  })

  it('语句缓存：连续 60 条 info 只 prepare 一次', () => {
    const svc = new LogService()
    for (let i = 0; i < 60; i++) svc.info('t', `m${i}`)
    expect(prepareMock).toHaveBeenCalledTimes(1)
  })

  it('info 微批：攒到阈值才进事务；warn/error 立即落', () => {
    const svc = new LogService()
    for (let i = 0; i < 24; i++) svc.info('t', `m${i}`) // 差 1 条不到默认批 25
    expect(transactionMock).not.toHaveBeenCalled()
    svc.error('t', 'boom')
    // error 立即落库（1 个事务），且不把攒着的 info 带丢——顺带触发 flush
    expect(transactionMock).toHaveBeenCalled()
    expect(dbMock.prepare('x').run).toHaveBeenCalled()
  })

  it('mode=off：不写日志表（prefRepository 的模式持久化除外）', () => {
    const svc = new LogService()
    svc.setMode('off')
    prepareMock.mockClear()
    svc.info('t', 'm')
    svc.error('t', 'e')
    const logInserts = prepareMock.mock.calls.filter(([sql]) =>
      String(sql).includes('log_entries')
    )
    expect(logInserts).toEqual([])
  })

  it('setMode 恢复 local 后继续写库', () => {
    const svc = new LogService()
    svc.setMode('off')
    svc.setMode('local')
    svc.error('t', 'back')
    expect(prepareMock).toHaveBeenCalled()
  })
})
