/**
 * Frond · Quicklink favicon 抓取与缓存（本地优先）
 *
 * 渲染端为 quicklink 条目显示站点图标：
 * - 首选目标站点自身 /favicon.ico（无第三方服务依赖）
 * - 缓存在 userData/favicons/<hash>.png，命中即秒回
 * - 内网地址拒绝（复用插件代理的黑名单），10s 超时，512KB 上限
 * - 失败返回 null，渲染端回退通用 link 图标
 */
import { app } from 'electron'
import { createHash } from 'crypto'
import { existsSync, mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { isLocalTarget } from './runtime'

const MAX_BYTES = 512 * 1024
const FETCH_TIMEOUT_MS = 10_000

function faviconDir(): string {
  const dir = join(app.getPath('userData'), 'favicons')
  mkdirSync(dir, { recursive: true })
  return dir
}

function cachePath(host: string): string {
  const hash = createHash('sha256').update(host).digest('hex').slice(0, 24)
  return join(faviconDir(), `${hash}.png`)
}

/**
 * 解析 quicklink URL 的 favicon 本地缓存路径；未缓存则抓取后落盘。
 * 任何失败返回 null（渲染端回退通用图标），不抛错。
 */
export async function getFaviconPath(quicklinkUrl: string): Promise<string | null> {
  let parsed: URL
  try {
    parsed = new URL(quicklinkUrl)
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null
  if (await isLocalTarget(parsed)) return null

  const cached = cachePath(parsed.host)
  if (existsSync(cached)) return cached

  try {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS)
    try {
      // 手动跟随重定向（最多 1 跳）：每一跳都重新过内网校验，
      // 避免 redirect:'follow' 下外网 302 → 内网绕过校验
      let target = new URL('/favicon.ico', parsed.origin)
      for (let hop = 0; hop < 2; hop++) {
        if (await isLocalTarget(target)) return null
        const res = await fetch(target, { signal: controller.signal, redirect: 'error' })
        if (res.status >= 300 && res.status < 400) {
          const location = res.headers.get('location')
          if (!location) return null
          target = new URL(location, target)
          continue
        }
        if (!res.ok) return null
        const declared = Number(res.headers.get('content-length') ?? 0)
        if (declared > MAX_BYTES) return null
        const buf = Buffer.from(await res.arrayBuffer())
        if (buf.length === 0 || buf.length > MAX_BYTES) return null
        writeFileSync(cached, buf)
        return cached
      }
      return null
    } finally {
      clearTimeout(timer)
    }
  } catch {
    return null
  }
}
