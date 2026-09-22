/**
 * 数据存储实例统一管理。
 *
 * 5-7 后，facade 全部退化为纯转发层（无 legacy fallback），构造代价极小。
 * 不再需要 Proxy 懒初始化，直接实例化即可。
 */

import { PomodoroDataStore } from './PomodoroDataStore'
import { SnippetDataStore } from './SnippetDataStore'
import { TagDataStore } from './TagDataStore'
import { PreferencesDataStore } from './PreferencesDataStore'
import { FolderDataStore } from './FolderDataStore'
import { UsageDataStore } from './UsageDataStore'

export const pomodoroStore = new PomodoroDataStore()
export const snippetStore = new SnippetDataStore()
export const tagStore = new TagDataStore()
export const preferencesStore = new PreferencesDataStore()
export const folderStore = new FolderDataStore()
export const usageStore = new UsageDataStore()
