/**
 * Frond · 启动备份节流（B53-5）
 *
 * DB ≥50MB 时 ensureOpen 每次启动都整库 copyFileSync + quick_check——大库用户
 * 每次启动 0.2-1s 同步 IO + WAL 写放大。本模块按时间节流：最新备份未满
 * BACKUP_INTERVAL_MS 就跳过（仍保留 BACKUP_KEEP=3 份滚动历史，恢复能力不变）。
 * 纯函数便于单测；文件名时间戳由 database.ts 的备份命名（frond.db.bak.<ts>）产生。
 */
export const BACKUP_INTERVAL_MS = 7 * 24 * 60 * 60 * 1000

/** 最新可解析备份的年龄（now - ts）；没有可解析备份返回 null */
export function newestBackupAge(files: string[], dbFile: string, now: number): number | null {
  let newest: number | null = null
  for (const f of files) {
    if (!f.startsWith(`${dbFile}.bak.`)) continue
    const ts = Number.parseInt(f.slice(dbFile.length + 5), 10)
    if (!Number.isFinite(ts)) continue
    if (newest === null || ts > newest) newest = ts
  }
  return newest === null ? null : now - newest
}

/** 最新备份未满间隔 → 跳过（年龄为负 = 时钟回拨，同样视为刚备过） */
export function shouldBackup(
  files: string[],
  dbFile: string,
  now: number,
  interval = BACKUP_INTERVAL_MS
): boolean {
  const age = newestBackupAge(files, dbFile, now)
  if (age === null) return true
  return age >= interval
}
