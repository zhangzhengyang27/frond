/**
 * Leaf · 胶囊内联页注册表（P-2④）
 *
 * 以前这里是 LauncherApp 模板里一条 24 节的 `v-if / v-else-if` 硬链：每加一个内联页
 * 就要在模板里再插一节，而且**加漏了不会报错**——`FirstPartyPage` 多一个 id、
 * 命令表里那一行照旧能按，按下去只是一片空白（类型管不到模板）。
 * 现在是一张表：「视图 id → 组件 + props + 事件」，模板里只剩一个 `<component :is>`。
 * 表的类型是 `Record<LauncherViewId, …>`，少任何一条都是编译错误。
 *
 * ctx 一律用 **getter** 而不是值：注册表在组件之外，拿到快照会让页面在 `query`
 * 变化后不再更新； getter 让 `pickPageView` 那个 computed 正常追踪依赖。
 */
import type { Component } from 'vue'
import type { FirstPartyPage } from '@shared/commands'
import type { FormField, PluginFormNode, PluginListItem } from '@shared/plugin-protocol'
import type { KindFilter } from '../pages/clipboardLogic'
import AIChatPage from '../pages/AIChatPage.vue'
import BrowserTabsPage from '../pages/BrowserTabsPage.vue'
import CalendarPage from '../pages/CalendarPage.vue'
import ClipboardPage from '../pages/ClipboardPage.vue'
import DictionaryPage from '../pages/DictionaryPage.vue'
import FilesPage from '../pages/FilesPage.vue'
import FocusPage from '../pages/FocusPage.vue'
import FocusStatsPage from '../pages/FocusStatsPage.vue'
import FormPage from '../pages/FormPage.vue'
import McpCallPage from '../pages/McpCallPage.vue'
import NotesPage from '../pages/NotesPage.vue'
import PluginListPage from '../pages/PluginListPage.vue'
import ReminderPage from '../pages/ReminderPage.vue'
import SchedulePage from '../pages/SchedulePage.vue'
import SettingsPage from '../pages/SettingsPage.vue'
import ShotsIndexPage from '../pages/ShotsIndexPage.vue'
import SnippetsPage from '../pages/SnippetsPage.vue'
import SystemInfoPage from '../pages/SystemInfoPage.vue'
import TrashPage from '../pages/TrashPage.vue'
import WindowSwitcherPage from '../pages/WindowSwitcherPage.vue'

/** 表单类页面的提交值（FormPage 的 checkbox 是 boolean，其余是 string） */
export type FormValues = Record<string, string | boolean>

/** 事件处理器：各页签名不同，收进一张表只能擦到这一层，具体页在包装处 cast 回真签名 */
export type ViewHandler = (payload?: unknown) => void

/** mcpcall 那一页要的现场（服务器 + 工具 + 用户填的值） */
export interface McpCallView {
  serverId: string
  serverLabel: string
  tool: string
  args: Record<string, string>
  seq: number
}

/**
 * 注册表能碰到的胶囊现场。全是 getter / action：注册表不持有任何状态，
 * 状态一份都不分——它仍在 LauncherApp 里。
 */
export interface LauncherViewCtx {
  query: () => string
  clipFilter: () => KindFilter
  setClipFilter: (value: KindFilter) => void
  /** 收起胶囊窗（内联页里「跳到别处 / 做完了」那类动作的收尾） */
  hideWindow: () => void
  /** 返回上一级（表单取消、结果页 ESC） */
  popPage: () => void
  onSnippetCopied: (title: string) => void
  askAIWithText: (text: string) => void
  createCalendarEvent: (values: FormValues) => void
  saveQuicklinkForm: (values: FormValues) => void
  openQuicklinkArg: (values: FormValues) => void
  openPluginWithArgs: (values: FormValues) => void
  submitMcpArg: (values: FormValues) => void
  /** 三张参数表单的字段由 LauncherApp 从「目标命令」算出来 */
  qlArgFields: () => Array<{ key: string; label: string }>
  qlArgInitial: () => Record<string, string>
  pluginArgFields: () => FormField[]
  mcpArgFields: () => FormField[]
  mcpArgInitial: () => Record<string, string>
  /** 目标命令在不在：不在就不渲染那一页（旧模板里 `&& qlArgTarget` 那些条件） */
  qlArgTarget: () => unknown
  pluginArgTarget: () => unknown
  mcpArgTarget: () => unknown
  mcpCall: () => McpCallView | null
  /** 插件的声明式两态（M2 表单 / M3.1 列表） */
  pluginForm: () => (Omit<PluginFormNode, '$t' | 'submitId'> & { submitId: string }) | null
  pluginList: () => PluginListItem[] | null
  pluginId: () => string
  pluginListLoading: () => boolean
  pluginListEmptyMessage: () => string | null
  submitPluginForm: (values: FormValues) => void
  closePluginForm: () => void
}

