/**
 * Frond · 类型化 IPC 调用（preload 侧）
 *
 * 与 src/main/ipc/typedIpc.ts 成对：通道必须在 IpcContract 里登记，req/res 由类型约束。
 * preload 对渲染端仍暴露原有 JS 签名（如 setTheme('dark')），在这里折算成约定的
 * 单对象入参 —— 这样统一线格式不需要动渲染端与第三方插件的调用面。
 */
import { ipcRenderer } from 'electron'
import type { IpcKey, IpcRequest, IpcResponse } from '../shared/ipc-contract'
import { decodeIpcError } from '../shared/ipcError'

/** 结构化 IPC 错误：kind/channel 可读，message 与主进程原始文案一致 */
export class FrondIpcError extends Error {
  readonly channel: string
  readonly kind: string
  constructor(payload: { channel: string; kind: string; message: string }) {
    super(payload.message)
    this.name = 'FrondIpcError'
    this.channel = payload.channel
    this.kind = payload.kind
  }
}

export function typedInvoke<K extends IpcKey>(
  channel: K,
  ...req: [IpcRequest<K>] extends [void] ? [] : [IpcRequest<K>]
): Promise<IpcResponse<K>> {
  return (ipcRenderer.invoke(channel, req[0]) as Promise<unknown>).catch((error: unknown) => {
    // 主进程信封 → 结构化 FrondIpcError（message 已还原为原始文案）
    if (error instanceof Error) {
      const payload = decodeIpcError(error.message)
      if (payload) throw new FrondIpcError(payload)
    }
    throw error
  }) as Promise<IpcResponse<K>>
}
