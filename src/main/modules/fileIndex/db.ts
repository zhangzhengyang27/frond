/**
 * Frond · 文件索引库（#9，独立 sqlite 文件 userData/file-index.db）
 *
 * files 主表 + files_fts（unicode61 主查询，FTS5 外部内容表 + 触发器同步）+
 * files_tri（trigram 影子表，中缀兜底）+ dirs 目录水位表 + meta。
 * 查询两档：主路径 name 模式走 {name skeleton path}（含 CJK 骨架词）、content 模式走
 * {content}，token 统一前缀匹配；主路径零结果时 name 模式再走一次 trigram 中缀。
 * unicode61 对 CJK 连续串是「单个 token」，前缀只从 token 头匹配（审查 I-3 实证过
 * 「计划」搜不到「项目计划.md」）——中文此前依赖 skeleton 列（拼音首字母）+ 头部前缀，
 * 中缀那一档补在这里：≥3 字符可命中，2 字中文仍是盲区（由上层回退系统检索承接）。
 */
import Database from 'better-sqlite3'

export interface FileIndexRow {
  path: string
  parent: string
  name: string
  ext: string | null
  size: number | null
  mtime: number | null
  isDir: boolean
  skeleton: string
  content: string | null
}

export interface FileIndexHit {
  path: string
  name: string
  parent: string
  isDir: boolean
  mtime: number | null
}

export type FileSearchMode = 'name' | 'content'

const SCHEMA = `
CREATE TABLE IF NOT EXISTS files (
  path    TEXT PRIMARY KEY,
  parent  TEXT NOT NULL,
  name    TEXT NOT NULL,
  ext     TEXT,
  size    INTEGER,
  mtime   INTEGER,
  is_dir  INTEGER NOT NULL DEFAULT 0,
  skeleton TEXT NOT NULL DEFAULT '',
  content TEXT
);
CREATE VIRTUAL TABLE IF NOT EXISTS files_fts USING fts5(
  name, skeleton, path, content, content='files', content_rowid='rowid',
  tokenize='unicode61'
);
CREATE TRIGGER IF NOT EXISTS files_ai AFTER INSERT ON files BEGIN
  INSERT INTO files_fts(rowid, name, skeleton, path, content)
  VALUES (new.rowid, new.name, new.skeleton, new.path, new.content);
END;
CREATE TRIGGER IF NOT EXISTS files_ad AFTER DELETE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name, skeleton, path, content)
  VALUES ('delete', old.rowid, old.name, old.skeleton, old.path, old.content);
END;
CREATE TRIGGER IF NOT EXISTS files_au AFTER UPDATE ON files BEGIN
  INSERT INTO files_fts(files_fts, rowid, name, skeleton, path, content)
  VALUES ('delete', old.rowid, old.name, old.skeleton, old.path, old.content);
  INSERT INTO files_fts(rowid, name, skeleton, path, content)
  VALUES (new.rowid, new.name, new.skeleton, new.path, new.content);
END;
CREATE TABLE IF NOT EXISTS dirs (
  path TEXT PRIMARY KEY,
  mtime_epoch INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT);

-- 中缀兜底索引（trigram）。unicode61 把连续 CJK 串当成**一个** token，前缀只从
-- token 头匹配 → 「目计划」搜不到「项目计划.md」（审查 I-3 实证过这类退化）。
-- trigram 对 ≥3 字符的任意中缀有效命中，实测 50 万条目建索引 2.4s、查询 <1ms；
-- 2 字中文它无能为力（那类仍走 mdfind 回退，见 fileSearch 的 source 分层）。
CREATE VIRTUAL TABLE IF NOT EXISTS files_tri USING fts5(
  name, path, content='files', content_rowid='rowid', tokenize='trigram'
);
CREATE TRIGGER IF NOT EXISTS files_tri_ai AFTER INSERT ON files BEGIN
  INSERT INTO files_tri(rowid, name, path) VALUES (new.rowid, new.name, new.path);
END;
CREATE TRIGGER IF NOT EXISTS files_tri_ad AFTER DELETE ON files BEGIN
  INSERT INTO files_tri(files_tri, rowid, name, path)
  VALUES ('delete', old.rowid, old.name, old.path);
END;
CREATE TRIGGER IF NOT EXISTS files_tri_au AFTER UPDATE ON files BEGIN
  INSERT INTO files_tri(files_tri, rowid, name, path) VALUES ('delete', old.rowid, old.name, old.path);
  INSERT INTO files_tri(rowid, name, path) VALUES (new.rowid, new.name, new.path);
END;
`

