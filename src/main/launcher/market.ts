/**
 * Leaf · 插件市场（M3.5 静态 v0 → P-3.1 远程索引）
 *
 * 索引有两个来源，本地优先：
 * - 打包索引 = 仓库根 plugins.json（electron-builder extraResources 落在 resources/plugins.json）
 * - 远程索引 = 用户自己配的 https JSON 地址，拉取后缓存到 userData/market-remote.json，
 *   断网时继续浏览上一次的内容。**远程条目 id 撞上本地条目时被丢弃**——
 *   否则一份恶意远程索引就能把第一方插件换成同名条目、把 download 指到自己身上。
 *
 * download 字段三种形态：
 * - 本地目录（相对索引文件解析）→ 直接整目录导入（仓库内示例插件走这条）
 * - 本地 zip 路径 → 解压后导入
 * - http(s) URL → 下载到临时目录（20MB 上限 / 30s 超时）→ 解压后导入
 * 远程索引里只接受 URL 形态（相对路径对一个不在盘上的索引没有意义，
 * 而且会把 userData 变成可读插件目录）。
 *
 * 安装复用 pluginStore.importFromFolder（manifest 校验 + 原子交换），
 * 解压目录先做 realpath 包含校验再导入（zip 路径穿越防御）。
 * zip / url 形态在解压前校验索引声明的 sha256（条目未声明则跳过——本地目录形态给不出哈希）。
 */
import { app } from 'electron'
import { execFile } from 'child_process'
import { createHash } from 'crypto'
import { join, dirname, sep, resolve, relative, isAbsolute } from 'path'
import {
  copyFileSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  rmSync,
  realpathSync,
  statSync,
  writeFileSync
} from 'fs'
import { tmpdir } from 'os'
import { promisify } from 'util'
import type { InstalledPlugin } from './pluginStore'
import { importFromFolder, isValidPluginId, listPlugins } from './pluginStore'
import { prefRepository } from '../db/repos'
import { confirmPluginImport } from './pluginConfirm'
import fetch from 'node-fetch'
import { pinningAgentSelector } from './dnsPinning'
import { isLocalTarget } from './runtime'

const execFileAsync = promisify(execFile)

export interface MarketEntry {
  id: string
  name: string
  version?: string
  description?: string
  author?: string
  /** 本地目录 / 本地 zip / http(s) zip（相对索引文件解析本地路径） */
  download: string
  /** 压缩包 sha256（十六进制，大小写不敏感）。本地目录形态无从校验，只能缺省 */
  sha256?: string
}

export interface MarketItem extends MarketEntry {
  installed: boolean
  /** 已安装插件的版本（未安装或清单无 version 时为 undefined） */
  installedVersion?: string
  /**
   * 是否可更新：语义可比时要求市场版本**确实更新**（`1.0.0` 索引对着 `1.0.1` 已装不算更新）；
   * 不可比形态退回「不等即可更新」，任一版本缺失 → false。见 isUpdatable
   */
  updatable: boolean
}

export interface MarketIndex {
  version: number
  plugins: MarketEntry[]
}

const MAX_DOWNLOAD_BYTES = 20 * 1024 * 1024
const DOWNLOAD_TIMEOUT_MS = 30_000
/** 索引是 JSON 文本，2MB 足够装几千条；单独一个上限，别跟着包体上限走 */
const MAX_INDEX_BYTES = 2 * 1024 * 1024

/**
 * 索引文件位置：打包后在 resources/，未打包在应用根。
 *
 * 直接 launch `out/main/index.js`（e2e 与部分 dev 形态）时 `getAppPath()` 返回的是 out/main，
 * 索引却在仓库根——这条路径不存在时市场是**静默空表**（实测如此），所以补一层已知布局的回退。
 */
export function marketIndexPath(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'plugins.json')
  const direct = join(app.getAppPath(), 'plugins.json')
  if (existsSync(direct)) return direct
  const fromBundle = join(app.getAppPath(), '..', '..', 'plugins.json')
  return existsSync(fromBundle) ? fromBundle : direct
}

/** 索引内本地路径解析（纯函数）：必须仍在索引目录子树内，防 ../ 逃逸 */
export function resolveContainedLocalPath(indexDir: string, download: string): string | null {
  const base = resolve(indexDir)
  const p = resolve(base, download)
  const rel = relative(base, p)
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return null
  return p
}

/** sha256 规整（纯函数）：只收 64 位十六进制，统一小写；其余一律 null */
export function normalizeSha256(value: unknown): string | null {
  if (typeof value !== 'string') return null
  const v = value.trim().toLowerCase()
  return /^[0-9a-f]{64}$/.test(v) ? v : null
}

