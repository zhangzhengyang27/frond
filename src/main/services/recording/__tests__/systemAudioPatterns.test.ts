import { describe, it, expect } from 'vitest'
import { probeSystemAudio, SYSTEM_AUDIO_PATTERNS, type AudioDevice } from '../systemAudioPatterns'

const dev = (kind: string, deviceId: string, label: string): AudioDevice => ({
  kind,
  deviceId,
  label
})

/**
 * 2026-09-23 重建：这个 spec 的头部（imports + dev() 助手）还在，下面的用例全丢了。
 * 断言按 systemAudioPatterns.ts 的实际行为写，不猜原意。
 */
describe('probeSystemAudio', () => {
  it('空设备列表 → 不可用，且不带 recommendedDeviceId', () => {
    expect(probeSystemAudio([])).toEqual({ available: false, matches: [] })
  })

  it('只看 audioinput：audiooutput 上叫 BlackHole 的不算可采集源', () => {
    const r = probeSystemAudio([dev('audiooutput', 'out-1', 'BlackHole 2ch')])
    expect(r.available).toBe(false)
    expect(r.matches).toEqual([])
  })

  it('三个平台的 loopback 命名都能命中', () => {
    const r = probeSystemAudio([
      dev('audioinput', 'mac-1', 'BlackHole 2ch'),
      dev('audioinput', 'mac-2', 'Soundflower (2ch)'),
      dev('audioinput', 'mac-3', 'Loopback Audio'),
      dev('audioinput', 'mac-4', 'Multi-Output Device'),
      dev('audioinput', 'win-1', 'CABLE Output (VB-Audio)'),
      dev('audioinput', 'win-2', 'WASAPI loopback'),
      dev('audioinput', 'linux-1', 'Monitor of Built-in Audio'),
      dev('audioinput', 'plain', 'MacBook Pro 麦克风')
    ])
    expect(r.matches).toEqual([
      'BlackHole 2ch',
      'Soundflower (2ch)',
      'Loopback Audio',
      'Multi-Output Device',
      'CABLE Output (VB-Audio)',
      'WASAPI loopback',
      'Monitor of Built-in Audio'
    ])
    expect(r.available).toBe(true)
  })

  it('大小写不敏感（设备名常是用户自建的）', () => {
    expect(probeSystemAudio([dev('audioinput', 'a', 'blackhole 16ch')]).available).toBe(true)
  })

  it('recommendedDeviceId 取第一个命中的，顺序即设备列表顺序', () => {
    const r = probeSystemAudio([
      dev('audioinput', 'mic', 'MacBook Pro 麦克风'),
      dev('audioinput', 'bh16', 'BlackHole 16ch'),
      dev('audioinput', 'sf', 'Soundflower (64ch)')
    ])
    expect(r.recommendedDeviceId).toBe('bh16')
  })

  it('SYSTEM_AUDIO_PATTERNS 每条都被上面的用例覆盖到', () => {
    expect(SYSTEM_AUDIO_PATTERNS).toHaveLength(8)
  })
})
