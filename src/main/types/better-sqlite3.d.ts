/**
 * Frond · better-sqlite3 项目内类型声明（B46 根源修复）
 *
 * 背景：better-sqlite3 v13 无 bundled types，@types/better-sqlite3 未跟进 v13 ——
 * TS 从 lib/*.js 推断，prepare/run/get/all 全 any，全仓 no-unsafe-* 家族因此
 * 累积 2,400+ 条（docs/BUGS.md B46）。本文件声明**本仓实际用到的面**：
 * Database（含 backup/pragma/transaction）、Statement（run/get/all/iterate）、
 * RunResult、Options。Result 默认 unknown：无泛型调用点拿到 unknown
 * （cast 合法，不触发 no-unsafe），行形状由调用点泛型或 typedSql.ts 收口给出。
 *
 * 形状依据：`typeof require('better-sqlite3')` 是构造器（无 .Database 运行时
 * 属性，lib/index.js 实测）；`Database.Database` / `Database.Statement` 走
 * namespace-merge 的类型面（`Database.Database` = 实例类型别名）。
 * 升级 better-sqlite3 若官方补 types，删除本文件即可。
 */
declare module 'better-sqlite3' {
  class Database {
    constructor(path: string, options?: Database.Options)
    prepare<Row = unknown>(sql: string): Database.Statement<Row>
    exec(sql: string): void
    pragma(source: string, options?: { simple?: boolean }): unknown
    transaction<TArgs extends unknown[], T>(fn: (...args: TArgs) => T): (...args: TArgs) => T
    /** 在线一致性快照（不打断主连接） */
    backup(destination: string): Promise<void>
    close(): void
    readonly open: boolean
    readonly inTransaction: boolean
  }

  namespace Database {
    /** 实例类型：`db: Database.Database` 的形状来源 */
    type Database = InstanceType<typeof Database>

    interface Options {
      readonly?: boolean
      /** 文件不存在时抛错而不是新建（导入/校验场景防误建空库） */
      fileMustExist?: boolean
      /** 锁等待毫秒数（默认 5000） */
      timeout?: number
      open?: boolean
    }

    type RunResult = {
      changes: number
      lastInsertRowid: number | bigint
    }

    interface Statement<Row = unknown> {
      run(...params: unknown[]): RunResult
      get(...params: unknown[]): Row | undefined
      all(...params: unknown[]): Row[]
      iterate(...params: unknown[]): IterableIterator<Row>
    }
  }

  export = Database
}
