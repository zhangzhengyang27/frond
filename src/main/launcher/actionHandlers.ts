/**
 * Frond · 主进程统一动作执行端（#4 Action 纯数据模型，增量方案）
 *
 * 与窗口无关的动作（system / app / file / quicklink / clipboard / snippet /
 * copyText / openUrl）由本注册表分发——胶囊 / ⌘K / 全局热键 / 托盘 / deeplink
 * 共用一套执行语义（对标 ueli ActionHandlerRegistry）。
 * module / page / plugin / firstParty 等窗口编排类动作保留在渲染端
 * （router / 胶囊页栈本就在渲染进程，见 renderer utils/commandRunner.ts）。
 *
 * 路由与校验通过 createDispatchMainAction(deps) 依赖注入实现（可单测）；
 * 模块底部 dispatchMainAction 单例绑定真实服务，供 action:invoke IPC 与
 * 热键分发（hotkeys.ts）直接调用。
 */
import { clipboard, shell } from 'electron'
import { buildQuicklinkUrl, isValidQuicklinkUrl } from '../../shared/commands'
import { isOpenUrlAllowed } from '../../shared/openUrl'
import { openQuicklinkUrl } from './quicklinkOpen'
import { isWindowAction, runSystemCommand, runWindowAction } from '../modules/systemCommands'
import { launchApplicationPath } from '../ipc/applications'
import { clipboardHistory } from '../services/ClipboardHistoryService'
import { snippetStore } from '../stores'
import { safeOpenablePath } from '../utils/openPathGuard'
import { log } from '../services/LogService'

/** 可由主进程直接执行的动作（纯数据，可序列化） */
export type MainAction =
  | { type: 'system'; cmdId: string }
  | { type: 'app'; path: string }
  | { type: 'quicklink'; url: string }
  | { type: 'file'; path: string }
  | { type: 'clipboardItem'; id: string }
  | { type: 'snippetItem'; id: string }
  | { type: 'copyText'; text: string }
  | { type: 'openUrl'; url: string }

export interface ActionResult {
  ok: boolean
  error?: string
}

/** 执行端依赖（注入便于单测；单例处绑定真实实现） */
export interface ActionHandlerDeps {
  runSystemCommand: (id: string) => Promise<unknown>
  runWindowAction: (action: string) => Promise<unknown>
  isWindowAction: (action: string) => boolean
  launchApp: (path: string) => Promise<{ success: boolean; error?: string }>
  openExternal: (url: string) => void
  openPath: (path: string) => Promise<{ ok: boolean; error?: string }>
  copyClipboardItem: (id: string) => boolean
  getSnippetText: (id: string) => string | null
  writeClipboardText: (text: string) => void
}

const MAIN_ACTION_TYPES: ReadonlySet<string> = new Set([
  'system',
  'app',
  'quicklink',
  'file',
  'clipboardItem',
  'snippetItem',
  'copyText',
  'openUrl'
])

/** fail-closed 载荷校验：未知类型 / 缺关键字段一律拒绝 */
export function isMainActionPayload(raw: unknown): raw is MainAction {
  if (typeof raw !== 'object' || raw === null) return false
  const a = raw as Record<string, unknown>
  if (typeof a.type !== 'string' || !MAIN_ACTION_TYPES.has(a.type)) return false
  const strField = (name: string): boolean =>
    typeof a[name] === 'string' && (a[name] as string) !== ''
  switch (a.type) {
    case 'system':
      return strField('cmdId')
    case 'app':
    case 'file':
      return strField('path')
    case 'quicklink':
    case 'openUrl':
      return strField('url')
    case 'clipboardItem':
    case 'snippetItem':
      return strField('id')
    case 'copyText':
      return typeof a.text === 'string'
    default:
      return false
  }
}

export function createDispatchMainAction(
  deps: ActionHandlerDeps
): (action: unknown) => Promise<ActionResult> {
  return async (raw: unknown): Promise<ActionResult> => {
    if (!isMainActionPayload(raw)) return { ok: false, error: 'invalid action payload' }
    const a = raw as MainAction
    try {
      switch (a.type) {
        case 'system': {
          // window.* 走窗口动作执行端（V4 P1-7：其余通道会报 unsupported）
          if (a.cmdId.startsWith('window.')) {
            const action = a.cmdId.slice('window.'.length)
            if (deps.isWindowAction(action)) return { ok: !!(await deps.runWindowAction(action)) }
            return { ok: false, error: `unknown window action: ${action}` }
          }
          return { ok: !!(await deps.runSystemCommand(a.cmdId)) }
        }
        case 'app': {
          const result = await deps.launchApp(a.path)
          return { ok: result.success, error: result.error }
        }
        case 'quicklink': {
          // 与热键分发同一语义：占位符取基础链接形态；scheme 白名单 fail-closed
          if (!isValidQuicklinkUrl(a.url)) return { ok: false, error: 'invalid quicklink url' }
          deps.openExternal(buildQuicklinkUrl(a.url, ''))
          return { ok: true }
        }
        case 'file': {
          return await deps.openPath(a.path)
        }
        case 'clipboardItem': {
          if (!deps.copyClipboardItem(a.id)) return { ok: false, error: 'item not found' }
          return { ok: true }
        }
        case 'snippetItem': {
          const text = deps.getSnippetText(a.id)
          if (!text) return { ok: false, error: 'snippet not found or empty' }
          deps.writeClipboardText(text)
          return { ok: true }
        }
        case 'copyText': {
          deps.writeClipboardText(a.text)
          return { ok: true }
        }
        case 'openUrl': {
          // 会议入会链接等 scheme 白名单（审查 I-diff2）
          if (!isOpenUrlAllowed(a.url)) return { ok: false, error: 'url scheme not allowed' }
          deps.openExternal(a.url)
          return { ok: true }
        }
      }
    } catch (error) {
      log.warn('launcher', `action dispatch failed: ${(error as Error).message}`)
      return { ok: false, error: (error as Error).message }
    }
  }
}

/** 单例：绑定真实服务（action:invoke IPC 与热键分发共用） */
export const dispatchMainAction = createDispatchMainAction({
  runSystemCommand: (id) => runSystemCommand(id),
  runWindowAction: (action) => runWindowAction(action as Parameters<typeof runWindowAction>[0]),
  isWindowAction: (action) => isWindowAction(action),
  launchApp: (path) => launchApplicationPath(path),
  openExternal: (url) => openQuicklinkUrl(url),
  openPath: async (path) => {
    // openPath 失败（返回错误字符串）要进 ActionResult：
    // 胶囊/⌘K/热键三条通道的失败提示依赖它（审查 Minor-7）
    const target = safeOpenablePath(path)
    if (!target) return { ok: false, error: 'path not openable' }
    const err = await shell.openPath(target)
    return err ? { ok: false, error: err } : { ok: true }
  },
  copyClipboardItem: (id) => clipboardHistory.copy(id),
  getSnippetText: (id) => snippetStore.getSnippetById(id)?.contents?.[0]?.value ?? null,
  writeClipboardText: (text) => clipboard.writeText(text)
})
