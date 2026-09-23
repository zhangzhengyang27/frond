/**
 * Frond · 统一命令注册表（阶段1.1 架构重构）
 *
 * 一切皆命令（Everything is a Command）：
 * - 应用启动、系统操作、窗口管理、文件搜索、剪贴板、片段、番茄钟、AI、插件…
 *   全部注册为标准 Command，启动器只面对一种抽象。
 * - 每个 Command 带 Actions（⌘K 动作面板）和可选 Detail（右侧详情面板）。
 * - Provider 模式：各功能模块实现 CommandProvider，注册到 Registry。
 *
 * 与旧体系的关系：
 * - 旧的 staticCommands / dynamicCommands / appsEntries / pluginCommands 逐步迁移为 Provider。
 * - 取命令只有一个出口 `getCommandsFrom(ids)`（P-7②）：调用方指名要哪几路，两批各自到。
 *   这里刻意不缓存——带 5 秒 TTL 的 `getCommands()` 与分批加载是两套时间语义，
 *   留着就是「今天拿到的到底是不是全量」这种查不动的问题的温床。
 */

import type { CommandAction } from './commands'

/** 命令分类（用于分组展示和搜索过滤） */
export type CommandCategory =
  | 'application'
  | 'system'
  | 'window'
  | 'file'
  | 'clipboard'
  | 'snippet'
  | 'recording'
  | 'pomodoro'
  | 'ai'
  | 'reminder'
  | 'note'
  | 'calendar'
  | 'plugin'
  | 'extension'
  | 'settings'
  | 'other'

/** 命令详情（右侧 Detail 面板） */
export interface CommandDetail {
  /** 详情标题 */
  title?: string
  /** Markdown 或纯文本内容 */
  content: string
  /** 渲染格式 */
  format?: 'text' | 'markdown'
}

/** 标准命令定义 */
export interface Command {
  /** 唯一 ID（如 'app:com.apple.Safari'、'system:lock'、'snippet:abc123'） */
  id: string
  /** 主标题 */
  title: string
  /** 副标题（路径 / 描述 / 来源） */
  subtitle?: string
  /** remixicon 名称（不含 ri- 前缀） */
  icon: string
  /** 搜索关键词（标题/副标题之外的额外匹配词） */
  keywords?: string[]
  /** 分类 */
  category: CommandCategory
  /** 类型徽标（右侧显示，如 '应用'、'系统'、'AI'） */
  badge?: string
  /** 别名（用户自定义 + 拼音首字母，搜索时匹配） */
  aliases?: string[]
  /** 可用动作（首个为回车默认动作，⌘K 展示全部） */
  actions: CommandAction[]
  /**
   * 这条命令接参数（「命令 + 尾部参数」的查询写法因此可命中，尾部预填进参数格）。
   * 插件命令与 MCP 工具命令才有；适配器会原样搬到 CommandEntry 上。
   */
  acceptsArgs?: boolean
  /** 详情面板内容（选中时右侧展示，可选） */
  detail?: CommandDetail | (() => Promise<CommandDetail> | CommandDetail)
  /** 执行默认动作（等价于 actions[0]，但可携带上下文） */
  execute?: (context?: CommandExecutionContext) => void | Promise<void>
}

/** 命令执行上下文 */
export interface CommandExecutionContext {
  /** 当前搜索词 */
  query?: string
  /** 选中的动作索引（默认 0） */
  actionIndex?: number
  /** 来源（'root' | 'command' | 'detail'） */
  source?: 'root' | 'command' | 'detail'
}

/** 命令提供者：各功能模块实现此接口，向 Registry 贡献命令 */
export interface CommandProvider {
  /** 提供者 ID */
  id: string
  /** 提供的命令分类 */
  categories: CommandCategory[]
  /** 获取命令列表（可异步，如扫描应用 / 查询数据库） */
  getCommands(): Promise<Command[]>
  /** 命令是否需要实时刷新（如剪贴板历史 / 文件搜索） */
  reactive?: boolean
}

/**
 * 命令注册表（单例）
 *
 * 用法：
 *   registry.register(applicationProvider)
 *   registry.register(systemProvider)
 *   const commands = await registry.getCommandsFrom(['system', 'builtin'])
 */
class CommandRegistry {
  private providers = new Map<string, CommandProvider>()

  /** 注册命令提供者 */
  register(provider: CommandProvider): void {
    this.providers.set(provider.id, provider)
  }

  /** 注销提供者 */
  unregister(providerId: string): void {
    this.providers.delete(providerId)
  }

  /**
   * 只问某几个 provider（分批加载用，P-7②）。
   *
   * 应用那一路是 macOS 全盘扫 .app，冷启动要 5-15s；模块/系统页/第一方动作是纯内存的。
   * 如果所有行都排在同一个出口后面，用户按 ⌥Space 之后几秒内连「番茄钟」
   * 这样的模块行都搜不到——所以它们必须能分两批到。
   * 这里刻意**不写缓存**：一批的结果被当成全量记住，比分批本身更容易出错。
   */
  async getCommandsFrom(providerIds: string[]): Promise<Command[]> {
    const picked = [...this.providers.values()].filter((p) => providerIds.includes(p.id))
    const results = await Promise.all(
      picked.map(async (provider) => {
        try {
          return await provider.getCommands()
        } catch (err) {
          console.warn(`[CommandRegistry] provider ${provider.id} failed:`, err)
          return []
        }
      })
    )
    return results.flat()
  }

  /** 获取已注册的提供者列表 */
  getProviderIds(): string[] {
    return [...this.providers.keys()]
  }
}

/** 全局单例 */
export const commandRegistry = new CommandRegistry()
