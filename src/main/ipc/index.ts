/**
 * IPC 处理器统一导出
 * 集中导出所有 IPC 注册函数，便于统一管理和维护
 */

export { registerNotificationIpcHandlers } from './notifications'

export { registerPreferencesIpcHandlers, registerPrettierIpcHandlers } from './preferences'
export { registerTagIpcHandlers } from './tags'
export { registerSnippetIpcHandlers } from './snippets'
export { registerApplicationsIpcHandlers } from './applications'
export { registerFoldersIpcHandlers } from './folders'
export { registerClipsIpcHandlers } from './clips'
export { registerMarkersIpcHandlers } from './markers'
export { registerRecordingIpcHandlers } from './recording'
export { registerRecordingHistoryIpcHandlers } from './recordingHistory'
export { registerRecordingSettingsIpcHandlers } from './recordingSettings'
export { registerScreenRecorderIpcHandlers } from './screenRecorder'
export { registerScreenRecorderSaveIpcHandlers } from './screenRecorderSave'
export { registerUsageIpcHandlers } from './usage'
export { registerAutoUpdateIpcHandlers } from './autoUpdate'
export { registerSystemInfoIpcHandlers } from './system'
export { registerLogIpcHandlers } from './log'
export { registerPlatformIpcHandlers } from './platform'
export { registerMigrationIpcHandlers } from './migration'
export { registerNotesIpc } from './notes'
export { registerRemindersIpc } from './reminders'

// 导出工具函数
export { registerHandlers, registerPrefixedHandlers } from './utils'
