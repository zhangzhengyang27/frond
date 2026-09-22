import { ipcMain, type IpcMainInvokeEvent } from 'electron'

/** 用 never[] 允许调用方声明任意具体参数（never 可赋给一切参数类型） */
type IpcHandler = (event: IpcMainInvokeEvent, ...args: never[]) => unknown

/**
 * 批量注册 IPC 处理器，减少样板代码。
 * 先移除已有 handler 防止重复注册报错。
 */
export function registerHandlers(map: Record<string, IpcHandler>): void {
  for (const [channel, handler] of Object.entries(map)) {
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, (event, ...args: unknown[]) =>
      (handler as (event: IpcMainInvokeEvent, ...handlerArgs: unknown[]) => unknown)(event, ...args)
    )
  }
}

/**
 * 将对象方法按前缀注册为 IPC 处理器。
 * 例如：prefix = 'photos', methods = { getAll: store.getAll }
 * 会注册 'photos:getAll' → handler
 * 先移除已有 handler 防止重复注册报错。
 */
export function registerPrefixedHandlers(
  prefix: string,
  methods: Record<string, (...args: never[]) => unknown>
): void {
  for (const [name, fn] of Object.entries(methods)) {
    const channel = `${prefix}:${name}`
    ipcMain.removeHandler(channel)
    ipcMain.handle(channel, (_event, ...args: unknown[]) =>
      (fn as (...fnArgs: unknown[]) => unknown)(...args)
    )
  }
}
