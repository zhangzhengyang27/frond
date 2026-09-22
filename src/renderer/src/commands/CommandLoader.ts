/**
 * Leaf · 命令加载器（阶段1.1）
 *
 * 注册所有 CommandProvider，提供统一的命令获取和搜索接口。
 * 同时提供 Command → CommandEntry 适配器，供现有 LauncherApp 渐进式迁移。
 */
import { commandRegistry, type Command } from '@shared/commandRegistry'
import { createApplicationProvider } from './ApplicationCommandProvider'
import { createSystemCommandProvider } from './SystemCommandProvider'
import { createFirstPartyCommandProvider } from './FirstPartyCommandProvider'
import { createBuiltinCommandProvider } from './BuiltinCommandProvider'
import { createMcpCommandProvider } from './McpCommandProvider'
import type { CommandEntry, CommandAction } from '@shared/commands'

let initialized = false

/** 初始化：注册所有内置 Provider */
export function initCommandRegistry(): void {
  if (initialized) return
  initialized = true

  commandRegistry.register(createApplicationProvider())
  commandRegistry.register(createSystemCommandProvider())
  commandRegistry.register(createFirstPartyCommandProvider())
  // P-7②：模块行与系统页行也进 Registry——此前它们是最后一个「调用方各自摊平」的静态清单
  commandRegistry.register(createBuiltinCommandProvider())
  // P-4② 收尾：MCP 工具进根搜索（读主进程的工具清单缓存，不 spawn）
  commandRegistry.register(createMcpCommandProvider())
}

/**
 * Command → CommandEntry 适配器
 * 供现有 LauncherApp 使用，逐步迁移后可移除。
 */
export function commandToEntry(cmd: Command): CommandEntry {
  // 合并 aliases 和 keywords 作为搜索别名（CommandEntry 没有独立 keywords 字段）
  const aliases = [...(cmd.aliases ?? []), ...(cmd.keywords ?? [])]
  return {
    key: cmd.id,
    title: cmd.title,
    subtitle: cmd.subtitle ?? '',
    icon: cmd.icon,
    badge: cmd.badge ?? '',
    action: cmd.actions[0] as CommandAction,
    // 参数化命令（MCP 工具）要把它带到 CommandEntry 上，否则「工具名 + 尾部参数」
    // 那种查询写法在根搜索里选不中这条，参数格只能空着打开
    acceptsArgs: cmd.acceptsArgs,
    aliases: aliases.length > 0 ? aliases : undefined
  }
}

/** 批量转换 */
export function commandsToEntries(cmds: Command[]): CommandEntry[] {
  return cmds.map(commandToEntry)
}

/** 纯内存的那一批（第一方 / 系统 / 模块与系统页），不碰磁盘 */
export const FAST_COMMAND_PROVIDERS = ['first-party', 'system', 'builtin', 'mcp']
/** 慢的那一批：应用扫描 */
export const SLOW_COMMAND_PROVIDERS = ['applications']

export async function getFastCommands(): Promise<Command[]> {
  initCommandRegistry()
  return commandRegistry.getCommandsFrom(FAST_COMMAND_PROVIDERS)
}

export async function getAppCommands(): Promise<Command[]> {
  initCommandRegistry()
  return commandRegistry.getCommandsFrom(SLOW_COMMAND_PROVIDERS)
}
