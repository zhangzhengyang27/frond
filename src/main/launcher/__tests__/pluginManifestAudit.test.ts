import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { parseMarketIndex } from '../market'
import { sanitizePluginPreferences } from '../../../shared/plugin-protocol'

/**
 * 内置插件清单静态审计（P-2.8，ROADMAP 欠账）。
 *
 * 这些规则不是形式主义：宿主读清单时对非法值是**静默剔除/降级**的
 * （未知权限丢掉、非法 argument 类型降成 text、>3 个参数截断），
 * 所以清单写错的表现是「插件在胶囊里少了个权限/参数」而不是启动报错——
 * 没有这道闸就会长期悄悄错着。第 5 条（版本号与市场索引一致）本周就真的飘过。
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const PLUGINS_DIR = join(__dirname, '..', '..', '..', '..', 'plugins')
const MARKET_FILE = join(__dirname, '..', '..', '..', '..', 'plugins.json')

interface ManifestCommand {
  code?: unknown
  title?: unknown
  arguments?: unknown
}
interface Manifest {
  id?: unknown
  name?: unknown
  version?: unknown
  main?: unknown
  commands?: ManifestCommand[]
  permissions?: unknown
  preferences?: unknown
}

const KNOWN_PERMISSIONS = new Set(['clipboard.read', 'clipboard.write', 'fs.open', 'net'])
const KNOWN_ARG_TYPES = new Set(['text', 'password', 'dropdown'])

const entries = readdirSync(PLUGINS_DIR)
const dirs = entries.filter((name) => existsSync(join(PLUGINS_DIR, name, 'plugin.json')))

const manifests = dirs.map((dir) => {
  const raw = JSON.parse(readFileSync(join(PLUGINS_DIR, dir, 'plugin.json'), 'utf8')) as Manifest
  return { dir, manifest: raw }
})

const marketRaw = (JSON.parse(readFileSync(MARKET_FILE, 'utf8')).plugins ?? []) as Array<{
  id: string
  name?: string
  version?: string
  download?: string
  sha256?: string
}>
const market = marketRaw.map((e) => ({ id: e.id, version: String(e.version) }))

describe('内置插件清单审计', () => {
  it('目录非空且每个条目都带 plugin.json（漏一个 = 该插件在市场里静默消失）', () => {
    expect(manifests.length).toBeGreaterThan(15)
    expect(
      dirs.length,
      `缺 plugin.json 的条目：${entries.filter((e) => !dirs.includes(e)).join(', ')}`
    ).toBe(entries.length)
  })

  it('id 与目录名一致（不一致会让「按目录找插件」全落空）', () => {
    for (const { dir, manifest } of manifests) {
      expect(manifest.id, `${dir}: id 与目录名不一致`).toBe(dir)
    }
  })

  it('必填字段齐：name / version / 至少一条命令且每条有 code + title', () => {
    for (const { dir, manifest } of manifests) {
      expect(typeof manifest.name, `${dir}: name 缺失`).toBe('string')
      expect(typeof manifest.version, `${dir}: version 缺失`).toBe('string')
      expect(Array.isArray(manifest.commands), `${dir}: commands 缺失`).toBe(true)
      expect(manifest.commands?.length ?? 0, `${dir}: commands 为空`).toBeGreaterThan(0)
      for (const cmd of manifest.commands ?? []) {
        expect(typeof cmd.code, `${dir}: 命令缺 code`).toBe('string')
        expect(typeof cmd.title, `${dir}: 命令缺 title`).toBe('string')
      }
    }
  })

  it('main 入口文件真实存在（写错文件名 = 插件打开白屏）', () => {
    for (const { dir, manifest } of manifests) {
      const main = typeof manifest.main === 'string' ? manifest.main : 'index.html'
      expect(existsSync(join(PLUGINS_DIR, dir, main)), `${dir}: 入口 ${main} 不存在`).toBe(true)
    }
  })

  it('permissions 只用已知值（未知值宿主会静默剔除，表现为「权限没生效」）', () => {
    for (const { dir, manifest } of manifests) {
      for (const p of (manifest.permissions ?? []) as string[]) {
        expect(KNOWN_PERMISSIONS.has(p), `${dir}: 未知权限 ${p}`).toBe(true)
      }
    }
  })

  it('arguments：≤3 个、类型已知、dropdown 必须带 data', () => {
    for (const { dir, manifest } of manifests) {
      for (const cmd of manifest.commands ?? []) {
        const args = (cmd.arguments ?? []) as Array<{
          name?: unknown
          type?: unknown
          data?: unknown
        }>
        expect(
          args.length,
          `${dir}/${String(cmd.code)}: 参数超过 3 个会被截断`
        ).toBeLessThanOrEqual(3)
        for (const arg of args) {
          expect(typeof arg.name, `${dir}: 参数缺 name`).toBe('string')
          const type = arg.type ?? 'text'
          expect(KNOWN_ARG_TYPES.has(String(type)), `${dir}: 未知参数类型 ${String(type)}`).toBe(
            true
          )
          if (type === 'dropdown') {
            expect(Array.isArray(arg.data) && arg.data.length > 0, `${dir}: dropdown 无 data`).toBe(
              true
            )
          }
        }
      }
    }
  })

  it('版本号与静态市场索引 plugins.json 一致（不一致会让「有更新」判定长期失真）', () => {
    for (const { dir, manifest } of manifests) {
      const entry = market.find((m) => m.id === dir)
      expect(entry, `${dir}: 未登记在 plugins.json`).toBeTruthy()
      expect(entry?.version, `${dir}: 清单版本 ${String(manifest.version)} ≠ 市场索引版本`).toBe(
        String(manifest.version)
      )
    }
  })

  it('偏好声明过一遍真清洗器不丢项（畸形项宿主会静默剔除，表现为「设置里少一项」）', () => {
    // 内置插件全都带 preferences，而这套声明此前从没被任何校验器看过一眼
    let declared = 0
    for (const { dir, manifest } of manifests) {
      const raw = manifest.preferences
      if (!Array.isArray(raw) || raw.length === 0) continue
      const cleaned = sanitizePluginPreferences(raw)
      expect(cleaned, dir).toHaveLength(raw.length)
      expect(
        cleaned.map((c) => c.name),
        dir
      ).toEqual((raw as Array<{ name: string }>).map((r) => r.name))
      // 类型不许被降级：降级 = 清单写的是下拉、界面渲染成文本框
      for (const [i, item] of raw.entries()) {
        const t = (item as { type?: string }).type
        if (t) expect(cleaned[i].type, `${dir}[${i}]`).toBe(t)
        const dflt = (item as { default?: string | boolean }).default
        if (t === 'checkbox') expect(typeof dflt, `${dir}[${i}] default 必须是布尔`).toBe('boolean')
        if (t === 'select' && typeof dflt === 'string') {
          expect(
            (item as { options?: string[] }).options ?? [],
            `${dir}[${i}] 默认值不在候选里`
          ).toContain(dflt)
        }
        /**
         * 逐字段深比：清洗器对超长值是**截断**、对多余候选是**丢弃**，
         * 上面那几条只看得出「少了一项 / 类型变了」，看不出「label 少了两个字、
         * 候选从 12 个变成 8 个」——而那正是插件作者最需要在写清单时就知道的事。
         */
        const src = item as Record<string, unknown>
        const expected: Record<string, unknown> = {}
        for (const key of ['name', 'label', 'type', 'default', 'options']) {
          if (src[key] !== undefined) expected[key] = src[key]
        }
        // 清单省略 type = 文本框，清洗器补上 'text' 是声明本身的默认语义，不算改动
        if (expected.type === undefined) expected.type = 'text'
        expect(cleaned[i], `${dir}[${i}] 每个字段必须原样活下来`).toEqual(expected)
      }
      declared += raw.length
    }
    expect(declared, '一个带偏好的内置插件都没有 = 这条规则空过').toBeGreaterThan(0)
  })

  it('市场索引过一遍真解析器不丢条目（畸形字段是静默剔除，不是启动报错）', () => {
    // 索引里一条 sha256 写短一位、download 逃出索引目录，表现都是「市场列表少了个插件」
    const parsed = parseMarketIndex({ version: 1, plugins: marketRaw }, dirname(MARKET_FILE))
    expect(parsed.plugins.map((p) => p.id).sort()).toEqual(market.map((m) => m.id).sort())
    for (const entry of parsed.plugins) {
      if (entry.sha256 !== undefined) {
        expect(entry.sha256, `${entry.id}: sha256 未过 normalize`).toMatch(/^[0-9a-f]{64}$/)
      }
    }
  })
})
