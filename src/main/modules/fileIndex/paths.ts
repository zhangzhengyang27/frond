/**
 * Leaf · 文件索引路径形态（#9 M2，跨平台）
 *
 * 索引内部（DB 的 path/parent、dirs 水位、scope、比较与删除前缀）**统一用正斜杠形态**：
 * scanner/service 里大量 `lastIndexOf('/')`、`deleteByPrefix(dir + '/')`、
 * `p.startsWith(scope + '/')` 都建立在「分隔符是 /」之上，而 node 的 path.join 在
 * Windows 上产出反斜杠 —— 不折算就会静默错位（parent 算成整串、前缀删除删不掉、
 * 范围判定永远不通过）。node:fs 在 Windows 上接受正斜杠，所以只在读写 fs 时不必换回。
 *
 * 另两处归一：去尾分隔符（root 除外）；盘符统一大写（Windows 路径大小写不敏感，
 * 不归一会导致 'c:/users' 与 'C:/users' 在水位与删除前缀上被当成两棵目录树）。
 */
import { statSync } from 'node:fs'

/** 折算成索引内部形态 */
export function normPath(p: string): string {
  if (!p) return p
  let s = p.replace(/\\/g, '/')
  while (s.length > 3 && s.endsWith('/')) s = s.slice(0, -1) // 保留 'C:/' 这类盘根
  if (s.length === 2 && s.endsWith(':')) s += '/' // 'C:' → 'C:/'
  return s.replace(/^([a-z]):/, (_m, d: string) => `${d.toUpperCase()}:`)
}

/** join 后立刻折算（scanner 每层都用它产出入库路径） */
export function joinNorm(dir: string, name: string): string {
  return normPath(`${dir}/${name}`)
}

/** 父目录（索引形态）：'a/b/c' → 'a/b'，'a/b' → 'a'，盘根与 '/' 返回自身 */
export function parentOf(p: string): string {
  const i = p.lastIndexOf('/')
  if (i < 0) return p
  if (i === 0) return '/'
  if (i === 2 && p[1] === ':') return p.slice(0, 2) + '/' // 'C:/x' → 'C:/'
  return p.slice(0, i)
}

/** 出主进程 / 给渲染端与 shell 用之前折回平台原生形态（索引内部一律正斜杠） */
export function nativePath(p: string): string {
  return process.platform === 'win32' ? p.replace(/\//g, '\\') : p
}

/**
 * 命中 scope 时返回「用该 scope 大小写归一后的路径」，否则 null（= 范围外）。
 *
 * 为什么需要它：Windows 路径大小写不敏感，但同一个目录从不同 API 拿到的 casing
 * 可能不同（用户手填的小写范围、8.3 短名、事件源回报的真实大小写）。不折叠会有
 * 两个后果——判成「范围外」而**静默不索引**，以及同一目录以两种 casing 入库变成
 * 两棵子树（重复条目 + 水位与删除前缀各管一半）。这里只把**前缀**换成 scope 的
 * 大小写，scope 之下仍用事件回报的真实 casing（展示与检索都靠它）。
 * macOS 走大小写敏感语义，故只在 win32 折叠比较。
 */
export function canonicalize(scopes: string[], p: string): string | null {
  const fold = (v: string): string => (process.platform === 'win32' ? v.toLowerCase() : v)
  const target = fold(p)
  for (const scope of scopes) {
    const key = fold(scope)
    if (target === key) return scope
    const prefix = key.endsWith('/') ? key : `${key}/`
    if (target.startsWith(prefix)) return scope + p.slice(key.length)
  }
  return null
}

/** p 是否落在某个 scope 内（scope 自身算在内） */
export function isInScope(scopes: string[], p: string): boolean {
  return canonicalize(scopes, p) !== null
}

/** 把「上次不可读」的范围分成已恢复与仍不可读两拨（卷插回来只补扫前者的那部分） */
export function partitionReadable(
  roots: string[],
  readable: (p: string) => boolean = isReadableDir
): { ready: string[]; still: string[] } {
  const ready: string[] = []
  const still: string[] = []
  for (const r of roots) (readable(r) ? ready : still).push(r)
  return { ready, still }
}

/** 目录当前可访问（挂载点回来 / 权限恢复） */
export function isReadableDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/** 默认目录判定：读不到（已删除 / 无权限）按非目录处理，交给父目录那一层 */
function defaultIsDir(p: string): boolean {
  try {
    return statSync(p).isDirectory()
  } catch {
    return false
  }
}

/**
 * 事件路径批 → 待重扫目录集合（只收目录）。
 * 事件既可能是目录本身、也可能是目录里的文件，两种都要落到「那个目录」：故收
 * 「事件自身（是目录时）」与「其父目录」。**不收文件路径**——旧实现照单全收，
 * 随后对文件 readdir 抛 ENOTDIR 再被 per-dir try/catch 吞掉：一次改动 N 个文件
 * 就白跑 N 次，等于把异常当控制流留在热路径上。
 */
export function dirsForEvents(
  scopes: string[],
  eventPaths: Iterable<string>,
  isDir: (p: string) => boolean = defaultIsDir
): string[] {
  const dirs = new Set<string>()
  const add = (p: string): void => {
    const canonical = p ? canonicalize(scopes, p) : null
    if (canonical && isDir(canonical)) dirs.add(canonical)
  }
  for (const p of eventPaths) {
    const n = normPath(p)
    add(n)
    add(parentOf(n))
  }
  return [...dirs]
}
