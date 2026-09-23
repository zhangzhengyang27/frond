/**
 * Frond · 模块元数据（shared 真理源）
 *
 * 来源：docs/IA_V2.md（信息架构 v2，「门 + 家」模型）。
 * 原「图标 / 实验台」为开发设施，已移除（2026-09）。
 *
 * 为什么放 shared/：
 * - 渲染端 Sidebar / Hub / CommandPalette / 启动台用
 * - 主进程 dockMenu / tray 也用（需要模块列表 + path 来跳转）
 * - 单一真理源，避免主进程 hardcode 与 renderer 不一致
 *
 * icon 命名走 Remix Icon（ri- 前缀由 AppIcon 处理）。
 * 不写死颜色——按 DESIGN_TOKENS.md 决策 15 统一 Brand 色。
 */

export type ModuleGroup = 'creation' | 'focus' | 'resource'

/** 侧边栏分组（IA v2：工具 / 启动器；系统页不走 ModuleMeta，见 commands.ts SYSTEM_PAGES） */
export type ModuleCategory = 'tool' | 'launcher'

export interface ModuleMeta {
  /** 唯一 id */
  id: string
  /** 路由名（vue-router name） */
  routeName: string
  /** 路由 path（用于 router.push） */
  path: string
  /** 中文标签（卡片 + 侧边栏共用） */
  label: string
  /** 描述（卡片副标题） */
  description: string
  /** remixicon 类名（不含 ri- 前缀） */
  icon: string
  /** 所在分组（决定 Hub 上排布） */
  group: ModuleGroup
  /** 侧边栏分组（IA v2 三分组） */
  category: ModuleCategory
  /** 1.0 升级提示标签（'即将升级' 等），undefined 表示无 */
  badge?: string
  /** 快捷键（⌘1-4） */
  shortcut: string
}

export const MODULES: ModuleMeta[] = [
  // 工具
  // 注：快捷键不重排（⌘1 随截图模块下线空出，2026-09-17），见 useModuleShortcuts
  {
    id: 'screenRecorder',
    routeName: 'screenRecorderRecord',
    path: '/screenRecorder/record',
    label: '屏幕录制',
    description: '录制 / 历史 / 回放 / 剪辑',
    icon: 'record-circle',
    group: 'creation',
    category: 'tool',
    shortcut: '2'
  },
  {
    id: 'pomodoro',
    routeName: 'pomodoro',
    path: '/pomodoro',
    label: '番茄钟',
    description: '三模式 + 任务 + 统计',
    icon: 'timer',
    group: 'focus',
    category: 'tool',
    shortcut: '3'
  },
  // 启动器
  {
    id: 'launcher',
    routeName: 'launcher',
    path: '/launcher',
    label: '启动器',
    description: 'Alt+Space 唤起 · 插件扩展',
    icon: 'search',
    group: 'resource',
    category: 'launcher',
    shortcut: '4'
  }
]

/** 按 id 找模块（主进程 dockMenu/tray 也用） */
export function findModule(id: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.id === id)
}

/** 按 routeName 找模块（用于高亮当前路由） */
export function findModuleByRoute(routeName: string): ModuleMeta | undefined {
  return MODULES.find((m) => m.routeName === routeName)
}

/** 按 group 排序后的分组结果（Hub 上排布用） */
export function getModulesByGroup(): Record<ModuleGroup, ModuleMeta[]> {
  const out: Record<ModuleGroup, ModuleMeta[]> = { creation: [], focus: [], resource: [] }
  for (const m of MODULES) out[m.group].push(m)
  return out
}

export const GROUP_LABELS: Record<ModuleGroup, string> = {
  creation: '创作',
  focus: '专注',
  resource: '资源'
}

/** 按 category 排序后的分组结果（侧边栏三分组用） */
export function getModulesByCategory(): Record<ModuleCategory, ModuleMeta[]> {
  const out: Record<ModuleCategory, ModuleMeta[]> = { tool: [], launcher: [] }
  for (const m of MODULES) out[m.category].push(m)
  return out
}

/**
 * 1.0 暂不重做但保留入口的模块（Hub 上放在「即将升级」分组，侧边栏挂在「工具」组尾）。
 * 来源：docs/DECISIONS.md Decision-002。
 */
export interface PendingModule {
  id: string
  routeName: string
  path: string
  label: string
  description: string
  icon: string
  /** 显示在卡片右上的小角标 */
  badge: string
  /** 快捷键（PENDING 模块默认不占 ⌘数字） */
  shortcut?: string
}

export const PENDING_MODULES: PendingModule[] = [
  {
    id: 'snippets',
    routeName: 'snippets',
    path: '/snippets',
    label: '代码片段',
    description: '1.0 暂不重做，下一迭代立即升级',
    icon: 'file-code',
    badge: 'v0.1→v1.1'
  }
]
