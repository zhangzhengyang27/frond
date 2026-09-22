import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createElement } from 'react'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * SDK 序列化层单测（#11，审查后补齐——设计文档 §6 承诺的 SDK 侧测试）。
 * 直接测构建产物 dist/index.js（提交入库，e2e 同源），stub launcherApi 驱动：
 * - start() 后 Callback 桥只装一次（C1：重复安装 → 回调分发两次）
 * - List.Section 拍平不重复（C2：sections+items 双写 → 条目翻倍）
 * - 嵌套函数 props 被清洗为可结构化克隆的形态（I2）
 * - 条目 props 变更走 commitUpdate 不污染视图（react-reconciler 0.34 形参错位）
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist', 'index.js')

const submitted: Array<Record<string, unknown>> = []
let callbackSink: ((data: unknown) => void) | null = null
/** 宿主 close 调用次数（pop / popToRoot 在根视图时应各计一次） */
let closed = 0

type Sdk = typeof import('../dist/index.js')
let sdk: Sdk

beforeAll(async () => {
  ;(
    globalThis as unknown as {
      launcherApi: {
        renderView: (v: unknown) => Promise<{ ok: boolean }>
        onCallback: (cb: (data: unknown) => void) => void
        close: () => void
      }
    }
  ).launcherApi = {
    renderView: async (v: unknown) => {
      submitted.push(v as Record<string, unknown>)
      return { ok: true }
    },
    onCallback: (cb) => {
      callbackSink = cb
    },
    close: () => {
      closed += 1
    }
  }
  sdk = await import(DIST)
})

const flush = async (): Promise<void> => new Promise((r) => setTimeout(r, 40))

function lastListView(): { $t: string; items: Array<Record<string, unknown>> } {
  const last = submitted[submitted.length - 1]
  expect(last?.$t).toBe('list')
  return last as { $t: string; items: Array<Record<string, unknown>> }
}

describe('leaf-plugin-sdk 序列化', () => {
  it('start 后回调只分发一次（C1 回归：重复安装桥 → 双倍触发）', async () => {
    expect(callbackSink).toBeTruthy()
    const onAction = vi.fn()
    sdk.start(
      createElement(
        sdk.List,
        {},
        createElement(
          sdk.List.Item,
          {
            title: 'x'
          },
          createElement(sdk.ActionPanel, {}, createElement(sdk.Action, { title: 'go', onAction }))
        )
      )
    )
    await flush()
    const item = lastListView().items[0]
    const cbId = (item.actions?.[0] as { callbackId?: string }).callbackId
    expect(cbId).toBeTruthy()
    callbackSink?.({ id: cbId })
    expect(onAction).toHaveBeenCalledTimes(1)
  })

  it('Section 拍平不重复（C2 回归：sections+items 双写 → 条目翻倍）', async () => {
    sdk.start(
      createElement(
        sdk.List,
        {},
        createElement(
          sdk.List.Section,
          { title: 'S1' },
          createElement(sdk.List.Item, { title: 'a' }),
          createElement(sdk.List.Item, { title: 'b' })
        ),
        createElement(sdk.List.Item, { title: 'top' })
      )
    )
    await flush()
    const titles = lastListView().items.map((i) => i.title)
    expect(titles).toEqual(['a', 'b', 'top'])
  })

  it('嵌套函数 props 被清洗（I2：视图可结构化克隆）', async () => {
    sdk.start(
      createElement(
        sdk.List,
        {},
        createElement(sdk.List.Item, {
          title: 'meta',
          meta: { onTap: () => {}, nested: { fn: () => {}, ok: 1 } }
        })
      )
    )
    await flush()
    const item = lastListView().items[0]
    // 可 JSON 序列化 = 可过 IPC structuredClone
    expect(() => JSON.stringify(item)).not.toThrow()
    const meta = item.meta as { onTap: unknown; nested: { fn: unknown; ok: number } }
    expect(typeof meta.onTap).toBe('string')
    expect(meta.nested.ok).toBe(1)
  })

  it('条目 props 变更经 commitUpdate 不污染视图（react-reconciler 0.34 形参错位回归）', async () => {
    // 0.34 的调用是 commitUpdate(stateNode, type, oldProps, newProps, fiber)，
    // 形参错位会把 fiber 赋进 HostNode.props → 序列化递归 stateNode>props>… 爆栈，
    // root 被打坏后所有后续视图提交静默消失（e2e 表单回传 flake 的真实根因）
    const list = (title: string): void => {
      sdk.start(createElement(sdk.List, null, createElement(sdk.List.Item, { title })))
    }
    list('第一次')
    await flush()
    list('第二次')
    await flush()
    const item = lastListView().items[0]
    expect(item.title).toBe('第二次')
    // fiber 泄漏的特征键（Object.entries 递归进 React 内部对象）
    expect(Object.keys(item)).not.toContain('stateNode')
  })

  it('环状 props 在重复处切断而非炸掉整棵视图（sanitizeValue 守卫回归）', async () => {
    const cyclic: Record<string, unknown> = { title: '环还在' }
    cyclic.self = cyclic // 插件侧成环（或病态深嵌套）
    sdk.start(createElement(sdk.List, null, createElement(sdk.List.Item, cyclic)))
    await flush()
    // 未守卫时这里根本走不到：resetAfterCommit 序列化 RangeError → 视图永不提交
    const item = lastListView().items[0]
    expect(item.title).toBe('环还在')
    const firstLevel = item.self as { title?: string; self?: unknown }
    expect(firstLevel.title).toBe('环还在') // 首层内容照常保留
    expect(firstLevel.self).toBeNull() // 第二次遇到同一对象即切断
    expect(() => JSON.stringify(item)).not.toThrow() // 仍可过 structuredClone
  })

  it('回调 id 失效时说得出原因（不再静默 no-op）', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    callbackSink?.({ id: 'cb-does-not-exist' })
    const explained = warn.mock.calls.some(
      (c) => String(c[0]).includes('回调 id 已失效') && String(c[0]).includes('cb-does-not-exist')
    )
    warn.mockRestore()
    expect(explained).toBe(true)
  })

  it('同一 Provider 生命周期内 useNavigation 引用稳定（否则全树随 context 每轮重渲染）', async () => {
    const seen: unknown[] = []
    function Probe(): null {
      seen.push(sdk.useNavigation())
      return null
    }
    sdk.start(createElement(Probe))
    await flush()
    const first = seen[seen.length - 1] as { push: (e: unknown) => void }
    expect(first).toBeTruthy()
    first.push(createElement(Probe)) // Provider 重渲染（栈顶同类型同位置）
    await flush()
    expect(seen.length).toBeGreaterThan(1)
    expect(seen[seen.length - 1]).toBe(first)
  })
})

