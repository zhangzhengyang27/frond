/**
 * Leaf · 胶囊内联页导航栈（M5.2，自 LauncherApp.vue 抽出）
 *
 * openFirstParty 压栈，ESC 逐级返回（Raycast push/pop）。
 * pageRef 指向当前内联页组件（页面需 defineExpose handleKey）。
 */
import { computed, inject, provide, ref, type ComputedRef, type InjectionKey } from 'vue'
import type { FirstPartyPage } from '@shared/commands'

/** 内联页组件需暴露的按键处理协议 */
export interface LauncherPageHandle {
  handleKey: (e: KeyboardEvent) => boolean
}

/** I7 面包屑：内联页 → 页面标题（Raycast 底栏面包屑语义） */
export const FIRST_PARTY_PAGE_TITLES: Record<FirstPartyPage, string> = {
  focus: '专注',
  snippets: '代码片段',
  shots: '截图库',
  schedule: '我的日程',
  eventform: '创建日程',
  clips: '剪贴板历史',
  focusStats: '专注统计',
  files: '文件搜索',
  qlform: '添加快捷链接',
  qlarg: '快捷链接',
  pluginarg: '插件命令参数',
  pluginarg: '插件命令参数',
  settings: '设置',
  ai: 'AI 问答',
  browserTabs: '浏览器标签',
  systemInfo: '系统信息',
  windowSwitcher: '窗口切换',
  trash: '回收站',
  dictionary: '词典',
  notes: '笔记',
  reminders: '提醒事项',
  calendar: '日历'
}

/** provide/inject 通道：LauncherApp 提供当前页标题，CapsulePage 消费渲染面包屑 */
export const PAGE_TITLE_KEY: InjectionKey<ComputedRef<string | null>> =
  Symbol('launcher-page-title')

/** 页面侧便捷注入（无提供者时为 null） */
export function injectPageTitle(): ComputedRef<string | null> | null {
  return inject(PAGE_TITLE_KEY, null)
}

/** LauncherApp 侧提供当前页标题 */
export function providePageTitle(title: ComputedRef<string | null>): void {
  provide(PAGE_TITLE_KEY, title)
}

export function useLauncherPages() {
  const pageStack = ref<FirstPartyPage[]>([])
  const firstPartyPage = computed<FirstPartyPage | null>(
    () => pageStack.value[pageStack.value.length - 1] ?? null
  )
  const pageRef = ref<LauncherPageHandle | null>(null)
  // ── 唤起轮次 ──
  // 唤起时的「回根」要先 await 一次读偏好，而 ⌘K 转交（openFirstParty / MCP 工具调用）
  // 走的是另一条 IPC，两条谁先到不可控；比时间戳又会被「主进程直接 hide()、渲染端不知道」
  // 打穿（那样 lastHiddenAt 永远不更新，回根从此再也不执行）。所以按**轮次**记：
  // 每次唤起开一轮，压页盖上当前轮号，回根只清那些不属于本轮的请求。
  let showCycle = 0
  let lastPushCycle = -1

  /** 本次唤起开新的一轮，返回轮号（回根判定要用它） */
  function beginShowCycle(): number {
    showCycle += 1
    return showCycle
  }

  /** 这一轮唤起里有没有人**显式**要过页面（有的话回根要给它的意图让路） */
  function pushedSince(cycle: number): boolean {
    return lastPushCycle >= cycle
  }

  function pushPage(page: FirstPartyPage): void {
    lastPushCycle = showCycle
    pageStack.value = [...pageStack.value, page]
  }

  /** 返回 true 表示还有上级（已弹出一层）；false 表示栈已空 */
  function popPage(): boolean {
    if (pageStack.value.length === 0) return false
    pageStack.value = pageStack.value.slice(0, -1)
    return pageStack.value.length > 0
  }

  return { pageStack, firstPartyPage, pageRef, pushPage, popPage, beginShowCycle, pushedSince }
}
=== FirstPartyPage
26:export const FIRST_PARTY_PAGE_VALUES = [
27-  'focus',
28-  'snippets',
29-  'shots',
30-  'schedule',
31-  'eventform',
32-  'clips',
33-  'focusStats',
34-  'files',
35-  'qlform',
36-  'qlarg',
37-  'pluginarg',
38-  'settings',
39-  'ai',
40-  'browserTabs',
41-  'systemInfo',
42-  'windowSwitcher',
43-  'trash',
44-  'dictionary',
45-  'notes',
46-  'reminders',
47-  'calendar'
48-] as const
49-
50:export type FirstPartyPage = (typeof FIRST_PARTY_PAGE_VALUES)[number]
51-
52-/**
53- * 重型模块（阶段C「主窗口降级」）：从启动台 / ⌘K 打开时走独立窗口，
54- * 不抢占主窗口当前状态；侧边栏内的窗口内导航行为不变。
55- */
56-export const WINDOW_MODULES: ReadonlySet<string> = new Set(['snippets', 'screenRecorder'])
57-
58-/** 命令可执行的动作 */
59-export type CommandAction =
60-  | { type: 'module'; moduleId: string; path: string }
61-  | { type: 'page'; pageId: string; path: string }
62-  | { type: 'plugin'; pluginId: string; cmd: string; arguments?: PluginArgument[] }
63-  /** #5 插件双通道：searchable 插件持久化条目，动作复用声明式 List 的 PluginItemAction */
64-  | { type: 'pluginSearch'; pluginId: string; action: PluginItemAction }
65-  | { type: 'app'; path: string }
66-  | { type: 'firstParty'; page: FirstPartyPage }
67-  | { type: 'copyText'; text: string }
68-  /** 系统命令 / 窗口管理（M2），id 形如 system.lock / window.left */
69-  | { type: 'system'; cmdId: string }
70-  /** 用户自定义快捷链接（M2.3） */
