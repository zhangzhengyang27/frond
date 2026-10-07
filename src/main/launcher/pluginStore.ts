/**
 * Frond · 启动器插件仓库
 *
 * 自研插件（安全收紧路线）：本地目录包，不经 npm 安装链路。
 * 目录结构：userData/launcher-plugins/<pluginId>/（plugin.json + 静态页面）
 * 索引：userData/launcher-plugins/installed.json（启停状态 / 导入来源）
 *
 * plugin.json 清单：
 * {
 *   "id": "com.frond.example",       // 必填，反向域名，作为目录名与数据命名空间
 *   "name": "示例插件",              // 必填
 *   "version": "0.1.0",
 *   "description": "…",
 *   "main": "index.html",           // 插件入口页（相对插件目录，默认 index.html）
 *   "icon": "icon.png",             // 可选，相对路径
 *   "devServer": "http://…",        // 可选，开发模式直接加载该 URL（忽略 main）
 *   "commands": [{ "code": "hello", "title": "Hello", "description": "…" }]
 * }
 */
import { app } from 'electron'
import { join, resolve, basename, sep } from 'path'
import {
  type PluginPreferenceDeclaration,
  isPluginPermission,
  sanitizePluginArguments,
  sanitizePluginCommandMode,
  type PluginArgument,
  type PluginApiMode,
  type PluginCommandMode,
  sanitizePluginPreferences
} from '../../shared/plugin-protocol'
import { getLauncherDocStore } from './docStore'
import {
  appendFileSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
  renameSync,
  rmSync,
  cpSync,
  realpathSync
} from 'fs'
import { log } from '../services/LogService'

export interface PluginCommand {
  code: string
  title: string
  description?: string
  /** 命令形态（对标 Raycast）：缺省 'view'；'action' = 无界面执行，不挂插件视图 */
  mode?: PluginCommandMode
  /** 命令参数声明（多参数命令，宿主清洗后经胶囊参数表单收集；上限 3，对标 Raycast） */
  arguments?: PluginArgument[]
}

/** M3.2：插件声明式偏好（管理页自动渲染表单，值存 launcher_docs kv）。
 *  键名/形状与清洗器都在 shared/plugin-protocol.ts，这里只做别名，避免两处漂移。 */
export type PluginPreference = PluginPreferenceDeclaration

export interface PluginManifest {
  id: string
  name: string
  version?: string | undefined
  description?: string
  main?: string
  icon?: string
  devServer?: string
  commands?: PluginCommand[]
  /** M3.2：偏好声明（宿主渲染设置表单） */
  preferences?: PluginPreference[]
  /** #5 插件双通道：声明后插件可经 submitSearchItems 向根搜索贡献条目（仅 === true 生效） */
  searchable?: boolean
  /** #11 React 视图协议：'react' = 插件经 renderView 提交视图树（缺省 'data' = renderList） */
  api?: PluginApiMode
  /** 敏感权限声明（声明制，见 shared/plugin-protocol.ts）；未知值在读取时剔除 */
  permissions?: string[]
}

/** P-3.4 来源审计：插件从哪条链装进来的（随 installed.json 持久化；旧数据缺省 = UI 按「未知」处理） */
export type PluginOriginKind = 'builtin' | 'market' | 'local' | 'dev'
export interface PluginOrigin {
  kind: PluginOriginKind
  /** 细化引用：市场来源（bundled/curated/remote）、导入目录、dev 目录等自由文本 */
  ref?: string
}

export interface InstalledPlugin extends PluginManifest {
  enabled: boolean
  /** 导入来源目录（dev 插件指向开发目录） */
  sourcePath?: string
  installedAt: number
  /** 最近一次更新时间（isUpdate 路径写入；首装无此字段） */
  updatedAt?: number
  /** 来源（P-3.4 之前安装的插件无此字段） */
  origin?: PluginOrigin
}

let cachedRoot: string | null = null

/** 插件根目录（惰性：app.getPath 需要应用就绪，也便于单测不触碰 electron） */
function pluginsRoot(): string {
  if (!cachedRoot) {
    cachedRoot = join(app.getPath('userData'), 'launcher-plugins')
  }
  return cachedRoot
}

function indexPath(): string {
  return join(pluginsRoot(), 'installed.json')
}

function ensureRoot(): void {
  if (!existsSync(pluginsRoot())) {
    mkdirSync(pluginsRoot(), { recursive: true })
  }
}

