import { app, shell, nativeImage } from 'electron'
import { join, isAbsolute } from 'path'
import { readFileSync, readdirSync, statSync, existsSync, mkdirSync, writeFileSync } from 'fs'
import { homedir, tmpdir } from 'os'
import { spawn, execFile, execFileSync } from 'child_process'
import plist from 'plist'
import { md5 } from 'js-md5'
import { typedHandle } from '../ipc/typedIpc'

export interface AppEntry {
  name: string
  path: string
  icon?: string
  /** 搜索别名：包名（英文名）+ 本地化显示名（中文用户按「谷歌 / 终端」搜应用的关键） */
  aliases?: string[]
}

// ─────────────────────────────────────────────────────────────
// 应用名（macOS）
// ─────────────────────────────────────────────────────────────

/**
 * 从 zh_CN / zh-Hans 的 InfoPlist.strings 提取本地化显示名（验收反馈 2026-09-18：
 * 应用索引只取 Info.plist 的 CFBundleDisplayName（多为英文），中文用户搜
 * 「谷歌浏览器 / 终端」等本地化名搜不到应用——本地化名作为搜索别称补齐）。
 * .strings 可能是 UTF-16 / UTF-8 文本或二进制 plist，二进制走系统 plutil 转换。
 */
function getLocalizedAppNames(appPath: string): string[] {
  const names: string[] = []
  const lprojDirs = ['zh_CN.lproj', 'zh-Hans.lproj', 'zh-Hans-CN.lproj']
  for (const dir of lprojDirs) {
    const stringsPath = join(appPath, 'Contents', 'Resources', dir, 'InfoPlist.strings')
    if (!existsSync(stringsPath)) continue
    let text: string | null = null
    try {
      const buf = readFileSync(stringsPath)
      if (buf.subarray(0, 8).toString('latin1') === 'bplist00') {
        // 二进制 plist：execFile 数组参数调 plutil，无 shell 注入面；失败静默跳过
        try {
          text = execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', stringsPath], {
            timeout: 2000
          }).toString('utf8')
          const parsed = JSON.parse(text) as Record<string, unknown>
          for (const key of ['CFBundleDisplayName', 'CFBundleName']) {
            const v = parsed[key]
            if (typeof v === 'string' && v.trim()) names.push(v.trim())
          }
          continue
        } catch {
          continue
        }
      } else if (buf[0] === 0xff && buf[1] === 0xfe) {
        text = buf.toString('utf16le')
      } else {
        text = buf.toString('utf8')
      }
    } catch {
      continue
    }
    if (!text) continue
    for (const key of ['CFBundleDisplayName', 'CFBundleName']) {
      // .strings 语法："key" = "value";（值内 \UXXXX 与 \" 转义）
      const m = text.match(new RegExp(`"${key}"\\s*=\\s*"((?:[^"\\\\]|\\\\.)*)"`, 'm'))
      if (!m?.[1]) continue
      const value = m[1]
        .replace(/\\U([0-9a-fA-F]{4})/g, (_all, h: string) => String.fromCharCode(parseInt(h, 16)))
        .replace(/\\(.)/g, '$1')
        .trim()
      if (value) names.push(value)
    }
  }
  return names
}

/** 批量本地化显示名脚本：NSFileManager.displayNameAtPath 是系统应用中文名
 * （终端 / 访达 / 活动监视器…）的唯一可靠来源；单进程承载全部路径（约 150 应用 <300ms） */
const LOCALIZED_NAME_JXA = `ObjC.import('Foundation')
function run(argv) {
  var paths = JSON.parse(argv[0])
  var fm = $.NSFileManager.defaultManager
  var out = {}
  paths.forEach(function (p) {
    var s = fm.displayNameAtPath($(p))
    if (s && !s.isNil()) { var v = ObjC.unwrap(s); if (v) out[p] = v }
  })
  return JSON.stringify(out)
}`