export interface LauncherPageDef {
  component: Component
  /**
   * 组件名。只为**测试与开发态自检**存在：钉住「这个 id 渲染的是哪一页」时，断言方
   * 不必 import 24 个 SFC（单测环境解析不了 `@components/*` 这类渲染端别名）。
   * 运行时不看它。
   */
  name: string
  props?: (ctx: LauncherViewCtx) => Record<string, unknown>
  on?: (ctx: LauncherViewCtx) => Record<string, ViewHandler>
  ready?: (ctx: LauncherViewCtx) => boolean
  /**
   * 组件复用键。默认不写就没有 `:key`；mcpcall 必须按「第几次调用」重挂载，
   * 否则同一个工具连跑两次时 Vue 复用实例、第二次回车什么都不发生。
   */
  key?: (ctx: LauncherViewCtx) => string | number
}

/** 一次渲染的成品 */
export interface LauncherPageView {
  component: Component
  props: Record<string, unknown>
  on: Record<string, ViewHandler>
  key?: string | number
}

/** 视图 id：内联页 + 插件的两态 */
export type LauncherViewId = FirstPartyPage | 'pluginform' | 'pluginlist'

/** 创建日程表单（V4 P0-1 批次4 第三档：Form 基元写回系统日历） */
const EVENT_FORM_FIELDS: FormField[] = [
  { key: 'title', label: '标题', placeholder: '例如：与团队同步' },
  { key: 'date', label: '开始日期', type: 'date' },
  { key: 'time', label: '开始时间', placeholder: 'HH:mm，如 14:30' },
  {
    key: 'duration',
    label: '时长',
    type: 'select',
    options: ['30 分钟', '1 小时', '90 分钟', '2 小时'],
    initial: '1 小时'
  }
]

/** 添加快捷链接表单 */
const QL_FORM_FIELDS: FormField[] = [
  { key: 'name', label: '名称', placeholder: 'GitHub' },
  { key: 'url', label: 'URL', placeholder: 'https://github.com' }
]

/** 带查询词的列表页统一这一份 */
const queryProps = (ctx: LauncherViewCtx): Record<string, unknown> => ({ query: ctx.query() })

/**
 * 一条视图 id 一个 def。少任何一条都是编译错误，而不是运行时一片空白。
 * 同一时刻只可能有一页在栈顶，所以顺序无关；按读起来顺排。
 */