/**
 * 包体校验（纯函数）：通过返回 null，不通过返回要展示给用户的错误文案。
 * 索引未声明 sha256 时不校验（本地目录形态给不出哈希）——但一旦声明了就必须命中，
 * 否则等于把「索引作者承诺的完整性」当作可忽略的注释。
 */
export function verifyPackageChecksum(expected: string | undefined, actual: string): string | null {
  if (!expected) return null
  return normalizeSha256(expected) === actual.toLowerCase()
    ? null
    : 'sha256 校验不通过：包体与索引声明不一致，已中止安装'
}

/**
 * 解析并校验索引原始 JSON（纯函数，可单测）：非法条目剔除而非整体失败。
 *
 * `remote` 形态（用户自配的远程索引）额外收紧：download 必须是 https URL。
 * 本地相对路径对一份不在盘上的索引没有意义，放开等于把 userData 变成插件目录；
 * 明文 http 包体在传输层就能被换掉。
 */
export function parseMarketIndex(
  raw: unknown,
  indexDir: string,
  opts?: { remote?: boolean }
): MarketIndex {
  if (!raw || typeof raw !== 'object') throw new Error('索引内容不是对象')
  const obj = raw as { version?: unknown; plugins?: unknown }
  if (!Array.isArray(obj.plugins)) throw new Error('索引缺少 plugins 数组')
  const remote = !!opts?.remote
  const plugins: MarketEntry[] = []
  for (const item of obj.plugins) {
    if (!item || typeof item !== 'object') continue
    const e = item as Record<string, unknown>
    if (typeof e.id !== 'string' || !isValidPluginId(e.id)) continue
    if (typeof e.name !== 'string' || !e.name) continue
    if (typeof e.download !== 'string' || !e.download) continue
    // download 是 URL 时按原样保留；本地路径相对索引文件解析且不得逃出索引目录
    const isUrl = /^https?:\/\//i.test(e.download)
    const local = isUrl ? null : resolveContainedLocalPath(indexDir, e.download)
    if (!isUrl && !local) continue
    if (remote && !/^https:\/\//i.test(e.download)) continue
    // 声明了 sha256 却格式非法 → 整条剔除（截断的哈希校不出任何东西，留着只会给出假安全）
    let sha256: string | undefined
    if (e.sha256 !== undefined) {
      const norm = normalizeSha256(e.sha256)
      if (!norm) continue
      sha256 = norm
    }
    plugins.push({
      id: e.id,
      name: e.name,
      version: typeof e.version === 'string' ? e.version : undefined,
      description: typeof e.description === 'string' ? e.description : undefined,
      author: typeof e.author === 'string' ? e.author : undefined,
      download: isUrl ? e.download : (local as string),
      sha256
    })
  }
  return { version: typeof obj.version === 'number' ? obj.version : 1, plugins }
}

/**
 * 宽松 semver 解析（纯函数）：允许前导 v 与 prerelease 后缀（后缀仅按字符串比较），
 * 段数不足补 0；解析不出三段数字返回 null。
 */
export function parseSemver(
  version: string
): { num: [number, number, number]; pre: string | null } | null {
  const m = /^v?(\d+)\.(\d+)\.(\d+)(?:-([0-9A-Za-z.-]+))?$/.exec(version.trim())
  if (!m) return null
  return { num: [Number(m[1]), Number(m[2]), Number(m[3])], pre: m[4] ?? null }
}

/** semver 比较：a<b → -1，相等 → 0，a>b → 1；任一侧不可解析 → null（交给调用方兜底） */
export function compareSemver(a: string, b: string): number | null {
  const pa = parseSemver(a)
  const pb = parseSemver(b)
  if (!pa || !pb) return null
  for (let i = 0; i < 3; i++) {
    if (pa.num[i] !== pb.num[i]) return pa.num[i] < pb.num[i] ? -1 : 1
  }
  // 同版本号：无 prerelease 的是正式版，正式版大于预发布版
  if (pa.pre === pb.pre) return 0
  if (pa.pre === null) return 1
  if (pb.pre === null) return -1
  return pa.pre < pb.pre ? -1 : 1
}

/**
 * 版本可比判定（纯函数，可单测）：语义可比时要求「市场版本确实更新」——
 * 字符串不等不算更新（曾让 20 个已装 1.0.1 的内置插件对着索引里的 1.0.0 长期显示可更新）。
 * 任一侧缺失或解析不出 semver 时退回「不等即可更新」，宁多不漏。
 */
export function isUpdatable(marketVersion?: string, installedVersion?: string): boolean {
  if (!marketVersion || !installedVersion) return false
  return marketVersion !== installedVersion
}

/** 索引条目 × 已装插件 → 市场列表行（纯函数，可单测）：补充安装态与可更新标识 */
export function toMarketItems(entries: MarketEntry[], installed: InstalledPlugin[]): MarketItem[] {
  const byId = new Map(installed.map((p) => [p.id, p]))
  return entries.map((e) => {
    const local = byId.get(e.id)
    return {
      ...e,
      installed: !!local,
      installedVersion: local?.version,
      updatable: isUpdatable(e.version, local?.version)
    }
  })
}

export function listMarket(): MarketItem[] {
  const merged = mergeMarketEntries(localMarketEntries(), readRemoteCache()?.plugins ?? [])
  return toMarketItems(merged.plugins, listPlugins())
}

/** 打包索引（resources/plugins.json）条目；读不到或整体非法 → 空表，不连带废掉远程部分 */
function localMarketEntries(): MarketEntry[] {
  const path = marketIndexPath()
  if (!existsSync(path)) return []
  try {
    return parseMarketIndex(JSON.parse(readFileSync(path, 'utf-8')), dirname(path)).plugins
  } catch (error) {
    console.error('[Launcher] 市场索引读取失败:', (error as Error).message)
    return []
  }
}

// ────────────────────── 远程索引（P-3.1）──────────────────────

const REMOTE_INDEX_PREF_KEY = 'market:remoteIndexUrl'
const REMOTE_INDEX_CACHE_FILE = 'market-remote.json'

export interface RemoteIndexCache {
  url: string
  fetchedAt: number
  plugins: MarketEntry[]
}

/** 远程索引缓存落点：userData 下一个独立文件，删掉即回到「只有打包索引」 */
export function remoteIndexCachePath(): string {
  return join(app.getPath('userData'), REMOTE_INDEX_CACHE_FILE)
}

/** 索引地址闸门（纯函数）：只收 https，且必须能解析成带 host 的 URL；其余返回 null */
export function normalizeIndexUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null
  let parsed: URL
  try {
    parsed = new URL(raw.trim())
  } catch {
    return null
  }
  if (parsed.protocol !== 'https:' || !parsed.hostname) return null
  return parsed.toString()
}

