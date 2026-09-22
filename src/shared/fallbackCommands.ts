/**
 * Leaf · Fallback Commands 兜底命令（对标 Raycast Fallback Commands）
 *
 * 当根搜索无匹配结果时，显示一组兜底命令，将"无结果"转化为"新入口"。
 * 用户可在启动器管理页启用/禁用（pref launcher:fallbackDisabled），
 * 并可自定义顺序（pref launcher:fallbackOrder，2026-09-18 落地）。
 */

export interface FallbackCommand {
  id: string
  title: string
  /** 支持 {query} 占位符，运行时替换为当前搜索词 */
  subtitle: string
  icon: string
  badge?: string
  /** 执行动作类型 */
  action:
    | { type: 'firstParty'; page: string; query?: string }
    | { type: 'searchFiles'; query: string }
    | { type: 'openUrl'; url: string }
    | { type: 'copyText'; text: string }
}

/** 默认兜底命令（按推荐顺序） */
export const DEFAULT_FALLBACK_COMMANDS: FallbackCommand[] = [
  {
    id: 'fallback:files',
    title: '搜索文件',
    subtitle: '在文件中查找「{query}」',
    icon: 'folder-line',
    badge: '文件',
    action: { type: 'searchFiles', query: '{query}' }
  },
  {
    id: 'fallback:ai',
    title: '询问 AI',
    subtitle: '用 AI 回答「{query}」',
    icon: 'sparkling-2-line',
    badge: 'AI',
    action: { type: 'firstParty', page: 'ai', query: '{query}' }
  },
  {
    id: 'fallback:dictionary',
    title: '词典查询',
    subtitle: '查询「{query}」的释义',
    icon: 'book-2-line',
    badge: '工具',
    action: { type: 'firstParty', page: 'dictionary', query: '{query}' }
  },
  {
    id: 'fallback:web',
    title: '网页搜索',
    subtitle: '在搜索引擎中查找「{query}」',
    icon: 'global-line',
    badge: '网页',
    // 用 {encodedQuery}：搜索词含空格/& 时必须编码，否则会截断 URL 或注入额外查询参数
    action: { type: 'openUrl', url: 'https://www.google.com/search?q={encodedQuery}' }
  },
  {
    id: 'fallback:clipboard',
    title: '剪贴板历史',
    subtitle: '在剪贴板历史中查找「{query}」',
    icon: 'clipboard-line',
    badge: '剪贴板',
    action: { type: 'firstParty', page: 'clips', query: '{query}' }
  }
]

/**
 * 按用户自定义顺序排序兜底命令：
 * order 里收录的 id 按其位置排前；未收录的保持默认相对序随后（对标 Vicinae 可排序 fallback 列表）。
 * 纯函数，不修改入参。
 */
export function sortFallbackCommands(cmds: FallbackCommand[], order: string[]): FallbackCommand[] {
  if (order.length === 0) return [...cmds]
  const pos = new Map(order.map((id, i) => [id, i]))
  const defaultIndex = new Map(cmds.map((c, i) => [c.id, i]))
  const UNKNOWN = Number.MAX_SAFE_INTEGER
  return [...cmds].sort((a, b) => {
    const pa = pos.get(a.id) ?? UNKNOWN
    const pb = pos.get(b.id) ?? UNKNOWN
    if (pa !== pb) return pa - pb
    // 同为未收录：按默认相对序
    return (defaultIndex.get(a.id) ?? 0) - (defaultIndex.get(b.id) ?? 0)
  })
}

/**
 * 按用户自定义顺序排序兜底命令：
 * order 里收录的 id 按其位置排前；未收录的保持默认相对序随后（对标 Vicinae 可排序 fallback 列表）。
 * 纯函数，不修改入参。
 */
export function sortFallbackCommands(cmds: FallbackCommand[], order: string[]): FallbackCommand[] {
  if (order.length === 0) return [...cmds]
  const pos = new Map(order.map((id, i) => [id, i]))
  const defaultIndex = new Map(cmds.map((c, i) => [c.id, i]))
  const UNKNOWN = Number.MAX_SAFE_INTEGER
  return [...cmds].sort((a, b) => {
    const pa = pos.get(a.id) ?? UNKNOWN
    const pb = pos.get(b.id) ?? UNKNOWN
    if (pa !== pb) return pa - pb
    // 同为未收录：按默认相对序
    return (defaultIndex.get(a.id) ?? 0) - (defaultIndex.get(b.id) ?? 0)
  })
}

/** 渲染时替换 {query} 占位符 */
export function renderFallbackCommand(cmd: FallbackCommand, query: string): FallbackCommand {
  const encoded = encodeURIComponent(query)
  const replace = (s: string): string =>
    s.replaceAll('{query}', query).replaceAll('{encodedQuery}', encoded)
  return {
    ...cmd,
    title: replace(cmd.title),
    subtitle: replace(cmd.subtitle),
    action:
      cmd.action.type === 'openUrl'
        ? { ...cmd.action, url: replace(cmd.action.url) }
        : cmd.action.type === 'searchFiles'
          ? { ...cmd.action, query: replace(cmd.action.query) }
          : cmd.action.type === 'firstParty'
            ? { ...cmd.action, query: cmd.action.query ? replace(cmd.action.query) : undefined }
            : cmd.action
  }
}
