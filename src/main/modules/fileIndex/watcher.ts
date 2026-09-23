/**
 * Frond · 文件索引事件源后端（#9 M2 跨平台）
 *
 * 两个平台的原生事件源都不是跨平台的包，且**只会用到当前平台那一个**：
 * - darwin：fsevents（package.json 里 os=["darwin"]，Windows 上根本不安装）
 * - win32：@parcel/watcher（内部走 ReadDirectoryChangesW，递归且自带忽略表）
 *
 * 因此两边都在分支内 **动态 import**：electron-vite 把 dependencies 全部外置，
 * 动态 import 落到运行时 require，构建期不会去解析另一平台的包 —— 静态导入则会让
 * 构建产物在缺包的平台直接 MODULE_NOT_FOUND（审查 C-1 就是这么炸的）。
 *
 * 输出统一为「事件路径」，由 service 折算成索引形态（normPath）后走同一套目录 diff。
 */
export type WatchListener = (path: string) => void

export interface WatchBackend {
  readonly name: 'fsevents' | 'parcel'
  /** 开始监听给定范围，返回停止函数（多次 start 的停止句柄各自持有） */
  watch(scopes: string[], onPath: WatchListener): Promise<() => void>
}

/** 当前平台可用的后端；null = 没有增量能力（索引仍可用，靠启动补偿与手动重建） */
export function activeBackend(p: NodeJS.Platform = process.platform): WatchBackend | null {
  if (p === 'darwin') return fseventsBackend
  if (p === 'win32') return parcelBackend
  return null
}

const fseventsBackend: WatchBackend = {
  name: 'fsevents',
  async watch(scopes, onPath) {
    const mod = await import('fsevents')
    const stops = scopes.map((dir) =>
      mod.default.watch(dir, (path: string) => {
        if (typeof path === 'string' && path) onPath(path)
      })
    )
    return () => stops.forEach((stop) => stop())
  }
}

const parcelBackend: WatchBackend = {
  name: 'parcel',
  async watch(scopes, onPath) {
    const mod = await import('@parcel/watcher')
    const stops: Array<() => void> = []
    for (const dir of scopes) {
      const sub = await mod.subscribe(dir, (err, events) => {
        if (err) {
          // 事件流断了索引只会「不再更新」而不是坏掉：说清楚，交给下次启动补偿兜底
          console.error('[FileIndex] 监听异常（增量暂停）:', err.message)
          return
        }
        for (const e of events) if (e?.path) onPath(e.path)
      })
      stops.push(() => void sub.unsubscribe())
    }
    return () => stops.forEach((stop) => stop())
  }
}