/** 批量取本地化显示名；失败返回空 Map（别称退化为包名 + .strings 本地化） */
function getLocalizedDisplayNames(paths: string[]): Promise<Map<string, string>> {
  return new Promise((resolve) => {
    if (paths.length === 0) {
      resolve(new Map())
      return
    }
    execFile(
      'osascript',
      ['-l', 'JavaScript', '-e', LOCALIZED_NAME_JXA, JSON.stringify(paths)],
      { timeout: 5000, maxBuffer: 1024 * 1024 },
      (error, stdout) => {
        if (error) {
          resolve(new Map())
          return
        }
        try {
          const parsed = JSON.parse(String(stdout)) as Record<string, string>
          const map = new Map<string, string>()
          for (const [p, name] of Object.entries(parsed)) if (name) map.set(p, name)
          resolve(map)
        } catch {
          resolve(new Map())
        }
      }
    )
  })
}

/**
 * 为每个应用挂搜索别称：包目录名（英文兜底，如 "Google Chrome"）+ 本地化显示名
 * （displayNameAtPath，如 "终端"）+ zh_CN InfoPlist.strings 本地化名。
 * 别名与显示名相同的去掉；mac 专属（.app 包结构）。
 */
async function attachAppAliases(entries: AppEntry[]): Promise<void> {
  const localized = await getLocalizedDisplayNames(
    entries.filter((e) => e.path.toLowerCase().endsWith('.app')).map((e) => e.path)
  )
  for (const entry of entries) {
    if (!entry.path.toLowerCase().endsWith('.app')) continue
    const base =
      entry.path
        .split('/')
        .pop()
        ?.replace(/\.app$/, '') ?? ''
    const nameLower = entry.name.trim().toLowerCase()
    const candidates = [base, localized.get(entry.path) ?? '', ...getLocalizedAppNames(entry.path)]
    const set = new Set<string>()
    for (const c of candidates) {
      if (c && c.toLowerCase() !== nameLower) set.add(c)
    }
    if (set.size > 0) entry.aliases = [...set]
  }
}

// 从 macOS .app 包的 Info.plist 中读取应用显示名称（CFBundleDisplayName 优先，支持中文）
function getAppDisplayName(appPath: string): string {
  try {
    const infoPlistPath = join(appPath, 'Contents', 'Info.plist')
    if (existsSync(infoPlistPath)) {
      const plistContent = readFileSync(infoPlistPath, 'utf-8')

      const keys = ['CFBundleDisplayName', 'CFBundleName', 'CFBundleExecutable']
      for (const key of keys) {
        const match = plistContent.match(
          new RegExp(`<key>${key}</key>\\s*<string>([^<]+)</string>`)
        )
        if (match?.[1]?.trim()) return match[1].trim()
      }
    }
  } catch {
    // 读取失败则回退到文件夹名
  }
  return (
    appPath
      .split('/')
      .pop()
      ?.replace(/\.app$/, '') || ''
  )
}

// ─────────────────────────────────────────────────────────────
// 图标：统一走 app.getFileIcon（原生提取，跨平台），替代旧的
// 「解析 plist → 找 .icns → sips 子进程转换」链路（无子进程、无 plist 遍历）。
//
// 传输走 image:// 文件 URL 而非 data URL：数百个 base64 图标组成的大对象
// 经 ipcMain.handle 结构化克隆序列化时会在 Electron 38 触发 ValueSerializer
// 原生崩溃（SIGTRAP），image:// URL 回复只有几百个小字符串。
// 缓存键 = md5(路径 + mtime)：应用更新（mtime 变化）后自动重新提取，无过期图标。
// ─────────────────────────────────────────────────────────────

const ICON_CONCURRENCY = 24
const iconDir = join(tmpdir(), 'LeafAppIcons')
if (!existsSync(iconDir)) {
  mkdirSync(iconDir, { recursive: true })
}

/** 进程内图标缓存：key = md5(path+mtime)，value = image:// URL；空串 = 已知无图标 */
const iconMemoryCache = new Map<string, string | undefined>()

function bundleMtime(appPath: string): number {
  try {
    return statSync(appPath).mtimeMs
  } catch {
    return 0
  }
}

