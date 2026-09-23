import { describe, it, expect, beforeAll, vi } from 'vitest'
import { createElement } from 'react'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * @raycast/api 兼容别名层（#11 M3）。
 * 测的是「Raycast 写法 → 最终提交给宿主的协议形状」：直接 import 构建产物
 * （与插件真实打包同源），stub launcherApi 收 renderView 的 JSON。
 */
const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist', 'index.js')

type AnyView = Record<string, unknown> & { $t: string; items?: AnyView[]; fields?: AnyView[] }

const submitted: AnyView[] = []
/** Alert / open / 偏好的宿主侧记账（P-2.5 那三格走的是 launcherApi，不进 renderView） */
const alerts: Array<{ title?: string; message: string; actions: unknown[] }> = []
const opened: string[] = []
let alertAnswer: string | null = 'ok'
let prefValues: Record<string, unknown> | null = null
let api: typeof import('../dist/index.js')

beforeAll(async () => {
  ;(globalThis as unknown as { launcherApi: Record<string, unknown> }).launcherApi = {
    renderView: async (v: unknown) => {
      submitted.push(v as AnyView)
      return { ok: true }
    },
    onCallback: () => {},
    alert: (input: { title?: string; message: string; actions?: unknown[] }) => {
      alerts.push({
        title: input?.title,
        message: String(input?.message),
        actions: input?.actions ?? []
      })
      return Promise.resolve(alertAnswer)
    },
    openUrl: (url: string) => {
      const u = String(url ?? '')
      const ok = /^https?:|^mailto:/i.test(u)
      if (ok) opened.push(u)
      return Promise.resolve(ok)
    },
    preferences: {
      all: () => Promise.resolve(prefValues ? { ok: true, values: prefValues } : { ok: false })
    }
  }
  api = await import(DIST)
})

const flush = async (): Promise<void> => new Promise((r) => setTimeout(r, 40))
const last = (): AnyView => submitted[submitted.length - 1]

describe('List 族形状适配', () => {
  it('items prop / actions prop / accessories 对象数组 → Frond 协议', async () => {
    const onGo = vi.fn()
    api.render(
      createElement(api.List, {
        items: [
          createElement(api.List.Item, {
            id: 'ignored-in-frond',
            title: 'frond/launcher',
            subtitle: '启动器主仓库',
            accessories: [{ title: 'star', value: '1.2k' }, 'plain'],
            actions: [
              createElement(api.Action, { title: '查看', onAction: onGo }),
              createElement(api.Action.Copy, { title: '复制地址', text: 'git@example.com' })
            ]
          })
        ]
      })
    )
    await flush()
    const item = last().items?.[0]
    expect(item?.title).toBe('frond/launcher')
    expect(item?.accessories).toEqual(['1.2k', 'plain'])
    const actions = item?.actions as AnyView[]
    expect(actions.map((a) => a.label)).toEqual(['查看', '复制地址'])
    expect(typeof actions[0].callbackId).toBe('string')
    expect(actions[1].type).toBe('copy')
    expect(actions[1].payload).toBe('git@example.com')
  })

  it('children 写法（不套 ActionPanel）同样工作', async () => {
    api.render(
      createElement(
        api.List,
        null,
        createElement(
          api.List.Item,
          { title: 'A' },
          createElement(api.Action, { title: 'x', onAction: () => {} })
        )
      )
    )
    await flush()
    const item = last().items?.[0]
    expect((item?.actions as AnyView[]).map((a) => a.label)).toEqual(['x'])
  })

  it('宿主没有的能力：首次调用 warn 一次，且不影响渲染', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.render(createElement(api.List, { searchBarPlaceholder: '搜索…', items: [] }))
    await flush()
    expect(last().$t).toBe('list')
    // P-2.3 起 Toast/LocalStorage/Cache 已接宿主能力；P-2.5 起 Alert / open /
    // getPreferenceValues 也接上了——「同名只说一次」改用仍未提供的 getSelectedText 来验。
    // 同时反向钉一条：Alert 不再 warn（接线做没做，看这条警告还在不在）
    await api.getSelectedText()
    await api.getSelectedText()
    await api.Alert.show({ title: 't', message: 'm' })
    const placeholderWarns = warn.mock.calls.filter((c) =>
      String(c[0]).includes('searchBarPlaceholder')
    )
    const selectedWarns = warn.mock.calls.filter((c) => String(c[0]).includes('getSelectedText'))
    const alertWarns = warn.mock.calls.filter((c) => String(c[0]).includes('Alert'))
    warn.mockRestore()
    expect(placeholderWarns).toHaveLength(1)
    expect(selectedWarns).toHaveLength(1) // 同名只说一次，不刷屏
    expect(alertWarns).toHaveLength(0) // Alert 已接到宿主原生模态框
    expect(alerts).toHaveLength(1)
  })
})