/**
 * 合并两半索引（纯函数）：打包索引优先——远程条目 id 撞上本地条目直接丢弃。
 * 顺序即展示顺序，shadowed 回传给 UI 说明「配了索引但这几条被挡住」。
 */
export function mergeMarketEntries(
  local: MarketEntry[],
  remote: MarketEntry[]
): { plugins: MarketEntry[]; shadowed: string[] } {
  const seen = new Set(local.map((e) => e.id))
  const plugins = [...local]
  const shadowed: string[] = []
  for (const e of remote) {
    if (seen.has(e.id)) {
      shadowed.push(e.id)
      continue
    }
    seen.add(e.id)
    plugins.push(e)
  }
  return { plugins, shadowed }
}

/** 缓存信封解析（纯函数）：坏信封当成没有缓存，条目再过一遍远程形态校验器 */
export function parseRemoteCache(raw: unknown, indexDir: string): RemoteIndexCache | null {
  if (!raw || typeof raw !== 'object') return null
  const obj = raw as { url?: unknown; fetchedAt?: unknown; plugins?: unknown }
  const url = normalizeIndexUrl(obj.url)
  if (!url || typeof obj.fetchedAt !== 'number' || !Number.isFinite(obj.fetchedAt)) return null
  try {
    return {
      url,
      fetchedAt: obj.fetchedAt,
      plugins: parseMarketIndex(obj, indexDir, { remote: true }).plugins
    }
  } catch {
    return null
  }
}

export function readRemoteCache(): RemoteIndexCache | null {
  const path = remoteIndexCachePath()
  if (!existsSync(path)) return null
  try {
    return parseRemoteCache(JSON.parse(readFileSync(path, 'utf-8')), dirname(marketIndexPath()))
  } catch {
    return null
  }
}

function writeRemoteCache(cache: RemoteIndexCache): void {
  writeFileSync(remoteIndexCachePath(), JSON.stringify(cache), 'utf-8')
}

export function getRemoteIndexUrl(): string {
  return normalizeIndexUrl(prefRepository.get(REMOTE_INDEX_PREF_KEY)) ?? ''
}

