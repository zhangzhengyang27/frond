import { describe, it, expect } from 'vitest'
import { skeletonize } from '../skeleton'

/**
 * skeleton 骨架词（对标 Vicinae skeletonizeToken）：CJK 字符转拼音首字母，
 * latin/数字保留小写，非字母数字丢弃——让中文文件名可用拼音首字母搜索
 * （如「项目计划.md」→ xmjhmd，输入 xmjh 前缀命中）。
 */
describe('skeletonize', () => {
  it('CJK 文件名转拼音首字母', async () => {
    expect(await skeletonize('项目计划.md')).toBe('xmjhmd')
  })

  it('latin 与数字保留小写', async () => {
    expect(await skeletonize('README.md')).toBe('readmemd')
    expect(await skeletonize('会议纪要2024.txt')).toBe('hyjy2024txt')
  })

  it('混合中英：CJK 转首字母、latin 保留、符号丢弃', async () => {
    expect(await skeletonize('Trae-工作区 设置.json')).toBe('traegzqszjson')
  })

  it('空串 / 纯符号返回空串', async () => {
    expect(await skeletonize('')).toBe('')
    expect(await skeletonize('—·…')).toBe('')
  })
})
