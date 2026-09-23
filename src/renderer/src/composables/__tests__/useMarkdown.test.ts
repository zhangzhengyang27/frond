import { describe, it, expect } from 'vitest'
import { useMarkdown } from '../useMarkdown'

/**
 * 演示模式缩放。
 *
 * 这个实现是**重建**的（原文件的函数体在恢复事故里没了，只剩签名），所以把选定的口径钉住：
 * 范围与步进照 `MarkdownPreview` 既有的那套（0.5–2、±0.1），两处不同尺子是迟早要对不上的。
 * 状态是模块级共享的，用例之间会互相影响 —— 下面按「先归位再断言」写，不假设初始值。
 */
function setTo(target: number): void {
  const { scale, onZoom } = useMarkdown()
  let guard = 0
  while (Number(scale.value) !== target && guard++ < 40) {
    onZoom(Number(scale.value) < target ? 'in' : 'out')
  }
}

describe('useMarkdown 演示缩放', () => {
  it('scale 是字符串（要插进 calc(1rem * …)），scaleToShow 是给人看的百分数', () => {
    setTo(1)
    const { scale, scaleToShow } = useMarkdown()
    expect(scale.value).toBe('1')
    expect(scaleToShow.value).toBe('100%')
  })

  it('放大一档：1 → 1.1，显示跟着走 110%', () => {
    setTo(1)
    const { scale, scaleToShow, onZoom } = useMarkdown()
    onZoom('in')
    expect(scale.value).toBe('1.1')
    expect(scaleToShow.value).toBe('110%')
  })

  it('顶到底就不再涨（连按 20 次也停在 2）', () => {
    const { scale, onZoom } = useMarkdown()
    for (let i = 0; i < 20; i++) onZoom('in')
    expect(Number(scale.value)).toBe(2)
    for (let i = 0; i < 40; i++) onZoom('out')
    expect(Number(scale.value)).toBe(0.5)
  })

  it('两个视图共享同一份缩放（换页不该跳回 100%）', () => {
    setTo(1)
    const a = useMarkdown()
    const b = useMarkdown()
    a.onZoom('in')
    expect(b.scale.value).toBe('1.1')
  })
})
