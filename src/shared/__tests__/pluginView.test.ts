import { describe, it, expect } from 'vitest'
import { parsePluginView } from '../plugin-protocol'

/**
 * React 视图协议 v2 解析（#11）：SDK 提交的 JSON 视图树 → v1 条目列表。
 * fail-closed：非法节点/动作剔除，sections 拍平，detail 视图降级为
 * 「单条占位条目 + detail 正文」复用胶囊既有渲染管线。
 */
describe('parsePluginView', () => {
  it('list 视图：items 拍平保留字段与 callbackId', () => {
    const items = parsePluginView({
      $t: 'list',
      items: [
        {
          title: 'frond/launcher',
          subtitle: '主仓库',
          icon: 'git-repository-line',
          accessories: ['TS'],
          keywords: ['repo'],
          detail: '# README',
          detailFormat: 'markdown',
          actions: [
            { label: '打开', type: 'open', payload: 'https://github.com' },
            { label: '详情', type: 'callback', payload: 'item:1', callbackId: 'cb-1' }
          ]
        }
      ]
    })
    expect(items).toHaveLength(1)
    expect(items[0]).toMatchObject({ title: 'frond/launcher', subtitle: '主仓库' })
    expect(items[0].actions[1].callbackId).toBe('cb-1')
  })

  it('sections 拍平为扁平列表（v1 不分组渲染）', () => {
    const items = parsePluginView({
      $t: 'list',
      sections: [
        { title: '仓库', items: [{ title: 'a', actions: [{ label: 'x', type: 'callback', payload: 'p', callbackId: 'c1' }] }] },
        { items: [{ title: 'b', actions: [{ label: 'y', type: 'callback', payload: 'q', callbackId: 'c2' }] }] }
      ]
    })
    expect(items.map((i) => i.title)).toEqual(['a', 'b'])
    expect(items[0].actions[0].callbackId).toBe('c1')
  })

  it('detail 视图降级为单条占位条目', () => {
    const items = parsePluginView({ $t: 'detail', markdown: '# 详情正文' })
    expect(items).toHaveLength(1)
    expect(items[0].detail).toBe('# 详情正文')
    expect(items[0].detailFormat).toBe('markdown')
  })

  it('detail 视图 text 优先级低于 markdown，纯 text 也支持', () => {
    const items = parsePluginView({ $t: 'detail', text: '纯文本' })
    expect(items[0].detail).toBe('纯文本')
    expect(items[0].detailFormat).toBe('text')
  })

  it('detail 视图携带 Detail.actions（P-2.6：动作挂上占位条目；非法动作剔除）', () => {
    // SDK 侧 reconciler 把 ActionPanel 序列化到 detail 节点的 actions 字段（见该文件
    // 「动作挂到那条占位条目上即可复用既有的 runPluginAction 通路」），宿主必须接住 ——
    // 2026-09-24 前 host 侧硬编码 actions:[] 把它丢了，react-view P-2.6 因此恒红
    const items = parsePluginView({
      $t: 'detail',
      markdown: '# 详情',
      actions: [
        { type: 'callback', label: '复制结果', callbackId: 'copy-1' },
        { label: '缺 type 的非法动作' },
        'not-an-object'
      ]
    })
    expect(items[0].actions).toHaveLength(1)
    expect(items[0].actions[0]).toMatchObject({ label: '复制结果', callbackId: 'copy-1' })
  })

  it('非法视图：未知 $t / 非对象 / 空 detail 拒绝；超长 markdown 截断', () => {
    expect(parsePluginView({ $t: 'grid' })).toEqual([])
    expect(parsePluginView('list')).toEqual([])
    expect(parsePluginView(null)).toEqual([])
    expect(parsePluginView({ $t: 'detail', markdown: 42 })).toEqual([])
    const truncated = parsePluginView({ $t: 'detail', markdown: 'x'.repeat(100 * 1024 + 1) })
    expect(truncated).toHaveLength(1)
    expect(truncated[0].detail?.length).toBe(100 * 1024)
  })

  it('item 清洗：title 必填、非法动作剔除（纯展示条目保留）', () => {
    const items = parsePluginView({
      $t: 'list',
      items: [
        { title: 'bad', actions: [{ label: 'x', type: 'sudo', payload: 'p' }] },
        { title: 'noaction' }
      ]
    })
    expect(items.map((i) => i.title)).toEqual(['bad', 'noaction'])
    expect(items[0].actions).toEqual([])
  })

  it('数量封顶 300 条', () => {
    const many = Array.from({ length: 400 }, (_, i) => ({
      title: `t${i}`,
      actions: [{ label: 'x', type: 'callback', payload: String(i), callbackId: `c${i}` }]
    }))
    expect(parsePluginView({ $t: 'list', items: many })).toHaveLength(300)
  })
})