/** trigram 允许出现在中缀查询里的字符（引号必须单独转义，否则 MATCH 语法被破） */
const TRIGRAM_SAFE_RE = /[^0-9A-Za-z._\-\u4e00-\u9fa5]/g
/** trigram token 粒度是 3 个字符，短于 3 的查询必然空转，不进这条路径 */
const MIN_TRIGRAM_LENGTH = 3

/** FTS5 MATCH 查询构造：token 白名单清洗 + 前缀匹配，fail-closed */
function buildMatch(tokens: string[]): string {
  const safe = tokens
    .map((t) => t.toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]/g, ''))
    .filter((t) => t.length > 0)
    .map((t) => `"${t}"*`)
  if (safe.length === 0) return ''
  return safe.join(' ')
}

export class FileIndexDb {
  private db: Database.Database

  private constructor(db: Database.Database) {
    this.db = db
    this.db.exec(SCHEMA)
  }

  static openInMemory(): FileIndexDb {
    return new FileIndexDb(new Database(':memory:'))
  }

  static open(dbPath: string): FileIndexDb {
    return new FileIndexDb(new Database(dbPath))
  }

  /** 批量 upsert（单事务）；FTS 由触发器同步 */
  upsertFiles(rows: FileIndexRow[]): void {
    const stmt = this.db.prepare(`
      INSERT INTO files (path, parent, name, ext, size, mtime, is_dir, skeleton, content)
      VALUES (@path, @parent, @name, @ext, @size, @mtime, @isDir, @skeleton, @content)
      ON CONFLICT(path) DO UPDATE SET
        parent=excluded.parent, name=excluded.name, ext=excluded.ext,
        size=excluded.size, mtime=excluded.mtime, is_dir=excluded.is_dir,
        skeleton=excluded.skeleton, content=excluded.content
    `)
    const tx = this.db.transaction((batch: FileIndexRow[]) => {
      for (const r of batch) {
        stmt.run({
          path: r.path,
          parent: r.parent,
          name: r.name,
          ext: r.ext,
          size: r.size,
          mtime: r.mtime,
          isDir: r.isDir ? 1 : 0,
          skeleton: r.skeleton,
          content: r.content
        })
      }
    })
    tx(rows)
  }

  deleteByPaths(paths: string[]): void {
    const stmt = this.db.prepare('DELETE FROM files WHERE path = ?')
    const tx = this.db.transaction((batch: string[]) => {
      for (const p of batch) stmt.run(p)
    })
    tx(paths)
  }

  /**
   * 前缀级联删除（目录被移除/剪枝）。
   * 用 B-tree 范围扫描而非 LIKE：LIKE 的 `_`/`%` 通配符会被路径中的下划线触发，
   * 误删无关目录的索引行（审查 I-2 已实证）；范围扫描更快且无转义问题。
   */
  deleteByPrefix(prefix: string): void {
    this.db
      .prepare('DELETE FROM files WHERE path = ? OR (path > ? AND path < ?)')
      .run(prefix, prefix, `${prefix}\uffff`)
  }

  markDir(path: string, mtimeEpoch: number): void {
    this.db
      .prepare(
        'INSERT INTO dirs (path, mtime_epoch) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET mtime_epoch = excluded.mtime_epoch'
      )
      .run(path, mtimeEpoch)
  }

  getDirEpoch(path: string): number | null {
    const row = this.db.prepare('SELECT mtime_epoch FROM dirs WHERE path = ?').get(path) as
      | { mtime_epoch: number }
      | undefined
    return row ? row.mtime_epoch : null
  }

