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
  items: MenuBarItem[]
}

let cache: MenuBarCache | null = null

export function registerMenuBarIpc(): void {
  typedHandle('menubar:list', async () => {
    if (process.platform !== 'darwin') {
      return { ok: false, app: null, items: [], reason: 'unsupported' }
    }
    if (cache && Date.now() - cache.at < CACHE_TTL_MS) {
      return { ok: true, app: cache.app, items: cache.items }
    }
    try {
      const out = await runOsa(buildListScript(MAX_DEPTH), LIST_TIMEOUT_MS)
      const items = parseMenuBarListing(out)
      const app = out.split('\n').find((l) => l.trim())?.split('\t')[0] ?? null
      cache = { at: Date.now(), app, items }
      return { ok: true, app, items }
    } catch (e) {
      return { ok: false, app: null, items: [], reason: (e as Error).message }
    }
  })

  typedHandle('menubar:trigger', async (_event, { segments, title }) => {
    if (process.platform !== 'darwin') return { ok: false, error: '仅 macOS 支持' }
    if (!segments.length) return { ok: false, error: '路径为空' }
    cache = null
    try {
      await runOsa(buildClickScript(segments, title), CLICK_TIMEOUT_MS)
      return { ok: true }
    } catch (e) {
      return { ok: false, error: (e as Error).message }
    }
  })
}
