/**
 * Leaf · 命令注册表（IA v2「统一命令层」）
 *
 * 单一真理源：启动台胶囊、⌘K 命令面板、托盘 / Dock 菜单、⌘1-4 的入口
 * 全部从这份注册表取命令，保证「同样的搜索，到处一个样」。
 *
 * 三类静态命令在此构建：
 * - module  → 主窗口模块页（家中的页面）
 * - page    → 系统管理页（设置 / 数据迁移 / 关于，非模块不进 MODULES）
 * - 内联页  → 第一方内联页命令（见 FIRST_PARTY_COMMANDS）
 * 两类动态命令由消费方运行时追加（类型沿用本文件）：
 * - plugin  → 已启用插件在 plugin.json 声明的命令（launcher.listPlugins）
 * - app     → 本机应用（getApplications）
 *
 * 执行语义见 renderer utils/commandRunner.ts；分工契约见 docs/IA_V2.md。
 */

import { MODULES, PENDING_MODULES } from './modules'
import type { PluginArgument, PluginItemAction } from './plugin-protocol'

/**
 * 第一方内联页 id（Raycast 式：命令结果直接呈现在胶囊窗内）。
 * 运行时数组与类型同源：主进程 openFirstParty 白名单从此派生，
 * 防止「类型有、白名单无」导致 ⌘K/首页入口静默失效。
 */
export const FIRST_PARTY_PAGE_VALUES = [
  'focus',
  'snippets',
  'shots',
  'schedule',
  'eventform',
  'clips',
  'focusStats',
  'files',
  'qlform',
  'qlarg',
  'pluginarg',
  'settings',
  'ai',
  'browserTabs',
  'systemInfo',
  'windowSwitcher',
  'trash',
  'dictionary',
  'notes',
  'reminders',
  'calendar'
] as const

export type FirstPartyPage = (typeof FIRST_PARTY_PAGE_VALUES)[number]

/**
 * 重型模块（阶段C「主窗口降级」）：从启动台 / ⌘K 打开时走独立窗口，
 * 不抢占主窗口当前状态；侧边栏内的窗口内导航行为不变。
 */
export const WINDOW_MODULES: ReadonlySet<string> = new Set(['snippets', 'screenRecorder'])

/** 命令可执行的动作 */
export type CommandAction =
  | { type: 'module'; moduleId: string; path: string }
  | { type: 'page'; pageId: string; path: string }
  | { type: 'plugin'; pluginId: string; cmd: string; arguments?: PluginArgument[] }
  /** #5 插件双通道：searchable 插件持久化条目，动作复用声明式 List 的 PluginItemAction */
  | { type: 'pluginSearch'; pluginId: string; action: PluginItemAction }
  | { type: 'app'; path: string }
  | { type: 'firstParty'; page: FirstPartyPage }
  | { type: 'copyText'; text: string }
  /** 系统命令 / 窗口管理（M2），id 形如 system.lock / window.left */
  | { type: 'system'; cmdId: string }
  /** 用户自定义快捷链接（M2.3） */
  | { type: 'quicklink'; id: string; url: string }
  /** 统一混合搜索（P0-1）：根搜索直接命中文件，回车用默认程序打开 */
  | { type: 'file'; path: string; name: string }
  /** 统一混合搜索：根搜索直接命中剪贴板历史条目，回车再复制 */
  | { type: 'clipboardItem'; id: string }
  /** 粘贴最近截图（V4 P1-10：对齐 Raycast Paste Latest Screenshot） */
  | { type: 'shotPaste' }
  /** 打开外部链接（V4 P0-1：下一个会议入会；URL 白名单由调用方保证 http(s)） */
  | { type: 'openUrl'; url: string }
  /** 统一混合搜索：根搜索直接命中代码片段，回车复制内容 */
  | { type: 'snippetItem'; id: string }
  /** P2-9：最近搜索词，点击后填入搜索框（不执行命令） */
  | { type: 'searchQuery'; query: string }
  /** 浮动笔记：打开浮动笔记窗口 */
  | { type: 'floatingNote' }

/** 用户自定义 Quicklink（M2.3，存储在主进程 kv）；URL 可含 {query} 占位符（参数化链接） */
export interface Quicklink {
  id: string
  name: string
  url: string
}

/**
 * 参数化 Quicklink（维度 1 剩余差距：命令参数化）：
 * URL 中每个 {query} 占位符替换为 URL 编码后的参数。
 * 例：https://github.com/search?q={query}
 */
export function buildQuicklinkUrl(url: string, arg: string): string {
  return url.replaceAll('{query}', encodeURIComponent(arg))
}