  /** 全部目录水位（启动期补偿扫描的输入） */
  listDirs(): Array<{ path: string; mtimeEpoch: number }> {
    const rows = this.db.prepare('SELECT path, mtime_epoch FROM dirs').all() as Array<{
      path: string
      mtime_epoch: number
    }>
    return rows.map((r) => ({ path: r.path, mtimeEpoch: r.mtime_epoch }))
  }

  /** 清掉某目录自身及其子孙的水位行（目录消失时连同索引行一起清，防水位表只增不减） */
  deleteDirsAt(path: string): void {
    const prefix = `${path}/`
    this.db
      .prepare('DELETE FROM dirs WHERE path = ? OR (path > ? AND path < ?)')
      .run(path, prefix, `${prefix}\uffff`)
  }

  /** 目录子项（增量 diff 用：DB 视角的现存子文件） */
  listDirChildren(parent: string): Array<{ path: string; name: string; mtime: number | null }> {
    return this.db
      .prepare('SELECT path, name, mtime FROM files WHERE parent = ?')
      .all(parent) as Array<{ path: string; name: string; mtime: number | null }>
  }

  /**
   * 查询。tokens 来自渲染端查询词的分词（空白切分）；
   * name 模式搜 {name skeleton path}，content 模式搜 {content}。
   */
  search(tokens: string[], opts: { mode: FileSearchMode; limit: number }): FileIndexHit[] {
    const match = buildMatch(tokens)
    if (!match) return []
    const columns = opts.mode === 'content' ? '{content}' : '{name skeleton path}'
    const sql = `
      SELECT f.path, f.name, f.parent, f.is_dir AS isDir, f.mtime
      FROM files_fts ft JOIN files f ON f.rowid = ft.rowid
      WHERE files_fts MATCH ${'@match'}
      ORDER BY rank
      LIMIT ${Math.max(1, Math.min(200, Math.floor(opts.limit)))}
    `
    return this.db
      .prepare(sql.replace('@match', '?'))
      .all(`${columns} : (${match})`) as unknown as FileIndexHit[]
  }

  count(): number {
    return (this.db.prepare('SELECT COUNT(*) AS n FROM files').get() as { n: number }).n
  }

  /**
   * 中缀兜底（仅 name 模式）：把每个 ≥3 字符的 token 当子串查 trigram 影子索引。
   * 只在主路径**零结果**时调用——不做排序混合，免得把更好的前缀命中挤下去。
   */
  searchInfix(tokens: string[], limit: number): FileIndexHit[] {
    const phrases = tokens
      .map((t) => t.trim().replace(TRIGRAM_SAFE_RE, '').toLowerCase())
      .filter((t) => t.length >= MIN_TRIGRAM_LENGTH)
      .map((t) => `"${t}"`)
    if (phrases.length === 0) return []
    const cap = Math.max(1, Math.min(200, Math.floor(limit)))
    return this.db
      .prepare(
        `SELECT f.path, f.name, f.parent, f.is_dir AS isDir, f.mtime
         FROM files_tri ft JOIN files f ON f.rowid = ft.rowid
         WHERE files_tri MATCH ? ORDER BY rank LIMIT ${cap}`
      )
      .all(`{name path} : (${phrases.join(' ')})`) as unknown as FileIndexHit[]
  }

  /**
   * 影子索引里有没有内容。老库（本次改动之前建的）schema 会就地补表，但历史行
   * 不会自动进 trigram → 服务层据此判定并触发一次分片重建补齐（不在构造器里同步
   * 跑 rebuild：实测 50 万条目要 2.4s，卡在启动就是白屏）。
   */
  triPopulated(): boolean {
    return this.db.prepare('SELECT rowid FROM files_tri LIMIT 1').get() !== undefined
  }

  setMeta(key: string, value: string): void {
    this.db
      .prepare(
        'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'
      )
      .run(key, value)
  }

  getMeta(key: string): string | null {
    const row = this.db.prepare('SELECT value FROM meta WHERE key = ?').get(key) as
      | { value: string }
      | undefined
    return row ? row.value : null
  }

  clearAll(): void {
    this.db.exec('DELETE FROM files; DELETE FROM dirs;')
  }

  close(): void {
    this.db.close()
  }
}
