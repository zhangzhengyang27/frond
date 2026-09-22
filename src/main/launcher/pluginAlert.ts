/**
 * Leaf · 插件 Alert 的对话框参数装配（P-2.5）
 *
 * 单独一个文件只为了一件事：把「怎么把插件给的 actions 摆成一个原生模态框」
 * 变成不 import electron 的纯函数，能被单测钉住。`dialog.showMessageBox` 本身
 * 在自动化里没人点按钮（模态框会一直挂着），所以装配逻辑必须能在不打扰用户的前提下验。
 */
import type { SanitizedAlert } from '../../shared/plugin-protocol'

export interface AlertDialogOptions {
  type: 'none' | 'info' | 'warning' | 'error'
  title: string
  message: string
  buttons: string[]
  defaultId: number
  cancelId: number
  noLink: true
}

/**
 * 标题一律带插件名：不这么做的话，第三方代码可以摆一个长得像系统提示的框骗用户点确认。
 * `noLink: true` 关掉 Windows 上那个「复制文本」链接（框里没用户要带走的内容，只有按钮）。
 *
 * **没有 cancel 样式动作时补一颗「取消」**：Esc / 关窗走的是 `cancelId`，
 * 少了这颗就只能指到某个已有按钮上——于是「按下 Esc」等于「执行插件给的第一条动作」，
 * 而那条常常正是带副作用（甚至 destructive）的那颗。补的这颗不在 `alert.actions` 里，
 * `alertPressedAction` 按下标取不到动作，自然回 null（= 什么都没选）。
 */
export function buildAlertDialogOptions(
  pluginName: string,
  alert: SanitizedAlert
): AlertDialogOptions {
  const titles = alert.actions.map((a) => a.title)
  const cancelIndex = alert.actions.findIndex((a) => a.style === 'cancel')
  // 主操作 = 第一个不是 cancel 的；一个 cancel 都没有时缺省就是第一个按钮
  const defaultIndex = alert.actions.findIndex((a) => a.style !== 'cancel')
  const noActions = alert.actions.length === 0
  // 没有动作时那唯一一颗「好」就是关闭本框，不需要再补「取消」
  const buttons = noActions ? ['好'] : cancelIndex >= 0 ? titles : [...titles, '取消']
  return {
    type: alert.actions.some((a) => a.style === 'destructive') ? 'warning' : 'info',
    title: `${pluginName}${alert.title ? ` · ${alert.title}` : ''}`,
    message: alert.message,
    buttons,
    defaultId: defaultIndex >= 0 ? defaultIndex : 0,
    cancelId: noActions ? 0 : cancelIndex >= 0 ? cancelIndex : titles.length,
    noLink: true
  }
}

/**
 * 用户按下第 N 个按钮 → 该回给插件什么。
 * 只有一个「好」的确认框回 null（与 Raycast 的 `alert(title, message)` 语义一致：
 * 没有可选动作时不假装选了谁）。补出来的那颗「取消」同理：它的下标落在 `actions` 之外，
 * 取不到动作 → null。
 */
export function alertPressedAction(alert: SanitizedAlert, response: number): string | null {
  const action = alert.actions[response]
  return action ? action.id : null
}

/**
 * 同一个插件同时只许挂着**一条**模态框。
 * `alert()` 不 await 就能排出一串，用户得一条条点掉才能继续用机器——这是现成的拒绝服务，
 * 而且是在最有权限的那个进程里发生的。后到的直接回 null，不排队。
 */
const openAlerts = new Set<string>()

/** 抢到本轮唯一名额返回 true；已经有框在飞返回 false */
export function beginPluginAlert(pluginId: string): boolean {
  if (openAlerts.has(pluginId)) return false
  openAlerts.add(pluginId)
  return true
}

export function endPluginAlert(pluginId: string): void {
  openAlerts.delete(pluginId)
}
