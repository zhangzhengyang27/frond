import { describe, it, expect } from 'vitest'
import { readFileSync, readdirSync, existsSync, statSync } from 'node:fs'
import { resolve, join, basename } from 'node:path'

/**
 * 内置插件清单（plugin.json）静态审计（ROADMAP D2「先修内功」）：
 * 与 plugin-api-parity.test.ts 互补——那个管「调用的 API 是否存在」，
 * 这个管「清单本身是否合规、入口文件是否真实存在」。
 * 第三方插件上架前同样跑这套规则（市场安装时会二次校验，这里是源头防线）。
 */

const repoRoot = resolve(__dirname, '../../..')

function collectPluginDirs(dir: string): string[] {
  return readdirSync(dir)
    .map((name) => join(dir, name))
    .filter((p) => statSync(p).isDirectory())
}

describe('内置插件清单审计', () => {
  const pluginRoots = [resolve(repoRoot, 'plugins'), resolve(repoRoot, 'example-plugin')]
  const problems: string[] = []
  let count = 0

  for (const root of pluginRoots) {
    for (const dir of collectPluginDirs(root)) {
      count += 1
      const rel = dir.slice(repoRoot.length + 1)
      const manifestPath = join(dir, 'plugin.json')
      if (!existsSync(manifestPath)) {
        problems.push(`${rel}: 缺少 plugin.json`)
        continue
      }

      let m: Record<string, unknown>
      try {
        m = JSON.parse(readFileSync(manifestPath, 'utf-8'))
      } catch (e) {
        problems.push(`${rel}: plugin.json 解析失败（${(e as Error).message}）`)
        continue
      }

      // 必填字段
      for (const field of ['id', 'name', 'version', 'description', 'main']) {
        if (typeof m[field] !== 'string' || !(m[field] as string).trim()) {
          problems.push(`${rel}: 缺少必填字段 ${field}`)
        }
      }
      // id 与目录名一致（安装目录由 id 决定，不一致会导致安装路径错乱）
      if (typeof m.id === 'string' && m.id !== basename(dir)) {
        problems.push(`${rel}: id "${m.id}" 与目录名不一致`)
      }
      // 版本号 semver（内置插件自动更新按版本号比对覆盖）
      if (typeof m.version === 'string' && !/^\d+\.\d+\.\d+$/.test(m.version)) {
        problems.push(`${rel}: version "${m.version}" 不是 x.y.z 形式`)
      }
      // 入口文件真实存在
      if (typeof m.main === 'string' && !existsSync(join(dir, m.main))) {
        problems.push(`${rel}: main 入口 "${m.main}" 不存在`)
      }
      // commands 结构
      if (m.commands !== undefined) {
        if (!Array.isArray(m.commands) || m.commands.length === 0) {
          problems.push(`${rel}: commands 必须是非空数组（留空应删除该字段）`)
        } else {
          for (const [i, c] of m.commands.entries()) {
            const cmd = c as Record<string, unknown>
            if (typeof cmd.code !== 'string' || !cmd.code.trim()) {
              problems.push(`${rel}: commands[${i}] 缺少 code`)
            }
            if (typeof cmd.title !== 'string' || !cmd.title.trim()) {
              problems.push(`${rel}: commands[${i}] 缺少 title`)
            }
          }
        }
      }
    }
  }

  it(`共审计 ${count} 个插件，清单全部合规`, () => {
    expect(count, '插件数量异常（目录丢失？）').toBeGreaterThanOrEqual(21)
    expect(problems, `发现 ${problems.length} 处清单问题:\n${problems.join('\n')}`).toEqual([])
  })
})
