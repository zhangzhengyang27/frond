import type Database from 'better-sqlite3'
import type { Migration } from '.'

/**
 * 015: 素材库三期（AI 语义搜索）
 *
 * photo_embeddings：CLIP 图像向量（float32 BLOB，512 维）。
 * 检索采用「全量载入内存 + 暴力余弦」——万级库毫秒级；
 * 库到 5 万+ 再迁 sqlite-vec（vec0 虚表），本表结构可直接沿用。
 */
export const m015_photo_embeddings: Migration = {
  version: 15,
  name: 'photo_embeddings',
  up(db: Database.Database) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS photo_embeddings (
        photo_id     TEXT    PRIMARY KEY,
        model        TEXT    NOT NULL,
        dim          INTEGER NOT NULL,
        embedding    BLOB    NOT NULL,
        created_at   INTEGER NOT NULL
      )
    `)
    db.exec(`CREATE INDEX IF NOT EXISTS idx_photo_embeddings_model ON photo_embeddings(model, dim)`)
  }
}
