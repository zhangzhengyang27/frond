// @vitest-environment happy-dom
/**
 * 胶囊内联页注册表（P-2④）。
 *
 * 这张表替代的是模板里那条 24 节硬链，所以守卫要钉住两件事：
 * ①**每个页面 id 都有 def**（漏一条以前是运行时一片空白，没人报错）；
 * ②**优先序是设计而不是数组位置**（栈顶 > 插件声明式视图 > 什么都没有，
 *   以及表单优先于列表——插件先提表单再提列表时旧行为是后者盖前者）。
 */
import { describe, it, expect } from 'vitest'
import { FIRST_PARTY_PAGE_VALUES } from '@shared/commands'
import {
  LAUNCHER_PAGE_VIEWS,
  pickPageView,
  type LauncherViewCtx,
  type McpCallView
} from '../launcherPageViews'

const ctx = (over: Partial<LauncherViewCtx> = {}): LauncherViewCtx => ({
  query: () => '',
  clipFilter: () => 'all',
  setClipFilter: () => {},
  hideWindow: () => {},
  popPage: () => {},
  onSnippetCopied: () => {},
  askAIWithText: () => {},
  createCalendarEvent: () => {},
  saveQuicklinkForm: () => {},
  openQuicklinkArg: () => {},
  openPluginWithArgs: () => {},
  submitMcpArg: () => {},
  qlArgFields: () => [],
  qlArgInitial: () => ({}),
  pluginArgFields: () => [],
  mcpArgFields: () => [],
  mcpArgInitial: () => ({}),
  qlArgTarget: () => null,
  pluginArgTarget: () => null,
  mcpArgTarget: () => null,
  mcpCall: () => null,
  pluginForm: () => null,
  pluginList: () => null,
  pluginId: () => '',
  pluginListLoading: () => false,
  pluginListEmptyMessage: () => null,
  submitPluginForm: () => {},
  closePluginForm: () => {},
  ...over
})

describe('LAUNCHER_PAGE_VIEWS', () => {
  it('每个内联页 id 都有 def（漏一条以前只会表现为按下去一片空白）', () => {
    const missing = FIRST_PARTY_PAGE_VALUES.filter((id) => !LAUNCHER_PAGE_VIEWS[id]?.component)
    expect(missing, `这些页面没有注册：${missing.join(', ')}`).toEqual([])
  })

  it('def 的 id 集合就是「页面 + 插件两态」，不多不少', () => {
    expect(Object.keys(LAUNCHER_PAGE_VIEWS).sort()).toEqual(
      [...FIRST_PARTY_PAGE_VALUES, 'pluginform', 'pluginlist'].sort()
    )
  })
})

describe('pickPageView', () => {
  it('栈空且插件没开 → 什么都不渲染（根列表那一路）', () => {
    expect(pickPageView(null, ctx())).toBe(null)
  })

  it('栈顶优先：插件开着但栈上有人时，渲染栈顶那一页', () => {
    const view = pickPageView(
      'notes',
      ctx({ pluginList: () => [{ title: 'x' }] as never })
    )
    expect(view?.component).toBe(LAUNCHER_PAGE_VIEWS.notes.component)
  })

  it('栈空才轮到插件：表单优先于列表（同一个插件两态都在时）', () => {
    const both = ctx({
      pluginForm: () => ({ fields: [], submitId: 's' }) as never,
      pluginList: () => [{ title: 'x' }] as never
    })
    expect(pickPageView(null, both)?.component).toBe(LAUNCHER_PAGE_VIEWS.pluginform.component)
    expect(pickPageView(null, ctx({ pluginList: () => [{ title: 'x' }] as never }))?.component).toBe(
      LAUNCHER_PAGE_VIEWS.pluginlist.component
    )
  })

  it('数据没就位的参数页不渲染（旧模板里 `&& qlArgTarget` 那几个条件）', () => {
    expect(pickPageView('qlarg', ctx())).toBe(null)
    expect(pickPageView('qlarg', ctx({ qlArgTarget: () => ({ key: 'q' }) }))?.component).toBe(
      LAUNCHER_PAGE_VIEWS.qlarg.component
    )
    expect(pickPageView('mcpcall', ctx())).toBe(null)
  })

  it('props 走 getter：查询词变了要跟着变（快照会让页面永远停在挂载那一刻）', () => {
    let q = '第一次'
    const c = ctx({ query: () => q })
    const view = pickPageView('dictionary', c)
    expect(view?.props).toEqual({ query: '第一次' })
    q = '第二次'
    expect(pickPageView('dictionary', c)?.props).toEqual({ query: '第二次' })
  })

  it('mcpcall 的 key 跟着调用次数走（同一个工具连跑两次必须重挂载重发）', () => {
    const call = (seq: number): LauncherViewCtx =>
      ctx({
        mcpCall: () => ({ serverId: 's', serverLabel: 'S', tool: 't', args: {}, seq })
      })
    expect(pickPageView('mcpcall', call(1))?.key).toBe(1)
    expect(pickPageView('mcpcall', call(2))?.key).toBe(2)
    // 其余页面的 key 就是页面 id：换页必重挂载（与旧硬链的 vnode 行为一致）
    expect(pickPageView('notes', ctx())?.key).toBe('notes')
    // 两张参数表单都是 FormPage：不给键 Vue 会复用实例、留着上一页填过的值
    expect(pickPageView('qlarg', ctx({ qlArgTarget: () => ({}) }))?.key).toBe('qlarg')
    expect(pickPageView('pluginarg', ctx({ pluginArgTarget: () => ({}) }))?.key).toBe('pluginarg')
  })

  it('列表页把 loading / 空态文案原样搬过去（插件自己写的文案不能被宿主吃掉）', () => {
    const view = pickPageView(
      null,
      ctx({
        pluginId: () => 'com.x',
        pluginList: () => [{ title: 'a' }] as never,
        pluginListLoading: () => true,
        pluginListEmptyMessage: () => '还在查'
      })
    )
    expect(view?.props).toMatchObject({
      pluginId: 'com.x',
      loading: true,
      emptyMessage: '还在查'
    })
  })

  it('事件都收在同一张表上：取消一律回到 popPage', () => {
    let popped = 0
    const view = pickPageView('eventform', ctx({ popPage: () => void popped++ }))
    view?.on.cancel?.()
    expect(popped).toBe(1)
  })
})
