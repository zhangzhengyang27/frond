import { describe, it, expect } from 'vitest'
import { readFileSync, existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateReleaseReadiness,
  parseReleaseVersion,
  readPublishTarget,
  isPlaceholderTarget,
  readReferencedBuildAssets,
  checkReleaseAssets,
  REQUIRED_ROOT_ASSETS
} from '../lib/releasePreflight.mjs'

/**
 * 发布链路自检（P-3.6）。
 *
 * 判错的代价不是「测试红了」，是「不能发的版本被发出去」或者「能发却被 CI 拦死」，
 * 所以两种方向都要钉住：占位目标必须 blocking，未签名必须 **不** blocking（D2 就是发未签名产物）。
 */

const REAL = { owner: 'real-org', repo: 'frond' }
const SIGNED = {
  CSC_LINK: 'file://cert.p12',
  APPLE_ID: 'a@b.c',
  APPLE_TEAM_ID: 'TEAM123',
  APPLE_APP_SPECIFIC_PASSWORD: 'xxxx'
}

describe('readPublishTarget', () => {
  it('解析真实 electron-builder.yml（解析器飘了就等于自检全瞎）', () => {
    const __dirname = dirname(fileURLToPath(import.meta.url))
    const yml = readFileSync(join(__dirname, '..', '..', 'electron-builder.yml'), 'utf-8')
    // 钉真仓库：解析器飘了等于自检全瞎；publish 目标换仓库时这里必须跟着改
    expect(readPublishTarget(yml)).toEqual({
      provider: 'github',
      owner: 'zhangzhengyang27',
      repo: 'frond'
    })
  })

  it('publish 块在文件中间也读得到，遇到下一个顶格 key 就收', () => {
    const yml = [
      'appId: com.frond',
      'publish:',
      '  provider: github',
      '  owner: o1',
      '  repo: r1',
      'electronDownload:',
      '  mirror: https://example.com/'
    ].join('\n')
    expect(readPublishTarget(yml)).toEqual({ provider: 'github', owner: 'o1', repo: 'r1' })
  })

  it('没有 publish 块 → 三项皆 null（调用方按「未配置」阻塞）', () => {
    expect(readPublishTarget('appId: com.frond\nmac:\n  category: public.app-class')).toEqual({
      provider: null,
      owner: null,
      repo: null
    })
  })
})

describe('parseReleaseVersion', () => {
  it('x.y.z 与可选 prerelease / 前导 v 都收，别的都不收', () => {
    expect(parseReleaseVersion('1.2.3')).toBe('1.2.3')
    expect(parseReleaseVersion('v1.2.3')).toBe('1.2.3')
    expect(parseReleaseVersion('1.2.3-beta.1')).toBe('1.2.3-beta.1')
    expect(parseReleaseVersion('1.2')).toBeNull()
    expect(parseReleaseVersion('nightly')).toBeNull()
    expect(parseReleaseVersion(undefined)).toBeNull()
  })
})

describe('evaluateReleaseReadiness', () => {
  it('占位发布目标是 blocking（绿色构建 ≠ 能发，这条就是拦这个的）', () => {
    const r = evaluateReleaseReadiness({
      owner: 'frond-app',
      repo: 'frond-desktop',
      version: '0.1.0',
      env: { GITHUB_TOKEN: 'x' }
    })
    expect(r.ok).toBe(false)
    expect(r.blocking.join('\n')).toContain('占位')
    expect(isPlaceholderTarget('frond-app', 'frond-desktop')).toBe(true)
  })

  it('真目标 + 已签名已公证：全清', () => {
    const r = evaluateReleaseReadiness({
      ...REAL,
      version: '1.2.0',
      tag: 'v1.2.0',
      env: { GH_TOKEN: 'x', ...SIGNED }
    })
    expect(r).toMatchObject({ ok: true, blocking: [], warnings: [], signed: true })
  })

  it('未签名不阻塞发布（D2 就是发未签名产物），但必须留一条 warning', () => {
    const r = evaluateReleaseReadiness({ ...REAL, version: '1.0.0', env: { GH_TOKEN: 'x' } })
    expect(r.ok).toBe(true)
    expect(r.warnings).toHaveLength(1)
    expect(r.warnings[0]).toContain('未签名')
  })

  it('只签了名没公证 → warning 说得是公证', () => {
    const r = evaluateReleaseReadiness({
      ...REAL,
      version: '1.0.0',
      env: { GH_TOKEN: 'x', CSC_LINK: 'file://c.p12' }
    })
    expect(r.ok).toBe(true)
    expect(r.warnings[0]).toContain('公证')
  })

  it('tag 与 package.json 版本不一致是 blocking', () => {
    const r = evaluateReleaseReadiness({
      ...REAL,
      version: '1.0.0',
      tag: 'v1.1.0',
      env: { GH_TOKEN: 'x', ...SIGNED }
    })
    expect(r.ok).toBe(false)
    expect(r.blocking.join('\n')).toContain('不一致')
  })

  it('没有任何上传 token → blocking（发出去等于只有 CI 缓存里那份）', () => {
    const r = evaluateReleaseReadiness({ ...REAL, version: '1.0.0', env: { ...SIGNED } })
    expect(r.blocking.join('\n')).toContain('GH_TOKEN')
  })

  it('非 mac 平台没有签名/公证这一档', () => {
    const r = evaluateReleaseReadiness({ ...REAL, version: '1.0.0', platform: 'win32' })
    expect(r.signed).toBeNull()
    expect(r.warnings).toEqual([])
  })
})

