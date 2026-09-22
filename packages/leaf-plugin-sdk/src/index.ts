/**
 * leaf-plugin-sdk · Leaf 启动器 React 插件 SDK（#11）
 *
 * 用法：
 *   import { render, List, List as _List } from 'leaf-plugin-sdk'
 *   render(<List>{items.map(i => <List.Item title={i.title}
 *     actions={<ActionPanel><Action title="打开" onAction={() => ...} /></ActionPanel>} />)}</List>)
 *
 * 视图以 JSON 提交宿主（胶囊原生渲染）；插件 BrowserView 隐藏为纯逻辑宿主。
 */
export { render, isMounted } from './reconciler'
export {
  List,
  Detail,
  ActionPanel,
  Action,
  Form,
  useNavigation,
  NavigationRoot
} from './components'
export {
  showToast,
  copyToClipboard,
  getClipboardText,
  getPluginContext,
  closePlugin,
  getLocalStorageItem,
  setLocalStorageItem,
  removeLocalStorageItem,
  getCacheItem,
  setCacheItem,
  removeCacheItem,
  showAlert,
  openExternalUrl,
  getPreferenceValues
} from './platform'
export type { AlertAction } from './platform'
export type {
  ListProps,
  ListItemProps,
  SectionProps,
  DetailProps,
  ActionProps,
  ActionPanelProps,
  FormProps,
  FormFieldProps,
  FormSelectProps
} from './components'
export type { ViewNode, ViewListItem, ViewAction, ViewSection } from './types'

import { createElement, type ReactNode } from 'react'
import { NavigationRoot } from './components'
import { render as renderTree } from './reconciler'
import { dispatchCallback } from './registry'

/**
 * 宿主交互 → Callback 钩子（{id, payload}）→ 回调注册表分发。
 * 模块初始化即安装；非插件环境（无 launcherApi）自动跳过。
 * 幂等（审查 C1：重复安装会让每个回调分发两次）。
 */
let bridgeInstalled = false
function installCallbackBridge(): void {
  if (bridgeInstalled) return
  bridgeInstalled = true
  const api = (
    globalThis as { launcherApi?: { onCallback?: (cb: (data: unknown) => void) => void } }
  ).launcherApi
  if (typeof api?.onCallback === 'function') {
    api.onCallback((data) => {
      const { id, payload } = (data ?? {}) as { id?: string; payload?: unknown }
      if (typeof id === 'string') dispatchCallback(id, payload)
    })
  }
}
installCallbackBridge()

/**
 * 启动渲染（等价 render()，自动包一层导航根以支持 useNavigation）。
 * 插件入口推荐用这个而不是裸 render。
 */
export function start(element: ReactNode): void {
  renderTree(createElement(NavigationRoot, { initial: element }))
}

/** 全局 launcherApi 形状声明（插件页面由宿主 preload 注入） */
declare global {
  interface Window {
    launcherApi?: {
      /** 关闭插件（回到启动器根搜索） */
      close?: () => void
      [key: string]: unknown
    }
  }
}
