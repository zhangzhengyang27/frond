/**
 * Frond · 窗口切换服务（阶段3.3b）
 *
 * 获取当前所有可见窗口列表，支持在启动器中搜索并切换到对应窗口。
 * macOS 下通过 AppleScript + System Events 获取窗口信息。
 */
import { execFile } from 'child_process'
import { typedHandle } from '../ipc/typedIpc'

/**
 * 运行 osascript：脚本作为独立参数传给 osascript，不经 shell，
 * 窗口标题中的 $()、反引号等不会被展开（execFile 无注入面）。
 * 带超时保护，避免 System Events 卡死拖住调用方。
 */
function runOsa(script: string, timeoutMs = 8000): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      'osascript',
      ['-e', script],
      { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 },
      (error, stdout) => {
        if (error) reject(error)
        else resolve(String(stdout))
      }
    )
  })
}

export interface WindowInfo {
  /** 窗口 ID（进程名+窗口标题哈希） */
  id: string
  /** 应用名称 */
  appName: string
  /** 窗口标题 */
  title: string
  /** 进程 ID */
  pid: number
  /** 应用图标（可选，通过 bundle id 获取） */
  icon?: string
}

/**
 * 获取所有可见窗口列表（macOS）
 * 通过 AppleScript 遍历 System Events 中的进程和窗口。
 * 用 \x00 作为分隔符，避免窗口标题中包含 || 或换行导致解析错误。
 */
export async function getWindows(): Promise<WindowInfo[]> {
  try {
    // 用 AppleScript 的 linefeed 作为真实换行，\x00 作为字段分隔符
    const script = [
      'tell application "System Events"',
      '  set output to ""',
      '  set AppleScript\'s text item delimiters to ""',
      '  repeat with p in (every process whose visible is true)',
      '    set appName to name of p',
      '    set pidNum to unix id of p',
      '    repeat with w in (every window of p)',
      '      set winTitle to name of w',
      '      if winTitle is not missing value and winTitle is not "" then',
      '        set output to output & appName & character id 0 & pidNum & character id 0 & winTitle & linefeed',
      '      end if',
      '    end repeat',
      '  end repeat',
      '  return output',
      'end tell'
    ].join('\n')
    const stdout = await runOsa(script)
    const lines = stdout.trim().split('\n').filter(Boolean)
    return lines.map((line) => {
      const parts = line.split('\x00')
      const appName = parts[0] ?? ''
      const pid = parseInt(parts[1] ?? '0', 10) || 0
      const title = parts.slice(2).join('\x00')
      return {
        id: `${appName}-${pid}-${title}`,
        appName,
        title,
        pid
      }
    })
  } catch (err) {
    console.warn('[WindowSwitcher] getWindows failed:', err)
    return []
  }
}

/**
 * 激活指定窗口（通过 pid 和窗口标题）
 * pid 必须为正整数；标题经转义后嵌入 AppleScript 字符串字面量
 * （execFile 不经 shell，无需防 $()/反引号，只需防 AppleScript 引号逃逸）。
 */
export async function activateWindow(pid: number, title: string): Promise<boolean> {
  if (!Number.isInteger(pid) || pid <= 0) return false
  try {
    const escapedTitle = title.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
    const script = [
      'tell application "System Events"',
      `  set targetProc to first process whose unix id is ${pid}`,
      '  set frontmost of targetProc to true',
      '  repeat with w in (every window of targetProc)',
      `    if name of w is "${escapedTitle}" then`,
      '      perform action "AXRaise" of w',
      '      exit repeat',
      '    end if',
      '  end repeat',
      'end tell'
    ].join('\n')
    await runOsa(script)
    return true
  } catch (err) {
    console.warn('[WindowSwitcher] activateWindow failed:', err)
    return false
  }
}

/** 注册窗口切换 IPC */
export function registerWindowSwitcherIpc(): void {
  typedHandle('windows:list', async () => {
    return getWindows()
  })

  typedHandle('windows:activate', async (_e, req) => {
    return activateWindow(Number(req.pid), typeof req.title === 'string' ? req.title : '')
  })
}