/**
 * 应用包元数据（胶囊右侧详情用，见 ApplicationCommandProvider 的函数型 detail）。
 * Info.plist 可能是 XML 也可能是二进制，统一交给系统 plutil 转 JSON——数组参数调用，
 * 无 shell 注入面。只接受绝对路径下的 .app，否则这条通道会被拿去探测任意文件。
 */
export function readAppBundleInfo(appPath: string): {
  bundleId: string | null
  version: string | null
  buildVersion: string | null
  executable: string | null
  modifiedMs: number | null
} {
  const empty = {
    bundleId: null,
    version: null,
    buildVersion: null,
    executable: null,
    modifiedMs: null
  } as const
  if (typeof appPath !== 'string' || !isAbsolute(appPath) || !appPath.endsWith('.app')) {
    return { ...empty }
  }
  const infoPlist = join(appPath, 'Contents', 'Info.plist')
  if (!existsSync(infoPlist)) return { ...empty }
  let json = ''
  try {
    json = execFileSync('/usr/bin/plutil', ['-convert', 'json', '-o', '-', infoPlist], {
      timeout: 2000
    }).toString('utf8')
  } catch {
    return { ...empty }
  }
  try {
    const p = JSON.parse(json) as Record<string, unknown>
    const str = (v: unknown): string | null => (typeof v === 'string' && v.trim() ? v.trim() : null)
    const mtime = bundleMtime(appPath)
    return {
      bundleId: str(p.CFBundleIdentifier),
      version: str(p.CFBundleShortVersionString),
      buildVersion: str(p.CFBundleVersion),
      executable: str(p.CFBundleExecutable),
      modifiedMs: mtime || null
    }
  } catch {
    return { ...empty }
  }
}

async function getAppIcon(appPath: string): Promise<string | undefined> {
  const key = md5(`${appPath}|${bundleMtime(appPath)}`)
  if (iconMemoryCache.has(key)) return iconMemoryCache.get(key)

  const iconPath = join(iconDir, `${key}.png`)
  if (existsSync(iconPath)) {
    const url = `image://${iconPath}`
    iconMemoryCache.set(key, url)
    return url
  }

  try {
    // size 只能用 'normal'（32px）：'large' 在 macOS/Windows 上不受支持，
    // 传入会触发 Electron 底层 CHECK 崩溃（SIGTRAP）
    const icon = await app.getFileIcon(appPath, { size: 'normal' })
    if (icon.isEmpty()) {
      iconMemoryCache.set(key, undefined)
      return undefined
    }
    writeFileSync(iconPath, icon.toPNG())
    const url = `image://${iconPath}`
    iconMemoryCache.set(key, url)
    return url
  } catch {
    iconMemoryCache.set(key, undefined)
    return undefined
  }
}

/**
 * 有限并发地逐项取图标，避免首扫时瞬时起数百个原生调用。
 * 注意：崩溃根因是 getFileIcon 的 size:'large'（macOS 不支持，见上），
 * 与并发无关；并发仅用于控制首扫瞬时压力。
 */
async function attachIcons(entries: AppEntry[]): Promise<void> {
  let next = 0
  const workers = Array.from({ length: Math.min(ICON_CONCURRENCY, entries.length) }, async () => {
    while (next < entries.length) {
      const entry = entries[next++]
      entry.icon = await getAppIcon(entry.path)
    }
  })
  await Promise.all(workers)
}

// ─────────────────────────────────────────────────────────────
// macOS
// ─────────────────────────────────────────────────────────────

// 标准 App 目录（system_profiler 会把磁盘上所有 .app 都列出来，需按前缀过滤）
const MAC_STANDARD_APP_DIRS = [
  '/Applications',
  '/System/Applications',
  '/System/Library/CoreServices/Applications',
  join(homedir(), 'Applications')
]

// 目录扫描的回退根目录（比前缀表多出 Utilities 子目录）
const MAC_SCAN_DIRS = [
  ...MAC_STANDARD_APP_DIRS,
  '/Applications/Utilities',
  '/System/Applications/Utilities'
]

