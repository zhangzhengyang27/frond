/**
 * Leaf · 文件搜索（M5.3）
 *
 * macOS：mdfind（Spotlight 索引）即时搜索——
 * name 模式：文件名匹配（-name，毫秒级）；content 模式：全文/元数据搜索（不带 -name，较慢）。
 * onlyIn 限定目录（mdfind -onlyin，只接受绝对路径）。
 *
 * Windows：#9 M2 起自建索引优先（@parcel/watcher 增量），未就绪/零结果时回退
 * PowerShell Get-ChildItem 递归搜索（较慢，有超时保护）。
 * name 模式：-Filter 文件名通配；content 模式：Select-String 内容搜索。
 *
 * 执行动作：open（系统默认程序） / reveal（Finder/资源管理器中显示）。
 */
import { shell } from 'electron'
import { execFile } from 'child_process'
import { isAbsolute } from 'path'
import { isMac, isWin } from '../utils/platform'
import { safeOpenablePath } from '../utils/openPathGuard'
import { countE2E } from '../e2eProbe'
import { fileIndex } from './fileIndex/service'
import { nativePath } from './fileIndex/paths'
import { typedHandle } from '../ipc/typedIpc'

interface FileHit {
  path: string
  name: string
  dir: string
  /** 文件大小（字节），Windows 搜索时填充 */
  size?: number
  /** 修改时间（毫秒时间戳），Windows 搜索时填充 */
  modifiedAt?: number
}

/** 查询选项：mode 默认 name（保持兼容）；onlyIn 仅接受绝对路径目录 */
export interface FileSearchOptions {
  mode?: 'name' | 'content'
  onlyIn?: string
}

const MAX_LIMIT = 50
/** mdfind 输出上限；结果条数在 JS 侧截断，这里只防止极端匹配把内存撑爆 */
const MAX_STDOUT_BYTES = 4 * 1024 * 1024
/** Windows PowerShell 搜索超时（比 macOS 长，因为无索引） */
const WINDOWS_TIMEOUT_MS = 8000

/** PowerShell 单引号字符串转义：内部 ' 翻倍，防止断开引号注入命令 */
function psQuote(s: string): string {
  return `'${s.replace(/'/g, "''")}'`
}

function mdfind(query: string, limit: number, opts: FileSearchOptions = {}): Promise<FileHit[]> {
  return new Promise((resolve) => {
    const safe = query.trim()
    if (!safe) {
      resolve([])
      return
    }
    const isContent = opts.mode === 'content'
    // content 模式扫全文，明显慢于文件名索引：结果上限减半
    const cap0 = Math.min(Math.max(limit, 1), MAX_LIMIT)
    const cap = isContent ? Math.ceil(cap0 / 2) : cap0
    // execFile 不经 shell：查询串/选项作为独立参数传给 mdfind，不存在 $()/反引号注入面
    const args: string[] = isContent ? [] : ['-name']
    // -onlyin 只接受绝对路径目录，其余一律忽略（不进参数，无注入面）
    if (opts.onlyIn !== undefined && isAbsolute(opts.onlyIn)) {
      args.push('-onlyin', opts.onlyIn)
    }
    args.push(safe)
    execFile('mdfind', args, { timeout: 4000, maxBuffer: MAX_STDOUT_BYTES }, (error, stdout) => {
      // 超出 maxBuffer 时 error 非空但 stdout 仍有前半段可用；其余错误按无结果处理
      if (error && !stdout) {
        resolve([])
        return
      }
      const hits = String(stdout)
        .split('\n')
        .map((line) => line.trim())
        // .app 包已作为「应用」命令由应用索引承载，文件结果里剔除（Raycast 同款去重）
        .filter((line) => line.length > 0 && !/\.app\/?$/i.test(line))
        .slice(0, cap)
        .map((path) => ({
          path,
          name: path.split('/').pop() ?? path,
          dir: path.split('/').slice(0, -1).join('/')
        }))
      resolve(hits)
    })
  })
}

/**
 * Windows 文件搜索：PowerShell Get-ChildItem 递归。
 * name 模式：-Filter 通配匹配文件名；content 模式：Select-String 内容匹配。
 * 输出格式：每行 `路径|大小|修改时间`（用 | 分隔，避免路径中的逗号/空格问题）。
 */