describe('navigation.popToRoot（P-2.6）', () => {
  it('push 出详情后 popToRoot 回根视图；已在根视图时按 pop 语义通知宿主关闭', async () => {
    type Nav = ReturnType<typeof sdk.useNavigation>
    let nav: Nav | null = null
    function Root(): ReturnType<typeof createElement> {
      nav = sdk.useNavigation()
      return createElement(sdk.List, {}, createElement(sdk.List.Item, { title: 'root' }))
    }
    sdk.start(createElement(Root))
    await flush()
    expect((submitted[submitted.length - 1] as { $t: string }).$t).toBe('list')

    const closeBefore = closed
    nav!.push(createElement(sdk.Detail, { markdown: '# 详情' }))
    await flush()
    expect((submitted[submitted.length - 1] as { $t: string }).$t).toBe('detail')

    nav!.popToRoot()
    await flush()
    expect((submitted[submitted.length - 1] as { $t: string }).$t).toBe('list')
    // 回根不该顺手关掉插件
    expect(closed).toBe(closeBefore)

    // 已在根视图：与 Raycast 一致，等同 pop → 通知宿主关闭
    nav!.popToRoot()
    await flush()
    expect(closed).toBe(closeBefore + 1)
  })
})

describe('List 的加载/空态伴生状态（P-2.6）', () => {
  it('loading / emptyMessage 随视图 JSON 提交给宿主', async () => {
    sdk.start(createElement(sdk.List, { loading: true, emptyMessage: '还没有数据' }))
    await flush()
    const node = submitted[submitted.length - 1]
    expect(node.$t).toBe('list')
    expect(node.loading).toBe(true)
    expect(node.emptyMessage).toBe('还没有数据')
  })

  it('未声明时 loading 恒发 false、emptyMessage 不下发（宿主不必处理 undefined）', async () => {
    sdk.start(createElement(sdk.List, {}, createElement(sdk.List.Item, { title: 'a' })))
    await flush()
    const node = submitted[submitted.length - 1]
    expect(node.loading).toBe(false)
    expect(node.emptyMessage).toBeUndefined()
  })
})

describe('Detail 的动作面板序列化（P-2.6 第二批）', () => {
  it('<Detail markdown><ActionPanel><Action/></ActionPanel></Detail> 带上 actions + callbackId', async () => {
    const onAction = vi.fn()
    sdk.start(
      createElement(
        sdk.Detail,
        { markdown: '# 详情正文' },
        createElement(sdk.ActionPanel, {}, createElement(sdk.Action, { title: '推一层', onAction }))
      )
    )
    await flush()
    const node = submitted[submitted.length - 1]
    expect(node.$t).toBe('detail')
    const actions = node.actions as Array<Record<string, unknown>>
    expect(actions).toHaveLength(1)
    expect(actions[0].label).toBe('推一层')
    expect(typeof actions[0].callbackId).toBe('string')
  })

  it('没有动作面板时不下发 actions 字段', async () => {
    sdk.start(createElement(sdk.Detail, { markdown: '# 只有正文' }))
    await flush()
    expect(submitted[submitted.length - 1].actions).toBeUndefined()
  })
})