/** 噪音过滤：不在标准目录、或嵌套在其它 .app 包内的子应用（如 Xcode 的 Instruments） */
function isNoiseAppPath(p: string): boolean {
  const lower = p.toLowerCase()
  const inStandard = MAC_STANDARD_APP_DIRS.some((dir) => lower.startsWith(dir.toLowerCase() + '/'))
  if (!inStandard) return true
  if (lower.includes('.app/')) return true
  return false
}

/** system_profiler 单次调用（带超时；失败/超时返回 null，由调用方回退目录扫描） */
function runSystemProfiler(timeoutMs = 15000): Promise<string | null> {
  return new Promise((resolve) => {
    let out = ''
    let settled = false
    const child = spawn('/usr/sbin/system_profiler', [
      '-xml',
      '-detailLevel',
      'mini',
      'SPApplicationsDataType'
    ])

    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill()
      resolve(null)
    }, timeoutMs)

    child.stdout.on('data', (chunk) => {
      out += chunk.toString()
    })
    child.on('error', () => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(null)
    })
    child.on('exit', (code) => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve(code === 0 && out ? out : null)
    })
  })
}

async function scanMacAppDirs(): Promise<AppEntry[]> {
  const entries: AppEntry[] = []
  for (const dir of MAC_SCAN_DIRS) {
    if (!existsSync(dir)) continue
    let items: string[] = []
    try {
      items = readdirSync(dir)
    } catch {
      continue
    }
    for (const item of items) {
      if (!item.endsWith('.app')) continue
      const p = join(dir, item)
      try {
        if (!statSync(p).isDirectory()) continue
      } catch {
        continue
      }
      entries.push({ name: getAppDisplayName(p), path: p })
    }
  }
  return entries
}

async function listMacApps(): Promise<AppEntry[]> {
  let entries: AppEntry[] = []

  const xml = await runSystemProfiler()
  if (xml !== null) {
    try {
      const parsed = plist.parse(xml) as Array<{
        _items?: Array<{ _name?: string; path?: string }>
      }>
      const items = parsed?.[0]?._items
      if (Array.isArray(items)) {
        for (const item of items) {
          const p = item.path || ''
          if (p.split('.').pop()?.toLowerCase() !== 'app') continue
          if (isNoiseAppPath(p)) continue
          const name =
            item._name ||
            p
              .split('/')
              .pop()
              ?.replace(/\.app$/, '') ||
            ''
          if (!name) continue
          entries.push({ name, path: p })
        }
      }
    } catch (err) {
      console.error('Failed to parse system_profiler output:', err)
      entries = []
    }
  }

  // system_profiler 失败 / 超时 / 解析失败 → 目录扫描兜底
  if (entries.length === 0) {
    console.warn('system_profiler unavailable, falling back to directory scan')
    entries = await scanMacAppDirs()
  }

  // 同名去重（同一应用常见于 /Applications 与 ~/Applications 各一份），优先保留 /Applications
  const byName = new Map<string, AppEntry>()
  for (const entry of entries) {
    const key = entry.name.trim().toLowerCase()
    if (!key) continue
    const existing = byName.get(key)
    if (!existing) {
      byName.set(key, entry)
      continue
    }
    const entryPreferred = entry.path.toLowerCase().startsWith('/applications/')
    const existingPreferred = existing.path.toLowerCase().startsWith('/applications/')
    if (entryPreferred && !existingPreferred) byName.set(key, entry)
  }

  const deduped = Array.from(byName.values())
  await attachAppAliases(deduped)
  await attachIcons(deduped)
  return deduped
}

// ─────────────────────────────────────────────────────────────
// Windows
// ─────────────────────────────────────────────────────────────

