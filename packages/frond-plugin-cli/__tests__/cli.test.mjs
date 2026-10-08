import { describe, expect, it } from 'vitest'
import {
  buildIndexEntry,
  normalizeInit,
  renderScaffold,
  slugify,
  upsertEntry
} from '../lib.mjs'

describe('slugify / normalizeInit', () => {
  it('中英混排归一为 slug；id 缺省 com.<author>.<slug>', () => {
    expect(slugify('My Cool Tool')).toBe('my-cool-tool')
    const r = normalizeInit({ name: 'Weekly Report', author: 'zhang' })
    expect(r.id).toBe('com.zhang.weekly-report')
    expect(r.dir).toBe('weekly-report')
  })

  it('纯中文名：id 无法自动派生，报错并指路 --id（name 可继续中文）', () => {
    const r = normalizeInit({ name: '周报生成器', author: 'zhang' })
    expect(r.error).toContain('--id')
    // 但显式给 id 就没问题，目录名回落 slug 逻辑仍然成立
    const ok = normalizeInit({ name: '周报生成器', author: 'zhang', id: 'com.zhang.weekly' })
    expect(ok.id).toBe('com.zhang.weekly')
  })

  it('显式 id 优先；非法 id 给原因', () => {
    expect(normalizeInit({ name: 'X', id: 'com.me.x' }).id).toBe('com.me.x')
    expect(normalizeInit({ name: 'X', id: 'sys.evil' }).error).toContain('id 不合法')
    expect(normalizeInit({ name: 'X', id: 'a..b' }).error).toContain('id 不合法')
  })

  it('缺 name 报错', () => {
    expect(normalizeInit({}).error).toBeDefined()
  })
})

describe('renderScaffold', () => {
  it('清单/页面/README 三件齐全，权限为空数组（按需声明）', () => {
    const { manifest, html, readme } = renderScaffold({
      id: 'com.me.demo',
      name: 'Demo',
      author: 'me',
      commandTitle: 'Demo'
    })
    expect(manifest.id).toBe('com.me.demo')
    expect(manifest.permissions).toEqual([])
    expect(manifest.commands[0].code).toBe('list')
    expect(html).toContain('launcherApi.renderList')
    expect(html).toContain('frondPluginHooks')
    expect(readme).toContain('frond-plugin init')
  })
})

describe('upsertEntry', () => {
  const entry = buildIndexEntry({
    id: 'com.me.demo',
    name: 'Demo',
    version: '0.1.0',
    download: 'https://host/demo.zip',
    sha256: 'a'.repeat(64)
  })
  expect(entry.error).toBeUndefined()

  it('空文本建新索引；未知字段透传；非对象索引按空处理', () => {
    const a = JSON.parse(upsertEntry('', entry.entry))
    expect(a.version).toBe(1)
    expect(a.plugins).toHaveLength(1)
    const b = JSON.parse(upsertEntry('{"maintainer":"me"}', entry.entry))
    expect(b.maintainer).toBe('me')
    expect(b.plugins).toHaveLength(1)
    expect(JSON.parse(upsertEntry('not json', entry.entry)).plugins).toHaveLength(1)
    expect(JSON.parse(upsertEntry('[1,2]', entry.entry)).plugins).toHaveLength(1)
  })

  it('同 id 替换原位（不追加），条目里的坏行被过滤', () => {
    const raw = JSON.stringify({
      version: 2,
      note: 'keep',
      plugins: [
        { id: 'com.other.x', name: 'X', download: 'https://h/x.zip' },
        { id: 'com.me.demo', name: '旧名', download: 'https://h/old.zip' },
        'garbage'
      ]
    })
    const next = JSON.parse(upsertEntry(raw, entry.entry))
    expect(next.version).toBe(2)
    expect(next.note).toBe('keep')
    expect(next.plugins).toHaveLength(2)
    expect(next.plugins.find((p) => p.id === 'com.me.demo').name).toBe('Demo')
  })
})

describe('buildIndexEntry（re-export 同源校验冒烟）', () => {
  it('非 https download 拒绝', () => {
    expect(
      buildIndexEntry({ id: 'com.a.b', name: 'b', download: 'http://h/b.zip' }).error
    ).toContain('https')
  })
})
