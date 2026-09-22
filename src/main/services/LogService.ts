export const log = new LogService()

/** 主进程全局兜底（接 uncaughtException / unhandledRejection）。
 * 由 src/main/index.ts 在装配时调用；console 输出便于开发期观察，
 * log.error 负责内存 ring buffer / SQLite / 磁盘持久化（telemetry 非 off 时）。 */
export function installGlobalLogHandlers(): void {
  process.on('uncaughtException', (err) => {
    console.error('[Main] Uncaught Exception:', err)
    log.error('uncaughtException', err.message, err)
  })
  process.on('unhandledRejection', (reason) => {
    console.error('[Main] Unhandled Rejection:', reason)
    log.error(
      'unhandledRejection',
      reason instanceof Error ? reason.message : String(reason),
      reason
    )
  })
}