async function listWindowsApps(): Promise<AppEntry[]> {
  const entries: AppEntry[] = []
  const seen = new Set<string>()
  const pushEntry = (name: string, p: string): void => {
    if (!name || !p || seen.has(p.toLowerCase())) return
    seen.add(p.toLowerCase())
    entries.push({ name, path: p })
  }

  // 开始菜单：递归（≤3 层）收集 .lnk / .exe——多数快捷方式在子文件夹里，只扫顶层会漏掉大半
  const startMenu = process.env.APPDATA
    ? join(process.env.APPDATA, 'Microsoft\\Windows\\Start Menu\\Programs')
    : ''
  const walk = (dir: string, depth: number): void => {
    if (depth > 3) return
    let items: string[] = []
    try {
      items = readdirSync(dir)
    } catch {
      return
    }
    for (const item of items) {
      const p = join(dir, item)
      try {
        if (statSync(p).isDirectory()) {
          walk(p, depth + 1)
          continue
        }
        if (/\.(lnk|exe)$/i.test(item)) {
          pushEntry(item.replace(/\.(lnk|exe)$/i, ''), p)
        }
      } catch {
        continue
      }
    }
  }
  if (startMenu) walk(startMenu, 0)

  // Program Files：只收「直接包含 .exe 的顶层目录」（指向首个 exe，保证可启动），
  // 其余纯资源目录（Common Files、Microsoft 等）不再误报为应用
  for (const basePath of ['C:\\Program Files', 'C:\\Program Files (x86)']) {
    let items: string[] = []
    try {
      items = readdirSync(basePath)
    } catch {
      continue
    }
    for (const item of items) {
      const p = join(basePath, item)
      try {
        if (!statSync(p).isDirectory()) {
          if (/\.(exe|lnk)$/i.test(item)) {
            pushEntry(item.replace(/\.(exe|lnk)$/i, ''), p)
          }
          continue
        }
        const exe = readdirSync(p).find((f) => /\.exe$/i.test(f))
        if (exe) pushEntry(item, join(p, exe))
      } catch {
        continue
      }
    }
  }

  await attachIcons(entries)
  return entries
}

// ─────────────────────────────────────────────────────────────
// Linux
// ─────────────────────────────────────────────────────────────

function parseDesktopFile(content: string): {
  name?: string
  type?: string
  hidden?: boolean
  noDisplay?: boolean
  iconPath?: string
} {
  const get = (key: string): string | undefined => {
    const m = content.match(new RegExp(`^${key}=(.*)$`, 'm'))
    return m?.[1]?.trim()
  }
  return {
    name: get('Name'),
    type: get('Type'),
    hidden: get('Hidden') === 'true',
    noDisplay: get('NoDisplay') === 'true',
    iconPath: get('Icon')
  }
}

async function listLinuxApps(): Promise<AppEntry[]> {
  const entries: AppEntry[] = []
  const iconHints = new Map<string, string>()
  const seen = new Set<string>()

  const dirs = ['/usr/share/applications', join(homedir(), '.local/share/applications')]
  for (const dir of dirs) {
    let items: string[] = []
    try {
      items = readdirSync(dir)
    } catch {
      continue
    }
    for (const item of items) {
      if (!item.endsWith('.desktop')) continue
      const p = join(dir, item)
      if (seen.has(p)) continue
      seen.add(p)
      try {
        const entry = parseDesktopFile(readFileSync(p, 'utf-8'))
        // 跳过隐藏项与非应用条目；Name= 优先于文件名（否则列表里全是 org.gnome.xxx）
        if (entry.hidden || entry.noDisplay) continue
        if (entry.type && entry.type !== 'Application') continue
        if (entry.iconPath && isAbsolute(entry.iconPath)) iconHints.set(p, entry.iconPath)
        entries.push({ name: entry.name || item.replace(/\.desktop$/, ''), path: p })
      } catch {
        continue
      }
    }
  }

  await attachIcons(entries)

  // getFileIcon 拿不到时，回退到 Icon= 的绝对路径
  for (const entry of entries) {
    if (entry.icon) continue
    const hint = iconHints.get(entry.path)
    if (!hint) continue
    try {
      const img = nativeImage.createFromPath(hint)
      if (!img.isEmpty()) entry.icon = img.resize({ width: 48, height: 48 }).toDataURL()
    } catch {
      // 忽略图标读取失败
    }
  }
  return entries
}

// ─────────────────────────────────────────────────────────────
// 汇总 + 缓存（stale-while-revalidate）
// ─────────────────────────────────────────────────────────────

