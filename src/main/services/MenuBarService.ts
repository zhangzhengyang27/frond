/**
 * Frond · 菜单栏项搜索服务（Raycast「Search Menu Bar Items」parity，2026-09-28）
 *
 * macOS System Events 遍历前台应用菜单栏（buildListScript），缓存 15s——
 * 深遍历大应用要数秒，不能每次打开都走。触发走 buildClickScript，点击后
 * 缓存立即失效（菜单状态已被改动）。纯逻辑在 menuBarLogic.ts（TDD）。
 * 平台：macOS（需辅助功能授权，与窗口切换同前提）。
 */
import { execFile } from 'node:child_process'
import { typedHandle } from '../ipc/typedIpc'
import { getCachedFrontmostPid } from '../launcher/frontmostCache'
import {
  buildClickScript,
  buildListScript,
  parseMenuBarListing,
  type MenuBarItem
} from './menuBarLogic'

const LIST_TIMEOUT_MS = 12_000
const CLICK_TIMEOUT_MS = 5_000
const CACHE_TTL_MS = 15_000
const MAX_DEPTH = 3

function runOsa(script: string, timeoutMs: number): Promise<string> {
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

interface MenuBarCache {
  at: number
  app: string | null
  /** 本次列表所属目标应用的 pid（trigger 按它寻址，见下） */
  pid: number | null
  items: MenuBarItem[]
}

let cache: MenuBarCache | null = null
/** in-flight 去重：深遍历数秒，关页再开页（每次 mount 都 refresh）会并发第二个 */
let listing: Promise<{
  ok: boolean
  app: string | null
  items: MenuBarItem[]
  reason?: string
}> | null = null

async function listMenuBarOnce(): Promise<{
  ok: boolean
  app: string | null
  items: MenuBarItem[]
  reason?: string
}> {
  // B36：按「唤起胶囊前的前台应用」pid 寻址——胶囊聚焦时执行时刻的 frontmost
  // 只能查到 Frond 自己（frontmostCache.ts:5 记载的语义坑）。无快照回退
  // frontmost（首启/缓存未热时的降级，行为同旧版）。
  const pid = getCachedFrontmostPid()
  const out = await runOsa(buildListScript(MAX_DEPTH, pid ?? undefined), LIST_TIMEOUT_MS)
  const items = parseMenuBarListing(out)
  const app =
    out
      .split('\n')
      .find((l) => l.trim())
      ?.split('\t')[0] ?? null
  cache = { at: Date.now(), app, pid, items }
  return { ok: true, app, items }
}

export function registerMenuBarIpc(): void {
  typedHandle('menubar:list', async () => {
    if (process.platform !== 'darwin') {
      return { ok: false, app: null, items: [], reason: 'unsupported' }
    }
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return { ok: true, app: cache.app, items: cache.items }
    }
    if (!listing) {
      listing = listMenuBarOnce().finally(() => {
        listing = null
      })
    }
    try {
      return await listing
    } catch (e) {
      return { ok: false, app: null, items: [], reason: (e as Error).message }
    }
  })

  typedHandle('menubar:trigger', async (_event, { segments, title }) => {
    if (process.platform !== 'darwin') return { ok: false, error: '仅 macOS 支持' }
    if (!segments.length) return { ok: false, error: '路径为空' }
    // 点击目标 = 列表所属应用（缓存的 pid），不是执行时刻的 frontmost：
    // 列表与点击之间用户切走时，按旧 frontmost 会点在别的应用上
    const pid = cache?.pid ?? getCachedFrontmostPid() ?? undefined
    cache = null
    try {
      await runOsa(buildClickScript(segments, title, pid), CLICK_TIMEOUT_MS)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
}
