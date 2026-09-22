
describe('sizeSummaryOf', () => {
  it('text/link 统计字符数', () => {
    expect(sizeSummaryOf(mk({ id: '1', text: '你好 world' }))).toBe('8 字符')
    expect(sizeSummaryOf(mk({ id: '2', kind: 'link', text: 'https://a.b' }))).toBe('11 字符')
    expect(sizeSummaryOf(mk({ id: '3', kind: 'text', text: '' }))).toBe('0 字符')
    expect(sizeSummaryOf(mk({ id: '9', kind: 'link', text: undefined }))).toBe('0 字符')
  })

  it('image 显示宽 × 高，缺失回退未知尺寸', () => {
    expect(sizeSummaryOf(mk({ id: '4', kind: 'image', width: 1920, height: 1080 }))).toBe(