async function fetchApplicationsList(): Promise<AppEntry[]> {
  let apps: AppEntry[]
  if (process.platform === 'darwin') {
    apps = await listMacApps()
  } else if (process.platform === 'win32') {
    apps = await listWindowsApps()
  } else {
    apps = await listLinuxApps()
  }
  return apps.sort((a, b) => a.name.localeCompare(b.name))
}

interface ApplicationsCache {
  applications: AppEntry[]
  timestamp: number
}

let applicationsCache: ApplicationsCache | null = null
let inflightFetch: Promise<AppEntry[]> | null = null
// system_profiler 冷扫要 5-15s，TTL 太短会让用户频繁白等；过期后先回旧数据再后台刷新
const CACHE_TTL = 24 * 60 * 60 * 1000

/** 并发去重：get / refresh / 后台刷新同时触发时只跑一次真实扫描 */
function fetchApplicationsListDeduped(): Promise<AppEntry[]> {
  if (!inflightFetch) {
    inflightFetch = fetchApplicationsList().finally(() => {
      inflightFetch = null
    })
  }
  return inflightFetch
}

function startBackgroundRefresh(): void {
  void fetchApplicationsListDeduped()
    .then((apps) => {
      applicationsCache = { applications: apps, timestamp: Date.now() }
    })
    .catch((err) => {
      console.error('Background applications refresh failed:', err)
    })
}

export function registerApplicationsIpcHandlers(): void {
  // 获取本地应用列表：新鲜缓存直接回；过期缓存立即回旧数据 + 后台静默刷新；无缓存才同步等待扫描
  typedHandle('get-applications', async () => {
    const now = Date.now()
    if (applicationsCache && now - applicationsCache.timestamp < CACHE_TTL) {
      return applicationsCache.applications
    }
    if (applicationsCache) {
      startBackgroundRefresh()
      return applicationsCache.applications
    }
    try {
      const applications = await fetchApplicationsListDeduped()
      applicationsCache = { applications, timestamp: Date.now() }
      return applications
    } catch (error) {
      console.error('Failed to get applications:', error)
      return applicationsCache?.applications ?? []
    }
  })

  // 强制刷新（用户点击刷新按钮 / ⌘R）：真实重扫
  typedHandle('refresh-applications', async () => {
    try {
      const applications = await fetchApplicationsListDeduped()
      applicationsCache = { applications, timestamp: Date.now() }
      return applications
    } catch (error) {
      console.error('Failed to refresh applications:', error)
      return applicationsCache?.applications ?? []
    }
  })

  // 启动应用：渲染端传来的路径必须校验（绝对路径 + 可启动类型 + 存在），
  // 防止被攻陷的渲染进程借此打开任意文件（校验实现见下方 launchApplicationPath）
  typedHandle('launch-application', async (_event, { appPath }) => {
    return launchApplicationPath(appPath)
  })
  typedHandle('applications:readInfo', (_event, { appPath }) =>
    readAppBundleInfo(String(appPath ?? ''))
  )
}

/** 启动应用路径校验 + 执行（IPC 与统一动作执行端 actionHandlers 共用，#4） */
const launchablePath = /\.(app|exe|lnk|desktop)$/i
export async function launchApplicationPath(appPath: unknown): Promise<{
  success: boolean
  error?: string
}> {
  if (typeof appPath !== 'string' || !appPath) {
    return { success: false, error: '无效的应用路径' }
  }
  if (!isAbsolute(appPath)) {
    return { success: false, error: '应用路径必须是绝对路径' }
  }
  if (!launchablePath.test(appPath)) {
    return { success: false, error: '不支持启动该类型的文件' }
  }
  if (!existsSync(appPath)) {
    return { success: false, error: '应用不存在或已被卸载' }
  }
  try {
    const error = await shell.openPath(appPath)
    // shell.openPath 成功时返回空字符串，失败时返回错误信息
    if (error) return { success: false, error }
    return { success: true }
  } catch (error) {
    console.error('Failed to launch application:', error)
    return { success: false, error: String(error) }
  }
}
