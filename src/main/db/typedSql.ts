/**
 * Frond · better-sqlite3 类型化访问收口（B46 战役核心件）
 *
 * 背景：better-sqlite3 v13 无 bundled types、@types/better-sqlite3 未跟进 v13 ——
 * TS 从 lib/*.js 推断类型，所有 prepare()/run()/get()/all() 返回 any，
 * 全仓 no-unsafe-* 家族因此有 2,400+ 条（docs/BUGS.md B46）。
 *
 * 本文件是**全仓唯一**触达裸 statement 返回值的地方：调用方拿到的一切都是
 * 显式泛型参数给出的类型。做法 = 把「行形状」的责任交给调用点的泛型参数，
 * 裸 any 的转换集中在这里一次性豁免（行数固定、有测试、有审查注释）。
 * 棘轮（scripts/unsafe-ratchet.mjs）保证仓内其它文件不再新增 unsafe。
 *
 * 语义与 better-sqlite3 完全一致：错误照抛（不吞），不包事务。
 */

/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-return, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument -- 见文件头：better-sqlite3 v13 无类型，裸转换全仓只允许发生在此文件 */

type AnyStatement = {
  run(...params: unknown[]): unknown
  get(...params: unknown[]): unknown
  all(...params: unknown[]): unknown[]
}

type AnyDatabase = {
  prepare(sql: string): AnyStatement
}

/** 预编译并执行 run（INSERT/UPDATE/DELETE），返回 Statement.run 的原生结果 */
export function prepareRun(db: unknown, sql: string, ...params: unknown[]): unknown {
  return (db as AnyDatabase).prepare(sql).run(...params)
}

/** 预编译并取第一行（无行返回 undefined） */
export function prepareGet<Row>(db: unknown, sql: string, ...params: unknown[]): Row | undefined {
  return (db as AnyDatabase).prepare(sql).get(...params) as Row | undefined
}

/** 预编译并取全部行 */
export function prepareAll<Row>(db: unknown, sql: string, ...params: unknown[]): Row[] {
  return (db as AnyDatabase).prepare(sql).all(...params) as Row[]
}

// ── 语句缓存形态（LogService / 批量 upsert 等自持 stmt 的调用点） ──

export function runStmt(stmt: unknown, ...params: unknown[]): unknown {
  return (stmt as AnyStatement).run(...params)
}

export function getStmt<Row>(stmt: unknown, ...params: unknown[]): Row | undefined {
  return (stmt as AnyStatement).get(...params) as Row | undefined
}

export function allStmt<Row>(stmt: unknown, ...params: unknown[]): Row[] {
  return (stmt as AnyStatement).all(...params) as Row[]
}

/** prepare 一次返回裸 statement（缓存用）；调用方只能把它传回本文件的 run/get/all */
export function prepareStmt(db: unknown, sql: string): unknown {
  return (db as AnyDatabase).prepare(sql)
}

// ── facade 形态：Repository 的 this.db 直接换成它，链式写法保持、泛型在调用点 ──

export interface SqlRunResult {
  changes: number
  lastInsertRowid: number | bigint
}

export interface SqlStmt<Row> {
  run(...params: unknown[]): SqlRunResult
  get(...params: unknown[]): Row | undefined
  all(...params: unknown[]): Row[]
}

export interface SqlDb {
  prepare<Row = unknown>(sql: string): SqlStmt<Row>
  exec(sql: string): void
  transaction<T>(fn: () => T): () => T
}

/** 把裸 Database 包成泛型 facade；运行时零包装（直通原 handle） */
export function sqlFacade(db: unknown): SqlDb {
  return db as SqlDb
}
