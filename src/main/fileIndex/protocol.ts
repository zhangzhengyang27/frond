/**
 * Frond · 文件索引 worker RPC 协议（批5）
 *
 * utilityProcess 的 MessagePort 走结构化克隆，对象直传无需 JSON 序列化；
 * 这里只做信封构造与类型守卫（纯函数，可独立单测）。
 * 方法语义与返回形状必须与 FileIndexService 逐字节一致（fileSearch 三层回退
 * 与 file-index e2e 依赖现行为）。
 */

export type FileIndexRequestType =
  | 'ensureStarted'
  | 'getStatus'
  | 'getScopes'
  | 'setScopes'
  | 'rebuild'
  | 'setHidden'
  | 'query'

export interface FileIndexRequest {
  id: number
  type: FileIndexRequestType
  payload: unknown
}

export interface FileIndexResponse {
  id: number
  ok: boolean
  result?: unknown
  error?: string
}

export type FileIndexWorkerLogLevel = 'debug' | 'error'

export interface FileIndexWorkerEvent {
  event: 'log'
  level: FileIndexWorkerLogLevel
  message: string
}

export function makeRequest(
  id: number,
  type: FileIndexRequestType,
  payload: unknown
): FileIndexRequest {
  return { id, type, payload }
}

export function makeResponse(id: number, ok: boolean, result?: unknown, error?: string): FileIndexResponse {
  return ok ? { id, ok, result } : { id, ok, error: error ?? 'unknown' }
}

export function makeLogEvent(level: FileIndexWorkerLogLevel, message: string): FileIndexWorkerEvent {
  return { event: 'log', level, message }
}

export function isFileIndexRequest(v: unknown): v is FileIndexRequest {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return (
    typeof r.id === 'number' &&
    typeof r.type === 'string' &&
    [
      'ensureStarted',
      'getStatus',
      'getScopes',
      'setScopes',
      'rebuild',
      'setHidden',
      'query'
    ].includes(r.type)
  )
}

export function isFileIndexResponse(v: unknown): v is FileIndexResponse {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return typeof r.id === 'number' && typeof r.ok === 'boolean'
}

export function isFileIndexWorkerEvent(v: unknown): v is FileIndexWorkerEvent {
  if (typeof v !== 'object' || v === null) return false
  const r = v as Record<string, unknown>
  return r.event === 'log' && typeof r.level === 'string' && typeof r.message === 'string'
}
