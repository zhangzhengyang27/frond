/**
 * Frond · 内置模块与系统页命令提供者（P-7②「注册表合一」的最后一批）
 *
 * 这批之前 Registry 只有 3 个 provider（应用 / 系统 / 第一方），而模块行与系统页行
 * 还留在 `shared/commands.ts` 的 `buildStaticCommands()` 里由调用方各自摊平。
 * 于是同一个渲染进程里有两个命令出口：胶囊走 Registry + 去重合并，主窗 ⌘K 面板走静态清单——
 * 两边的行**已经开始不一样**（面板看不到 `ai:chat`「AI 对话」这类只在 provider 里的行）。
 * 搬进来之后，`buildStaticCommands()` 就没有调用方了。
 *
 * 行本身的形状保持不变：key / icon / title / subtitle / badge 与原静态清单逐字段一致，
 * 免得「重构」顺手改了用户在搜索框里看到的东西。
 */
import { MODULES, PENDING_MODULES } from '@shared/modules'
import { SYSTEM_PAGES, FIRST_PARTY_COMMANDS, type CommandEntry } from '@shared/commands'
import type { Command, CommandProvider } from '@shared/commandRegistry'

/**
 * Registry 拥有的全部静态行：模块 + 系统页 + 第一方动作。
 *
 * 与旧静态清单逐字段一致（key / icon / title / subtitle / badge / action）：
 * key 不能换——收藏、使用统计、用户别名都是按 key 存的；文案也不能换——
 * 这是重构不是改版。
 */
export function builtinStaticRows(): CommandEntry[] {
  return [
    ...MODULES.map((m) => ({
      key: `module:${m.id}`,
      icon: m.icon,
      title: m.label,
      subtitle: m.description,
      badge: '功能',
      action: { type: 'module' as const, moduleId: m.id, path: m.path }
    })),
    ...PENDING_MODULES.map((p) => ({
      key: `module:${p.id}`,
      icon: p.icon,
      title: p.label,
      subtitle: p.description,
      badge: '功能',
      action: { type: 'module' as const, moduleId: p.id, path: p.path }
    })),
    ...SYSTEM_PAGES.map((p) => ({
      key: `page:${p.id}`,
      icon: p.icon,
      title: p.label,
      subtitle: p.description,
      badge: '页面',
      action: { type: 'page' as const, pageId: p.id, path: p.path }
    })),
    // 第一方动作（开始专注 / 搜片段 / 截图库 …）也在这一批里带进来：
    // 少了它们，搜索框里这 11 行会**静默消失**（mergeCommands 的真数据用例就是为这个写的）
    ...FIRST_PARTY_COMMANDS
  ]
}

/** 静态行 → Command（`commandsToEntries` 的逆运算，字段一一对应） */
export function entryToCommand(e: CommandEntry): Command {
  return {
    id: e.key,
    title: e.title,
    subtitle: e.subtitle,
    icon: e.icon,
    badge: e.badge,
    // category 只用于过滤/统计，不代表用户看到的分类；page: 归设置，其余归 other
    category: e.key.startsWith('page:') ? 'settings' : 'other',
    aliases: e.aliases,
    actions: [e.action]
  }
}

export function createBuiltinCommandProvider(): CommandProvider {
  return {
    id: 'builtin',
    categories: ['other', 'settings'],
    reactive: false,
    async getCommands(): Promise<Command[]> {
      return builtinStaticRows().map(entryToCommand)
    }
  }
}
