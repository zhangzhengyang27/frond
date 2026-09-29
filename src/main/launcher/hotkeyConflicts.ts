/**
 * Frond · 热键互斥纯逻辑（B40 余项：保存时拒绝）
 *
 * 此前命令热键可与主热键/截图热键/⌘⇧M 撞车——Electron 对同一加速器的
 * 二次注册结果「看运气」，被顶掉的一方静默失效且冲突清单不含该情形。
 * 现口径：设置任何一组热键时，撞到其他组已占用的加速器直接拒绝并说明。
 * 纯函数、无 electron 依赖（hotkeys.ts 与 ipc handler 共用）。
 */

export interface HotkeyGroupsConfig {
  main: string
  /** '' = 未启用截图热键 */
  screenshot: string
}

/** 返回撞车的组名；无冲突返回 null（accel 大小写不敏感比较，Electron 加速器同义） */
export function findHotkeyConflict(
  accel: string,
  groups: HotkeyGroupsConfig & { showHide: string },
  /** 正在设置的那一组（不与自己比较） */
  editing: 'main' | 'screenshot' | 'command'
): string | null {
  const norm = (s: string): string => s.trim().toLowerCase()
  const target = norm(accel)
  if (!target) return null
  const owners: Array<{ group: string; value: string }> = [
    { group: '主热键', value: groups.main },
    { group: '截图热键', value: groups.screenshot },
    { group: '唤起/隐藏热键（⌘⇧M）', value: groups.showHide }
  ]
  for (const { group, value } of owners) {
    if (!value) continue
    if (editing === 'main' && group === '主热键') continue
    if (editing === 'screenshot' && group === '截图热键') continue
    if (norm(value) === target) return group
  }
  return null
}
