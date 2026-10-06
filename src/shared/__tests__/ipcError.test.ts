import { describe, it, expect } from 'vitest'
import { IPC_ERROR_PREFIX, encodeIpcError, decodeIpcError, payloadFromThrown } from '../ipcError'

describe('IPC 错误信封（批 7a）', () => {
  it('编码 → 解码往返保真', () => {
    const msg = encodeIpcError({ channel: 'clip:export', kind: 'Error', message: '磁盘已满' })
    expect(msg.startsWith(IPC_ERROR_PREFIX)).toBe(true)
    const back = decodeIpcError(msg)
    expect(back).toEqual({ channel: 'clip:export', kind: 'Error', message: '磁盘已满' })
  })

  it('非信封消息返回 null（透传口径）', () => {
    expect(decodeIpcError('Error invoking remote method: x: boom')).toBeNull()
    expect(decodeIpcError('FROND_IPC_V1:not-json')).toBeNull()
    expect(decodeIpcError('')).toBeNull()
  })

  it('payloadFromThrown：Error 保留 name/message；非 Error 收口为 NonError', () => {
    expect(payloadFromThrown('ch', new TypeError('x is not a function'))).toEqual({
      channel: 'ch',
      kind: 'TypeError',
      message: 'x is not a function'
    })
    expect(payloadFromThrown('ch', '裸字符串')).toEqual({
      channel: 'ch',
      kind: 'NonError',
      message: '裸字符串'
    })
    expect(payloadFromThrown('ch', 42)).toEqual({ channel: 'ch', kind: 'NonError', message: '42' })
  })

  it('message 里含信封前缀字样的原始错误不会被二次解码撕开', () => {
    const payload = payloadFromThrown('ch', new Error('FROND_IPC_V1: 假装信封的普通文案'))
    const encoded = encodeIpcError(payload)
    const back = decodeIpcError(encoded)
    expect(back?.message).toBe('FROND_IPC_V1: 假装信封的普通文案')
  })
})
