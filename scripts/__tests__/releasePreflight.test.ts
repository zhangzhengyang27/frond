import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import {
  evaluateReleaseReadiness,
  parseReleaseVersion,
  readPublishTarget,
  isPlaceholderTarget
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
    expect(readPublishTarget(yml)).toEqual({
      provider: 'github',
      owner: 'frond-app',
      repo: 'frond-desktop'
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
