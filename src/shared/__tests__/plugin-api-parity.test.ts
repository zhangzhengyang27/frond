import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, join } from 'node:path'
import { SENSITIVE_PLUGIN_API_PERMISSIONS } from '../plugin-protocol'

/**
 * 插件 API 奇偶校验：扫描所有内置插件对 window.launcherApi 的调用，
 * 与 preload 实际暴露的 API 面（src/preload/plugin.ts）逐一比对。
 *
 * 背景：16/21 内置插件曾调用从未存在的 api.getClipboardText()（preload 只有
 * readText），功能静默失败。本测试防止同类"插件调用了宿主没有的 API"回归。
 */

const repoRoot = resolve(__dirname, '../../..')

/** 从 preload 源码静态解析 launcherApi 暴露的方法名（顶层 + 命名空间子方法） */
function extractExposedApi(): Set<string> {
  // CRLF 环境（win32 checkout）下 $ 锚点正则会被 \r 破坏，读入即归一
  const source = readFileSync(resolve(repoRoot, 'src/preload/plugin.ts'), 'utf-8').replace(/\r\n/g, '\n')
  const start = source.indexOf('const launcherApi = {')
  const end = source.indexOf('export type', start)
  expect(start, 'plugin.ts 中应存在 launcherApi 定义').toBeGreaterThan(-1)
  expect(end, 'plugin.ts 中应存在 LauncherPluginApi 导出').toBeGreaterThan(-1)

  const body = source.slice(start, end)
  const exposed = new Set<string>()
  let currentNamespace: string | null = null

  for (const line of body.split('\n')) {
    const ns = line.match(/^ {2}(\w+): \{$/)
    if (ns) {
      currentNamespace = ns[1]
      continue
    }
    // 命名空间结束（回到 2 空格缩进的下一行由后续匹配处理；仅两个扁平命名空间，简单重置）
    if (currentNamespace && /^ {2}\w+:/.test(line) && !line.startsWith('    ')) {
      currentNamespace = null
    }
    const method = line.match(/^ {4}(\w+):/)
    if (currentNamespace && method) {
      exposed.add(`${currentNamespace}.${method[1]}`)
      continue
    }
    const topLevel = line.match(/^ {2}(\w+):/)
    if (topLevel) {
      exposed.add(topLevel[1])
    }
  }

  // 解析器自身健壮性哨兵：若 preload 结构变化导致漏抓，先在这里失败
  for (const sentinel of ['readText', 'fetch', 'renderList', 'db.put', 'preferences.get']) {
    expect(exposed.has(sentinel), `API 解析异常：未从 plugin.ts 抓到 ${sentinel}`).toBe(true)
  }
  return exposed
}

/** 递归收集 plugin 页面源文件 */
function collectPluginHtml(dir: string): string[] {
  const out: string[] = []
  if (!existsSync(dir)) return out
  for (const name of readdirSync(dir)) {
    const full = join(dir, name)
    if (statSync(full).isDirectory()) {
      out.push(...collectPluginHtml(full))
    } else if (name === 'index.html') {
      out.push(full)
    }
  }
  return out
}

describe('插件 API 奇偶校验', () => {
  it('插件调用的每个 launcherApi 方法都在 preload 中真实暴露', () => {
    const exposed = extractExposedApi()
    const pluginDirs = [resolve(repoRoot, 'plugins'), resolve(repoRoot, 'example-plugin')]
    const offenders: string[] = []

    for (const dir of pluginDirs) {
      for (const file of collectPluginHtml(dir)) {
        const html = readFileSync(file, 'utf-8')
        const rel = file.slice(repoRoot.length + 1)
        // 负向断言排除 URL 中的 "api.xxx.com" 之类字符串，只匹配真正的 api 对象调用
        const calls = html.matchAll(/(?<![\w./$-])api\.(\w+(?:\.\w+)?)/g)
        for (const m of calls) {
          const name = m[1]
          if (!exposed.has(name)) {
            offenders.push(`${rel}: api.${name} 不在 preload 暴露的 API 中`)
          }
        }
      }
    }

    expect(offenders, `发现 ${offenders.length} 处幽灵 API 调用:\n${offenders.join('\n')}`).toEqual(
      []
    )
  })
})

describe('插件敏感权限声明制', () => {
  it('插件使用的敏感 API 都已在 plugin.json permissions 中声明', () => {
    const offenders: string[] = []
    const dirs = [resolve(repoRoot, 'plugins'), resolve(repoRoot, 'example-plugin')]
    for (const dir of dirs) {
      for (const file of collectPluginHtml(dir)) {
        const pluginDir = file.slice(0, file.lastIndexOf('/'))
        const html = readFileSync(file, 'utf-8')
        const manifestPath = join(pluginDir, 'plugin.json')
        let declared: string[] = []
        try {
          declared =
            (JSON.parse(readFileSync(manifestPath, 'utf-8')) as { permissions?: string[] })
              .permissions ?? []
        } catch {
          continue // example-plugin 等无 manifest 的目录跳过
        }
        const used = new Set<string>()
        for (const api of Object.keys(SENSITIVE_PLUGIN_API_PERMISSIONS)) {
          if (new RegExp(`(?<![\\w.$-])api\\.${api}\\b`).test(html)) used.add(api)
        }
        for (const api of used) {
          const perm = SENSITIVE_PLUGIN_API_PERMISSIONS[api]
          if (!declared.includes(perm)) {
            offenders.push(
              `${file.slice(repoRoot.length + 1)}: 使用 api.${api} 但未声明权限 "${perm}"`
            )
          }
        }
      }
    }
    expect(offenders, `权限声明缺失:\n${offenders.join('\n')}`).toEqual([])
  })
})
