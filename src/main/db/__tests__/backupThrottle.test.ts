import { describe, it, expect } from 'vitest'
import { newestBackupAge, shouldBackup, BACKUP_INTERVAL_MS } from '../backupThrottle'

/**
 * B53-5 启动备份节流：DB ≥50MB 时此前**每次启动**都整库 copyFileSync +
 * quick_check（大库用户每次启动 0.2-1s 同步 IO）。改为按时间节流——最新备份
 * 未满 7 天就跳过（仍有 BACKUP_KEEP=3 份滚动历史可恢复）。
 */

const DAY = 24 * 60 * 60 * 1000
const bak = (ts: number): string => `frond.db.bak.${ts}`

describe('backupThrottle（B53-5）', () => {
  it('无备份：要备', () => {
    expect(shouldBackup([], 'frond.db', 1000)).toBe(true)
  })

  it('最新备份未满 7 天：跳过', () => {
    const files = ['unrelated.txt', bak(1000), bak(3 * DAY)]
    expect(shouldBackup(files, 'frond.db', 3 * DAY + BACKUP_INTERVAL_MS - 1)).toBe(false)
  })

  it('最新备份已满 7 天：要备', () => {
    const files = [bak(3 * DAY)]
    expect(shouldBackup(files, 'frond.db', 3 * DAY + BACKUP_INTERVAL_MS)).toBe(true)
  })

  it('newestBackupAge 取最新可解析备份的年龄，无法解析的名字忽略', () => {
    const files = [bak(1000), 'frond.db.bak.broken', bak(5000), 'other.db.bak.9999']
    expect(newestBackupAge(files, 'frond.db', 6000)).toBe(1000)
  })

  it('年龄为 0 或负（时钟回拨）视为「刚备过」→ 跳过', () => {
    const files = [bak(6000)]
    expect(shouldBackup(files, 'frond.db', 5000)).toBe(false)
  })
})
