/**
 * Frond · 应用索引磁盘持久化（B53-1）
 *
 * applicationsCache 此前只在内存：每次冷启动首轮 get-applications 都同步等
 * 5-15s system_profiler。扫描成功后落盘 JSON，下次启动先回旧数据，由调用方
 * 既有的 stale-while-revalidate 逻辑（CACHE_TTL 24h）决定是否后台刷新——
 * 应用行从「每次启动 5-15s 才可搜」降到 <100ms。
 *
 * 纯函数便于单测：损坏 JSON / 版本不符 → null（回退同步扫描）；非法行剔除
 * 而非全盘拒绝（单条脏数据不该作废整份缓存）。
 */
import { join } from 'path'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs'

export interface ApplicationsCacheRow {
  name: string
  path: string
  icon?: string
  aliases?: string[]
}

interface CachePayload {
  version: number
  timestamp: number
  applications: unknown
}

const VERSION = 1

export function cacheFilePath(dir: string): string {
  return join(dir, 'applications-cache.json')
}

export function loadApplicationsCacheFile(
  dir: string
): { timestamp: number; applications: ApplicationsCacheRow[] } | null {
  const file = cacheFilePath(dir)
  if (!existsSync(file)) return null
  try {
    const payload = JSON.parse(readFileSync(file, 'utf-8')) as CachePayload
    if (payload.version !== VERSION) return null
    if (typeof payload.timestamp !== 'number' || !Array.isArray(payload.applications)) return null
    // 逐行校验：单条脏数据剔除，不全盘拒绝
    const applications = (payload.applications as unknown[]).filter(
      (a): a is ApplicationsCacheRow =>
        typeof a === 'object' &&
        a !== null &&
        typeof (a as ApplicationsCacheRow).name === 'string' &&
        typeof (a as ApplicationsCacheRow).path === 'string'
    )
    return { timestamp: payload.timestamp, applications }
  } catch {
    return null
  }
}

export function saveApplicationsCacheFile(
  dir: string,
  applications: ApplicationsCacheRow[],
  timestamp: number
): void {
  mkdirSync(dir, { recursive: true })
  const payload: CachePayload = { version: VERSION, timestamp, applications }
  writeFileSync(cacheFilePath(dir), JSON.stringify(payload), 'utf-8')
}