function readIndex(): InstalledPlugin[] {
  ensureRoot()
  try {
    return JSON.parse(readFileSync(indexPath(), 'utf-8')) as InstalledPlugin[]
  } catch (error) {
    if (!existsSync(indexPath())) return []
    // 索引损坏：留档坏文件并按磁盘插件目录重建（启用状态重置为启用）
    console.error('[Launcher] installed.json 损坏，尝试重建:', (error as Error).message)
    try {
      rmSync(indexPath())
    } catch (e) {
      // 批 7b 空 catch 清账（原注释：* ignore）
      log.debug('plugin-store', '* ignore', e)
    }
    return rebuildIndexFromDisk()
  }
}

/** 扫描插件根目录下的 plugin.json 重建索引（installed.json 损坏时的自愈路径） */
function rebuildIndexFromDisk(): InstalledPlugin[] {
  const rebuilt: InstalledPlugin[] = []
  try {
    for (const entry of readdirSync(pluginsRoot(), { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      try {
        const manifest = readManifest(join(pluginsRoot(), entry.name))
        rebuilt.push({ ...manifest, id: entry.name, enabled: true, installedAt: Date.now() })
      } catch (e) {
        console.warn('[Launcher] 重建索引跳过', entry.name, (e as Error).message)
      }
    }
  } catch (e) {
    // 批 7b 空 catch 清账（原注释：* ignore）
    log.debug('plugin-store', '* ignore', e)
  }
  if (rebuilt.length > 0) writeIndex(rebuilt)
  return rebuilt
}

function writeIndex(plugins: InstalledPlugin[]): void {
  ensureRoot()
  // 原子写：先写临时文件再替换，避免中途崩溃留下截断 JSON
  const tmpFile = `${indexPath()}.tmp-${process.pid}`
  writeFileSync(tmpFile, JSON.stringify(plugins, null, 2))
  rmSync(indexPath(), { force: true })
  renameSync(tmpFile, indexPath())
}

// ─────────── 来源审计（P-3.4）：userData/launcher-plugins/audit.jsonl ───────────

export interface PluginAuditEntry {
  ts: number
  pluginId: string
  action: 'install' | 'update' | 'remove'
  fromVersion?: string
  toVersion?: string
  origin?: PluginOrigin
}

function auditFilePath(): string {
  return join(pluginsRoot(), 'audit.jsonl')
}

/** 审计追加失败只记日志：审计是旁路观测，绝不能反过来挡安装/卸载 */
function appendAudit(entry: PluginAuditEntry): void {
  try {
    ensureRoot()
    appendFileSync(auditFilePath(), `${JSON.stringify(entry)}\n`, 'utf-8')
  } catch (e) {
    log.debug('plugin-store', 'audit append failed', e)
  }
}

/** 旧安装的来源回填（builtin 启动链用）：只在缺失时写，不覆盖已有 origin */
export function setPluginOriginIfMissing(pluginId: string, origin: PluginOrigin): void {
  const index = readIndex()
  const target = index.find((p) => p.id === pluginId)
  if (!target || target.origin) return
  target.origin = origin
  writeIndex(index)
}

/** 插件安装目录（协议服务/卸载都以它为根） */
export function pluginDir(pluginId: string): string {
  return join(pluginsRoot(), pluginId)
}

/** 校验插件 id：反向域名或字母数字连字符，防目录穿越；sys.* 为宿主保留命名空间 */
export function isValidPluginId(id: string): boolean {
  return (
    /^[\w](?:[\w.-]*[\w])?$/.test(id) && !id.includes('..') && !id.toLowerCase().startsWith('sys.')
  )
}

/** 解析插件内相对路径（以插件根目录为根） */
export function resolvePluginFile(pluginId: string, relativePath: string): string | null {
  return resolvePluginFileIn(pluginsRoot(), pluginId, relativePath)
}

/** 纯函数版本（可单测）：解析并确保目标不逃逸出 <root>/<pluginId> 目录 */
export function resolvePluginFileIn(
  root: string,
  pluginId: string,
  relativePath: string
): string | null {
  if (!isValidPluginId(pluginId)) return null
  const dir = join(root, pluginId)
  if (!existsSync(dir)) return null
  const target = resolve(dir, relativePath)
  const realDir = realpathSync(dir)
  const realTarget = realpathSyncSafe(target)
  // 必须带分隔符前缀校验：否则 com.a 可经 ../com.ab 读到兄弟插件目录
  if (realTarget !== realDir && !realTarget.startsWith(realDir + sep)) return null
  return existsSync(realTarget) ? realTarget : null
}

/** realpathSync 的容错封装：目标不存在时返回 null（避免抛错） */
function realpathSyncSafe(target: string): string {
  try {
    return realpathSync(target)
  } catch {
    return target
  }
}

/** 读取并校验目录下的 plugin.json（devPlugins 热重载等场景复用同一校验） */
export function readManifest(dir: string): PluginManifest {
  const manifestPath = join(dir, 'plugin.json')
  if (!existsSync(manifestPath)) {
    throw new Error('目录中不存在 plugin.json')
  }
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest
  if (!manifest.id || !isValidPluginId(manifest.id)) {
    throw new Error(`plugin.json 的 id 非法：${String(manifest.id)}`)
  }
  if (!manifest.name) {
    throw new Error('plugin.json 缺少 name')
  }
  // 统一小写：标准 scheme 的 host 会被 URL 解析器小写化，大小写敏感文件系统上会 404
  manifest.id = manifest.id.toLowerCase()
  if (manifest.devServer && !/^https?:\/\//i.test(manifest.devServer)) {
    throw new Error('devServer 仅支持 http(s) 地址')
  }
  // 权限声明归一：非数组视为未声明；数组内未知值剔除（fail-closed——拼错权限名等于没声明）
  if (Array.isArray(manifest.permissions)) {
    manifest.permissions = manifest.permissions.filter((v) => isPluginPermission(v))
  } else if (manifest.permissions !== undefined) {
    delete manifest.permissions
  }
  // api 模式归一：仅接受 'react'，其余（含拼错值）一律视为 'data'（fail-closed）
  if (manifest.api === 'react') {
    manifest.api = 'react'
  } else if (manifest.api !== undefined) {
    delete manifest.api
  }
  // 偏好声明清洗（fail-closed）：此前 manifest.preferences 是**整段照收**的，
  // 类型写错、label 缺失、select 没有候选都会悄悄流到读取端（插件拿到 undefined，
  // 用户以为自己没填）。清洗器见 sanitizePluginPreferences
  if (manifest.preferences !== undefined) {
    const cleaned = sanitizePluginPreferences(manifest.preferences)
    if (cleaned.length) manifest.preferences = cleaned
    else delete manifest.preferences
  }
  // 命令参数声明清洗（fail-closed）：非法项剔除 / 非法类型降级 / 数量封顶，
  // 见 shared/plugin-protocol.ts sanitizePluginArguments
  if (Array.isArray(manifest.commands)) {
    for (const cmd of manifest.commands) {
      if (typeof cmd !== 'object' || cmd === null) continue
      const c = cmd
      // 命令形态清洗（fail-closed）：只认 view/action，其余按缺省 view
      const mode = sanitizePluginCommandMode(c.mode)
      if (mode) c.mode = mode
      else delete c.mode
      if ('arguments' in c) {
        const cleaned = sanitizePluginArguments(c.arguments)
        if (cleaned.length > 0) c.arguments = cleaned
        else delete c.arguments
      }
    }
  }
  if (manifest.devServer) {
    // devServer 页面持有完整 launcherApi，明文 http 可被 MITM 持续注入 JS：
    // 远程地址必须 https，http 仅限本机开发服务器
    const devUrl = new URL(manifest.devServer)
    const host = devUrl.hostname.toLowerCase()
    const isLocalHost =
      host === 'localhost' || host.endsWith('.localhost') || host === '127.0.0.1' || host === '::1'
    if (devUrl.protocol === 'http:' && !isLocalHost) {
      throw new Error('devServer 明文 http 仅允许本机地址，远程开发地址请使用 https')
    }
  }
  return manifest
}

export function listPlugins(): InstalledPlugin[] {
  return readIndex().sort((a, b) => a.id.localeCompare(b.id))
}

export function getPlugin(pluginId: string): InstalledPlugin | undefined {
  return readIndex().find((p) => p.id === pluginId)
}

/** 启用的插件（搜索命令来源） */
export function listEnabledPlugins(): InstalledPlugin[] {
  return readIndex().filter((p) => p.enabled)
}

/**
 * 从本地目录导入插件。
 * devServer 插件只拷贝 plugin.json（页面由 dev server 提供）；普通插件整目录拷贝。
 *
 * opts.isUpdate（P-3.2 更新路径）：保留用户的启停状态与首次安装时间——
 * 此前覆盖式更新会把已停用的插件悄悄拉回启用；首装路径维持 enabled:true 不变。
 */
export function importFromFolder(
  srcDir: string,
  opts?: { origin?: PluginOrigin; isUpdate?: boolean }
): InstalledPlugin {
  const absSrc = resolve(srcDir)
  if (!existsSync(absSrc)) {
    throw new Error('目录不存在')
  }
  const manifest = readManifest(absSrc)
  ensureRoot()

  const dest = pluginDir(manifest.id)
  // 先拷到临时目录，成功后再与旧安装交换（拷贝失败不破坏现有安装）
  const staging = `${dest}.staging-${Date.now()}`
  rmSync(staging, { recursive: true, force: true })
  mkdirSync(staging, { recursive: true })

  if (manifest.devServer) {
    // dev 插件：只收清单，页面由 dev server 提供
    cpSync(join(absSrc, 'plugin.json'), join(staging, 'plugin.json'))
  } else {
    cpSync(absSrc, staging, { recursive: true })
  }
  rmSync(dest, { recursive: true, force: true })
  renameSync(staging, dest)

  const index = readIndex()
  const existing = index.find((p) => p.id === manifest.id)
  const isUpdate = opts?.isUpdate === true
  const installed: InstalledPlugin = {
    ...manifest,
    enabled: isUpdate && existing ? existing.enabled : true,
    sourcePath: absSrc,
    installedAt: isUpdate && existing ? existing.installedAt : Date.now(),
    ...(isUpdate ? { updatedAt: Date.now() } : {}),
    ...(opts?.origin ? { origin: opts.origin } : {})
  }
  const next = index.filter((p) => p.id !== manifest.id)
  next.push(installed)
  writeIndex(next)
  appendAudit({
    ts: Date.now(),
    pluginId: manifest.id,
    action: isUpdate ? 'update' : 'install',
    ...(existing?.version ? { fromVersion: existing.version } : {}),
    ...(manifest.version ? { toVersion: manifest.version } : {}),
    ...(opts?.origin ? { origin: opts.origin } : {})
  })
  return installed
}

export function removePlugin(pluginId: string): void {
  // rmSync recursive 的删除根由 pluginId 拼出：不过 isValidPluginId 的话，
  // 被攻陷渲染端传 '../../..' 就是递归删任意目录（B40）
  if (!isValidPluginId(pluginId)) throw new Error(`非法插件 id，已拒绝卸载: ${pluginId}`)
  const index = readIndex()
  const removed = index.find((p) => p.id === pluginId)
  writeIndex(index.filter((p) => p.id !== pluginId))
  rmSync(pluginDir(pluginId), { recursive: true, force: true })
  if (removed) {
    appendAudit({
      ts: Date.now(),
      pluginId,
      action: 'remove',
      ...(removed.version ? { fromVersion: removed.version } : {}),
      ...(removed.origin ? { origin: removed.origin } : {})
    })
  }
  // 卸载即清理插件命名空间 KV（launcher_docs），避免卸载重装后读到旧数据
  try {
    getLauncherDocStore().deleteByPlugin(pluginId)
  } catch (e) {
    // 批 7b 空 catch 清账（原注释：* 数据库未就绪（极早启动）时跳过：卸载重装场景 KV 本就应清空， 此处失败仅残留数据，不影响功能）
    log.debug(
      'plugin-store',
      '* 数据库未就绪（极早启动）时跳过：卸载重装场景 KV 本就应清空， 此处失败仅残留数据，不影响功能',
      e
    )
  }
}

export function setPluginEnabled(pluginId: string, enabled: boolean): InstalledPlugin | undefined {
  const index = readIndex()
  const target = index.find((p) => p.id === pluginId)
  if (!target) return undefined
  target.enabled = enabled
  writeIndex(index)
  return target
}

/** 插件入口 URL：devServer 优先，否则 plugin:// 协议 */
export function pluginEntryUrl(plugin: InstalledPlugin): string {
  if (plugin.devServer) return plugin.devServer
  const main = plugin.main || 'index.html'
  return `plugin://${plugin.id}/${main}`
}

/** 插件图标 URL（无图标返回空串，由渲染端兜底） */
export function pluginIconUrl(plugin: InstalledPlugin): string {
  if (plugin.devServer || !plugin.icon) return ''
  return `plugin://${plugin.id}/${plugin.icon}`
}

/** 供日志/管理页展示的目录名 */
export function pluginDisplayName(plugin: InstalledPlugin): string {
  return `${plugin.name} (${basename(pluginDir(plugin.id))})`
}

export { pluginsRoot as getPluginsRoot }
