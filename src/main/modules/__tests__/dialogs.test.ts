import { describe, it, expect, vi, beforeEach } from 'vitest'
import type {
  BrowserWindow,
  MessageBoxOptions,
  OpenDialogOptions,
  SaveDialogOptions
} from 'electron'

// 模拟 electron 的 dialog API
vi.mock('electron', () => {
  return {
    dialog: {
      showOpenDialog: vi.fn(async () => ({ canceled: false, filePaths: ['/tmp'] })),
      showSaveDialog: vi.fn(async () => ({ canceled: false, filePath: '/tmp/file.txt' })),
      showMessageBox: vi.fn(async () => ({ response: 0 }))
    }
  }
})

import { dialog } from 'electron'
import { showOpenDialogFor, showSaveDialogFor, showMessageBoxFor } from '../dialogs'

/** 按预期实参元组读取被 mock 的 dialog 方法首次调用的实参（规避 electron 重载签名收窄） */
function firstCall<TArgs extends unknown[]>(fn: unknown): TArgs {
  return (fn as { mock: { calls: TArgs[] } }).mock.calls[0]
}

/** 最小化的假窗口：仅需 isDestroyed() 返回 false */
const fakeWindow = (): BrowserWindow => ({ isDestroyed: () => false }) as unknown as BrowserWindow

describe('dialogs helpers', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('showOpenDialogFor: 使用无窗口重载', async () => {
    const res = await showOpenDialogFor(null, { properties: ['openDirectory'] })
    expect(dialog.showOpenDialog).toHaveBeenCalledTimes(1)
    const callArgs = firstCall<[OpenDialogOptions]>(dialog.showOpenDialog)
    // 无窗口重载只有一个参数（options）
    expect(callArgs.length).toBe(1)
    expect(res.canceled).toBe(false)
  })

  it('showOpenDialogFor: 使用窗口重载', async () => {
    await showOpenDialogFor(fakeWindow(), { properties: ['openFile'] })
    const callArgs = firstCall<[BrowserWindow, OpenDialogOptions]>(dialog.showOpenDialog)
    expect(callArgs.length).toBe(2)
  })

  it('showOpenDialogFor: 传递 filters 与取消场景', async () => {
    // 下次调用返回取消
    vi.mocked(dialog.showOpenDialog).mockResolvedValueOnce({ canceled: true, filePaths: [] })
    const options: OpenDialogOptions = {
      properties: ['openFile', 'multiSelections'],
      filters: [{ name: '图片', extensions: ['png', 'jpg'] }]
    }
    const res = await showOpenDialogFor(null, options)
    expect(res.canceled).toBe(true)
    const callArgs = firstCall<[OpenDialogOptions]>(dialog.showOpenDialog)
    // 无窗口重载只有一个参数；检查 options 内容
    expect(callArgs.length).toBe(1)
    expect(callArgs[0].filters?.[0].name).toBe('图片')
  })

  it('showSaveDialogFor: 使用无窗口重载', async () => {
    const res = await showSaveDialogFor(undefined, { nameFieldLabel: 'file' })
    expect(dialog.showSaveDialog).toHaveBeenCalledTimes(1)
    const callArgs = firstCall<[SaveDialogOptions]>(dialog.showSaveDialog)
    expect(callArgs.length).toBe(1)
    expect(res.filePath).toBe('/tmp/file.txt')
  })

  it('showMessageBoxFor: 根据窗口存在选择重载', async () => {
    await showMessageBoxFor(null, { message: 'hello' })
    const callArgsNoWin = firstCall<[MessageBoxOptions]>(dialog.showMessageBox)
    expect(callArgsNoWin.length).toBe(1)
    vi.clearAllMocks()
    await showMessageBoxFor(fakeWindow(), { message: 'hi' })
    const callArgsWithWin = firstCall<[BrowserWindow, MessageBoxOptions]>(dialog.showMessageBox)
    expect(callArgsWithWin.length).toBe(2)
  })

  it('showSaveDialogFor: 传递 defaultPath 与取消场景', async () => {
    // 取消时 electron 约定 filePath 为空字符串
    vi.mocked(dialog.showSaveDialog).mockResolvedValueOnce({ canceled: true, filePath: '' })
    const options: SaveDialogOptions = { title: '保存', defaultPath: '/tmp/file.txt' }
    const res = await showSaveDialogFor(undefined, options)
    expect(res.canceled).toBe(true)
    const callArgs = firstCall<[SaveDialogOptions]>(dialog.showSaveDialog)
    expect(callArgs.length).toBe(1)
    expect(callArgs[0].defaultPath).toBe('/tmp/file.txt')
  })
})
