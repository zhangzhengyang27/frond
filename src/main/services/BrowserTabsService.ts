/**
 * Frond · 浏览器标签服务（P1-5）
 *
 * macOS 上通过 AppleScript 获取 Google Chrome / Safari 的当前标签列表，
 * 支持搜索标签标题/URL 并激活对应标签。
 *
 * 权限：需要 macOS 辅助功能权限（自动化控制浏览器）。
 * 非 macOS 平台返回空列表。
 */
import { ipcMain } from 'electron'
import { execFile } from 'child_process'

export interface BrowserTab {
  id: string
  browser: 'chrome' | 'safari'
  title: string
  url: string
  windowId: number
  tabIndex: number
}

function runAppleScript(script: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile('osascript', ['-e', script], { encoding: 'utf8', timeout: 5000 }, (err, stdout) => {
      if (err) reject(err)
      else resolve(stdout.trim())
    })
  })
}

/** 获取 Google Chrome 所有窗口的标签 */
async function getChromeTabs(): Promise<BrowserTab[]> {
  // 运行态守卫：is running 检查不会拉起浏览器，未运行直接返回空——
  // 否则主进程内部查询（如 Quicklinks 复用标签）会作为副作用启动已关闭的浏览器
  const script = `
    if application "Google Chrome" is not running then return ""
    tell application "Google Chrome"
      set output to ""
      set windowIndex to 0
      repeat with w in windows
        set windowIndex to windowIndex + 1
        set tabIndex to 0
        repeat with t in tabs of w
          set tabIndex to tabIndex + 1
          set output to output & windowIndex & "||" & tabIndex & "||" & (title of t) & "||" & (URL of t) & "\n"
        end repeat
      end repeat
      return output
    end tell
  `
  try {
    const output = await runAppleScript(script)
    return parseTabOutput(output, 'chrome')
  } catch {
    return []
  }
}

/** 获取 Safari 所有窗口的标签 */
async function getSafariTabs(): Promise<BrowserTab[]> {
  const script = `
    if application "Safari" is not running then return ""
    tell application "Safari"
      set output to ""
      set windowIndex to 0
      repeat with w in windows
        set windowIndex to windowIndex + 1
        set tabIndex to 0
        repeat with t in tabs of w
          set tabIndex to tabIndex + 1
          set output to output & windowIndex & "||" & tabIndex & "||" & (name of t) & "||" & (URL of t) & "\n"
        end repeat
      end repeat
      return output
    end tell
  `
  try {
    const output = await runAppleScript(script)
    return parseTabOutput(output, 'safari')
  } catch {
    return []
  }
}

function parseTabOutput(output: string, browser: 'chrome' | 'safari'): BrowserTab[] {
  const lines = output.split('\n').filter((l) => l.trim())
  return lines.map((line) => {
    const parts = line.split('||')
    const windowId = parseInt(parts[0], 10) || 1
    const tabIndex = parseInt(parts[1], 10) || 1
    const title = parts[2] || ''
    const url = parts[3] || ''
    return {
      id: `${browser}:${windowId}:${tabIndex}`,
      browser,
      title,
      url,
      windowId,
      tabIndex
    }
  })
}

/** 激活指定标签（切换到对应窗口并选中标签） */
async function activateTab(tab: BrowserTab): Promise<boolean> {
  const script =
    tab.browser === 'chrome'
      ? `
    tell application "Google Chrome"
      activate
      set index of window ${tab.windowId} to 1
      set active tab index of window ${tab.windowId} to ${tab.tabIndex}
    end tell
  `
      : `
    tell application "Safari"
      activate
      set index of window ${tab.windowId} to 1
      set current tab of window ${tab.windowId} to tab ${tab.tabIndex} of window ${tab.windowId}
    end tell
  `
  try {
    await runAppleScript(script)
    return true
  } catch {
    return false
  }
}

/**
 * 列出 Chrome / Safari 全部标签（供主进程内部调用，B4 Quicklinks 复用已有标签页）。
 * 非 macOS、查询失败或浏览器均未运行时返回空数组（不会作为副作用拉起浏览器）。
 */
export async function listAllBrowserTabs(): Promise<BrowserTab[]> {
  if (process.platform !== 'darwin') return []
  const [chromeTabs, safariTabs] = await Promise.all([getChromeTabs(), getSafariTabs()])
  return [...chromeTabs, ...safariTabs]
}

/** 激活指定标签（内部查询命中后供主进程模块调用） */
export { activateTab as activateBrowserTab }

export function registerBrowserTabsIpc(): void {
  ipcMain.handle('browser:tabs:list', async () => {
    if (process.platform !== 'darwin') return { ok: true, tabs: [], supported: false }
    return { ok: true, tabs: await listAllBrowserTabs(), supported: true }
  })

  ipcMain.handle('browser:tabs:activate', async (_e, tab: BrowserTab) => {
    if (process.platform !== 'darwin') return { ok: false, error: '仅支持 macOS' }
    const success = await activateTab(tab)
    return { ok: success }
  })
}

