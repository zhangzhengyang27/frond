/**
 * Frond · 菜单栏项搜索纯逻辑（Raycast「Search Menu Bar Items」parity，2026-09-28）
 *
 * Electron 接线在 MenuBarService.ts；本文件只放可单测的纯部分：
 * osascript 列表输出解析、点击脚本构造（引号转义是安全面——菜单标题来自
 * 任意应用的任意字符串，必须不能断裂/注入脚本）、展示用路径标签。
 * 平台：macOS（System Events，需辅助功能授权——与窗口切换同前提）。
 */
import type { MenuBarItem } from '../../shared/menuBar'

export type { MenuBarItem }

const SEP = '\t'

/** 解析 osascript 输出：每行 `app\tseg1\t…\tsegN\titemTitle`；空行/缺列丢弃 */
export function parseMenuBarListing(out: string): MenuBarItem[] {
  const items: MenuBarItem[] = []
  for (const line of out.split('\n')) {
    if (!line.trim()) continue
    const cols = line.split(SEP)
    if (cols.length < 3) continue
    const title = cols[cols.length - 1]
    const segments = cols.slice(1, -1)
    if (!title || segments.some((s) => !s)) continue
    items.push({ segments, title, pathLabel: pathLabel(segments) })
  }
  return items
}

/** 展示用路径标签：段间用 › 连接 */
export function pathLabel(segments: string[]): string {
  return segments.join(' › ')
}

/** AppleScript 字符串字面量转义：反斜杠与双引号（其余字符 osascript 原样收） */
export function escapeAppleScriptString(value: string): string {
  return value.replace(/\\/g, '\\\\').replace(/"/g, '\\"')
}

/**
 * 构造点击脚本。segments 为完整路径段 + title 为条目名：
 *   click menu item "T" of menu 1 of menu bar item "M"
 *   click menu item "T" of menu 1 of menu item "P" of menu 1 of menu bar item "M"
 * 定位：给 targetPid（唤起胶囊前快照的前台应用，frontmostCache 缓存）按 unix id
 * 寻址——胶囊聚焦时执行时刻的 frontmost 只能查到 Frond 自己（B36 实锤）；
 * 不给 pid 回退 frontmost（兼容无快照场景）。
 */
export function buildClickScript(segments: string[], title: string, targetPid?: number): string {
  let target = `menu bar item "${escapeAppleScriptString(segments[0])}"`
  for (let i = 1; i < segments.length; i++) {
    target = `menu item "${escapeAppleScriptString(segments[i])}" of menu 1 of ${target}`
  }
  const locate =
    typeof targetPid === 'number' && Number.isInteger(targetPid)
      ? `first application process whose unix id is ${targetPid}`
      : 'first application process whose frontmost is true'
  return [
    'tell application "System Events"',
    `  tell (${locate})`,
    `    click menu item "${escapeAppleScriptString(title)}" of menu 1 of ${target}`,
    '  end tell',
    'end tell'
  ].join('\n')
}

/**
 * 构造列表脚本：System Events 深遍历目标应用菜单栏到 maxDepth 层，扁平输出
 * 每行 `app\tseg…\titemTitle`（tab 分隔；标题内 tab 由 scrub 换成空格防列错位）。
 * 定位同 buildClickScript：targetPid 优先（B36），否则 frontmost。
 * 深遍历慢（大应用数秒），depth 与缓存由 Service 侧控制。
 */
export function buildListScript(maxDepth: number, targetPid?: number): string {
  const locateStatement =
    typeof targetPid === 'number' && Number.isInteger(targetPid)
      ? `set fps to first application process whose unix id is ${targetPid}`
      : 'set fps to first application process whose frontmost is true'
  return `
on joinList(lst, delim)
  set d to text item delimiters
  set text item delimiters to delim
  set r to lst as text
  set text item delimiters to d
  return r
end joinList

on scrub(s)
  set d to text item delimiters
  set text item delimiters to tab
  set parts to text items of s
  set text item delimiters to " "
  set r to parts as text
  set text item delimiters to d
  return r
end scrub

on lineFor(appName, prefix, n)
  return my joinList({appName} & prefix & {n}, tab)
end lineFor

on walk(mi, prefix, depth, maxDepth, appName)
  set n to ""
  set hasSub to false
  set children to {}
  tell application "System Events"
    set n to name of mi
    if n is missing value then return ""
    set n to my scrub(n)
    set hasSub to (count of menus of mi) > 0
    if hasSub and depth < maxDepth then
      set children to menu items of menu 1 of mi
    end if
  end tell
  -- 用字符串拼接累积而非列表追加：列表引用在 tell 上下文里会被路由给
  -- System Events（实测 -10006），无变异的返回值拼接没有这个坑
  if hasSub and depth < maxDepth then
    set acc to ""
    repeat with c in children
      set acc to acc & my walk(c, prefix & {n}, depth + 1, maxDepth, appName) & linefeed
    end repeat
    return acc
  end if
  return my lineFor(appName, prefix, n)
end walk

on listMenuBar(maxDepth)
  set big to ""
  tell application "System Events"
    ${locateStatement}
    set appName to name of fps
    repeat with mbi in menu bar items of menu bar 1 of fps
      set big to big & my walk(mbi, {}, 0, maxDepth, appName) & linefeed
    end repeat
  end tell
  return big
end listMenuBar

return listMenuBar(${maxDepth})
`
}
