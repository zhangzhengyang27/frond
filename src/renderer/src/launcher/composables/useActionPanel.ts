/**
 * Leaf · 结果级 ⌘K 动作面板（M1.2，自 LauncherApp.vue 抽出）
 *
 * 按选中条目的 action 类型生成可用动作列表；动作执行后统一关面板，
 * 需要收起胶囊的动作额外调 hideWindow。
 *
 * P-1.1：每条动作带稳定 `id`（键位与 e2e 不随重排漂移）与可选 `key`
 * （修饰键直触声明，匹配逻辑在 modifierKeys.ts）。主动作仍标 `hint: '↵'`，
 * 二级动作的键帽由渲染层按 `key` 生成——**没有 key 的动作不得显示键帽**。
 */
import { computed, ref, type Ref } from 'vue'
import type { CommandEntry } from '@shared/commands'
import type { ScoredEntry } from '@shared/search'
import type { ActionKey } from './modifierKeys'

export interface PanelAction {
  /** 稳定标识：动作重排后键位与 e2e 仍能定位到同一条 */
  id: string
  label: string
  /** remixicon 图标名（I4：Raycast ActionPanel 每行带图标） */
  icon: string
  /** 键帽提示：只标注真实可触发的按键（审查修复：原先按标签猜 ⌘C/⌘R 但并未绑定，有误导） */
  hint?: string
  /** 修饰键直触绑定；缺省表示「仅 ↵ 或面板选择」 */
  key?: ActionKey
  run: () => void
}