function windowsSearch(
  query: string,
  limit: number,
  opts: FileSearchOptions = {}
): Promise<FileHit[]> {
  return new Promise((resolve) => {
    const safe = query.trim()
    if (!safe) {
      resolve([])
      return
    }
    const isContent = opts.mode === 'content'
    const cap = Math.floor(Math.min(Math.max(limit, 1), MAX_LIMIT))
    // 用户输入的 onlyIn 经 psQuote 转义；默认根目录是常量，
    // 必须保持不带引号才能让 PowerShell 展开 $env:USERPROFILE（单引号内不展开）
    const searchRoot =
      opts.onlyIn && isAbsolute(opts.onlyIn) ? psQuote(opts.onlyIn) : '$env:USERPROFILE'
    const safePattern = safe.replace(/'/g, "''")

    // PowerShell 脚本：递归搜索，输出 路径|大小|修改时间Ticks
    const psScript = isContent
      ? `Get-ChildItem -Path ${searchRoot} -Recurse -File -ErrorAction SilentlyContinue | Select-String -Pattern '${safePattern}' -List -ErrorAction SilentlyContinue | Select-Object -First ${cap} | ForEach-Object { "$($_.Path)|$($_.Length)|$($_.LastWriteTime.Ticks)" }`
      : `Get-ChildItem -Path ${searchRoot} -Recurse -File -Filter '*${safePattern}*' -ErrorAction SilentlyContinue | Select-Object -First ${cap} | ForEach-Object { "$($_.FullName)|$($_.Length)|$($_.LastWriteTime.Ticks)" }`

    execFile(
      'powershell.exe',
      ['-NoProfile', '-Command', psScript],
      {
        timeout: WINDOWS_TIMEOUT_MS,
        maxBuffer: MAX_STDOUT_BYTES,
        windowsHide: true
      },
      (error, stdout) => {
        if (error && !stdout) {
          resolve([])
          return
        }
        const hits = String(stdout)
          .split('\n')
          .map((line) => line.trim())
          .filter((line) => line.length > 0 && line.includes('|'))
          .slice(0, cap)
          .map((line) => {
            const parts = line.split('|')
            const path = parts[0] || ''
            const size = parts[1] ? parseInt(parts[1], 10) : undefined
            // PowerShell Ticks → 毫秒时间戳（Ticks 是 100 纳秒，从 0001-01-01 开始）
            const modifiedAt = parts[2]
              ? Math.floor((parseInt(parts[2], 10) - 621355968000000000) / 10000)
              : undefined
            const name = path.split(/[\\/]/).pop() ?? path
            const dir = path.split(/[\\/]/).slice(0, -1).join('/')
            return { path, name, dir, size, modifiedAt }
          })
        resolve(hits)
      }
    )
  })
}

export function registerFileSearchIpc(): void {
  typedHandle('find:files', async (_e, { query, limit = 30, opts }) => {
    if (!isMac() && !isWin()) {
      return {
        ok: false,
        supported: false,
        items: [],
        error: '文件搜索当前仅支持 macOS 和 Windows'
      }
    }
    // opts 只取白名单字段：mode 仅认 'content'（其余按 name），onlyIn 非字符串忽略
    const mode = opts?.mode === 'content' ? 'content' : 'name'
    const onlyIn = typeof opts?.onlyIn === 'string' ? opts.onlyIn : undefined
    const searchOpts: FileSearchOptions = { mode, onlyIn }
    // #9 自建索引优先（macOS / Windows）：ready 时直接用（含 skeleton 拼音首字母 + 内容列）；
    // 未就绪或**零结果**时回退系统检索（设计 §5「查询无果时回退」——索引只有
    // 前缀匹配，中缀查询零结果时旧链路仍有产出，审查 I-3）；
    // onlyIn 限定目录在索引范围外，同样回退
    const trimmed = String(query ?? '').trim()
    if ((isMac() || isWin()) && !onlyIn) {
      fileIndex.ensureStarted()
      const tokens = trimmed.split(/\s+/).filter(Boolean)
      const indexed = tokens.length > 0 ? fileIndex.query(tokens, mode, Number(limit) || 30) : null
      if (indexed && indexed.length > 0) {
        return {
          ok: true,
          supported: true,
          items: indexed.map((h) => ({
            // 索引内部是正斜杠形态，出主进程前折回原生分隔符（Windows 展示与
            // shell.openPath/reveal 都按 C:\Users\… 说话）
            path: nativePath(h.path),
            name: h.name,
            dir: nativePath(h.parent)
          })),
          source: 'index' as const
        }
      }
    }
    const onMac = isMac()
    const items = onMac
      ? await mdfind(trimmed, Number(limit) || 30, searchOpts)
      : await windowsSearch(trimmed, Number(limit) || 30, searchOpts)
    // source 让调用方能区分「自建索引命中」与「回退系统检索」——没有它，验收只能
    // 靠 DB 计数间接推断（设计 §6 早写过这个字段）
    return {
      ok: true,
      supported: true,
      items,
      source: onMac ? ('mdfind' as const) : ('powershell' as const)
    }
  })
  typedHandle('find:reveal', (_e, { filePath }) => {
    countE2E('find:reveal')
    // 与 system:openPath 同级守卫：路径必须存在且非可执行扩展名，
    // 否则被攻陷渲染端可借此探测任意路径存在性
    const p = safeOpenablePath(filePath)
    if (!p) return { ok: false }
    shell.showItemInFolder(p)
    return { ok: true }
  })
}
