import { describe, it, expect, vi } from 'vitest'
import { createDispatchMainAction, type ActionHandlerDeps } from '../actionHandlers'

/**
 * 主进程统一动作执行端（#4 Action 纯数据模型，增量方案）：
 * 与窗口无关的动作（system/app/file/quicklink/clipboard/snippet/copy/openUrl）
 * 由 main 的注册表分发——胶囊 / ⌘K / 全局热键 / 托盘 / deeplink 共用一套执行语义。
 * 本文件测路由与 fail-closed 校验（deps 注入，不触真实服务）。
 */

function makeDeps(over: Partial<ActionHandlerDeps> = {}): ActionHandlerDeps {
  return {
    runSystemCommand: vi.fn(async () => ({ ok: true })),
    runWindowAction: vi.fn(async () => ({ ok: true })),
    // dispatch 传入的是去掉 window. 前缀后的动作名
    isWindowAction: (a: string) => ['left', 'right', 'top', 'bottom'].includes(a),
    launchApp: vi.fn(async () => ({ success: true })),
    openExternal: vi.fn(),
    openPath: vi.fn(async () => true),
    copyClipboardItem: vi.fn(() => true),
    getSnippetText: vi.fn(() => 'print(1)'),
    writeClipboardText: vi.fn(),
    ...over
  }
}

describe('createDispatchMainAction', () => {
  it('system：window.* 走 runWindowAction，其余走 runSystemCommand', async () => {
    const deps = makeDeps()
    const dispatch = createDispatchMainAction(deps)
    await dispatch({ type: 'system', cmdId: 'window.left' })
    expect(deps.runWindowAction).toHaveBeenCalledWith('left')
    expect(deps.runSystemCommand).not.toHaveBeenCalled()
    await dispatch({ type: 'system', cmdId: 'system.lock' })
    expect(deps.runSystemCommand).toHaveBeenCalledWith('system.lock')
  })

  it('app：路径透传 launchApp', async () => {
    const deps = makeDeps()
    await createDispatchMainAction(deps)({ type: 'app', path: '/Applications/Safari.app' })
    expect(deps.launchApp).toHaveBeenCalledWith('/Applications/Safari.app')
  })

  it('file：路径透传 openPath', async () => {
    const deps = makeDeps()
    const result = await createDispatchMainAction(deps)({ type: 'file', path: '/tmp/a.txt' })
    expect(result.ok).toBe(true)
    expect(deps.openPath).toHaveBeenCalledWith('/tmp/a.txt')
  })

  it('quicklink：合法 URL 打开（占位符取基础链接形态）', async () => {
    const deps = makeDeps()
    const result = await createDispatchMainAction(deps)({
      type: 'quicklink',
      url: 'https://github.com/{query}'
    })
    expect(result.ok).toBe(true)
    expect(deps.openExternal).toHaveBeenCalledWith('https://github.com/')
  })

  it('quicklink：非法 scheme 拒绝（fail-closed）', async () => {
    const deps = makeDeps()
    const result = await createDispatchMainAction(deps)({
      type: 'quicklink',
      url: 'file:///etc/passwd'
    })
    expect(result.ok).toBe(false)
    expect(deps.openExternal).not.toHaveBeenCalled()
  })

  it('openUrl：scheme 白名单放行 http(s)，拦截客户端 scheme 以外来源', async () => {
    const deps = makeDeps()
    const ok = await createDispatchMainAction(deps)({ type: 'openUrl', url: 'https://a.b/c' })
    expect(ok.ok).toBe(true)
    expect(deps.openExternal).toHaveBeenCalledWith('https://a.b/c')
    const bad = await createDispatchMainAction(deps)({ type: 'openUrl', url: 'javascript:alert(1)' })
    expect(bad.ok).toBe(false)
  })

  it('clipboardItem：条目存在则复制，不存在返回失败', async () => {
    const deps = makeDeps()
    const ok = await createDispatchMainAction(deps)({ type: 'clipboardItem', id: 'c1' })
    expect(ok.ok).toBe(true)
    expect(deps.copyClipboardItem).toHaveBeenCalledWith('c1')
    const missing = await createDispatchMainAction(
      makeDeps({ copyClipboardItem: vi.fn(() => false) })
    )({ type: 'clipboardItem', id: 'ghost' })
    expect(missing.ok).toBe(false)
  })

  it('snippetItem：取首个内容块复制；无内容返回失败', async () => {
    const deps = makeDeps()
    const ok = await createDispatchMainAction(deps)({ type: 'snippetItem', id: 's1' })
    expect(ok.ok).toBe(true)
    expect(deps.writeClipboardText).toHaveBeenCalledWith('print(1)')
    const empty = await createDispatchMainAction(
      makeDeps({ getSnippetText: vi.fn(() => null) })
    )({ type: 'snippetItem', id: 's2' })
    expect(empty.ok).toBe(false)
  })

  it('copyText：写剪贴板', async () => {
    const deps = makeDeps()
    await createDispatchMainAction(deps)({ type: 'copyText', text: 'hello' })
    expect(deps.writeClipboardText).toHaveBeenCalledWith('hello')
  })

  it('未知类型 / 非对象载荷拒绝（fail-closed）', async () => {
    const deps = makeDeps()
    for (const bad of [{ type: 'sudo' }, null, 42, {}, { type: 'module', moduleId: 'x' }]) {
      const result = await createDispatchMainAction(deps)(bad)
      expect(result.ok).toBe(false)
    }
  })
})
