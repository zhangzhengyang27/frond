/**
 * Frond · 向前台应用注入粘贴键（⌘V / Ctrl+V）
 *
 * 供剪贴板历史「粘贴直达」等场景复用：调用方先把内容写好剪贴板并收起
 * 自己的窗口（焦点回落到目标应用），延迟 pasteDelayMs 后注入粘贴键。
 * 依赖 macOS 辅助功能授权（与片段文本扩展同一权限）。
 */
import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

/** 收起窗口后等焦点落定的默认延迟 */
export const PASTE_DELAY_MS = 150

/** 向当前前台应用注入一次粘贴键；失败抛错（调用方决定提示策略） */
export async function pasteToActiveApp(): Promise<void> {
  if (process.platform === 'darwin') {
    const script = `tell application "System Events" to keystroke "v" using command down`
    await execFileAsync('osascript', ['-e', script], { timeout: 5000 })
  } else if (process.platform === 'win32') {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('^v')`
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeout: 5000
    })
  } else {
    throw new Error('当前平台不支持粘贴注入')
  }
}

/** 直接向前台应用键入文本（US 可打印字符场景，避免剪贴板中转） */
export async function typeTextToActiveApp(text: string): Promise<void> {
  if (process.platform === 'darwin') {
    // osascript keystroke 需要转义反斜杠与双引号；文本已由调用方限定为安全字符集
    const escaped = text.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const script = `tell application "System Events" to keystroke "${escaped}"`
    await execFileAsync('osascript', ['-e', script], { timeout: 8000 })
  } else if (process.platform === 'win32') {
    // SendKeys 特殊字符（+^%~(){}[]）需包裹转义
    const escaped = text.replace(/([+^%~(){}[\]])/g, '{$1}').replace(/\n/g, '{ENTER}')
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('${escaped.replace(/'/g, "''")}')`
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeout: 8000
    })
  } else {
    throw new Error('当前平台不支持文本注入')
  }
}

/** 是否适合直接键入（不走剪贴板中转）：ASCII 可打印 + 换行 + 制表，长度受限 */
export function isDirectTypable(text: string): boolean {
  if (text.length === 0 || text.length > 500) return false

  return /^[\t\n\r\x20-\x7E]*$/.test(text)
}
