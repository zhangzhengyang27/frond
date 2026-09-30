/**
 * Frond · IPC 错误信封（批 7a，C-代码-03）
 *
 * 现状问题：typedHandle 直通 ipcMain.handle，handler 抛错后 Electron 把它序列化成
 * 渲染端的 generic Error（"Error invoking remote method" 前缀）——错误类别、通道名
 * 全部丢失，渲染端无法按类型分流 UX，主进程日志覆盖靠各 handler 自觉。
 *
 * 方案：主进程捕获后在**错误消息里**编码结构化信封（Electron 只保留 message 字符串，
 * 这是唯一能穿越序列化的载体）；preload 解包重建成 FrondIpcError（kind/channel 可读，
 * message 保持原始文案——渲染端既有的 message 字符串匹配不受影响）。
 * 非信封形态的 rejection（Electron 自身的前缀错误等）原样透传。
 */

export const IPC_ERROR_PREFIX = 'FROND_IPC_V1:'

export interface IpcErrorPayload {
  /** 通道名（排查时定位 handler） */
  channel: string
  /** error.name（Error/AbortError/TypeError…）或 'NonError' */
  kind: string
  /** 原始 message（渲染端展示与既有字符串匹配的兼容面） */
  message: string
}

export function encodeIpcError(payload: IpcErrorPayload): string {
  return IPC_ERROR_PREFIX + JSON.stringify(payload)
}

export function decodeIpcError(message: string): IpcErrorPayload | null {
  if (!message.startsWith(IPC_ERROR_PREFIX)) return null
  try {
    const raw = JSON.parse(message.slice(IPC_ERROR_PREFIX.length)) as Partial<IpcErrorPayload>
    if (typeof raw.channel !== 'string' || typeof raw.kind !== 'string') return null
    return { channel: raw.channel, kind: raw.kind, message: String(raw.message ?? '') }
  } catch {
    return null
  }
}

/** 把任意 thrown 值规整成 payload（非 Error 抛出物按 String() 收口） */
export function payloadFromThrown(channel: string, thrown: unknown): IpcErrorPayload {
  if (thrown instanceof Error) {
    return { channel, kind: thrown.name || 'Error', message: thrown.message }
  }
  return { channel, kind: 'NonError', message: String(thrown) }
}
