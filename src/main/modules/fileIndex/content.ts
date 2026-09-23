/**
 * Frond · 文件内容提取策略（#9 v1 含内容搜索）
 *
 * 白名单扩展名 + 大小截断 + 二进制嗅探（前 8KB 出现 null 字节拒收），
 * 防止把 FTS 索引撑爆（设计预算：10 万文件 ≤ 100MB）。
 */

export const CONTENT_MAX_BYTES = 512 * 1024
/** null 字节嗅探窗口 */
const BINARY_SNIFF_BYTES = 8192

const CONTENT_EXTENSIONS: ReadonlySet<string> = new Set([
  'md',
  'markdown',
  'txt',
  'json',
  'ts',
  'tsx',
  'js',
  'jsx',
  'mjs',
  'cjs',
  'css',
  'scss',
  'less',
  'html',
  'xml',
  'yml',
  'yaml',
  'toml',
  'csv',
  'py',
  'rb',
  'go',
  'rs',
  'java',
  'kt',
  'swift',
  'c',
  'h',
  'cpp',
  'hpp',
  'sh',
  'zsh',
  'sql',
  'log',
  'vue',
  'svg'
])

/** 文件是否值得提取正文（扩展名白名单 + 非空 + 大小上限内） */
export function isContentEligible(name: string, size: number | null | undefined): boolean {
  if (size === null || size === undefined || size <= 0 || size > CONTENT_MAX_BYTES) return false
  const dot = name.lastIndexOf('.')
  if (dot === -1) return false
  const ext = name.slice(dot + 1).toLowerCase()
  return CONTENT_EXTENSIONS.has(ext)
}

/** Buffer → 正文文本；二进制（嗅探窗口含 null 字节）返回 null */
export function contentFromBuffer(buf: Buffer): string | null {
  const window = buf.subarray(0, Math.min(buf.length, BINARY_SNIFF_BYTES))
  for (const b of window) {
    if (b === 0) return null
  }
  return buf.toString('utf8')
}
