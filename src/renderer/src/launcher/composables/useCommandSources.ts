/**
 * Frond · 胶囊命令源聚合（自 LauncherApp.vue 抽出）
 *
 * 四个来源：统一 Registry（应用 + 系统/窗口 + 第一方 + 模块/系统页）/ 插件命令 /
 * 插件 searchable 条目 / Quicklinks。别名（拼音首字母 + 用户自定义）就绪后
 * bump aliasEpoch 触发 entries 重算。
 *
 * 系统命令这一路不在这里出（P-7② 收尾）：它由 `SystemCommandProvider` 按主进程报的
 * 平台 id 建行。以前这里也 buildSystemCommands 一遍、provider 里再手写一遍，两份文案还不一样
 * （`system.hideAll` 一个写「显示桌面」一个写「隐藏所有窗口」），标题不同的那些
 * ——音量五档、屏保、清空废纸篓——就这么成对出现在搜索框里，使用统计劈成两个 key。
 */
import { computed, onScopeDispose, ref } from 'vue'
import { buildQuicklinkCommands, addPinyinAliases, type CommandEntry } from '@shared/commands'
import { mergeCommandEntries } from '@shared/mergeCommands'
import type { Command } from '@shared/commandRegistry'
import type { PluginArgument, PluginItemAction } from '@shared/plugin-protocol'
import { findModule, type ModuleMeta } from '@shared/modules'
import {
  commandsToEntries,
  initCommandRegistry,
  getFastCommands,
  getAppCommands
} from '@renderer/commands/CommandLoader'
import { loadMcpToolEntries } from '@renderer/commands/McpCommandProvider'
import { latestOnly } from './launcherInteractions'

/**
 * 命令源聚合。
 *
 * `afterTableChange`：命令表被**推送**刷新之后要做的事（胶囊传的是「按当前查询重跑」——
 * 它那份结果是命令式的 ref，不重跑就还是旧的一屏；主窗 ⌘K 面板的结果是 computed，不用传）。
 * `onSlowBatch`：应用扫描慢批（冷启动 5-15s+，负载下更久）落地后的重跑回调——
 * 不重跑的话应用行要再敲一个字才看得到（capsule-actions:211 的 flake 根因）。
 */