/**
 * 解析 Quicklink URL 中的命名参数占位符（{name}），返回去重后的参数名（按出现顺序）。
 * {query} / {encodedQuery} 是旧单参数语法，不在此列（保持既有单参流程不变）。
 * Raycast 语法 {argument name="org"} 不引入——Leaf 用裸 {org}，更短且表单直接以
 * 参数名做标签（V4 P0-4：多参数命令最小闭环，落在 Quicklink 场景）。
 */
export function quicklinkArgNames(url: string): string[] {
  const names: string[] = []
  const re = /\{([a-zA-Z_][\w-]*)\}/g
  let m: RegExpExecArray | null
  while ((m = re.exec(url)) !== null) {
    const name = m[1]
    if (name === 'query' || name === 'encodedQuery') continue
    if (!names.includes(name)) names.push(name)
  }
  return names
}

/**
 * 按参数名替换 Quicklink 占位符（值 URL 编码）。
 * 未提供或为空的参数保留原占位符——调用方（qlarg 表单）负责先收齐。
 */
export function buildQuicklinkUrlMulti(url: string, values: Record<string, string>): string {
  return url.replace(/\{([a-zA-Z_][\w-]*)\}/g, (full, name: string) => {
    if (name === 'encodedQuery') return full
    const v = values[name]
    return v !== undefined && v !== '' ? encodeURIComponent(v) : full
  })
}

/**
 * Quicklink URL 白名单：只允许 http(s)。
 * Quicklink 会经 shell.openExternal 打开，file:/自定义协议/命令串必须挡在
 * 保存与分发两端；渲染端打开走 system:openExternal（同一白名单）。
 */
