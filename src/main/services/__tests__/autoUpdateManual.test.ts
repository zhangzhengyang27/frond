import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import {
  GITHUB_LATEST_API,
  GITHUB_RELEASES_URL,
  REPO,
  isNewerVersion,
  pickMacDownloadUrl,
  parseLatestRelease
} from '../autoUpdateManual'

const ROOT = process.cwd()

/** 更新源仓库与 electron-builder.yml 的 publish 配置互为钉子：谁漂了这里咬 */
const BUILDER_YML = readFileSync(join(ROOT, 'electron-builder.yml'), 'utf8')

describe('autoUpdateManual · mac 未签名手动更新（MelodyAir 方案移植）', () => {
  it('更新源常量与 electron-builder.yml publish 互相钉住（防漂移）', () => {
    expect(REPO).toBe('zhangzhengyang27/frond')
    expect(GITHUB_LATEST_API).toBe(`https://api.github.com/repos/${REPO}/releases/latest`)
    expect(GITHUB_RELEASES_URL).toBe(`https://github.com/${REPO}/releases/latest`)
    expect(BUILDER_YML).toContain('owner: zhangzhengyang27')
    expect(BUILDER_YML).toContain('repo: frond')
  })

  describe('isNewerVersion（语义化版本比较，a > b 才 true）', () => {
    it('相等与旧版返回 false', () => {
      expect(isNewerVersion('0.1.0', '0.1.0')).toBe(false)
      expect(isNewerVersion('0.1.0', '0.2.0')).toBe(false)
      expect(isNewerVersion('0.1.0', '1.0.0')).toBe(false)
    })

    it('patch/minor/major 任一段更新返回 true', () => {
      expect(isNewerVersion('0.1.1', '0.1.0')).toBe(true)
      expect(isNewerVersion('0.2.0', '0.1.9')).toBe(true)
      expect(isNewerVersion('1.0.0', '0.9.9')).toBe(true)
    })

    it('按数值比较而不是字典序（10 > 9）', () => {
      expect(isNewerVersion('0.10.0', '0.9.0')).toBe(true)
      expect(isNewerVersion('0.9.0', '0.10.0')).toBe(false)
    })

    it('带 v 前缀的 tag 与段数不齐（缺段补 0）都能比', () => {
      expect(isNewerVersion('v0.2.0', '0.1.0')).toBe(true)
      expect(isNewerVersion('1.0', '1.0.0')).toBe(false)
      expect(isNewerVersion('1.0.0', '1.0')).toBe(false)
    })
  })

  describe('pickMacDownloadUrl（按当前架构挑 dmg 资产）', () => {
    const assets = [
      { name: 'Frond-0.2.0-arm64.dmg', browser_download_url: 'https://x/frond-arm64.dmg' },
      { name: 'Frond-0.2.0.dmg.zip', browser_download_url: 'https://x/frond.zip' },
      { name: 'Frond-0.2.0-x64.dmg', browser_download_url: 'https://x/frond-x64.dmg' },
      { name: 'latest-mac.yml', browser_download_url: 'https://x/latest-mac.yml' }
    ]

    it('arm64 机器挑 arm64 dmg', () => {
      expect(pickMacDownloadUrl(assets, 'arm64')).toBe('https://x/frond-arm64.dmg')
    })

    it('x64 机器挑 x64 dmg', () => {
      expect(pickMacDownloadUrl(assets, 'x64')).toBe('https://x/frond-x64.dmg')
    })

    it('没有带架构后缀的 dmg 时回退任意 dmg（排除 zip 冒充与 yml）', () => {
      const onlyGeneric = [
        { name: 'Frond-0.2.0.dmg', browser_download_url: 'https://x/frond.dmg' },
        { name: 'Frond-0.2.0.zip', browser_download_url: 'https://x/f.zip' },
        { name: 'latest-mac.yml', browser_download_url: 'https://x/latest-mac.yml' }
      ]
      expect(pickMacDownloadUrl(onlyGeneric, 'arm64')).toBe('https://x/frond.dmg')
    })

    it('一个 dmg 都没有返回 null（调用方退到 releases 页）', () => {
      expect(
        pickMacDownloadUrl(
          [{ name: 'latest-mac.yml', browser_download_url: 'https://x/y' }],
          'arm64'
        )
      ).toBeNull()
      expect(pickMacDownloadUrl([], 'arm64')).toBeNull()
    })
  })

  describe('parseLatestRelease（GitHub releases/latest 载荷 → 手动更新信息）', () => {
    const base = {
      tag_name: 'v0.2.0',
      assets: [
        { name: 'Frond-0.2.0-arm64.dmg', browser_download_url: 'https://x/frond-arm64.dmg' },
        { name: 'latest-mac.yml', browser_download_url: 'https://x/latest-mac.yml' }
      ]
    }

    it('远端更新时给出版本 + 架构匹配的下载地址', () => {
      expect(parseLatestRelease(base, '0.1.0', 'arm64')).toEqual({
        version: '0.2.0',
        downloadUrl: 'https://x/frond-arm64.dmg',
        releasesUrl: GITHUB_RELEASES_URL
      })
    })

    it('同版本/旧版本/坏载荷返回 null', () => {
      expect(parseLatestRelease(base, '0.2.0', 'arm64')).toBeNull()
      expect(parseLatestRelease(base, '0.3.0', 'arm64')).toBeNull()
      expect(parseLatestRelease({}, '0.1.0', 'arm64')).toBeNull()
      expect(parseLatestRelease(null, '0.1.0', 'arm64')).toBeNull()
      expect(parseLatestRelease({ tag_name: 42 }, '0.1.0', 'arm64')).toBeNull()
    })

    it('没有可用 dmg 资产时 downloadUrl 退到 releases 页', () => {
      const noDmg = {
        tag_name: 'v0.2.0',
        assets: [{ name: 'latest-mac.yml', browser_download_url: 'https://x/y' }]
      }
      expect(parseLatestRelease(noDmg, '0.1.0', 'arm64')?.downloadUrl).toBe(GITHUB_RELEASES_URL)
      expect(parseLatestRelease({ tag_name: 'v0.2.0' }, '0.1.0', 'arm64')?.downloadUrl).toBe(
        GITHUB_RELEASES_URL
      )
    })
  })
})
