/**
 * Frond · 文件索引本地日志（批5 进程隔离配套）
 *
 * worker 进程不能引主库单例（LogService 连着 database.ts，会把整个主 DB 层
 * 拖进 utility 进程），这里给 fileIndex 域一个零依赖 logger：console 直出 +
 * 可注册 sink（workerHost 注册后经 RPC 事件转发主进程打印，保证打包版可见）。
 */

export type FileIndexLogLevel = 'debug' | 'error'

type Sink = (level: FileIndexLogLevel, message: string) => void

let sink: Sink | null = null

export function setFileIndexLogSink(fn: Sink | null): void {
  sink = fn
}

export function logFileIndex(level: FileIndexLogLevel, message: string, err?: unknown): void {
  const line = err ? `${message}: ${(err as Error).message}` : message
  if (level === 'error') {
    console.error(`[FileIndex] ${line}`)
  } else {
    console.log(`[FileIndex] ${line}`)
  }
  sink?.(level, line)
}
