import {
  RecordingSettingsDataStore,
  QUALITY_PRESETS,
  type RecordingSettings
} from '../stores/RecordingSettingsDataStore'
import { typedHandle } from './typedIpc'

/**
 * IPC Handler 包装器：统一错误处理
 */
function wrapHandler<TArgs extends unknown[], T>(
  handler: (...args: TArgs) => T
): (...args: TArgs) => T {
  return (...args: TArgs): T => {
    try {
      return handler(...args)
    } catch (error) {
      console.error('[recordingSettings] IPC Error:', error)
      throw error
    }
  }
}

export function registerRecordingSettingsIpcHandlers(): void {
  let recordingSettingsStore: RecordingSettingsDataStore

  try {
    recordingSettingsStore = new RecordingSettingsDataStore()
  } catch (error) {
    console.error('[recordingSettings] 初始化存储失败:', error)
    // 创建一个空实例作为降级方案
    recordingSettingsStore = new (class extends RecordingSettingsDataStore {
      constructor() {
        super()
      }
    })()
  }

  // 获取录制设置
  typedHandle(
    'recording-settings:getSettings',
    wrapHandler(() => {
      return recordingSettingsStore.getSettings()
    })
  )

  // 更新录制设置
  typedHandle(
    'recording-settings:updateSettings',
    wrapHandler((_event, updates: Partial<RecordingSettings>) => {
      return recordingSettingsStore.updateSettings(updates)
    })
  )

  // 重置为默认设置
  typedHandle(
    'recording-settings:resetToDefaults',
    wrapHandler(() => {
      return recordingSettingsStore.resetToDefaults()
    })
  )

  // 获取质量预设
  typedHandle(
    'recording-settings:getQualityPreset',
    wrapHandler(
      (_event: Electron.IpcMainInvokeEvent, req: { quality: 'low' | 'medium' | 'high' }) => {
        const preset = QUALITY_PRESETS[req.quality]
        if (!preset) {
          throw new Error(`无效的质量预设: ${req.quality}`)
        }
        return preset
      }
    )
  )
}