export function isValidQuicklinkUrl(url: unknown): boolean {
  if (typeof url !== 'string' || url.length === 0 || url.length > 2048) return false
  try {
    const parsed = new URL(url)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

/** 搜索 / 命令列表通用条目（胶囊与 ⌘K 共用） */
export interface CommandEntry {
  /** 唯一 key（结果列表 v-for / 选中态恢复用） */
  key: string
  /** 结果类型图标名（remixicon，不含 ri- 前缀） */
  icon: string
  /** 主标题 */
  title: string
  /** 副标题（描述 / 路径） */
  subtitle: string
  /** 结果行右侧的类型徽标文案（应用 / 功能 / 插件 / 页面 / 动作） */
  badge: string
  /** 别名（拼音首字母等，M1.1，惰性生成） */
  aliases?: string[]
  action: CommandAction
}

/** 系统管理页（主窗口「系统」组；非模块，不进 MODULES / ⌘数字） */
export interface SystemPage {
  id: string
  routeName: string
  path: string
  label: string
  description: string
  icon: string
}

export const SYSTEM_PAGES: SystemPage[] = [
  {
    id: 'settings',
    routeName: 'settings',
    path: '/settings',
    label: '设置',
    description: '外观 / 更新 / 数据 / 日志',
    icon: 'settings-3-line'
  },
  {
    id: 'migration',
    routeName: 'migration',
    path: '/migration',
    label: '数据迁移',
    description: '旧版本数据一键导入',
    icon: 'database-2-line'
  },
  {
    id: 'about',
    routeName: 'about',
    path: '/about',
    label: '关于',
    description: '版本 / 开源信息',
    icon: 'information-line'
  }
]

/**
 * 第一方内联页命令（Raycast 式）：回车后胶囊窗自身变形为该页，
 * 结果在胶囊内呈现，不再跳转主窗口。页面实现见
 * renderer/launcher/pages/（FocusPage / SnippetsPage）。
 */
export const FIRST_PARTY_COMMANDS: CommandEntry[] = [
  {
    key: 'firstparty:focus',
    icon: 'timer',
    title: '开始专注',
    subtitle: '胶囊内直接开始 / 暂停番茄钟',
    badge: '动作',
    action: { type: 'firstParty', page: 'focus' }
  },
  {
    key: 'firstparty:snippets',
    icon: 'file-code',
    title: '搜片段',
    subtitle: '搜索代码片段，回车即复制',
    badge: '动作',
    action: { type: 'firstParty', page: 'snippets' }
  },
  {
    key: 'firstparty:shots',
    icon: 'image-line',
    title: '截图库',
    subtitle: '按图内文字与文件名搜索截图（OCR 索引）',
    badge: '动作',
    action: { type: 'firstParty', page: 'shots' }
  },
  {
    key: 'firstparty:shotsPaste',
    icon: 'clipboard-line',
    title: '粘贴最近截图',
    subtitle: '把最近一张截图粘贴到当前应用',
    badge: '动作',
    action: { type: 'shotPaste' }
  },
  {
    key: 'firstparty:eventform',
    icon: 'calendar-add-line',
    title: '创建日程',
    subtitle: '写入系统日历（标题 / 开始时间 / 时长）',
    badge: '动作',
    action: { type: 'firstParty', page: 'eventform' }
  },
  {
    key: 'firstparty:schedule',
    icon: 'calendar-line',
    title: '我的日程',
    subtitle: '今日与未来 7 天的会议和日程',
    badge: '动作',
    action: { type: 'firstParty', page: 'schedule' }
  },
  {
    key: 'firstparty:clips',
    icon: 'clipboard-line',
    title: '剪贴板历史',
    subtitle: '最近复制的文本与图片，回车再复制',
    badge: '动作',
    action: { type: 'firstParty', page: 'clips' }
  },
  {
    key: 'firstparty:focusStats',
    icon: 'bar-chart-line',
    title: '专注统计',
    subtitle: '近 7 天专注速览',
    badge: '动作',
    action: { type: 'firstParty', page: 'focusStats' }
  },
  {
    key: 'firstparty:files',
    icon: 'folder-line',
    title: '文件搜索',
    subtitle: 'Spotlight 即时搜索文件名（macOS）',
    badge: '动作',
    action: { type: 'firstParty', page: 'files' }
  },
  {
    key: 'firstparty:qlform',
    icon: 'add-line',
    title: '添加快捷链接',
    subtitle: '胶囊内表单填写，保存后即可搜索打开',
    badge: '动作',
    action: { type: 'firstParty', page: 'qlform' }
  },
  {
    key: 'firstparty:settings',
    icon: 'settings-line',
    title: '快捷设置',
    subtitle: '主题 / 文本扩展 / 剪贴板历史，胶囊内直达',
    badge: '动作',
    action: { type: 'firstParty', page: 'settings' }
  },
  {
    key: 'firstparty:ai',
    icon: 'sparkling-2-line',
    title: 'AI 对话',
    subtitle: '胶囊内与 AI 对话（需配置 API Key）',
    badge: 'AI',
    action: { type: 'firstParty', page: 'ai' }
  },
  {
    key: 'firstparty:browserTabs',
    icon: 'chrome-line',
    title: '浏览器标签',
    subtitle: '搜索 Chrome / Safari 标签并切换（macOS）',
    badge: '浏览器',
    action: { type: 'firstParty', page: 'browserTabs' }
  },
  {
    key: 'firstparty:notes',
    icon: 'file-text-line',
    title: '笔记',
    subtitle: '轻量 Markdown 笔记，本地存储',
    badge: '动作',
    action: { type: 'firstParty', page: 'notes' }
  },
  // AI 预设命令（P0-3 增强：翻译/总结/改写，选中文本后快速处理）
  {
    key: 'ai:translate',
    icon: 'translate-2',
    title: '翻译为中文',
    subtitle: '把剪贴板文本翻译为中文',
    badge: 'AI',
    action: { type: 'firstParty', page: 'ai' }
  },
  {
    key: 'ai:summarize',
    icon: 'text-wrap',
    title: '总结文本',
    subtitle: '总结剪贴板文本的核心要点',
    badge: 'AI',
    action: { type: 'firstParty', page: 'ai' }
  },
  {
    key: 'ai:rewrite',
    icon: 'edit-line',
    title: '润色改写',
    subtitle: '优化剪贴板文本的表达',
    badge: 'AI',
    action: { type: 'firstParty', page: 'ai' }
  },
  {
    key: 'ai:pomodoroReport',
    icon: 'file-chart-line',
    title: '番茄钟日报',
    subtitle: 'AI 生成今日专注日报',
    badge: 'AI',
    action: { type: 'firstParty', page: 'ai' }
  }
]

/** M2.1/M2.2/B3：系统命令的展示元数据（主进程按平台返回可用 id）。
 *  必须覆盖主进程 getSystemCommandIds() 的全部 id（systemCommands.test.ts 有防漂移断言） */
export const SYSTEM_CMD_META: Record<string, { title: string; subtitle: string; icon: string }> = {
  'system.lock': { title: '锁定屏幕', subtitle: '立即锁屏', icon: 'lock-line' },
  'system.sleep': { title: '睡眠', subtitle: '系统休眠', icon: 'moon-line' },
  'system.screensaver': { title: '屏保', subtitle: '启动屏幕保护', icon: 'tv-line' },
  'system.restart': { title: '重启', subtitle: '重新启动系统', icon: 'restart-line' },
  'system.shutdown': { title: '关机', subtitle: '关闭计算机', icon: 'shut-down-line' },
  'system.emptyTrash': { title: '清空废纸篓', subtitle: '清空系统废纸篓', icon: 'delete-bin-line' },
  'system.hideAll': { title: '显示桌面', subtitle: '最小化全部窗口', icon: 'layout-line' },
  'system.muteToggle': { title: '静音切换', subtitle: '切换系统静音', icon: 'volume-mute-line' },
  'system.showDesktop': { title: '显示桌面', subtitle: '最小化全部窗口', icon: 'layout-line' },
  // B3：媒体 / 音量 / 批量退出 / 通知 / 弹盘
  'system.playPause': { title: '播放 / 暂停', subtitle: '切换媒体播放', icon: 'play-circle-line' },
  'system.nextTrack': { title: '下一首', subtitle: '切换到下一曲目', icon: 'skip-forward-line' },
  'system.previousTrack': { title: '上一首', subtitle: '切换到上一曲目', icon: 'skip-back-line' },
  'system.volume0': { title: '音量 0%', subtitle: '静音', icon: 'volume-mute-line' },
  'system.volume25': { title: '音量 25%', subtitle: '设置系统音量', icon: 'volume-down-line' },
  'system.volume50': { title: '音量 50%', subtitle: '设置系统音量', icon: 'volume-down-line' },
  'system.volume75': { title: '音量 75%', subtitle: '设置系统音量', icon: 'volume-up-line' },
  'system.volume100': { title: '音量 100%', subtitle: '设置系统音量', icon: 'volume-up-line' },
  'system.quitAllApps': {
    title: '退出所有应用',
    subtitle: '优雅关闭全部前台应用',
    icon: 'apps-2-line'
  },
  'system.quitAllAppsExceptFrontmost': {
    title: '退出其他应用',
    subtitle: '保留前台应用，退出其余',
    icon: 'apps-2-line'
  },
  'system.hideAllExceptFrontmost': {
    title: '隐藏其他应用',
    subtitle: '保留前台应用，隐藏其余',
    icon: 'eye-off-line'
  },
  'system.dismissNotifications': {
    title: '清除通知',
    subtitle: '关闭屏幕上的通知',
    icon: 'notification-3-line'
  },
  'system.ejectAllDisks': {
    title: '弹出所有磁盘',
    subtitle: '弹出全部可移动磁盘',
    icon: 'save-3-line'
  }
}

/** 窗口管理命令展示元数据（M2.2 + V4 三分/六分/最大高宽）。
 *  必须覆盖主进程 getWindowActionIds() 的全部 id（systemCommands.test.ts 有防漂移断言） */
export const WINDOW_CMD_META: Record<string, { title: string; subtitle: string }> = {
  'window.left': { title: '窗口左半屏', subtitle: '前台应用窗口靠左' },
  'window.right': { title: '窗口右半屏', subtitle: '前台应用窗口靠右' },
  'window.maximize': { title: '窗口最大化', subtitle: '前台应用窗口铺满屏幕' },
  'window.restore': { title: '窗口还原', subtitle: '切换前台窗口最大化状态' },
  'window.top': { title: '窗口 · 上半屏', subtitle: '前台应用窗口占上半屏' },
  'window.bottom': { title: '窗口 · 下半屏', subtitle: '前台应用窗口占下半屏' },
  'window.topLeft': { title: '窗口 · 左上', subtitle: '前台应用窗口占左上四分之一' },
  'window.topRight': { title: '窗口 · 右上', subtitle: '前台应用窗口占右上四分之一' },
  'window.bottomLeft': { title: '窗口 · 左下', subtitle: '前台应用窗口占左下四分之一' },
  'window.bottomRight': { title: '窗口 · 右下', subtitle: '前台应用窗口占右下四分之一' },
  'window.center': { title: '窗口 · 居中', subtitle: '前台应用窗口移到屏幕中央，尺寸不变' },
  'window.nextDisplay': {
    title: '窗口 · 下一显示器',
    subtitle: '前台应用窗口移到下一个显示器，尺寸与相对位置不变'
  },
  'window.maximizeHeight': { title: '窗口 · 最大高度', subtitle: '高度铺满屏幕，宽度不变' },
  'window.maximizeWidth': { title: '窗口 · 最大宽度', subtitle: '宽度铺满屏幕，高度不变' },
  'window.thirdFirst': { title: '窗口 · 左三分之一', subtitle: '占屏幕左侧三分之一' },
  'window.thirdFirstTwo': { title: '窗口 · 左三分之二', subtitle: '占屏幕左侧三分之二' },
  'window.thirdCenter': { title: '窗口 · 中三分之一', subtitle: '占屏幕中间三分之一' },
  'window.thirdLastTwo': { title: '窗口 · 右三分之二', subtitle: '占屏幕右侧三分之二' },
  'window.thirdLast': { title: '窗口 · 右三分之一', subtitle: '占屏幕右侧三分之一' },
  'window.sixthTopLeft': { title: '窗口 · 上左六分之一', subtitle: '占屏幕上左六分之一' },
  'window.sixthTopCenter': { title: '窗口 · 上中六分之一', subtitle: '占屏幕上中六分之一' },
  'window.sixthTopRight': { title: '窗口 · 上右六分之一', subtitle: '占屏幕上右六分之一' },
  'window.sixthBottomLeft': { title: '窗口 · 下左六分之一', subtitle: '占屏幕下左六分之一' },
  'window.sixthBottomCenter': { title: '窗口 · 下中六分之一', subtitle: '占屏幕下中六分之一' },
  'window.sixthBottomRight': { title: '窗口 · 下右六分之一', subtitle: '占屏幕下右六分之一' }
}

/** 由主进程上报的可用 id 构建动态系统命令（M2.1 / M2.2） */
export function buildSystemCommands(ids: { system: string[]; window: string[] }): CommandEntry[] {
  const system: CommandEntry[] = ids.system.flatMap((id) => {
    const meta = SYSTEM_CMD_META[id]
    if (!meta) return []
    return [
      {
        key: `syscmd:${id}`,
        icon: meta.icon,
        title: meta.title,
        subtitle: meta.subtitle,
        badge: '系统',
        action: { type: 'system', cmdId: id } satisfies CommandAction
      }
    ]
  })
  const window: CommandEntry[] = ids.window.flatMap((id) => {
    const meta = WINDOW_CMD_META[id]
    if (!meta) return []
    return [
      {
        key: `syscmd:${id}`,
        icon: 'window-line',
        title: meta.title,
        subtitle: meta.subtitle,
        badge: '系统',
        action: { type: 'system', cmdId: id } satisfies CommandAction
      }
    ]
  })
  return [...system, ...window]
}

/** M2.3：用户 Quicklinks → 命令条目 */
export function buildQuicklinkCommands(links: Quicklink[]): CommandEntry[] {
  return links.map((l) => ({
    key: `quicklink:${l.id}`,
    icon: 'link',
    title: l.name,
    subtitle: l.url,
    badge: '链接',
    action: { type: 'quicklink', id: l.id, url: l.url } satisfies CommandAction
  }))
}

/** 静态命令 = 模块 + PENDING 模块 + 系统页 + 第一方内联页（动态：插件 / 应用 / 系统命令 / Quicklinks 由消费方追加） */
export function buildStaticCommands(): CommandEntry[] {
  return [
    ...MODULES.map((m) => ({
      key: `module:${m.id}`,
      icon: m.icon,
      title: m.label,
      subtitle: m.description,
      badge: '功能',
      action: { type: 'module', moduleId: m.id, path: m.path } satisfies CommandAction
    })),
    ...PENDING_MODULES.map((p) => ({
      key: `module:${p.id}`,
      icon: p.icon,
      title: p.label,
      subtitle: p.description,
      badge: '功能',
      action: { type: 'module', moduleId: p.id, path: p.path } satisfies CommandAction
    })),
    ...SYSTEM_PAGES.map((p) => ({
      key: `page:${p.id}`,
      icon: p.icon,
      title: p.label,
      subtitle: p.description,
      badge: '页面',
      action: { type: 'page', pageId: p.id, path: p.path } satisfies CommandAction
    })),
    ...FIRST_PARTY_COMMANDS
  ]
}

/**
 * 为含中文标题的命令惰性生成拼音首字母别名（番茄钟 → fqz）。
 * pinyin-pro 词典较大，动态 import 避免拖慢胶囊入口包；生成后原地写入 aliases。
 */
export async function addPinyinAliases(entries: CommandEntry[]): Promise<void> {
  const pending = entries.filter((e) => e.aliases === undefined && /[\u4e00-\u9fa5]/.test(e.title))
  if (pending.length === 0) return
  try {
    const { pinyin } = await import('pinyin-pro')
    for (const entry of pending) {
      const initials = pinyin(entry.title, {
        pattern: 'first',
        toneType: 'none',
        type: 'array',
        nonZh: 'consecutive'
      })
        .join('')
        .replace(/[^a-z0-9]/gi, '')
        .toLowerCase()
      entry.aliases = initials ? [initials] : []
    }
  } catch {
    /* 拼音库加载失败不阻塞搜索 */
  }
}
