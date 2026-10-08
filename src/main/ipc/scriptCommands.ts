import { typedHandle } from './typedIpc'
import { listScriptCommands, openScriptsDir, runScriptCommand } from '../modules/scriptCommands'

export function registerScriptCommandsIpc(): void {
  typedHandle('scriptCmds:list', () => listScriptCommands())
  // 失败弹系统通知（与 calendar 写操作同口径：渲染端执行器不展示错误正文）
  typedHandle('scriptCmds:run', async (_e, { id }) => {
    const result = await runScriptCommand(String(id ?? ''))
    if (!result.ok && result.error) {
      try {
        const { Notification } = await import('electron')
        new Notification({
          title: `脚本执行失败：${String(id)}`,
          body: result.error.slice(0, 200)
        }).show()
      } catch (e) {
        // 通知失败静默：执行结果已回传渲染端
        console.debug('[scriptCmds] 通知失败', e)
      }
    }
    return result
  })
  typedHandle('scriptCmds:openDir', () => openScriptsDir())
}
