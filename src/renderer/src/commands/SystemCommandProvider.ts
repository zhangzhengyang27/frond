/**
 * Leaf · 系统命令提供者（阶段1.1，P-7② 收尾重做）
 *
 * 这一路以前是一张手写的 340 行清单：同一批系统/窗口命令在这里写一遍（副标题 'System'、
 * `system:lock` 这样的 id）、在 `SYSTEM_CMD_META` 再写一遍（中文副标题、`syscmd:system.lock`），
 * 两边文案还不一样。合并器只认「同 key」与「同标题同动作」，于是音量五档、屏保、
 * 清空废纸篓这类**标题不同**的成对出现在搜索框里，回车执行的却是同一件事——
 * 使用统计也被劈成两个 key。
 *
 * 现在只有一条路：主进程报本机支持的 id，文案取 `SYSTEM_CMD_META` / `WINDOW_CMD_META`
 * （`systemCommands.test.ts` 已经钉住「每个 id 都得有元数据」，缺文案编译期就红）。
 * key 仍是 `system:lock` / `window:maximize`——收藏与使用统计存在这些 key 上。
 */
import type { Command, CommandCategory, CommandProvider } from '@shared/commandRegistry'
import { buildSystemCommands, type CommandEntry } from '@shared/commands'

/** 主进程报的「本机支持的命令 id」；拿不到（node 环境 / IPC 未就绪）就是空，不自己猜一份默认清单 */
async function platformIds(): Promise<{ system: string[]; window: string[] }> {
  try {
    return await window.api.sysCmd.ids()
  } catch {
    return { system: [], window: [] }
  }
}

function toCommand(e: CommandEntry): Command {
  const cmdId = e.action.type === 'system' ? e.action.cmdId : ''
  const category: CommandCategory = cmdId.startsWith('window.') ? 'window' : 'system'
  return {
    id: e.key,
    title: e.title,
    subtitle: e.subtitle,
    icon: e.icon,
    category,
    badge: e.badge,
    // 放 aliases 不放 keywords：`commandToEntry` 会把两者拼回 aliases，写两处就是同一批词进两遍
    aliases: e.aliases,
    actions: [e.action]
  }
}

export function createSystemCommandProvider(): CommandProvider {
  return {
    id: 'system',
    categories: ['system', 'window'],
    reactive: false,
    async getCommands(): Promise<Command[]> {
      return buildSystemCommands(await platformIds()).map(toCommand)
    }
  }
}
