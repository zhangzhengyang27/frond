/**
 * Leaf · 应用命令提供者（阶段1.1）
 *
 * 扫描系统应用，注册为标准 Command。
 * 复用现有 getApplications IPC，包装为 Command 格式。
 */
import type { Command, CommandProvider } from '@shared/commandRegistry'

interface ApplicationInfo {
  name: string
  path: string
  icon?: string
  aliases?: string[]
}

export function createApplicationProvider(): CommandProvider {
  return {
    id: 'applications',
    categories: ['application'],
    reactive: false,
    async getCommands(): Promise<Command[]> {
      try {
        const apps = (await window.api.getApplications()) as ApplicationInfo[]
        return apps.map((app) => ({
          id: `app:${app.path}`,
          title: app.name,
          aliases: app.aliases,
          subtitle: app.path,
          icon: app.icon ? 'apps' : 'window-2',
          category: 'application',
          badge: '应用',
          actions: [
            { type: 'app', path: app.path },
            { type: 'copyText', text: app.path }
          ],
          // 函数型 detail：选中这一行时才异步读包元数据（几百个应用没必要全读一遍）
          detail: async () => {
            const info = await window.api.readAppInfo(app.path)
            const lines = [
              `路径：\`${app.path}\``,
              info.bundleId ? `Bundle ID：\`${info.bundleId}\`` : '',
              info.version
                ? `版本：${info.version}${info.buildVersion ? ` (${info.buildVersion})` : ''}`
                : '',
              info.modifiedMs
                ? `修改于：${new Date(info.modifiedMs).toLocaleString('zh-Hans-CN', { hour12: false })}`
                : '',
              '回车启动应用'
            ].filter(Boolean)
            return { title: app.name, content: lines.join('\n\n'), format: 'markdown' as const }
          }
        }))
      } catch {
        return []
      }
    }
  }
}