/**
 * 发布资产自检（P1-6）。
 *
 * 判据从 electron-builder.yml **反解**，而不是硬编码清单 —— 以后往 yml 里加一个
 * `build/xxx` 引用，自检自动跟着要求它存在。下面第一条就是真正的门禁：它读真实的
 * yml，然后要求磁盘上每个被引用的资产都在。
 */
describe('readReferencedBuildAssets / checkReleaseAssets', () => {
  const REPO_ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..')
  const yml = readFileSync(join(REPO_ROOT, 'electron-builder.yml'), 'utf-8')

  it('从真实 electron-builder.yml 里反解出 entitlements 与图标', () => {
    const refs = readReferencedBuildAssets(yml)
    // entitlements 两个都要（主 app + 子进程 inherit），图标两个都要（icns / png）
    expect(refs).toContain('build/entitlements.mac.plist')
    expect(refs).toContain('build/entitlements.mac.inherit.plist')
    expect(refs).toContain('build/icon.icns')
    expect(refs).toContain('build/icon.png')
    // 体量哨兵：至少 4 条，防止解析退化成空数组后下面那条门禁空转
    expect(refs.length).toBeGreaterThanOrEqual(4)
    expect(new Set(refs).size).toBe(refs.length) // 去重
  })

  it('electron-builder.yml 引用的每个 build/* 资产都真实存在（P1-6 的门禁）', () => {
    const referenced = readReferencedBuildAssets(yml)
    const { required, missing } = checkReleaseAssets(
      (rel) => existsSync(join(REPO_ROOT, rel)),
      referenced
    )
    expect(required.length).toBeGreaterThanOrEqual(5) // 4 个 build/* + LICENSE
    expect(
      missing,
      '这些资产被 electron-builder.yml 引用（或为分发必需）却不存在 ——\n' +
        '`pnpm build` 在多数平台仍是绿的，但 mac 打包会直接失败 / 产物退回默认图标：'
    ).toEqual([])
  })

  it('根 LICENSE 必须在（electron-builder 会打进安装包；MIT 要求随分发物给出声明）', () => {
    expect(REQUIRED_ROOT_ASSETS).toContain('LICENSE')
    expect(existsSync(join(REPO_ROOT, 'LICENSE'))).toBe(true)
  })

  it('package.json 声明了 license 字段（与 LICENSE 文件同源，不能只有一个）', () => {
    const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf-8')) as {
      license?: string
    }
    expect(pkg.license).toBe('MIT')
  })

  it('checkReleaseAssets 把缺失项报全（注入 exists，不碰真实文件系统）', () => {
    const have = new Set(['LICENSE', 'build/icon.png'])
    const { required, missing } = checkReleaseAssets(
      (rel) => have.has(rel),
      ['build/icon.png', 'build/icon.icns', 'build/entitlements.mac.plist']
    )
    expect(required).toEqual([
      'LICENSE',
      'build/icon.png',
      'build/icon.icns',
      'build/entitlements.mac.plist'
    ])
    expect(missing).toEqual(['build/icon.icns', 'build/entitlements.mac.plist'])
  })

  it('全部就位时 missing 为空（防止判据写反成恒报缺失）', () => {
    const { missing } = checkReleaseAssets(() => true, ['build/icon.icns'])
    expect(missing).toEqual([])
  })

  it('yml 里没有 build/ 引用时只要求 LICENSE', () => {
    const { required, missing } = checkReleaseAssets((rel) => rel === 'LICENSE', [])
    expect(required).toEqual(['LICENSE'])
    expect(missing).toEqual([])
  })
})
