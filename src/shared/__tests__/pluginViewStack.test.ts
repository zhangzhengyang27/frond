import { describe, it, expect } from 'vitest'
import {
  PLUGIN_VIEW_STACK_MAX,
  type PluginViewLayer,
  popLayer,
  pluginCanGoBack,
  pushLayer,
  replaceLayer,
  topLayer
} from '../pluginViewStack'

/**
 * 插件视图栈的判据（P-2④ 第二半）。
 *
 * 这一格唯一的存在理由是「插件自己导航时，用户按返回该退回哪」。两种坏法都难看：
 * 该压不压 → 返回键一步跳回根；不该压乱压 → 返回键退的是上一次搜索结果。
 * 所以断言全押在「谁让栈生长」这一条上，而不是押在数据长相上。
 */
const L = (id: string, kind: PluginViewLayer['kind'] = 'list'): PluginViewLayer => ({ kind, id })

describe('生长只由插件明说（pushLayer），重绘永远不生长（replaceLayer）', () => {
  it('搜索型插件逐次重画：条目怎么变，栈深都是 1', () => {
    let stack: PluginViewLayer[] = []
    for (const n of [0, 1, 2]) stack = replaceLayer(stack, { kind: 'list', id: `search-${n}` })
    expect(stack).toHaveLength(1)
    expect(pluginCanGoBack(stack)).toBe(false)
  })

  it('同一层重绘 depth 不变、id 不变（渲染端靠 id 复用实例，焦点才不丢）', () => {
    const one = replaceLayer([], L('search'))
    const two = replaceLayer(one, L('search'))
    expect(two).toHaveLength(1)
    expect(two[0].id).toBe('search')
  })

  it('换了 id 也只替换栈顶，**不**多长一层（进下一层要明说 push）', () => {
    const first = replaceLayer([], L('search'))
    const second = replaceLayer(first, L('detail'))
    expect(second.map((l) => l.id)).toEqual(['detail'])
  })

  it('pushLayer 才生长：进一层就有一层可退', () => {
    const deeper = pushLayer([L('root')], L('repos'))
    expect(deeper.map((l) => l.id)).toEqual(['root', 'repos'])
    expect(pluginCanGoBack(deeper)).toBe(true)
  })
})

describe('弹出与根层', () => {
  it('根层不许弹（退根层 = 关插件，那是胶囊的另一个动作）', () => {
    expect(popLayer([L('root')])).toBeNull()
    expect(popLayer([])).toBeNull()
  })

  it('弹一层只去掉栈顶，下面的层按原顺序留着', () => {
    const three = pushLayer(pushLayer([L('a')], L('b')), L('c'))
    expect(popLayer(three)?.map((l) => l.id)).toEqual(['a', 'b'])
    expect(topLayer(popLayer(three) ?? [])?.id).toBe('b')
  })
})

describe('栈深上限：丢最底下一层，而不是拒收新层', () => {
  it('第 9 层压进来，栈里是 2..9 —— 宁可少一层返回，也不让插件这次渲染失败', () => {
    let stack: PluginViewLayer[] = [L('l0')]
    for (let i = 1; i <= PLUGIN_VIEW_STACK_MAX; i++) stack = pushLayer(stack, L(`l${i}`))
    expect(stack).toHaveLength(PLUGIN_VIEW_STACK_MAX)
    expect(stack[0].id).toBe('l1')
    expect(topLayer(stack)?.id).toBe(`l${PLUGIN_VIEW_STACK_MAX}`)
  })
})
