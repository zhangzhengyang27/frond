/**
 * Frond · 命令别名服务（P2-8）
 *
 * 用户可为任意命令（CommandEntry.key）自定义别名，搜索时别名与标题同等匹配。
 * 例如把 "Clipboard History" 别名为 "ch"，输入 "ch" 即可命中。
 *
 * 存储：SQLite pref_preferences（原 electron-store，双栈收尾第一批迁移；
 * 旧 config.json 的 aliases 由 dataMigrations.migrateAliasesFromLegacyStore 导入）。
 */
import { ipcMain } from 'electron'
import { prefRepository } from '../db/repos'

const ALIAS_KEY = 'aliases'

function readAll(): Record<string, string[]> {
  const raw = prefRepository.get(ALIAS_KEY)
  if (!raw) return {}
  try {
    return JSON.parse(raw) as Record<string, string[]>
  } catch {
    return {}
  }
}

function writeAll(all: Record<string, string[]>): void {
  prefRepository.set(ALIAS_KEY, JSON.stringify(all))
}

export function getAliases(): Record<string, string[]> {
  return readAll()
}

export function setAlias(commandKey: string, alias: string): boolean {
  if (!commandKey || !alias.trim()) return false
  const all = getAliases()
  const list = all[commandKey] ?? []
  const normalized = alias.trim().toLowerCase()
  if (list.includes(normalized)) return false
  list.push(normalized)
  all[commandKey] = list
  writeAll(all)
  return true
}

export function removeAlias(commandKey: string, alias: string): boolean {
  const all = getAliases()
  const list = all[commandKey]
  if (!list) return false
  const idx = list.indexOf(alias.trim().toLowerCase())
  if (idx === -1) return false
  list.splice(idx, 1)
  if (list.length === 0) {
    delete all[commandKey]
  } else {
    all[commandKey] = list
  }
  writeAll(all)
  return true
}

export function getAliasesForCommand(commandKey: string): string[] {
  return getAliases()[commandKey] ?? []
}

export function registerAliasIpc(): void {
  ipcMain.handle('alias:getAll', () => getAliases())
  ipcMain.handle('alias:get', (_e, commandKey: string) => getAliasesForCommand(commandKey))
  ipcMain.handle('alias:set', (_e, commandKey: string, alias: string) =>
    setAlias(commandKey, alias)
  )
  ipcMain.handle('alias:remove', (_e, commandKey: string, alias: string) =>
    removeAlias(commandKey, alias)
  )
}
