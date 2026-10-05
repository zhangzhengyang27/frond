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
export { registerUsageIpcHandlers } from './usage'
export { registerAutoUpdateIpcHandlers } from './autoUpdate'
export { registerSystemInfoIpcHandlers } from './system'
export { registerLogIpcHandlers } from './log'
export { registerMigrationIpcHandlers } from './migration'
export { registerNotesIpc } from './notes'
export { registerRemindersIpc } from './reminders'
export { registerPermissionsIpcHandlers } from './permissions'
export { registerCloudBackupIpcHandlers } from './cloudBackup'
