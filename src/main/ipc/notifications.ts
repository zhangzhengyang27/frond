import { BrowserWindow } from 'electron'
import { typedHandle } from './typedIpc'
import { NotificationService } from '../services/NotificationService'

/**
 * 系统通知（番茄钟 / 录屏 / 通用 info-success-warning-error）。
 *
 * 2026-09-23 重迁到 `typedHandle`：恢复事故把这份文件回退成了**全量迁移前的旧副本**——
 * 它按位置参数收（`(_event, type, title, body, options)`），而 preload 早就是单对象
 * （`typedInvoke('notification:show', { type, title, body, options })`）。
 * 结果是运行时 `type` 收到整个对象、`title` 是 undefined，**通知整条静默不响**，
 * 而 `ipcContract` 测试只认 `typedHandle` 与裸 `ipcMain.handle`，把它报成「主进程未注册」。
 * 契约（`shared/ipc-contract.ts`）与 preload 侧都是好的，包括 `pomodoro` 的 `'remind'` 档。
 */
export function registerNotificationIpcHandlers(): void {
  const notificationService = NotificationService.getInstance()

  // B10：把通知的点击/关闭转成事件广播（渲染端不可能通过 IPC 传回调函数）
  notificationService.onNotificationEvent((payload) => {
    for (const win of BrowserWindow.getAllWindows()) {
      if (!win.isDestroyed()) {
        win.webContents.send('notification:event', payload)
      }
    }
  })

  typedHandle('notification:show', (_event, { type, title, body, options }) =>
    notificationService.show(type, title, body, options)
  )
  typedHandle('notification:pomodoro', (_event, { type, message }) =>
    notificationService.showPomodoroNotification(type, message)
  )
  typedHandle('notification:recording', (_event, { type, message }) =>
    notificationService.showRecordingNotification(type, message)
  )
  typedHandle('notification:info', (_event, { title, body, options }) =>
    notificationService.showInfo(title, body, options)
  )
  typedHandle('notification:success', (_event, { title, body, options }) =>
    notificationService.showSuccess(title, body, options)
  )
  typedHandle('notification:warning', (_event, { title, body, options }) =>
    notificationService.showWarning(title, body, options)
  )
  typedHandle('notification:error', (_event, { title, body, options }) =>
    notificationService.showError(title, body, options)
  )
  typedHandle('notification:close', (_event, { id }) => {
    notificationService.close(id)
  })
  typedHandle('notification:closeAll', () => {
    notificationService.closeAll()
  })
}
