/**
 * Shared types for renderer ↔ main IPC payload shapes.
 * 这里放 cross-process 通用类型；具体 module 的私有类型留在各自 store / repository。
 */

/** 一条工作日志 */
export interface LogEntry {
  ts: number
  level: 'info' | 'warn' | 'error'
  scope: string
  msg: string
  stack?: string | undefined
}

export interface LogExportPayload {
  entries: LogEntry[]
  meta: {
    platform: NodeJS.Platform
    arch: string
    appVersion: string
    exportedAt: number
  }
}

/**
 * 上报模式：
 * - 'off'   : 只保留内存 ring buffer；不落库、不写文件
 * - 'local' : 当前默认，落 log_entries + 磁盘 .log 文件，可导出
 * - 'remote': 在 local 基础上，预留远程上报通道（1.0 不实现，仅 stub）
 *
 * 用户在 Settings → 「日志 / 反馈」里切换；持久化到 pref_preferences。
 */
export type TelemetryMode = 'off' | 'local' | 'remote'

/**
 * 崩溃上报状态（opt-in）：
 * 收集只在本机（crashReporter uploadToServer:false），没有服务器自动上传；
 * 发现新转储时由主进程提醒，用户自己决定要不要去 GitHub 提 Issue。
 */
export interface CrashReportStatus {
  /** 用户是否已开启崩溃收集 */
  optIn: boolean
  /** 尚未确认过的崩溃转储份数 */
  pendingCount: number
}
