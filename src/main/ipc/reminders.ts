/**
 * Frond · Reminders IPC 处理器
 *
 * 提醒事项的渲染端 ↔ 主进程通信层。
 */
import { reminderService } from '../services/ReminderService'
import { typedHandle } from './typedIpc'

export function registerRemindersIpc(): void {
  // 提醒列表
  typedHandle('reminders:list', (_e, { filter }) => reminderService.list(filter))

  // 单条提醒
  typedHandle('reminders:get', (_e, { id }) => reminderService.get(id))

  // 新建提醒
  typedHandle('reminders:create', (_e, data) => reminderService.create(data))

  // 更新提醒
  typedHandle('reminders:update', (_e, { id, patch }) => reminderService.update(id, patch))

  // 标记完成
  typedHandle('reminders:complete', (_e, { id }) => reminderService.complete(id))

  // 取消完成
  typedHandle('reminders:uncomplete', (_e, { id }) => reminderService.uncomplete(id))

  // 软删除
  typedHandle('reminders:remove', (_e, { id }) => reminderService.remove(id))

  // 统计未完成数量
  typedHandle('reminders:countActive', () => reminderService.countActive())
}
