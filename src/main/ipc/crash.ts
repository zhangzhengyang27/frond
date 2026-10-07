import { typedHandle } from './typedIpc'
import { crashReport } from '../services/CrashReportService'

export function registerCrashIpcHandlers(): void {
  typedHandle('crash:getStatus', () => crashReport.getStatus())
  typedHandle('crash:setOptIn', (_event, { enabled }) => crashReport.setOptIn(enabled === true))
  typedHandle('crash:openIssueTemplate', () => crashReport.openIssueTemplate())
}