export function useCommandSources(afterTableChange?: () => void, onSlowBatch?: () => void) {
  /** 插件命令（每次唤起刷新，管理页装/停插件后立即生效） */
  const pluginCommands = ref<CommandEntry[]>([])

  /**
   * MCP 工具行（P-4②「工具进根搜索」）。单独一路而不是塞进 Registry：
   * 推送刷新时只重拉变了的那一路，代价是一条 IPC。
   */
  const mcpCommands = ref<CommandEntry[]>([])

  /** Quicklinks（M2.3，用户在设置里自建；参数化链接的槽位在 actionMap 那边判） */
  const dynamicCommands = ref<CommandEntry[]>([])

  /** 阶段1.1：统一 Command Registry 命令（应用 + 系统 + 第一方） */
  const registryEntries = ref<CommandEntry[]>([])
  /** 原始 Command 对象（用于获取 detail） */
  const registryCommands = ref<Command[]>([])

  /** quicklink URL → favicon 本地缓存路径（image:// 加载；无则回退 link 图标） */
  const faviconPaths = ref<Map<string, string>>(new Map())

  /** 别名（拼音首字母）就绪标记：enrich 完成后 bump 触发结果重算（M1.1） */
  const aliasEpoch = ref(0)

  /**
   * P-7②：静态清单不再是这里的独立一源——模块行、系统页行与第一方动作都由
   * `BuiltinCommandProvider` 交给 Registry（`mergeCommands.test.ts` 的真数据用例
   * 逐 key 钉住「搬完不许少行」）。
   */

  /**
   * 分两批到达（P-7②）：先纯内存的那些行，应用扫描（冷启动 5-15s）随后自己补上。
   * 合成一批的话，胶囊刚打开那几秒连「番茄钟」这类模块行都搜不到——
   * 静态清单时代它们是同步就在的，这是搬进 Registry 时带出来的回归。
   */
  async function loadRegistryCommands(): Promise<void> {
    try {
      initCommandRegistry()
      const fast = await getFastCommands()
      registryCommands.value = fast
      registryEntries.value = commandsToEntries(fast)
      void getAppCommands().then((apps) => {
        registryCommands.value = [...registryCommands.value, ...apps]
        registryEntries.value = commandsToEntries(registryCommands.value)
        // 应用行的拼音别名/用户别名补一轮（与既有的多次 enrich 同一套路）
        void enrichAliases()
        // 应用扫描是**慢批**（冷启动 5-15s+，负载下更久）：落地后必须通知消费方
        // 重跑当前查询，否则应用行要再敲一个字才出现（capsule-actions:211 flake 根因）
        onSlowBatch?.()
      })
    } catch (err) {
      console.warn('[Launcher] loadRegistryCommands failed:', err)
    }
  }

  async function loadDynamicCommands(): Promise<void> {
    const parts: CommandEntry[] = []
    try {
      const links = await window.api.launcher.quicklinksList()
      parts.push(...buildQuicklinkCommands(links))
      // favicon 异步补齐：先显示通用 link 图标，命中缓存/下载完成后替换
      void Promise.allSettled(
        links.map(async (l) => {
          const path = await window.api.launcher.quicklinkFavicon(l.url)
          if (path) faviconPaths.value.set(l.url, path)
        })
      )
    } catch {
      /* Quicklinks 读取失败不阻塞其他来源 */
    }
    dynamicCommands.value = parts
  }

  /** 读一次工具清单（主进程侧只读缓存，不会 spawn），同样只认最新一趟 */
  const loadMcpCommands = latestOnly(loadMcpToolEntries, (v) => {
    mcpCommands.value = v
  })

  /** 拉一次插件命令表；提交交给 latestOnly——两次推送挨得近时旧结果不能盖掉新结果 */
  async function fetchPluginCommands(): Promise<CommandEntry[]> {
    try {
      const plugins = (await window.api.launcher.listPlugins()) as Array<{
        id: string
        name: string
        enabled: boolean
        commands?: Array<{
          code: string
          title: string
          description?: string
          arguments?: PluginArgument[]
        }>
      }>
      return plugins
        .filter((p) => p.enabled && Array.isArray(p.commands))
        .flatMap((p): CommandEntry[] =>
          p.commands!.map((cmd) => ({
            key: `plugin:${p.id}:${cmd.code}`,
            icon: 'plug-2',
            title: cmd.title,
            subtitle: `${p.name}${cmd.description ? ' · ' + cmd.description : ''}`,
            badge: '插件',
            // 声明了参数的插件命令才吃「命令 + 尾部参数」的前缀命中
            acceptsArgs: (cmd.arguments?.length ?? 0) > 0,
            action: {
              type: 'plugin' as const,
              pluginId: p.id,
              cmd: cmd.code,
              arguments: cmd.arguments
            }
          }))
        )
    } catch {
      /* 插件列表读取失败不阻塞内置搜索 */
      return pluginCommands.value
    }
  }

  const loadPluginCommands = latestOnly(fetchPluginCommands, (v) => {
    pluginCommands.value = v
  })

  /** #5 插件双通道：searchable 插件持久化条目（关闭插件后仍可从根搜索命中） */
  const pluginSearchRows = ref<CommandEntry[]>([])

  /** djb2 短哈希（psearch 稳定 key 用）：只求跨会话一致 + 低碰撞，不抗碰撞攻击 */
  function shortHash(input: string): string {
    let h = 5381
    for (let i = 0; i < input.length; i++) h = ((h << 5) + h + input.charCodeAt(i)) | 0
    return (h >>> 0).toString(36)
  }

  async function loadPluginSearchItems(): Promise<void> {
    try {
      const items = (await window.api.launcher.pluginSearchList()) as Array<{
        title: string
        subtitle?: string
        icon?: string
        keywords?: string[]
        badge?: string
        action: PluginItemAction
        pluginId: string
      }>
      pluginSearchRows.value = items.slice(0, 200).map((item) => ({
        // P-3：稳定 usage key——此前是位置下标，插件更新/条目重排后同一 key 指向
        // 不同条目，frecency 错绑（审查 Minor）。取标题+动作的短哈希：跨会话稳定，
        // 同插件内重名条目靠动作 payload 区分。
        key: `psearch:${item.pluginId}:${shortHash(item.title + JSON.stringify(item.action))}`,
        icon: item.icon || 'plug-2',
        title: item.title,
        subtitle: item.subtitle || '插件条目',
        badge: item.badge || '插件',
        // 关键词映射为别名：走统一匹配引擎的别名层（连续命中按标题级略降档）
        aliases: item.keywords,
        action: {
          type: 'pluginSearch' as const,
          pluginId: item.pluginId,
          action: item.action
        }
      }))
    } catch {
      pluginSearchRows.value = []
    }
  }

  /** 别名惰性补齐（M1.1 + P2-8）：拼音首字母 + 用户自定义别名 */
  // B53-6：pinyin-pro 词典 452KB 别挤进胶囊启动窗口——拼音别名延到空闲补齐
  // （requestIdleCallback，无则 1.5s）；用户自定义别名仍即时生效。多次 enrich
  // 合并调度，最新集合覆盖旧集合；补齐后 aliasEpoch++ 触发消费方重跑查询
  let pinyinPending: CommandEntry[] | null = null
  let pinyinScheduled = false
  function schedulePinyinEnrich(entries: CommandEntry[]): void {
    pinyinPending = entries
    if (pinyinScheduled) return
    pinyinScheduled = true
    const run = (): void => {
      pinyinScheduled = false
      const list = pinyinPending
      pinyinPending = null
      if (!list || list.length === 0) return
      void addPinyinAliases(list).then(() => {
        aliasEpoch.value++
      })
    }
    if ('requestIdleCallback' in window) requestIdleCallback(run, { timeout: 3000 })
    else setTimeout(run, 1500)
  }

  async function enrichAliases(): Promise<void> {
    // 动态源也要补别名：合一之前主窗面板单独给 Quicklink / 系统命令做过 addPinyinAliases，
    // 中文命名的 Quicklink 打首字母搜得到，合一后漏了就搜不到了
    const all = [
      ...registryEntries.value,
      ...pluginCommands.value,
      ...mcpCommands.value,
      ...dynamicCommands.value
    ]
    schedulePinyinEnrich(all)
    // P2-8：合并用户自定义别名（key = 命令 key）
    try {
      const userAliases = await window.api.alias.getAll()
      for (const entry of all) {
        const custom = userAliases[entry.key]
        if (custom && custom.length > 0) {
          entry.aliases = [...(entry.aliases ?? []), ...custom]
        }
      }
    } catch {
      /* 别名读取失败不影响拼音别名 */
    }
    aliasEpoch.value++
  }

  function faviconOf(entry: CommandEntry): string | null {
    if (entry.action.type !== 'quicklink') return null
    return faviconPaths.value.get(entry.action.url) ?? null
  }

  /** Raycast 风格：按命令类型给图标方形背景上色 */
  function iconBg(entry: CommandEntry): string {
    const type = entry.action.type
    // 分类色板定义在 tokens.css（--launcher-cat-*），此处只做类型→变量名映射
    const bgMap: Record<string, string> = {
      app: 'var(--launcher-cat-app)',
      system: 'var(--launcher-cat-system)',
      module: 'var(--launcher-cat-module)',
      quicklink: 'var(--launcher-cat-quicklink)',
      file: 'var(--launcher-cat-file)',
      clipboardItem: 'var(--launcher-cat-clipboard)',
      snippetItem: 'var(--launcher-cat-snippet)',
      ai: 'var(--launcher-cat-ai)',
      searchQuery: 'var(--launcher-cat-search)',
      openUrl: 'var(--launcher-cat-url)'
    }
    return bgMap[type] ?? 'var(--launcher-cat-other)'
  }

  const entries = computed<CommandEntry[]>(() => {
    void aliasEpoch.value // 别名异步就绪后重算
    // P-7②：五个源走同一个合并器而不是摊平数组——静态清单与 Provider 并存期间
    // 真的出现过同一命令两行（ai:translate 三处、剪贴板历史两处），
    // 那不光多一行，v-for 的 key 还会撞。次序：Registry 优先，静态清单在其后。
    const merged = mergeCommandEntries([
      registryEntries.value, // 统一 Registry（应用 + 系统 + 第一方 + 模块/系统页）
      pluginCommands.value,
      mcpCommands.value, // MCP 工具清单缓存
      pluginSearchRows.value, // #5 插件双通道：searchable 插件持久化条目
      dynamicCommands.value
    ])
    if (merged.duplicateKeys.length || merged.duplicateTitles.length) {
      // 只在开发态说：用户改不了命令表，弹提示是噪音
      if (import.meta.env.DEV) {
        console.warn(
          '[commands] 重复命令已去重：',
          merged.duplicateKeys.join(', '),
          merged.duplicateTitles.join(', ')
        )
      }
    }
    return merged.entries
  })

  // 命令表变了（插件装卸 / 启停 / 市场更新 / MCP 工具清单变化）：两路消费者都在这重拉。
  // 放在这里而不是各界面自己订，是因为「谁该刷新」与命令源同源，散着订迟早漏一路
  // （此前只有胶囊订，主窗的 ⌘K 面板就一直拿着过期的表）。
  // 推送带上了**是哪一路**变的：只重拉那一路，不去连带把系统命令/模块行全重算。
  const offTableChange = window.api.launcher.onCommandTableChanged((source) => {
    const reload = source === 'mcp' ? loadMcpCommands() : loadPluginCommands()
    void reload
      .then(async () => {
        await enrichAliases()
        afterTableChange?.()
      })
      .catch(() => {
        /* 拉不到就保持现状：下一次唤起照样会重拉，不该把界面搞成半更新 */
      })
  })
  onScopeDispose(() => offTableChange())

  return {
    pluginCommands,
    mcpCommands,
    loadMcpCommands,
    pluginSearchRows,
    dynamicCommands,
    registryEntries,
    registryCommands,
    faviconPaths,
    loadRegistryCommands,
    loadDynamicCommands,
    loadPluginCommands,
    loadPluginSearchItems,
    enrichAliases,
    faviconOf,
    iconBg,
    entries
  }
}

/** 模块 → 命令条目（建议列表用）；找不到模块返回 null */
export function moduleToEntry(id: string): CommandEntry | null {
  const m: ModuleMeta | undefined = findModule(id)
  return m
    ? {
        key: `module:${m.id}`,
        icon: m.icon,
        title: m.label,
        subtitle: m.description,
        badge: '功能',
        action: { type: 'module', moduleId: m.id, path: m.path }
      }
    : null
}
