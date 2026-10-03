import { describe, it, expect, vi, beforeEach } from 'vitest'

/**
 * B53-4 文件搜索并行回退回归钉：此前「索引查询 → 零结果 → 才发起 mdfind」串行，
 * 短查询实测 450-540ms。改为**并行**发起——
 *  - 系统检索与索引同时起跑（fill 后 mdfind 的 execFile 立即被调用）
 *  - 索引命中即弃系统检索结果（source=index）
 *  - 索引零结果时系统检索已在飞（延迟 ≈ max(索引, 系统检索) 而非两者之和）
 * NO_FALLBACK 钩子保持纯索引口径（不 spawn 系统检索）。
 */

const handlers = new Map<string, (event: unknown, req: unknown) => unknown>()

const queryDeferreds: Array<{ resolve: (v: unknown) => void }> = []
const queryMock = vi.hoisted(() => ({
  ensureStarted: vi.fn(),
  query: vi.fn(
    () =>
      new Promise((resolve) => {
        queryDeferreds.push({ resolve })
      })
  )
}))
void queryMock

const { execFileMock } = vi.hoisted(() => ({
  execFileMock: vi.fn(
    (_cmd: string, _args: string[], _opts: unknown, cb: (e: Error | null, out: string) => void) => {
      execFileCbs.push(cb)
    }
  )
}))
const execFileCbs: Array<(e: Error | null, out: string) => void> = []

vi.mock('electron', () => ({
  shell: { openPath: vi.fn(), showItemInFolder: vi.fn() },
  ipcMain: {
    handle: (channel: string, fn: (event: unknown, req: unknown) => unknown) => {
      handlers.set(channel, fn)
    }
  }
}))
vi.mock('../../fileIndex/client', () => ({ fileIndexClient: queryMock }))
vi.mock('../../utils/platform', () => ({ isMac: () => true, isWin: () => false }))
vi.mock('child_process', () => ({ execFile: execFileMock }))

import { registerFileSearchIpc } from '../fileSearch'

const flush = async (): Promise<void> => {
  for (let i = 0; i < 6; i++) await Promise.resolve()
}

beforeEach(() => {
  handlers.clear()
  queryDeferreds.length = 0
  execFileCbs.length = 0
  execFileMock.mockClear()
  queryMock.ensureStarted.mockClear()
  queryMock.query.mockClear()
  registerFileSearchIpc()
})

const invoke = (req: unknown): Promise<unknown> => handlers.get('find:files')!({}, req)

describe('find:files 并行回退（B53-4）', () => {
  it('索引查询在飞时系统检索已起跑（并行，非串行）', async () => {
    const p = invoke({ query: 'notes', limit: 10 })
    await flush()
    // mdfind 已 spawn（旧串行实现此刻还在等索引，execFile 调用数为 0）
    expect(execFileMock).toHaveBeenCalledTimes(1)
    expect(execFileMock.mock.calls[0]![0]).toBe('mdfind')

    // mdfind 先回（指纹在飞也能收）
    execFileCbs[0]!(null, '/Users/me/notes/a.txt\n')
    // 索引随后零结果
    queryDeferreds[0]!.resolve(null)
    await flush()
    const res = (await p) as { source: string; items: Array<{ path: string }> }
    expect(res.source).toBe('mdfind')
    expect(res.items[0]!.path).toBe('/Users/me/notes/a.txt')
  })

  it('索引命中即弃系统检索结果', async () => {
    const p = invoke({ query: 'a.txt', limit: 10 })
    await flush()
    expect(execFileMock).toHaveBeenCalledTimes(1) // 并行已起跑
    queryDeferreds[0]!.resolve([{ path: '/x/a.txt', name: 'a.txt', parent: '/x' }])
    await flush()
    const res = (await p) as { source: string; items: Array<{ path: string }> }
    expect(res.source).toBe('index')
    expect(res.items[0]!.path).toBe('/x/a.txt')
  })

  it('NO_FALLBACK：不 spawn 系统检索', async () => {
    process.env.FROND_FILE_SEARCH_NO_FALLBACK = '1'
    try {
      const p = invoke({ query: 'notes', limit: 10 })
      await flush()
      expect(execFileMock).not.toHaveBeenCalled()
      queryDeferreds[0]!.resolve(null)
      await flush()
      const res = (await p) as { source: string; items: unknown[] }
      expect(res.source).toBe('index')
      expect(res.items).toEqual([])
    } finally {
      delete process.env.FROND_FILE_SEARCH_NO_FALLBACK
    }
  })
})
