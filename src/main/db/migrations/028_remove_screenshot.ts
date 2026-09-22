/**
 * Leaf · Migration 028 — 下线 截图 模块，删除其全部表
 *
 * 截图功能迁移至独立项目，从应用中移除。此迁移：
 * 1. 删除 ss_screenshots（001_init 引入；含 OCR 文本与软删除列）
 * 2. 删除 idx_ss_screenshots_* 两个索引
 *
 * 注：共用设施不受影响——image:// 协议、tag_tags 标签字典、
 * usage_records 模块使用统计、tesseract.js（剪贴板历史 OCR 仍在用）均保留。
 *
 * 幂等：DROP TABLE IF EXISTS / DROP INDEX IF EXISTS。
 */
import type Database from 'better-sqlite3'
import type { Migration } from './index'

export const m028_remove_screenshot: Migration = {
  version: 28,
  name: 'remove_screenshot',
  up(db: Database.Database) {
    db.transaction(() => {
      db.exec('DROP INDEX IF EXISTS idx_ss_screenshots_captured_desc')
      db.exec('DROP INDEX IF EXISTS idx_ss_screenshots_hash')
      db.exec('DROP TABLE IF EXISTS ss_screenshots')
    })()
  }
}
