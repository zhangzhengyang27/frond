/**
 * Frond · file-index-worker（批5 R2 进程隔离）
 *
 * 文件索引独立进程入口：主进程经 utilityProcess.fork 拉起，argv[2] = userData 路径
 * （worker 不依赖 electron app 模块）。全部 SQLite/扫描/FTS 写入/watcher 都在本进程，
 * 主进程只持 RPC 客户端——索引再重也不阻塞主线程（Raycast v2 的"索引进程隔离"原则）。
 */
import { fileIndex } from '../modules/fileIndex/service'
import { setFileIndexLogSink } from './log'
import {
  isFileIndexRequest,
  makeResponse,
  makeLogEvent,
  type FileIndexRequestType
} from './protocol'

const userDataArg = process.argv[2]
if (!userDataArg) throw new Error('file-index-worker 需要 userData 路径参数（fork argv[2]）')
const userDataPath: string = userDataArg

/** utilityProcess 的 parentPort（Electron 专属，@types/node 无此字段） */
interface ParentPortLike {
  postMessage(message: unknown): void
  on(event: 'message', listener: (e: { data: unknown }) => void): void
}
const parentPort = (process as unknown as { parentPort: ParentPortLike }).parentPort

// 本地日志经 RPC 事件转发主进程打印（打包版里 worker stdout 默认不可见）
setFileIndexLogSink((level, message) => {
  parentPort.postMessage(makeLogEvent(level, message))
})

async function handle(type: FileIndexRequestType, payload: unknown): Promise<unknown> {
  switch (type) {
    case 'ensureStarted':
      await fileIndex.ensureStarted(userDataPath)
      return null
    case 'getStatus':
      return fileIndex.getStatus()
    case 'getScopes':
      return fileIndex.getScopes()
    case 'setScopes':
      fileIndex.setScopes((payload as string[]) ?? [])
      return null
    case 'rebuild':
      await fileIndex.rebuild()
      return null
    case 'setHidden':
      fileIndex.setHidden(payload === true)
      return null
    case 'query': {
      const { tokens, mode, limit } = (payload ?? {}) as {
        tokens: string[]
        mode: 'name' | 'content'
        limit: number
      }
      return fileIndex.query(tokens, mode, limit)
    }
  }
}

parentPort.on('message', (e: { data: unknown }) => {
  const msg = e.data
  if (!isFileIndexRequest(msg)) return
  void handle(msg.type, msg.payload)
    .then((result) => parentPort.postMessage(makeResponse(msg.id, true, result)))
    .catch((err: unknown) =>
      parentPort.postMessage(makeResponse(msg.id, false, undefined, (err as Error).message))
    )
})
