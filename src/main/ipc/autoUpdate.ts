import { AutoUpdateService } from '../services/AutoUpdateService'
import { typedHandle } from './typedIpc'

export function registerAutoUpdateIpcHandlers(): void {
  typedHandle('update:check', async () => AutoUpdateService.checkForUpdates())
  typedHandle('update:download', async () => {
    await AutoUpdateService.downloadUpdate()
  })
  typedHandle('update:install', () => {
    AutoUpdateService.quitAndInstall()
  })
  typedHandle('update:getStatus', () => AutoUpdateService.getStatus())
  typedHandle('update:getCurrentVersion', () => AutoUpdateService.getCurrentVersion())
}
