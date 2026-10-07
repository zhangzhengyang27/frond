/**
 * Frond · 内置插件自动安装
 *
 * 应用启动时扫描 resources/plugins/ 下的内置插件，
 * 未安装的自动安装（importFromFolder），已安装的跳过。
 * 内置插件开箱即用，用户仍可在管理页禁用/卸载。
 *
 * 设计：
 * - 只在首次启动或**内置版本确实更新**时安装/更新（semver 比较，见 decideBuiltinInstall；
 *   只比较「更新」意味着市场上装的更高版本同 id 插件不会被启动链降级覆盖）
 * - 更新保留用户的启停状态（importFromFolder isUpdate 路径）
 * - 来源与版本变化落 audit.jsonl（P-3.4）；同版本跳过时回填缺失的来源标记
 * - 安装失败不阻塞应用启动（仅日志警告）
 */
import { app } from 'electron'
import { join, resolve } from 'path'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { importFromFolder, listPlugins, setPluginOriginIfMissing, type PluginManifest } from './pluginStore'
import { compareSemver } from './market'

export type BuiltinInstallDecision = 'install' | 'update' | 'skip'

/**
 * 内置插件安装决策（纯函数，可单测）：
 * - 未安装 → install
 * - 已安装：只在**内置版本确实更新**时 update（semver 比较）——旧逻辑「版本不等就重装」
 *   会把用户从市场装的更高版本同 id 插件在每次启动时降级覆盖回内置版
 * - 任一侧版本解析不出 semver：退回「不等即更新」（与 market.isUpdatable 同一兜底）
 * - 内置件没有 version → 永远 skip（沿用旧规则：无版本号不参与更新）
 */
export function decideBuiltinInstall(
  existing: { version?: string | undefined } | undefined,
  incoming: { version?: string | undefined }
): BuiltinInstallDecision {
  if (!existing) return 'install'
  if (!incoming.version) return 'skip'
  if (!existing.version) return 'update'
  const c = compareSemver(incoming.version, existing.version)
  if (c === null) return incoming.version !== existing.version ? 'update' : 'skip'
  return c === 1 ? 'update' : 'skip'
}

/**
 * 内置插件目录（按启动形态解析，依次尝试候选）：
 * - 打包态 → resources/plugins/
 * - dev（electron . / electron-vite dev）→ 仓库根 plugins/（getAppPath 即仓库根）
 * - e2e / electron-vite preview（electron out/main/index.js）→ getAppPath 是
 *   out/main，仓库根 plugins 在两级之上——候选回退，避免内置插件静默缺失
 */
export function builtinPluginsDir(): string {
  if (app.isPackaged) return join(process.resourcesPath, 'plugins')
  const appPath = app.getAppPath()
  const candidates = [join(appPath, 'plugins'), resolve(appPath, '../../plugins')]
  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate
  }
  return candidates[0] ?? ''
}

/** 读取目录下的 plugin.json */
function readManifestSafe(dir: string): PluginManifest | null {
  try {
    const manifestPath = join(dir, 'plugin.json')
    if (!existsSync(manifestPath)) return null
    return JSON.parse(readFileSync(manifestPath, 'utf-8')) as PluginManifest
  } catch {
    return null
  }
}

/**
 * 自动安装内置插件。
 * 扫描内置插件目录，对每个插件：
 * - 未安装 → 安装
 * - 已安装但版本不同 → 更新（重新安装覆盖）
 * - 已安装且版本相同 → 跳过
 */
export function autoInstallBuiltinPlugins(): void {
  // e2e / 测试实例可显式跳过：内置插件自动安装会污染结果行序与冷启动基线，
  // 测试自行通过 importFromFolder 精确播种所需插件
  if (process.env.FROND_SKIP_BUILTIN_PLUGINS === '1') {
    console.log('[BuiltinPlugins] FROND_SKIP_BUILTIN_PLUGINS=1，跳过自动安装')
    return
  }
  const dir = builtinPluginsDir()
  if (!existsSync(dir)) {
    console.log('[BuiltinPlugins] 内置插件目录不存在，跳过:', dir)
    return
  }

  const installed = listPlugins()
  const installedMap = new Map(installed.map((p) => [p.id, p]))
  let installedCount = 0
  let updatedCount = 0
  let skippedCount = 0

  try {
    for (const entry of readdirSync(dir, { withFileTypes: true })) {
      if (!entry.isDirectory()) continue
      const pluginDir = join(dir, entry.name)
      const manifest = readManifestSafe(pluginDir)
      if (!manifest || !manifest.id) continue

      const existing = installedMap.get(manifest.id)
      const decision = decideBuiltinInstall(existing, manifest)
      if (decision === 'install') {
        // 未安装 → 安装
        try {
          importFromFolder(pluginDir, { origin: { kind: 'builtin', ref: 'bundled' } })
          installedCount++
          console.log(
            `[BuiltinPlugins] 已安装内置插件: ${manifest.id}@${manifest.version ?? 'unknown'}`
          )
        } catch (error) {
          console.warn(`[BuiltinPlugins] 安装失败 ${manifest.id}:`, (error as Error).message)
        }
      } else if (decision === 'update') {
        // 内置版本确实更新 → 更新（保留启停状态，见 importFromFolder isUpdate）
        try {
          importFromFolder(pluginDir, {
            origin: { kind: 'builtin', ref: 'bundled' },
            isUpdate: true
          })
          updatedCount++
          console.log(
            `[BuiltinPlugins] 已更新内置插件: ${manifest.id} ${existing?.version ?? '?'} → ${manifest.version}`
          )
        } catch (error) {
          console.warn(`[BuiltinPlugins] 更新失败 ${manifest.id}:`, (error as Error).message)
        }
      } else {
        // 同版本跳过，顺带回填历史安装缺失的来源标记（已有 origin 不覆盖）
        setPluginOriginIfMissing(manifest.id, { kind: 'builtin', ref: 'bundled' })
        skippedCount++
      }
    }
  } catch (error) {
    console.warn('[BuiltinPlugins] 扫描内置插件目录失败:', (error as Error).message)
  }

  if (installedCount > 0 || updatedCount > 0) {
    console.log(
      `[BuiltinPlugins] 完成: 新增 ${installedCount} 个, 更新 ${updatedCount} 个, 跳过 ${skippedCount} 个`
    )
  }
}
