/**
 * Leaf · 前台应用名缓存（UI 对标 I2：剪贴板「粘贴到 <应用名>」目标级文案）
 *
 * 胶囊窗聚焦后用 osascript 查前台进程只能查到 Leaf 自己，
 * 而「粘贴回注」发生在胶囊 hide 之后——届时前台应用会恢复为唤起 Leaf 前的那个。
 * 因此在胶囊隐藏期间低频轮询缓存前台应用名（首次被 IPC 调用时启用轮询），
 * 渲染端读缓存展示目标级提示。
 */
import { app } from 'electron'
import { frontmostAppName } from '../modules/focusShield'
import { getLauncherWindow } from './window'

const POLL_INTERVAL_MS = 5000

let cached: string | null = null
let timer: ReturnType<typeof setInterval> | null = null

function isSelfName(name: string): boolean {
  // dev 进程名 Electron；打包后为可执行名（productName=Leaf，Windows 带 .exe）。
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
  void frontmostAppName().then((name) => {
    if (name && !isSelfName(name)) cached = name
  })
}

/** 首次调用即启用低频轮询（幂等） */
export function enableFrontmostCache(): void {
  if (timer) return
  timer = setInterval(poll, POLL_INTERVAL_MS)
  poll()
}

export function getCachedFrontmostApp(): string | null {
  return cached
}
