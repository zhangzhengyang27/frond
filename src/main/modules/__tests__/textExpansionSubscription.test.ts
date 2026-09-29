import { describe, it, expect, vi, beforeEach } from 'vitest'
import { mkdirSync } from 'node:fs'

// 真实 database 单例会沿导入链开 userData/frond.db：目录必须先存在
mkdirSync('/tmp/frond-expansion-test', { recursive: true })

/**
 * B43 回归钉：启动后全机卡顿的根因修复。
 *
 * 此前 textExpansion 只要开关是 enabled 就订阅全局键钩子（uiohook 的
 * CGEventTap，覆盖键盘+鼠标移动全套系统事件）——零触发词的用户（多数人）
 * 也常驻一个纯开销的全局 tap；主进程一旦忙起来 tap 超时，macOS 对超时的
 * 活动 tap 限流**全系统输入**，表现就是整台电脑键鼠发卡。
 *
 * 现口径：enabled 且「确有触发词」才订阅；片段增删改（invalidateTriggers）
 * 跨过 0↔N 边界时重评估订阅。本文件钉住这个订阅状态机。
 */

const { onKeydownMock, unsubscribeMock, getSnippetsMock } = vi.hoisted(() => ({
  onKeydownMock: vi.fn(() => unsubscribeMock),
  unsubscribeMock: vi.fn(),
  getSnippetsMock: vi.fn(
    () => [] as Array<{ trigger?: string | null; contents?: Array<{ value: string }> }>
  )
}))

vi.mock('electron', () => ({
  app: { on: vi.fn(), getPath: () => '/tmp/frond-expansion-test', isReady: () => true, getVersion: () => '0.0.0-test' },
  clipboard: { writeText: vi.fn(), readText: vi.fn(() => '') },
  BrowserWindow: { getAllWindows: () => [] },
  shell: { openExternal: vi.fn() }
}))

vi.mock('../globalKeys', () => ({
  globalKeyHook: { onKeydown: onKeydownMock },
  hasFocusedFrondWindow: vi.fn(() => false)
}))

vi.mock('../../db/repos/SnippetRepository', () => ({
  snippetRepository: { getSnippets: getSnippetsMock }
}))

vi.mock('../../launcher/docStore', () => ({
  getLauncherDocStore: () => ({
    // readConfig 读到 enabled:true（真实用户库的实况）
    get: () => ({ id: 'config', data: { enabled: true } }),
    put: vi.fn()
  })
}))

vi.mock('../../services/ClipboardHistoryService', () => ({ clipboardHistory: {} }))
vi.mock('../../utils/inputBox', () => ({ showInputBox: vi.fn() }))

async function freshService() {
  vi.resetModules()
  return await import('../textExpansion')
}

describe('textExpansion 订阅状态机（B43 全机卡顿根因）', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    onKeydownMock.mockReturnValue(unsubscribeMock)
    getSnippetsMock.mockReturnValue([])
  })

  it('enabled 但 0 触发词：不订阅全局钩子（uiohook 完全不启动）', async () => {
    const { textExpansion } = await freshService()
    textExpansion.start()
    expect(onKeydownMock).not.toHaveBeenCalled()
    expect(textExpansion.hasActiveListener()).toBe(false)
  })

  it('enabled 且有触发词：订阅', async () => {
    getSnippetsMock.mockReturnValue([{ trigger: ';brt', contents: [{ value: '文本' }] }])
    const { textExpansion } = await freshService()
    textExpansion.start()
    expect(onKeydownMock).toHaveBeenCalledTimes(1)
    expect(textExpansion.hasActiveListener()).toBe(true)
  })

  it('invalidateTriggers 跨 0↔N 边界：先订阅后退订再订阅', async () => {
    getSnippetsMock.mockReturnValue([{ trigger: ';brt', contents: [{ value: '文本' }] }])
    const { textExpansion } = await freshService()
    textExpansion.start()
    expect(onKeydownMock).toHaveBeenCalledTimes(1)

    // 用户删掉了带触发词的片段 → 退订
    getSnippetsMock.mockReturnValue([])
    textExpansion.invalidateTriggers()
    expect(unsubscribeMock).toHaveBeenCalledTimes(1)
    expect(textExpansion.hasActiveListener()).toBe(false)

    // 又建了一个 → 重新订阅
    getSnippetsMock.mockReturnValue([{ trigger: ';x', contents: [{ value: '文本' }] }])
    textExpansion.invalidateTriggers()
    expect(onKeydownMock).toHaveBeenCalledTimes(2)
    expect(textExpansion.hasActiveListener()).toBe(true)
  })

  it('disabled 时即使有触发词也不订阅', async () => {
    // readConfig 的 mock 固定 enabled:true；用 stop() 表达 disabled 终态
    getSnippetsMock.mockReturnValue([{ trigger: ';brt', contents: [{ value: '文本' }] }])
    const { textExpansion } = await freshService()
    textExpansion.start()
    textExpansion.stop()
    expect(unsubscribeMock).toHaveBeenCalled()
    expect(textExpansion.hasActiveListener()).toBe(false)
  })
})
