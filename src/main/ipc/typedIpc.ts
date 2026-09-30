/**
 * Frond · 类型化 IPC 注册（单对象入参约定的执行点）
 *
 * 约定：每个通道一个 `req` 对象（无入参用 void），返回类型即 `res`；通道必须先在
 * `src/shared/ipc-contract.ts` 登记 —— 没登记或形状不符，这里编译期就红。
 * 这是本仓库此前缺失的一环：登记册过去只是文档，不参与任何编译约束。
 *
 * 迁移策略（决定了 400+ 通道是否搬得动）：**只改主进程 handler 与本文件的调用方**，
 * preload 暴露给渲染端的 `window.api.X(...)` JS 签名保持不变，由 preload 负责
 * 「位置参数 → 对象」的折算。渲染端因此零改动，第三方插件用的 launcherApi 也不破。
 */
import { ipcMain, type IpcMainInvokeEvent } from 'electron'
import type { IpcKey, IpcRequest, IpcResponse } from '../../shared/ipc-contract'
import { encodeIpcError, payloadFromThrown } from '../../shared/ipcError'

export type TypedHandler<K extends IpcKey> = (
  event: IpcMainInvokeEvent,
  req: IpcRequest<K>
) => IpcResponse<K> | Promise<IpcResponse<K>>

/**
 * 注册一个已登记的通道（ipcMain.handle 包装，带 req/res 约束）。
 * 批 7a：失败统一打日志 + 装信封再抛——渲染端经 typedInvoke 解包拿到
 * FrondIpcError（kind/channel 可读、原始 message 保留）；不经 typedInvoke 的
 * 调用方（测试直连等）看到的 message 是信封串，属预期。
 */
export function typedHandle<K extends IpcKey>(channel: K, handler: TypedHandler<K>): void {
  ipcMain.handle(channel, async (...args: unknown[]) => {
    try {
      return await (handler as (...a: unknown[]) => unknown)(...args)
    } catch (error) {
      console.error(`[ipc] ${channel} 处理失败:`, error)
      throw new Error(encodeIpcError(payloadFromThrown(channel, error)))
    }
  })
}

/**
 * @deprecated 批 7a 起 typedHandle 自带失败日志与错误信封，本函数仅为既有 14 处
 * 调用点的兼容别名（logLabel 参数不再使用），新代码一律用 typedHandle。
 */
export function typedHandleLogged<K extends IpcKey>(
  channel: K,
  handler: TypedHandler<K>,
  _logLabel = '[ipc]'
): void {
  typedHandle(channel, handler)
}

/** 一次性摘掉某通道的注册（模块热重载/测试用） */
export function typedRemove(channel: IpcKey): void {
  ipcMain.removeHandler(channel)
}
