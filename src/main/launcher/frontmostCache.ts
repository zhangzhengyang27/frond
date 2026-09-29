/**
 * Frond · 前台应用名缓存（UI 对标 I2：剪贴板「粘贴到 <应用名>」目标级文案）
 *
 * 胶囊窗聚焦后用 osascript 查前台进程只能查到 Frond 自己，
 * 而「粘贴回注」发生在胶囊 hide 之后——届时前台应用会恢复为唤起 Frond 前的那个。
 * 因此在胶囊隐藏期间低频轮询缓存前台应用名（首次被 IPC 调用时启用轮询），
 * 渲染端读缓存展示目标级提示。
 */
import { app } from 'electron'
import { frontmostAppIdentity } from '../modules/focusShield'
import { getLauncherWindow } from './window'

const POLL_INTERVAL_MS = 5000
/** hide 后焦点回落需要一拍，立即查只会查到正在消失的胶囊 */
const HIDE_REPOLL_DELAY_MS = 600

interface FrontmostIdentity {
  name: string
  pid: number
}

let cached: FrontmostIdentity | null = null
let timer: ReturnType<typeof setInterval> | null = null
let hideRepollTimer: ReturnType<typeof setTimeout> | null = null

function isSelfName(name: string): boolean {
  // dev 进程名 Electron；打包后为可执行名（productName=Frond，Windows 带 .exe）。
  // 审查修复：app.getName() 取 package.json 而非 OS 进程名，打包版会失配——
  // 改为与可执行文件名大小写不敏感比对。
  const exe = app.getPath('exe')
  const selfNames = new Set([
    'electron',
    'electron.exe',
    app.getName().toLowerCase(),
    exe
      .split(/[/\\]/)
      .pop()!
      .toLowerCase()
  ])
  return selfNames.has(name.toLowerCase())
}

function poll(): void {
  if (getLauncherWindow()?.isVisible()) return
  void frontmostAppIdentity().then(({ name, pid }) => {
    if (name && pid !== null && !isSelfName(name)) cached = { name, pid }
  })
}

/** 首次调用即启用低频轮询（幂等） */
export function enableFrontmostCache(): void {
  if (timer) return
  timer = setInterval(poll, POLL_INTERVAL_MS)
  poll()
}

/**
 * 胶囊真 hide 后补一拍快照（B36）：轮询最长 5s 陈旧——用户在唤起前一刻切了
 * 应用时，菜单栏搜索会按旧 pid 寻址。hide 是「即将切回用户应用」的最强信号，
 * 此刻补拍把陈旧窗口压到一次焦点切换以内。
 */
export function noteLauncherHidden(): void {
  if (hideRepollTimer) clearTimeout(hideRepollTimer)
  hideRepollTimer = setTimeout(() => {
    hideRepollTimer = null
    poll()
  }, HIDE_REPOLL_DELAY_MS)
}

export function getCachedFrontmostApp(): string | null {
  return cached?.name ?? null
}

/** 唤起胶囊前的前台应用 pid（菜单栏搜索按 unix id 寻址用，B36）；无快照为 null */
export function getCachedFrontmostPid(): number | null {
  return cached?.pid ?? null
}
