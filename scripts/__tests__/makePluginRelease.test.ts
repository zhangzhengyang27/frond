import { describe, it, expect } from 'vitest'
import { buildIndexEntry } from '../lib/makePluginRelease'

/**
 * make-plugin-release 的索引条目构造。
 * 语义必须与主进程 market.ts 的静默剔除规则**同源**（isValidPluginId、sha256 64 位
 * 十六进制），否则作者本地生成时能过、上市场就被静默消失——那正是文档里警告过的事故。
 * 区别于主进程的是：这里**给原因**（作者侧要能自查），主进程侧才是静默剔除。
 */
describe('makePluginRelease · buildIndexEntry（与 market.ts 剔除规则同源）', () => {
  const base = {
    id: 'com.example.demo',
    name: 'Demo',
    download: 'https://example.com/demo-1.0.0.zip',
    sha256: 'a'.repeat(64)
  }

  it('合法条目原样构造（可选字段透传）', () => {
    expect(buildIndexEntry({ ...base, version: '1.0.0', description: '演示', author: 'zz' }).entry).toEqual({
      id: 'com.example.demo',
      name: 'Demo',
      version: '1.0.0',
      description: '演示',
      author: 'zz',
      download: 'https://example.com/demo-1.0.0.zip',
      sha256: 'a'.repeat(64)
    })
  })

  it('id 不合法给原因：sys. 前缀 / 含 ../ 或.. / 空串', () => {
    expect(buildIndexEntry({ ...base, id: 'sys.evil' })!.error).toContain('sys.')
    expect(buildIndexEntry({ ...base, id: 'a..b' })!.error).toBeTruthy()
    expect(buildIndexEntry({ ...base, id: '' })!.error).toBeTruthy()
  })

  it('缺 name 或 download 给原因', () => {
    expect(buildIndexEntry({ id: 'com.x.y', name: '', download: 'https://x/z.zip' })!.error).toContain('name')
    expect(buildIndexEntry({ id: 'com.x.y', name: 'X', download: '' })!.error).toContain('download')
  })

  it('sha256 不是 64 位十六进制给原因；缺省则不带该字段', () => {
    expect(buildIndexEntry({ ...base, sha256: 'xyz' })!.error).toContain('sha256')
    const noHash = buildIndexEntry({ ...base, sha256: undefined })
    expect(noHash!.entry).toBeTruthy()
    expect(noHash!.entry!.sha256).toBeUndefined()
  })

  it('download 在作者侧是 https 直链；明文 http 直接拒绝（远程索引只收 https）', () => {
    expect(buildIndexEntry({ ...base, download: 'http://example.com/x.zip' })!.error).toContain('https')
  })
})