describe('Form 族形状适配', () => {
  it('name/title/defaultValue → id/label/initial；Form.Submit 变 submitLabel；Dropdown 收选项', async () => {
    const onSubmit = vi.fn()
    api.render(
      createElement(
        api.Form,
        { onSubmit },
        createElement(api.Form.TextField, {
          name: 'q',
          title: '查询',
          placeholder: '输入',
          defaultValue: 'dv'
        }),
        createElement(api.Form.Checkbox, { name: 'on', title: '开启', defaultValue: true }),
        createElement(
          api.Form.Dropdown,
          { name: 'kind', title: '类型', defaultValue: '建议' },
          createElement(api.Form.Dropdown.Item, { title: '建议', value: '建议' }),
          createElement(api.Form.Dropdown.Item, { title: '缺陷', value: '缺陷' })
        ),
        createElement(api.Form.Submit, { title: '跑一下' })
      )
    )
    await flush()
    const view = last()
    expect(view.$t).toBe('form')
    expect(view.submitLabel).toBe('跑一下')
    const fields = view.fields as AnyView[]
    expect(fields.map((f) => f.id)).toEqual(['q', 'on', 'kind'])
    expect(fields[0]).toMatchObject({ label: '查询', placeholder: '输入', initial: 'dv' })
    expect(fields[1]).toMatchObject({ type: 'checkbox', initial: true })
    expect(fields[2]).toMatchObject({ type: 'select', options: ['建议', '缺陷'], initial: '建议' })
    expect(typeof view.submitId).toBe('string')
  })
})

describe('Detail 适配', () => {
  it('markdown 直传；纯文本子节点降级为 text', async () => {
    api.render(createElement(api.Detail, { markdown: '# 标题' }))
    await flush()
    expect(last()).toMatchObject({ $t: 'detail', markdown: '# 标题' })
  })
})

describe('List 的 isLoading / emptyView 翻译（P-2.6）', () => {
  it('isLoading → loading；EmptyView 元素收成一句文案', async () => {
    api.render(
      createElement(api.List, {
        isLoading: true,
        emptyView: createElement(api.EmptyView, { title: '没结果', description: '先同步一次' })
      })
    )
    await flush()
    const node = last()
    expect(node.$t).toBe('list')
    expect(node.loading).toBe(true)
    expect(node.emptyMessage).toBe('没结果 — 先同步一次')
  })

  it('不传 isLoading 时显式下发 false（宿主读到的是布尔不是 undefined）', async () => {
    api.render(createElement(api.List, {}))
    await flush()
    expect(last().loading).toBe(false)
  })
})

describe('Detail.actions 翻译（P-2.6 第二批）', () => {
  it('actions prop（Raycast 形态）→ SDK 的 children ActionPanel，不再是 notSupported', async () => {
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    api.render(
      createElement(api.Detail, {
        markdown: '# 详情',
        actions: createElement(
          api.ActionPanel,
          {},
          createElement(api.Action.Copy, { name: '复制一下', text: 'abc' })
        )
      })
    )
    await flush()
    const node = last()
    warn.mockRestore()
    expect(node.$t).toBe('detail')
    expect((node.actions as Array<Record<string, unknown>>)[0].label).toBe('复制一下')
    expect(warn.mock.calls.filter((c) => String(c[0]).includes('Detail.actions'))).toHaveLength(0)
  })
})

/**
 * P-2.5：Raycast 的 Alert / open / getPreferenceValues 三格。
 * 钉的是「Raycast 写法 → 宿主收到的形状」，尤其是 Action 的**顺序**与
 * 按下之后回什么——顺序错了用户回车选到的就不是主操作。
 */
describe('Alert 适配', () => {
  it('primary / danger / cancel 排成宿主要的形状，按下回对应的 Action', async () => {
    alerts.length = 0
    alertAnswer = 'del'
    const primary = new api.Alert.Action('保存', 'save')
    const danger = new api.Alert.Action('删除', 'del', 'destructive')
    const cancel = new api.Alert.Action('取消', 'no', 'cancel')
    const pressed = await api.Alert.show({
      title: '要保存吗',
      message: '会覆盖现有文件',
      primaryAction: primary,
      dangerAction: danger,
      cancelAction: cancel
    })
    expect(alerts[0].actions).toEqual([
      { id: 'save', title: '保存', style: 'default' },
      { id: 'del', title: '删除', style: 'destructive' },
      { id: 'no', title: '取消', style: 'cancel' }
    ])
    expect(pressed).toBe(danger)
    expect(pressed?.id).toBe('del')
  })

  it('按下的是「只有好」的确认框时回 null（不假造一个 Action）', async () => {
    alertAnswer = null
    await expect(api.alert('好了', '完成了')).resolves.toBeNull()
    expect(alerts.at(-1)?.title).toBe('好了')
    expect(alerts.at(-1)?.actions).toEqual([])
    alertAnswer = 'ok'
  })
})

describe('open 与 getPreferenceValues 适配', () => {
  it('白名单内的 URL 交给宿主；被拒的不静默成功', async () => {
    opened.length = 0
    await api.open('https://example.com/x')
    expect(opened).toEqual(['https://example.com/x'])
    // file: 被宿主拒 —— 这里不抛，但也不会谎报已打开
    await expect(api.open('file:///etc/passwd')).resolves.toBeUndefined()
    expect(opened).toHaveLength(1)
  })

  it('getPreferenceValues 取回声明过的偏好；宿主没给时是空对象', async () => {
    prefValues = { apiKey: 'k', theme: 'dark' }
    await expect(api.getPreferenceValues()).resolves.toEqual({ apiKey: 'k', theme: 'dark' })
    prefValues = null
    await expect(api.getPreferenceValues()).resolves.toEqual({})
  })
})
