/**
 * Frond · systemAudioPatterns
 *
 * 把 IPC handler 内的正则 pattern 抽到独立模块，便于单测；
 * 平台无关的系统音频 loopback 设备名特征。
 *
 * 涵盖：
 *   - macOS: BlackHole / Soundflower / Loopback Audio / Multi-Output Device
 *   - Windows: VB-Audio / CABLE Output / WASAPI loopback
 *   - Linux: PulseAudio Monitor of ...
 */

export const SYSTEM_AUDIO_PATTERNS: RegExp[] = [
  /BlackHole/i,
  /Soundflower/i,
  /Loopback Audio/i,
  /Multi-Output Device/i,
  /VB-Audio/i,
  /CABLE Output/i,
  /WASAPI loopback/i,
  /Monitor of/i
]

export interface AudioDevice {
  kind: string
  deviceId: string
  label: string
}

export interface SystemAudioProbeResult {
  available: boolean
  matches: string[]
  recommendedDeviceId?: string
}

/**
 * 给定 enumerateDevices 返回的设备列表，找出可能用于"系统音频 loopback"的输入设备。
 */
export function probeSystemAudio(devices: AudioDevice[]): SystemAudioProbeResult {
  const audioInputs = devices.filter((d) => d.kind === 'audioinput')
  const matched = audioInputs.filter((d) => SYSTEM_AUDIO_PATTERNS.some((re) => re.test(d.label)))
  const recommended = matched[0]
  return {
    available: matched.length > 0,
    matches: matched.map((d) => d.label),
    recommendedDeviceId: recommended?.deviceId
  }
}