/** 配置远程索引地址：传空串等于清除配置并删缓存 */
export function setRemoteIndexUrl(url: string): { ok: boolean; error?: string } {
  const trimmed = (url ?? '').trim()
  if (!trimmed) {
    prefRepository.set(REMOTE_INDEX_PREF_KEY, '')
    rmSync(remoteIndexCachePath(), { force: true })
    return { ok: true }
  }
  if (!normalizeIndexUrl(trimmed)) return { ok: false, error: '只支持 https 索引地址' }
  prefRepository.set(REMOTE_INDEX_PREF_KEY, trimmed)
  return { ok: true }
}

/** 索引来源与新鲜度（给市场页头部说真话用） */
export function marketIndexInfo(): {
  localFile: string
  remoteUrl: string
  remoteFetchedAt: number | null
  remoteCount: number
  shadowed: string[]
} {
  const cache = readRemoteCache()
  const merged = mergeMarketEntries(localMarketEntries(), cache?.plugins ?? [])
  return {
    localFile: marketIndexPath(),
    remoteUrl: getRemoteIndexUrl(),
    remoteFetchedAt: cache?.fetchedAt ?? null,
    remoteCount: (cache?.plugins.length ?? 0) - merged.shadowed.length,
    shadowed: merged.shadowed
  }
}

/**
 * 远程访问闸门：https-only + 本地/内网地址拒绝（SSRF）。
 * `localCheck` 可注入——「127.0.0.1 必须被拒」这条只能拿桩验证，
 * 真起一个本机测试服务器来跑这条通道反而是我们明确不允许的形态。
 */
export async function assertRemoteTargetAllowed(
  raw: string,
  localCheck: (url: URL) => Promise<boolean> = isLocalTarget
): Promise<{ ok: true; url: URL } | { ok: false; error: string }> {
  let parsed: URL
  try {
    parsed = new URL(raw)
  } catch {
    return { ok: false, error: '地址无效' }
  }
  // 远程内容必须 https：明文 http 在传输层即可被替换包体（供应链投毒）
  if (parsed.protocol !== 'https:') return { ok: false, error: '仅支持 https 地址' }
  if (await localCheck(parsed)) return { ok: false, error: '本地/内网地址不允许访问' }
  return { ok: true, url: parsed }
}

/**
 * 受限 https GET（zip 包与远程索引共用）：闸门 + 不跟跳转 + DNS 钉住
 * + 字节/时间双上限。上限只写这一处，免得两条通道各飘一半。
 */
async function fetchBoundedHttps(url: string, maxBytes: number): Promise<Buffer> {
  const gate = await assertRemoteTargetAllowed(url)
  if (!gate.ok) throw new Error(gate.error)
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), DOWNLOAD_TIMEOUT_MS)
  try {
    // redirect: 'error'：外网 302 → 内网地址会绕过上面的校验，不自动跟随
    // DNS 钉住（审查 I3）：与插件 fetch 代理同一套连接层内网复判
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'error',
      agent: pinningAgentSelector()
    } as Parameters<typeof fetch>[1])
    if (!res.ok || !res.body) throw new Error(`下载失败（HTTP ${res.status}）`)
    const limitMb = Math.floor(maxBytes / 1024 / 1024)
    const declared = Number(res.headers.get('content-length') ?? 0)
    if (declared > maxBytes) throw new Error(`内容超过 ${limitMb}MB 上限`)
    const chunks: Buffer[] = []
    let total = 0
    for await (const chunk of res.body) {
      total += chunk.length
      if (total > maxBytes) throw new Error(`内容超过 ${limitMb}MB 上限`)
      chunks.push(Buffer.from(chunk as Uint8Array))
    }
    return Buffer.concat(chunks)
  } finally {
    clearTimeout(timer)
  }
}

/** 拉取并缓存远程索引；失败时**保留旧缓存**（网络抖动不该把市场清空） */
export async function refreshRemoteIndex(): Promise<{
  ok: boolean
  count: number
  shadowed: string[]
  fetchedAt?: number
  error?: string
}> {
  const url = getRemoteIndexUrl()
  if (!url) return { ok: false, count: 0, shadowed: [], error: '尚未配置远程索引地址' }
  try {
    const body = await fetchBoundedHttps(url, MAX_INDEX_BYTES)
    const plugins = parseMarketIndex(
      JSON.parse(body.toString('utf-8')),
      dirname(marketIndexPath()),
      {
        remote: true
      }
    ).plugins
    const fetchedAt = Date.now()
    writeRemoteCache({ url, fetchedAt, plugins })
    const merged = mergeMarketEntries(localMarketEntries(), plugins)
    return { ok: true, count: merged.plugins.length, shadowed: merged.shadowed, fetchedAt }
  } catch (error) {
    return { ok: false, count: 0, shadowed: [], error: (error as Error).message }
  }
}