export function useActionPanel(deps: {
  results: Ref<ScoredEntry[]>
  selectedIndex: Ref<number>
  runEntry: (entry: CommandEntry) => Promise<void>
  hideWindow: () => void
  /** P-1.3 keep-open：与条目类型无关的通用动作要用它取当前态、切态 */
  pinned: Ref<boolean>
  togglePinned: () => void
  /** P-1.4：收藏态与切换（key = CommandEntry.key，全类型可用，不只模块） */
  favorites: Ref<string[]>
  toggleFavorite: (key: string) => void
}): {
  actionPanelEntry: Ref<CommandEntry | null>
  actionIndex: Ref<number>
  panelActions: Ref<PanelAction[]>
  /** 不经面板也可取动作（P-1.2 修饰键直触要对高亮行生效，而不只是面板打开时） */
  actionsFor: (entry: CommandEntry | null) => PanelAction[]
  toggleActionPanel: () => void
} {
  const actionPanelEntry = ref<CommandEntry | null>(null)
  const actionIndex = ref(0)

  /** 按条目类型生成动作列表；面板与修饰键直触共用同一份，避免两套语义分叉 */
  const buildActions = (entry: CommandEntry | null): PanelAction[] => {
    if (!entry) return []
    const a = entry.action
    const list: PanelAction[] = []
    const primary = (): void => {
      actionPanelEntry.value = null
      void deps.runEntry(entry)
    }
    const runAndHide =
      (fn: () => void): (() => void) =>
      () => {
        actionPanelEntry.value = null
        fn()
        deps.hideWindow()
      }
    const revealInFinder = (path: string): void => {
      void window.api.fileSearch.reveal(path)
    }
    const copyText = (text: string): void => {
      void navigator.clipboard.writeText(text)
    }
    switch (a.type) {
      case 'module':
        list.push({
          id: 'open',
          label: '打开（沉浸窗口）',
          icon: 'play-line',
          hint: '↵',
          run: primary
        })
        list.push({
          id: 'openInMain',
          label: '在主窗口打开',
          icon: 'window-line',
          run: runAndHide(() => window.api.launcher.openModule(a.moduleId, a.path))
        })
        list.push({
          id: 'copyPath',
          label: '复制路径',
          icon: 'file-copy-line',
          key: 'cmd+shift+c',
          run: runAndHide(() => copyText(a.path))
        })
        break
      case 'page':
        list.push({
          id: 'open',
          label: '打开（沉浸窗口）',
          icon: 'play-line',
          hint: '↵',
          run: primary
        })
        list.push({
          id: 'openInMain',
          label: '在主窗口打开',
          icon: 'window-line',
          run: runAndHide(() => window.api.launcher.openModule(a.pageId, a.path))
        })
        break
      case 'app':
        list.push({ id: 'launch', label: '启动应用', icon: 'rocket-line', hint: '↵', run: primary })
        list.push({
          id: 'reveal',
          label: '在 Finder 中显示',
          icon: 'folder-open-line',
          key: 'cmd+backspace',
          run: runAndHide(() => revealInFinder(a.path))
        })
        list.push({
          id: 'copyPath',
          label: '复制路径',
          icon: 'file-copy-line',
          key: 'cmd+shift+c',
          run: runAndHide(() => copyText(a.path))
        })
        break
      case 'file':
        list.push({
          id: 'open',
          label: '打开',
          icon: 'external-link-line',
          hint: '↵',
          run: primary
        })
        list.push({
          id: 'reveal',
          label: '在 Finder 中显示',
          icon: 'folder-open-line',
          key: 'cmd+backspace',
          run: runAndHide(() => revealInFinder(a.path))
        })
        list.push({
          id: 'copyPath',
          label: '复制路径',
          icon: 'file-copy-line',
          key: 'cmd+shift+c',
          run: runAndHide(() => copyText(a.path))
        })
        break
      case 'shotPaste':
        list.push({
          id: 'paste',
          label: '粘贴到前台应用',
          icon: 'clipboard-line',
          hint: '↵',
          run: primary
        })
        break
      case 'openUrl':
        list.push({
          id: 'open',
          label: '打开链接',
          icon: 'external-link-line',
          hint: '↵',
          run: primary
        })
        list.push({
          id: 'copyLink',
          label: '复制链接',
          icon: 'ri-link',
          key: 'cmd+shift+c',
          run: runAndHide(() => {
            if (a.url) copyText(a.url)
          })
        })
        break
      case 'clipboardItem':
        list.push({ id: 'copy', label: '复制', icon: 'file-copy-line', hint: '↵', run: primary })
        list.push({
          id: 'pasteBack',
          label: '粘贴到前台应用',
          icon: 'clipboard-line',
          key: 'cmd+shift+v',
          run: runAndHide(() => {
            void window.api.clipHist.pasteBack(a.id)
          })
        })
        break
      case 'snippetItem':
        list.push({
          id: 'copyContent',
          label: '复制内容',
          icon: 'file-copy-line',
          hint: '↵',
          run: primary
        })
        list.push({
          id: 'openManager',
          label: '在片段管理中打开',
          icon: 'file-code-line',
          run: runAndHide(() => {
            void window.api.launcher.openModule('snippets', '/snippets')
          })
        })
        break
      default:
        list.push({ id: 'run', label: '执行', icon: 'play-line', hint: '↵', run: primary })
    }
    // 与条目类型无关的通用动作，排在类型动作之后（保证 ↵ 语义仍是主动作）。
    // keep-open 执行后不关窗——否则切完态立刻看不见效果。
    list.push({
      id: 'favorite',
      label: deps.favorites.value.includes(entry.key) ? '取消收藏' : '收藏此命令',
      icon: deps.favorites.value.includes(entry.key) ? 'star-fill' : 'star-line',
      key: 'cmd+shift+f',
      run: () => {
        actionPanelEntry.value = null
        deps.toggleFavorite(entry.key)
      }
    })
    list.push({
      id: 'keepOpen',
      label: deps.pinned.value ? '取消保持打开' : '保持窗口打开',
      icon: deps.pinned.value ? 'pin-off-line' : 'pin-line',
      key: 'cmd+shift+k',
      run: () => {
        actionPanelEntry.value = null
        deps.togglePinned()
      }
    })
    return list
  }

  /** ⌘K 面板当前展示的动作（面板未打开则为空） */
  const panelActions = computed<PanelAction[]>(() => buildActions(actionPanelEntry.value))

  /** 底部 Actions 按钮：对当前选中结果呼出 / 关闭动作面板（与 ⌘K 同一状态） */
  function toggleActionPanel(): void {
    if (actionPanelEntry.value) {
      actionPanelEntry.value = null
      return
    }
    const item = deps.results.value[deps.selectedIndex.value]
    if (!item) return
    actionPanelEntry.value = item.entry
    actionIndex.value = 0
  }

  return {
    actionPanelEntry,
    actionIndex,
    panelActions,
    actionsFor: buildActions,
    toggleActionPanel
  }
}
