/**
 * Frond 插件视图协议类型（#11）。
 *
 * ⚠ 本文件是 src/shared/plugin-protocol.ts 中 React 视图协议的 SDK 侧副本：
 * SDK 必须可独立安装（不依赖宿主仓库路径），两处由 e2e 与文档保持同步。
 */

export type PluginActionType = 'copy' | 'open' | 'callback'

export interface ViewAction {
  /** 动作标签（ActionPanel / 提示文案展示） */
  label: string
  type: PluginActionType
  /** copy/open 的目标；callback 时作为回调回传的附带数据 */
  payload?: string
  /** SDK 内部：宿主回传的回调 id（由序列化器写入，插件作者无需手填） */
  callbackId?: string
}

export interface ViewListItem {
  title: string
  subtitle?: string
  icon?: string
  /** 右侧配件文本（如大小 / 日期），最多 3 条 */
  accessories?: string[]
  keywords?: string[]
  detail?: string
  detailFormat?: 'text' | 'markdown'
  actions?: ViewAction[]
}

export interface ViewSection {
  title?: string
  items: ViewListItem[]
}

export type ViewNode =
  | { $t: 'list'; sections?: ViewSection[]; items?: ViewListItem[] }
  | { $t: 'detail'; markdown?: string; text?: string }