/** 下载源解析（纯函数，可单测）：目录 / 本地 zip / 远端 zip */
export function resolveDownloadSource(
  download: string
): { kind: 'dir'; path: string } | { kind: 'zip'; path: string } | { kind: 'url'; url: string } {
  if (/^https?:\/\//i.test(download)) return { kind: 'url', url: download }
  if (/\.zip$/i.test(download) && existsSync(download) && statSync(download).isFile()) {
    return { kind: 'zip', path: download }
  }
  if (existsSync(download) && statSync(download).isDirectory())
    return { kind: 'dir', path: download }
  if (/\.zip$/i.test(download)) return { kind: 'zip', path: download }
  return { kind: 'dir', path: download }
}

/**
 * 在解压结果里定位包含 plugin.json 的目录（根目录或一层子目录），
 * 并做 realpath 包含校验（防 zip 内路径穿越 / 符号链接逃逸）。
 */
export function findManifestDir(root: string): string | null {
  const realRoot = realpathSync(root)
  const contained = (dir: string): boolean => {
    try {
      const real = realpathSync(dir)
      return real === realRoot || real.startsWith(realRoot + sep)
    } catch {
      return false
    }
  }
  if (existsSync(join(root, 'plugin.json')) && contained(root)) return root
  try {
    for (const entry of readdirSync(root, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const dir = join(root, entry.name)
      if (existsSync(join(dir, 'plugin.json')) && contained(dir)) return dir
    }
  } catch {
    /* ignore */
  }
  return null
}

/** 解压 zip（系统 unzip / PowerShell Expand-Archive），纯壳便于单测 */
export async function extractZip(zipPath: string, destDir: string): Promise<void> {
  if (process.platform === 'win32') {
    await execFileAsync('powershell', [
      '-NoProfile',
      '-NonInteractive',
      '-Command',
      `Expand-Archive -LiteralPath '${zipPath}' -DestinationPath '${destDir}' -Force`
    ])
  } else {
    await execFileAsync('unzip', ['-q', '-o', zipPath, '-d', destDir])
  }
}

async function downloadZip(url: string, destPath: string): Promise<void> {
  writeFileSync(destPath, await fetchBoundedHttps(url, MAX_DOWNLOAD_BYTES))
}

/** 文件 sha256（小写十六进制）。包体上限 20MB，整读比流式简单且够用 */
export async function sha256File(path: string): Promise<string> {
  return createHash('sha256').update(readFileSync(path)).digest('hex')
}

/** 从市场条目安装（IPC 入口，返回值与 installFromFolder IPC 一致） */
export async function installFromMarket(entryId: string): Promise<{
  success: boolean
  plugin?: InstalledPlugin
  error?: string
}> {
  let staging: string | null = null
  try {
    const item = listMarket().find((e) => e.id === entryId)
    if (!item) return { success: false, error: '索引中不存在该条目' }
    const source = resolveDownloadSource(item.download)

    let importDir: string
    if (source.kind === 'dir') {
      // 运行时再校验一次 realpath 包含关系：解析期检查后目录内容可被替换（符号链接逃逸）
      const indexDir = resolve(dirname(marketIndexPath()))
      const realDir = realpathSync(source.path)
      const realBase = realpathSync(indexDir)
      if (realDir !== realBase && !realDir.startsWith(realBase + sep)) {
        return { success: false, error: 'refused: 本地插件目录不在索引目录内' }
      }
      importDir = source.path
    } else {
      staging = mkdtempSync(join(tmpdir(), 'leaf-market-'))
      const zipPath = join(staging, 'pkg.zip')
      if (source.kind === 'url') {
        await downloadZip(source.url, zipPath)
      } else {
        copyFileSync(source.path, zipPath)
      }
      // 校验落在解压之前：损坏/被替换的包不该再经过解压这一步
      const mismatch = verifyPackageChecksum(item.sha256, await sha256File(zipPath))
      if (mismatch) return { success: false, error: mismatch }
      await extractZip(zipPath, join(staging, 'unpacked'))
      const manifestDir = findManifestDir(join(staging, 'unpacked'))
      if (!manifestDir) return { success: false, error: '压缩包中未找到 plugin.json' }
      importDir = manifestDir
    }
    // 审查 I5：市场安装与本地导入共用确认闸（未来索引联网化后此闸不可绕过）
    if (!(await confirmPluginImport(importDir))) {
      return { success: false, error: '已取消导入' }
    }
    const plugin = importFromFolder(importDir)
    return { success: true, plugin }
  } catch (error) {
    return { success: false, error: (error as Error).message }
  } finally {
    if (staging) rmSync(staging, { recursive: true, force: true })
  }
}
