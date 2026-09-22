import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import { mkdtempSync, mkdirSync, writeFileSync, rmSync, existsSync, symlinkSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'
import {
  parseMarketIndex,
  resolveDownloadSource,
  findManifestDir,
  extractZip,
  normalizeSha256,
  verifyPackageChecksum,
  sha256File,
  normalizeIndexUrl,
  mergeMarketEntries,
  parseRemoteCache,
  assertRemoteTargetAllowed,
  parseSemver,
  compareSemver,
  isUpdatable,
  toMarketItems,
  type MarketEntry
} from '../market'
import type { InstalledPlugin } from '../pluginStore'

/**
 * 静态插件市场 v0（M3.5）纯函数测试：
 * 索引解析（非法条目剔除 / 本地路径相对索引目录解析）、下载源分类、
 * 解压结果中 manifest 目录定位（含路径穿越防御）与真实 unzip 解压。
 */

let root: string

beforeEach(() => {
  root = mkdtempSync(join(tmpdir(), 'leaf-market-'))
})

afterEach(() => {
  rmSync(root, { recursive: true, force: true })
})

describe('parseMarketIndex', () => {
  it('合法索引解析，本地 download 相对索引目录解析', () => {
    const index = parseMarketIndex(
      {
        version: 1,
        plugins: [
          { id: 'com.a.p', name: 'A', version: '1.0.0', download: './pkgs/a' },
          { id: 'com.b.p', name: 'B', download: 'https://example.com/b.zip' }
        ]
      },
      root
    )
    expect(index.version).toBe(1)
    expect(index.plugins).toHaveLength(2)
    expect(index.plugins[0].download).toBe(join(root, 'pkgs', 'a'))
    expect(index.plugins[1].download).toBe('https://example.com/b.zip')
  })

  it('非法条目剔除而非整体失败', () => {
    const index = parseMarketIndex(
      {
        version: 1,
        plugins: [
          { id: 'bad..id', name: 'X', download: './x' }, // 非法 id
          { id: 'ok.id', name: '', download: './x' }, // 缺 name
          { id: 'ok.id2', name: 'Y' }, // 缺 download
          'garbage', // 非对象
          { id: 'good.id', name: 'Z', download: './z' }
        ]
      },
      root
    )
    expect(index.plugins).toHaveLength(1)
    expect(index.plugins[0].id).toBe('good.id')
  })

  it('非对象输入抛错', () => {
    expect(() => parseMarketIndex(null, root)).toThrow()
    expect(() => parseMarketIndex({ plugins: 'nope' }, root)).toThrow()
  })

  it('本地 download 逃出索引目录（../）的条目被剔除', () => {
    const index = parseMarketIndex(
      {
        version: 1,
        plugins: [
          { id: 'com.esc.p', name: 'Esc', download: '../outside-plugin' },
          { id: 'com.abs.p', name: 'Abs', download: '/etc' },
          { id: 'com.self.p', name: 'Self', download: '.' },
          { id: 'com.ok.p', name: 'Ok', download: './inside' }
        ]
      },
      root
    )
    // com.self.p 解析为索引目录本身（rel === ''）也应剔除；只留子树内条目
    expect(index.plugins.map((p) => p.id)).toEqual(['com.ok.p'])
  })
})

describe('parseSemver / compareSemver', () => {
  it('解析三段数字与 prerelease 后缀，容忍前导 v 和空白', () => {
    expect(parseSemver('1.2.3')).toEqual({ num: [1, 2, 3], pre: null })
    expect(parseSemver(' v1.2.3 ')).toEqual({ num: [1, 2, 3], pre: null })
    expect(parseSemver('1.2.3-beta.1')).toEqual({ num: [1, 2, 3], pre: 'beta.1' })
  })

  it('非三段 x.y.z 形态返回 null（交给 isUpdatable 兜底）', () => {
    for (const bad of ['1.0', '1', 'latest', '1.0.0.1', '1.0.0rc', '']) {
      expect(parseSemver(bad)).toBeNull()
    }
  })

  it('比较：主/次/补丁逐级比大小，短版本号按 0 补齐由上层兜底', () => {
    expect(compareSemver('1.0.1', '1.0.0')).toBe(1)
    expect(compareSemver('1.0.0', '1.0.1')).toBe(-1)
    expect(compareSemver('1.0.0', '1.0.0')).toBe(0)
    expect(compareSemver('0.9.9', '1.0.0')).toBe(-1)
    expect(compareSemver('2.0.0', '10.0.0')).toBe(-1)
    expect(compareSemver('1.10.0', '1.9.0')).toBe(1)
  })

  it('比较：正式版大于同版本号 prerelease', () => {
    expect(compareSemver('1.0.0', '1.0.0-beta')).toBe(1)
    expect(compareSemver('1.0.0-beta', '1.0.0')).toBe(-1)
    expect(compareSemver('1.0.0-beta', '1.0.0-alpha')).toBe(1)
  })

  it('比较：任一侧不可解析 → null', () => {
    expect(compareSemver('1.0.0', 'nightly')).toBeNull()
    expect(compareSemver('nightly', '1.0.0')).toBeNull()
  })
})

describe('isUpdatable / toMarketItems（版本更新通道）', () => {
  const entry = (version?: string): MarketEntry => ({
    id: 'com.a.p',
    name: 'A',
    version,
    download: './a'
  })
  const installed = (version?: string): InstalledPlugin => ({
    id: 'com.a.p',
    name: 'A',
    version,
    enabled: true,
    installedAt: 0
  })

  it('市场版本更新 → updatable=true', () => {
    expect(isUpdatable('1.1.0', '1.0.0')).toBe(true)
    expect(isUpdatable('0.2.0', '0.1.0')).toBe(true)
  })

  it('版本一致 → updatable=false', () => {
    expect(isUpdatable('0.1.0', '0.1.0')).toBe(false)
  })

  it('市场版本更旧也绝不是更新：字符串不等不算可更新', () => {
    // 真实回归：内置插件清单已升 1.0.1，市场索引仍写 1.0.0，旧实现让 20 个插件长期显示「可更新」
    expect(isUpdatable('1.0.0', '1.0.1')).toBe(false)
    expect(isUpdatable('1.0.0', '2.0.0')).toBe(false)
    expect(isUpdatable('1.0.0-beta', '1.0.0')).toBe(false)
  })

  it('不可比形态退回「不等即可更新」，宁多不漏', () => {
    expect(isUpdatable('nightly', '1.0.0')).toBe(true)
    expect(isUpdatable('nightly', 'nightly')).toBe(false)
    expect(isUpdatable('1.0', '2.0')).toBe(true)
  })

  it('任一版本缺失视为不可判定 → updatable=false', () => {
    expect(isUpdatable(undefined, '1.0.0')).toBe(false)
    expect(isUpdatable('1.0.0', undefined)).toBe(false)
    expect(isUpdatable(undefined, undefined)).toBe(false)
  })

  it('toMarketItems：补充 installed / installedVersion / updatable', () => {
    const items = toMarketItems(
      [
        entry('1.1.0'), // 已装旧版 → 可更新
        entry('1.0.0'), // 已装同版 → 不可更新
        entry(undefined), // 市场无版本 → 不可判定
        { id: 'com.b.p', name: 'B', download: './b' } // 未安装
      ],
      [installed('1.0.0')]
    )
    expect(items).toHaveLength(4)
    expect(items[0]).toMatchObject({
      id: 'com.a.p',
      installed: true,
      installedVersion: '1.0.0',
      updatable: true
    })
    expect(items[1]).toMatchObject({ installed: true, installedVersion: '1.0.0', updatable: false })
    expect(items[2]).toMatchObject({ installed: true, installedVersion: '1.0.0', updatable: false })
    expect(items[3]).toMatchObject({ id: 'com.b.p', installed: false, updatable: false })
    expect(items[3].installedVersion).toBeUndefined()
  })

  it('toMarketItems：市场条目保留原字段（name/version/download）', () => {
    const items = toMarketItems([entry('2.0.0')], [])
    expect(items[0]).toMatchObject({ id: 'com.a.p', name: 'A', version: '2.0.0' })
  })
})

describe('包体 sha256 校验（分发与信任 P-3.3）', () => {
  const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

  it('normalizeSha256：只收 64 位十六进制并统一小写', () => {
    expect(normalizeSha256(ABC)).toBe(ABC)
    expect(normalizeSha256(` ${ABC.toUpperCase()} `)).toBe(ABC)
    for (const bad of [undefined, null, 123, ABC.slice(0, 63), `${ABC}a`, 'z'.repeat(64), '']) {
      expect(normalizeSha256(bad)).toBeNull()
    }
  })

  it('sha256File：对已知向量给出摘要（不是拿 crypto 自己证自己）', async () => {
    const f = join(root, 'abc.txt')
    writeFileSync(f, 'abc')
    expect(await sha256File(f)).toBe(ABC)
    // 判异：改一个字节必须换摘要
    writeFileSync(f, 'abd')
    expect(await sha256File(f)).not.toBe(ABC)
  })

  it('verifyPackageChecksum：未声明放行，声明了就必须命中（大小写不敏感）', () => {
    expect(verifyPackageChecksum(undefined, ABC)).toBeNull()
    expect(verifyPackageChecksum(ABC, ABC)).toBeNull()
    expect(verifyPackageChecksum(ABC.toUpperCase(), ABC)).toBeNull()
    expect(verifyPackageChecksum('0'.repeat(64), ABC)).toMatch(/校验不通过/)
    // 声明值本身畸形 = 校不出来，按不通过处理而不是悄悄放行
    expect(verifyPackageChecksum(ABC.slice(0, 63), ABC)).toMatch(/校验不通过/)
  })

  it('索引解析：sha256 规整为小写；声明了但畸形的条目整条剔除', () => {
    const index = parseMarketIndex(
      {
        version: 1,
        plugins: [
          {
            id: 'com.ok.p',
            name: 'OK',
            download: 'https://example.com/ok.zip',
            sha256: ` ${ABC.toUpperCase()} `
          },
          { id: 'com.bad.p', name: 'Bad', download: './bad', sha256: 'deadbeef' }
        ]
      },
      root
    )
    expect(index.plugins).toHaveLength(1)
    expect(index.plugins[0]).toMatchObject({ id: 'com.ok.p', sha256: ABC })
  })
})

describe('远程索引（P-3.1）', () => {
  const remoteEntry = (over: Partial<MarketEntry> = {}): MarketEntry => ({
    id: 'com.remote.p',
    name: 'Remote',
    download: 'https://mirror.example.com/com.remote.p-1.0.0.zip',
    ...over
  })

  it('normalizeIndexUrl：只收带 host 的 https，别的一律 null', () => {
    expect(normalizeIndexUrl('https://example.com/plugins.json')).toBe(
      'https://example.com/plugins.json'
    )
    for (const bad of [
      undefined,
      null,
      42,
      '',
      '  ',
      'plugins.json',
      'http://example.com/p.json',
      'ftp://example.com/p.json',
      'https://',
      'javascript:alert(1)'
    ]) {
      expect(normalizeIndexUrl(bad), `应拒绝 ${String(bad)}`).toBeNull()
    }
  })

  it('远程形态的索引：download 只接受 https URL，本地路径与明文 http 条目剔除', () => {
    const index = parseMarketIndex(
      {
        version: 1,
        plugins: [
          remoteEntry(),
          remoteEntry({ id: 'com.http.p', download: 'http://example.com/a.zip' }),
          remoteEntry({ id: 'com.rel.p', download: './plugins/com.rel.p' }),
          remoteEntry({ id: 'com.abs.p', download: '/tmp/somewhere' })
        ]
      },
      root,
      { remote: true }
    )
    expect(index.plugins.map((p) => p.id)).toEqual(['com.remote.p'])
  })

  it('同形态不互相污染：打包索引仍可用本地相对路径（回归护栏）', () => {
    const index = parseMarketIndex(
      { version: 1, plugins: [{ id: 'com.local.p', name: 'L', download: './plugins/com.local.p' }] },
      root
    )
    expect(index.plugins[0].download).toBe(join(root, 'plugins/com.local.p'))
  })

  it('mergeMarketEntries：打包索引胜出，远程同名条目被挡且如实上报', () => {
    const local = [remoteEntry({ id: 'com.leaf.example' }), remoteEntry({ id: 'com.a.p' })]
    const remote = [
      remoteEntry({ id: 'com.leaf.example', download: 'https://evil.example.com/payload.zip' }),
      remoteEntry({ id: 'com.new.p' })
    ]
    const merged = mergeMarketEntries(local, remote)
    expect(merged.plugins.map((p) => p.id)).toEqual(['com.leaf.example', 'com.a.p', 'com.new.p'])
    expect(merged.plugins[0].download).not.toMatch(/evil/)
    expect(merged.shadowed).toEqual(['com.leaf.example'])
  })

  it('缓存信封：缺 url / fetchedAt 或非 https url 都当成没有缓存', () => {
    const ok = {
      url: 'https://example.com/plugins.json',
      fetchedAt: 1234,
      plugins: [remoteEntry()]
    }
    expect(parseRemoteCache(ok, root)).toMatchObject({ fetchedAt: 1234 })
    expect(parseRemoteCache({ ...ok, url: 'http://example.com/p.json' }, root)).toBeNull()
    expect(parseRemoteCache({ ...ok, fetchedAt: undefined }, root)).toBeNull()
    expect(parseRemoteCache({ ...ok, fetchedAt: '1234' }, root)).toBeNull()
    expect(parseRemoteCache(null, root)).toBeNull()
    expect(parseRemoteCache('[]', root)).toBeNull()
  })

  it('缓存信封里的条目重过校验器：手改缓存塞本地路径也进不了市场', () => {
    const cache = parseRemoteCache(
      {
        url: 'https://example.com/plugins.json',
        fetchedAt: 1,
        plugins: [remoteEntry(), remoteEntry({ id: 'com.sneak.p', download: '/etc' })]
      },
      root
    )
    expect(cache?.plugins.map((p) => p.id)).toEqual(['com.remote.p'])
  })

  it('远程闸门：明文 http 与本地/内网目标都拒（内网判定注入桩，不靠真联网）', async () => {
    const publicOnly = async (): Promise<boolean> => false
    await expect(assertRemoteTargetAllowed('https://example.com/p.json', publicOnly)).resolves.toMatchObject(
      { ok: true }
    )
    await expect(assertRemoteTargetAllowed('http://example.com/p.json', publicOnly)).resolves.toMatchObject(
      { ok: false, error: expect.stringContaining('https') }
    )
    await expect(
      assertRemoteTargetAllowed('https://127.0.0.1:8787/p.json', async () => true)
    ).resolves.toMatchObject({ ok: false, error: expect.stringContaining('内网') })
    await expect(assertRemoteTargetAllowed('not a url', publicOnly)).resolves.toMatchObject({
      ok: false,
      error: '地址无效'
    })
  })
})

describe('包体 sha256 校验（分发与信任 P-3.3）', () => {
  const ABC = 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad'

  it('normalizeSha256：只收 64 位十六进制并统一小写', () => {
    expect(normalizeSha256(ABC)).toBe(ABC)
    expect(normalizeSha256(` ${ABC.toUpperCase()} `)).toBe(ABC)
    for (const bad of [undefined, null, 123, ABC.slice(0, 63), `${ABC}a`, 'z'.repeat(64), '']) {
      expect(normalizeSha256(bad)).toBeNull()
    }
  })

  it('sha256File：对已知向量给出摘要（不是拿 crypto 自己证自己）', async () => {
    const f = join(root, 'abc.txt')
    writeFileSync(f, 'abc')
    expect(await sha256File(f)).toBe(ABC)
    // 判异：改一个字节必须换摘要
    writeFileSync(f, 'abd')
    expect(await sha256File(f)).not.toBe(ABC)
  })

  it('verifyPackageChecksum：未声明放行，声明了就必须命中（大小写不敏感）', () => {
    expect(verifyPackageChecksum(undefined, ABC)).toBeNull()
    expect(verifyPackageChecksum(ABC, ABC)).toBeNull()
    expect(verifyPackageChecksum(ABC.toUpperCase(), ABC)).toBeNull()
    expect(verifyPackageChecksum('0'.repeat(64), ABC)).toMatch(/校验不通过/)
    // 声明值本身畸形 = 校不出来，按不通过处理而不是悄悄放行
    expect(verifyPackageChecksum(ABC.slice(0, 63), ABC)).toMatch(/校验不通过/)
  })

  it('索引解析：sha256 规整为小写；声明了但畸形的条目整条剔除', () => {
    const index = parseMarketIndex(
      {
        version: 1,
        plugins: [
          {
            id: 'com.ok.p',
            name: 'OK',
            download: 'https://example.com/ok.zip',
            sha256: ` ${ABC.toUpperCase()} `
          },
          { id: 'com.bad.p', name: 'Bad', download: './bad', sha256: 'deadbeef' }
        ]
      },
      root
    )
    expect(index.plugins).toHaveLength(1)
    expect(index.plugins[0]).toMatchObject({ id: 'com.ok.p', sha256: ABC })
  })
})

describe('远程索引（P-3.1）', () => {
  const remoteEntry = (over: Partial<MarketEntry> = {}): MarketEntry => ({
    id: 'com.remote.p',
    name: 'Remote',
    download: 'https://mirror.example.com/com.remote.p-1.0.0.zip',
    ...over
  })

  it('normalizeIndexUrl：只收带 host 的 https，别的一律 null', () => {
    expect(normalizeIndexUrl('https://example.com/plugins.json')).toBe(
      'https://example.com/plugins.json'
    )
    for (const bad of [
      undefined,
      null,
      42,
      '',
      '  ',
      'plugins.json',
      'http://example.com/p.json',
      'ftp://example.com/p.json',
      'https://',
      'javascript:alert(1)'
    ]) {
      expect(normalizeIndexUrl(bad), `应拒绝 ${String(bad)}`).toBeNull()
    }
  })

  it('远程形态的索引：download 只接受 https URL，本地路径与明文 http 条目剔除', () => {
    const index = parseMarketIndex(
      {
        version: 1,
        plugins: [
          remoteEntry(),
          remoteEntry({ id: 'com.http.p', download: 'http://example.com/a.zip' }),
          remoteEntry({ id: 'com.rel.p', download: './plugins/com.rel.p' }),
          remoteEntry({ id: 'com.abs.p', download: '/tmp/somewhere' })
        ]
      },
      root,
      { remote: true }
    )
    expect(index.plugins.map((p) => p.id)).toEqual(['com.remote.p'])
  })

  it('同形态不互相污染：打包索引仍可用本地相对路径（回归护栏）', () => {
    const index = parseMarketIndex(
      { version: 1, plugins: [{ id: 'com.local.p', name: 'L', download: './plugins/com.local.p' }] },
      root
    )
    expect(index.plugins[0].download).toBe(join(root, 'plugins/com.local.p'))
  })

  it('mergeMarketEntries：打包索引胜出，远程同名条目被挡且如实上报', () => {
    const local = [remoteEntry({ id: 'com.leaf.example' }), remoteEntry({ id: 'com.a.p' })]
    const remote = [
      remoteEntry({ id: 'com.leaf.example', download: 'https://evil.example.com/payload.zip' }),
      remoteEntry({ id: 'com.new.p' })
    ]
    const merged = mergeMarketEntries(local, remote)
    expect(merged.plugins.map((p) => p.id)).toEqual(['com.leaf.example', 'com.a.p', 'com.new.p'])
    expect(merged.plugins[0].download).not.toMatch(/evil/)
    expect(merged.shadowed).toEqual(['com.leaf.example'])
  })

  it('缓存信封：缺 url / fetchedAt 或非 https url 都当成没有缓存', () => {
    const ok = {
      url: 'https://example.com/plugins.json',
      fetchedAt: 1234,
      plugins: [remoteEntry()]
    }
    expect(parseRemoteCache(ok, root)).toMatchObject({ fetchedAt: 1234 })
    expect(parseRemoteCache({ ...ok, url: 'http://example.com/p.json' }, root)).toBeNull()
    expect(parseRemoteCache({ ...ok, fetchedAt: undefined }, root)).toBeNull()
    expect(parseRemoteCache({ ...ok, fetchedAt: '1234' }, root)).toBeNull()
    expect(parseRemoteCache(null, root)).toBeNull()
    expect(parseRemoteCache('[]', root)).toBeNull()
  })

  it('缓存信封里的条目重过校验器：手改缓存塞本地路径也进不了市场', () => {
    const cache = parseRemoteCache(
      {
        url: 'https://example.com/plugins.json',
        fetchedAt: 1,
        plugins: [remoteEntry(), remoteEntry({ id: 'com.sneak.p', download: '/etc' })]
      },
      root
    )
    expect(cache?.plugins.map((p) => p.id)).toEqual(['com.remote.p'])
  })

  it('远程闸门：明文 http 与本地/内网目标都拒（内网判定注入桩，不靠真联网）', async () => {
    const publicOnly = async (): Promise<boolean> => false
    await expect(assertRemoteTargetAllowed('https://example.com/p.json', publicOnly)).resolves.toMatchObject(
      { ok: true }
    )
    await expect(assertRemoteTargetAllowed('http://example.com/p.json', publicOnly)).resolves.toMatchObject(
      { ok: false, error: expect.stringContaining('https') }
    )
    await expect(
      assertRemoteTargetAllowed('https://127.0.0.1:8787/p.json', async () => true)
    ).resolves.toMatchObject({ ok: false, error: expect.stringContaining('内网') })
    await expect(assertRemoteTargetAllowed('not a url', publicOnly)).resolves.toMatchObject({
      ok: false,
      error: '地址无效'
    })
  })
})

describe('resolveDownloadSource', () => {
  it('URL → url', () => {
    expect(resolveDownloadSource('https://example.com/a.zip')).toEqual({
      kind: 'url',
      url: 'https://example.com/a.zip'
    })
  })

  it('本地目录 → dir', () => {
    const dir = join(root, 'pkg')
    mkdirSync(dir)
    expect(resolveDownloadSource(dir)).toEqual({ kind: 'dir', path: dir })
  })

  it('本地 zip 文件 → zip', () => {
    const zip = join(root, 'pkg.zip')
    writeFileSync(zip, 'fake')
    expect(resolveDownloadSource(zip)).toEqual({ kind: 'zip', path: zip })
  })

  it('不存在的 .zip 路径仍归类 zip（交给安装流程报错）', () => {
    const zip = join(root, 'missing.zip')
    expect(resolveDownloadSource(zip)).toEqual({ kind: 'zip', path: zip })
  })
})

describe('findManifestDir', () => {
  it('plugin.json 在根目录', () => {
    writeFileSync(join(root, 'plugin.json'), '{}')
    expect(findManifestDir(root)).toBe(root)
  })

  it('plugin.json 在一层子目录（常见 zip 打包形态）', () => {
    const sub = join(root, 'com.a.p')
    mkdirSync(sub)
    writeFileSync(join(sub, 'plugin.json'), '{}')
    expect(findManifestDir(root)).toBe(sub)
  })

  it('没有 manifest 返回 null', () => {
    expect(findManifestDir(root)).toBeNull()
  })

  it('指向外部的符号链接目录不通过校验（穿越防御）', () => {
    const outside = mkdtempSync(join(tmpdir(), 'leaf-market-out-'))
    try {
      writeFileSync(join(outside, 'plugin.json'), '{}')
      const link = join(root, 'evil')
      symlinkSync(outside, link)
      expect(findManifestDir(root)).toBeNull()
    } finally {
      rmSync(outside, { recursive: true, force: true })
    }
  })
})

// 解压链路依赖系统 zip/unzip（CI 与开发机为 macOS，均有）；缺二进制的环境跳过
const hasZipTools =
  existsSync('/usr/bin/zip') && (existsSync('/usr/bin/unzip') || process.platform === 'win32')

describe.skipIf(!hasZipTools)('extractZip（真实解压）', () => {
  it('解压出的目录可被 findManifestDir 定位', async () => {
    const pkgDir = join(root, 'src-pkg')
    const nested = join(pkgDir, 'com.leaf.example')
    mkdirSync(nested, { recursive: true })
    writeFileSync(join(nested, 'plugin.json'), '{"id":"com.leaf.example","name":"示例"}')
    const zipPath = join(root, 'pkg.zip')
    execFileSync('zip', ['-q', '-r', zipPath, '.'], { cwd: pkgDir })

    const dest = join(root, 'unpacked')
    await extractZip(zipPath, dest)
    expect(findManifestDir(dest)).toBe(join(dest, 'com.leaf.example'))
  })
})
