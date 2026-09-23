/**
 * Frond · 文件索引排除规则（#9，纯函数）
 *
 * 目录名级剪枝（扫描时任意层级命中即整目录跳过，不进入）+ 文件级隐藏开关。
 * 默认范围是 home 全量，~/Library / .Trash / 构建产物必须被剪掉。
 */

export interface ExcludePolicy {
  /** 忽略 dot 开头的文件/目录（管理页开关，默认 true） */
  hidden: boolean
  /** 用户追加排除的目录名（管理页配置） */
  extraDirs?: string[]
  /** 目录内存在 .frondignore 文件时整目录跳过（扫描器探测后传入标记） */
  frondIgnoreMarked?: boolean
}

/** 内置排除目录名（任意层级命中即剪枝；与 Raycast/Vicinae 默认排除对齐）。
 * extraDirs（用户追加）与 per-dir policy 扩展留 M2。 */
const BUILTIN_DIR_NAMES: ReadonlySet<string> = new Set([
  'node_modules',
  '.git',
  'Library',
  'Caches',
  '.Trash',
  'dist',
  'build',
  'out',
  'target',
  '.pnpm-store',
  '.cache',
  'venv',
  '.venv',
  '__pycache__',
  '.gradle',
  'Pods',
  'DerivedData',
  '.next',
  '.nuxt',
  '.turbo',
  'coverage'
])

/** 文件/目录名是否为隐藏（dot 开头） */
function isHidden(name: string): boolean {
  return name.startsWith('.')
}

/** 目录是否应被剪枝（含 .frondignore 标记 / 内置名单 / 用户追加 / 隐藏开关） */
export function shouldExcludeDir(name: string, policy: ExcludePolicy): boolean {
  if (policy.frondIgnoreMarked) return true
  if (BUILTIN_DIR_NAMES.has(name)) return true
  if (policy.extraDirs?.includes(name)) return true
  if (policy.hidden && isHidden(name)) return true
  return false
}

/** 文件是否应排除（隐藏开关） */
export function shouldExcludeFile(name: string, policy: ExcludePolicy): boolean {
  return policy.hidden && isHidden(name)
}
