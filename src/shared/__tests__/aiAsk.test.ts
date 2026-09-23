import { describe, it, expect } from 'vitest'
import { AI_ASK_BODY_MAX, buildEntryAsk } from '../aiAsk'

/**
 * 「问 AI：解释这条」的提示词拼装（P-4③）。
 * 判据不是文案好看，是**多少上下文离开本机**：正文截断、每种类型只带自己那一份。
 */
describe('buildEntryAsk', () => {
  it('文件行带的是路径，不是标题', () => {
    expect(
      buildEntryAsk({ title: 'notes.md', subtitle: '~/Documents', action: { type: 'file', path: '/Users/x/Documents/notes.md' } })
    ).toBe('解释这个本地文件是什么、通常用来做什么：/Users/x/Documents/notes.md')
  })

  it('应用行带标题与安装路径', () => {
    const t = buildEntryAsk({ title: 'Safari', action: { type: 'app', path: '/Applications/Safari.app' } })
    expect(t).toContain('Safari')
    expect(t).toContain('/Applications/Safari.app')
  })

  it('链接行用 url，正文行用 content', () => {
    expect(buildEntryAsk({ title: 'GH', action: { type: 'openUrl', url: 'https://github.com' } })).toContain(
      'https://github.com'
    )
    expect(
      buildEntryAsk({ title: '片段', action: { type: 'snippetItem', content: 'SELECT * FROM t' } })
    ).toContain('SELECT * FROM t')
  })

  it('正文超过上限要截断并明说，不能整篇寄出去', () => {
    const long = '啊'.repeat(AI_ASK_BODY_MAX + 500)
    const t = buildEntryAsk({ title: 'x', action: { type: 'clipboardItem', content: long } })
    expect(t).toContain('…（已截断）')
    expect(t.length).toBeLessThan(AI_ASK_BODY_MAX + 80)
  })

  it('内容缺省时退回 subtitle / title，不留空问题', () => {
    expect(buildEntryAsk({ title: '剪贴', subtitle: '一段文本', action: { type: 'clipboardItem' } })).toContain(
      '一段文本'
    )
    expect(buildEntryAsk({ title: '剪贴', action: { type: 'clipboardItem' } })).toContain('剪贴')
  })

  it('模块与内联页问的是「这个功能能做什么」', () => {
    const t = buildEntryAsk({ title: '录屏', subtitle: '/screen-recorder', action: { type: 'module' } })
    expect(t).toContain('介绍 Frond 的这个功能')
    expect(t).toContain('（/screen-recorder）')
  })

  it('未知类型与空标题都有兜底，不会拼出「解释这条搜索结果是什么：」这种半截问题', () => {
    expect(buildEntryAsk({ title: '正则测试', subtitle: 'com.frond.regex' })).toContain('正则测试')
    expect(buildEntryAsk({ title: '   ' })).toContain('(无标题)')
    expect(buildEntryAsk({})).toContain('(无标题)')
  })

  it('正文尾部空白清掉（剪贴板常见结尾一堆换行）', () => {
    const t = buildEntryAsk({ title: 'x', action: { type: 'clipboardItem', content: 'abc\n\n  ' } })
    expect(t.endsWith('abc')).toBe(true)
  })
})
