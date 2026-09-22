
import { describe, it, expect } from 'vitest'
import { probeSystemAudio, SYSTEM_AUDIO_PATTERNS, type AudioDevice } from '../systemAudioPatterns'

const dev = (kind: string, deviceId: string, label: string): AudioDevice => ({
  kind,
  deviceId,
  label
})