export const LAUNCHER_PAGE_VIEWS: Record<LauncherViewId, LauncherPageDef> = {
  focus: { component: FocusPage, name: 'focus' },
  snippets: {
    component: SnippetsPage,
    name: 'snippets',
    props: queryProps,
    on: (ctx) => ({
      copied: (t) => ctx.onSnippetCopied(String(t ?? '')),
      navigate: () => ctx.hideWindow()
    })
  },
  schedule: {
    component: SchedulePage,
    name: 'schedule',
    on: (ctx) => ({ close: () => ctx.hideWindow() })
  },
  eventform: {
    component: FormPage,
    name: 'eventform',
    props: () => ({ fields: EVENT_FORM_FIELDS, submitLabel: '创建日程' }),
    on: (ctx) => ({
      submit: (v) => ctx.createCalendarEvent((v ?? {}) as FormValues),
      cancel: () => ctx.popPage()
    })
  },
  shots: {
    component: ShotsIndexPage,
    name: 'shots',
    props: queryProps,
    on: (ctx) => ({ 'ask-ai': (t) => ctx.askAIWithText(String(t ?? '')) })
  },
  clips: {
    component: ClipboardPage,
    name: 'clips',
    props: (ctx) => ({ query: ctx.query(), filter: ctx.clipFilter() }),
    on: (ctx) => ({
      'ask-ai': (t) => ctx.askAIWithText(String(t ?? '')),
      // v-model:filter 在这套写法里就是 :filter + @update:filter 两半
      'update:filter': (v) => ctx.setClipFilter(v as KindFilter)
    })
  },
  focusStats: {
    component: FocusStatsPage,
    name: 'focusStats',
    on: (ctx) => ({ navigate: () => ctx.hideWindow() })
  },
  files: { component: FilesPage, name: 'files', props: queryProps },
  settings: { component: SettingsPage, name: 'settings' },
  ai: { component: AIChatPage, name: 'ai' },
  browserTabs: { component: BrowserTabsPage, name: 'browserTabs' },
  systemInfo: { component: SystemInfoPage, name: 'systemInfo' },
  windowSwitcher: { component: WindowSwitcherPage, name: 'windowSwitcher', props: queryProps },
  trash: { component: TrashPage, name: 'trash' },
  dictionary: { component: DictionaryPage, name: 'dictionary', props: queryProps },
  notes: { component: NotesPage, name: 'notes' },
  reminders: { component: ReminderPage, name: 'reminders', props: queryProps },
  calendar: { component: CalendarPage, name: 'calendar' },
  qlform: {
    component: FormPage,
    name: 'qlform',
    props: () => ({
      fields: QL_FORM_FIELDS,
      submitLabel: '保存链接',
      initial: { url: 'https://' }
    }),
    on: (ctx) => ({
      submit: (v) => ctx.saveQuicklinkForm((v ?? {}) as FormValues),
      cancel: () => ctx.popPage()
    })
  },
  qlarg: {
    component: FormPage,
    name: 'qlarg',
    props: (ctx) => ({
      fields: ctx.qlArgFields(),
      submitLabel: '打开',
      initial: ctx.qlArgInitial()
    }),
    on: (ctx) => ({
      submit: (v) => ctx.openQuicklinkArg((v ?? {}) as FormValues),
      cancel: () => ctx.popPage()
    }),
    ready: (ctx) => !!ctx.qlArgTarget()
  },
  pluginarg: {
    component: FormPage,
    name: 'pluginarg',
    props: (ctx) => ({ fields: ctx.pluginArgFields(), submitLabel: '运行' }),
    on: (ctx) => ({
      submit: (v) => ctx.openPluginWithArgs((v ?? {}) as FormValues),
      cancel: () => ctx.popPage()
    }),
    ready: (ctx) => !!ctx.pluginArgTarget()
  },
  mcparg: {
    component: FormPage,
    name: 'mcparg',
    props: (ctx) => ({
      fields: ctx.mcpArgFields(),
      submitLabel: '运行',
      initial: ctx.mcpArgInitial()
    }),
    on: (ctx) => ({
      submit: (v) => ctx.submitMcpArg((v ?? {}) as FormValues),
      cancel: () => ctx.popPage()
    }),
    ready: (ctx) => !!ctx.mcpArgTarget()
  },
  mcpcall: {
    component: McpCallPage,
    name: 'mcpcall',
    props: (ctx) => {
      const call = ctx.mcpCall()
      return {
        serverId: call?.serverId ?? '',
        serverLabel: call?.serverLabel ?? '',
        tool: call?.tool ?? '',
        args: call?.args ?? {}
      }
    },
    on: (ctx) => ({ cancel: () => ctx.popPage() }),
    ready: (ctx) => !!ctx.mcpCall(),
    key: (ctx) => ctx.mcpCall()?.seq ?? 0
  },
  pluginform: {
    component: FormPage,
    name: 'pluginform',
    props: (ctx) => ({
      fields: ctx.pluginForm()?.fields ?? [],
      submitLabel: ctx.pluginForm()?.submitLabel ?? '提交'
    }),
    on: (ctx) => ({
      submit: (v) => ctx.submitPluginForm((v ?? {}) as FormValues),
      cancel: () => ctx.closePluginForm()
    }),
    ready: (ctx) => !!ctx.pluginForm()
  },
  pluginlist: {
    component: PluginListPage,
    name: 'pluginlist',
    props: (ctx) => ({
      pluginId: ctx.pluginId(),
      items: ctx.pluginList() ?? [],
      loading: ctx.pluginListLoading(),
      emptyMessage: ctx.pluginListEmptyMessage() ?? undefined
    }),
    ready: (ctx) => !!ctx.pluginList()
  }
}

/**
 * 栈顶 + 插件现场 → 这一次渲染什么。
 *
 * 规则一句话：**栈上有人就渲染栈顶；栈空而插件开着，才轮到插件的声明式视图。**
 * 旧硬链里插件那两节排在第 7、8 位，于是「排在它前面的 7 页」能盖住插件、
 * 后面的全被插件盖住——那是数组位置造成的偶然，不是设计。现在按本来该有的样子：
 * 谁是被显式要的那一个，谁显示。
 */
export function pickPageView(
  top: FirstPartyPage | null,
  ctx: LauncherViewCtx
): LauncherPageView | null {
  const id: LauncherViewId | null =
    top ?? (ctx.pluginForm() ? 'pluginform' : ctx.pluginList() ? 'pluginlist' : null)
  if (!id) return null
  const def = LAUNCHER_PAGE_VIEWS[id]
  if (!def || (def.ready && !def.ready(ctx))) return null
  return {
    component: def.component,
    props: def.props?.(ctx) ?? {},
    on: def.on?.(ctx) ?? {},
    // 默认键就是页面 id：以前 24 节硬链里每一节是不同的 vnode 位置，换页必然重挂载；
    // 合成一个 <component :is> 之后不写 key 就会**复用实例**——同名组件（FormPage 有 6 条）
    // 在两张参数表之间切换时会留着上一页填过的值。mcpcall 用自己的 seq 覆盖这条。
    key: def.key?.(ctx) ?? id
  }
}
