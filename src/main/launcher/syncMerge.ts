/**
 * Frond · 双向同步的行级合并（P-5①）
 *
 * 取代原来的「镜像覆盖」：`dataSync.applyBundle()` 把远端没有的本地行一律删掉，
 * 于是两台设备各自改过的东西，后同步那台会**静默丢掉**先同步那台的数据——
 * 用户看到的不是「哪条赢了」，而是「我昨天写的笔记没了」。
 *
 * 这里的规矩（2026-09-21 拍板）：
 * - 只在**三方比过之后**才动数据：本地行、远端行、上次同步见过的那一行（state）。
 *   两方比（旧 LWW）分不出「谁改过」和「谁没动」，只能靠猜。
 * - 两边都改过 → 较新的落地，较旧的那份**原地另存一行冲突副本**（标题带设备与时间）；
 *   KV 类（pref / launcher_docs / 片段扩展内容）另存一行没意义 → 记一条冲突报出去。
 * - 一边删、另一边在删除之后又改过 → 保留被改的那一份并报 `delete-edit`：
 *   删除是一次操作，编辑是用户的劳动，不能拿前者盖后者。
 * - 删除靠 state 里的**墓碑**传播，不靠「远端没有就删本地」。
 *
 * 不 import electron / sqlite：合并判据必须能被单测钉住（`syncMerge.test.ts`）。
 * `__rev` 由 DB 层读行时算好带进来（自己没有时间戳的表用父行的时间戳）。
 */

/** 一行的通用形状：`__rev` 是本次同步用来比新旧的修订号（unix ms） */
export type MergeRow = Record<string, unknown>

/** state 表里的一格：上次同步见过这行时的修订号；`deletedAt` 非空 = 墓碑 */
export interface StateEntry {
  rev: number
  deletedAt?: number
}

export type StateTable = Record<string, StateEntry>

export interface SyncTableSpec {
  table: string
  /** 主键列（按顺序拼成 rowKey） */
  pk: string[]
  /** 冲突处理：copy = 原地另存副本（需要 idCol + titleCol）；report = 只做 LWW 并计数 */
  conflict: 'copy' | 'report'
  /** 主键里充当「这一行的 id」的列（副本要换一个新 id，不能跟赢家抢主键） */
  idCol?: string
  /** 副本改哪个标题列 */
  titleCol?: string
}

export interface ConflictRecord {
  table: string
  key: string
  kind: 'edit-edit' | 'edit-delete' | 'delete-edit'
  /** 被判负、被另存或被保留的那一侧（供状态页说清楚「谁的哪条留下了」） */
  loser: 'local' | 'remote'
}

export interface MergeInput {
  spec: SyncTableSpec
  local: MergeRow[]
  remote: MergeRow[]
  state: StateTable
  /** 本次合并的时间戳（传进来而不是 Date.now()，墓碑才钉得住） */
  now: number
  /** 本机设备名，进冲突副本的标题 */
  device: string
  /** 副本标题后缀里的时间串（调用方按用户语言格式化） */
  stamp: string
}

export interface MergeOutput {
  /** 要写进本地的行（远端新增 / 远端更新 / 冲突副本） */
  upsert: MergeRow[]
  /** 要删掉的本地行 rowKey */
  removeKeys: string[]
  conflicts: ConflictRecord[]
  /** 副本行（同时也在 upsert 里；单独给一份是为了计数） */
  copies: MergeRow[]
  /** 合并后的整表 state（调用方按它覆盖式回写） */
  nextState: StateTable
}

const SEP = '\u0000'

/** 行修订号；缺 `__rev` 的行按 0 处理（等于「永远最旧」，只会被对手覆盖，不会反过来吃掉别人） */
function revOf(row: MergeRow | undefined): number {
  if (!row) return 0
  const r = row['__rev']
  return typeof r === 'number' && Number.isFinite(r) ? r : 0
}

/**
 * 两行的**内容**是否等价。`__rev` 是修订号，不是内容：一次「只动了元数据」的写
 * 会把 rev 推高而内容一字不变，那种两边不该产出一行冲突副本 —— 否则每同步一次
 * 就多一行，而且用户看到的是「我这条笔记被复制成了两条」。
 */
function sameContent(a: MergeRow, b: MergeRow): boolean {
  const keys = new Set([...Object.keys(a), ...Object.keys(b)])
  keys.delete('__rev')
  for (const k of keys) {
    if (JSON.stringify(a[k] ?? null) !== JSON.stringify(b[k] ?? null)) return false
  }
  return true
}

/** rowKey：主键值按 pk 顺序拼，带分隔符避免 (a,bc) 与 (ab,c) 撞成同一个 */
export function rowKeyOf(spec: SyncTableSpec, row: MergeRow): string {
  return spec.pk.map((k) => String(row[k] ?? '')).join(SEP)
}

/**
 * 主键值数组（rowKey 的反向：删除本地行时 SQL 要按列传值）。
 * 带上 spec 有两个用处：列数是已知的（拆出几段就该是几列，多了说明值里混进了分隔符，
 * 宁可少拆也不能拼出错行的 WHERE），而且调用方不必自己记住 pk 有几列。
 */
export function pkValues(spec: SyncTableSpec, key: string): string[] {
  const parts = key.split(SEP)
  return spec.pk.map((_, i) => parts[i] ?? '')
}

function indexRows(spec: SyncTableSpec, rows: MergeRow[]): Map<string, MergeRow> {
  const out = new Map<string, MergeRow>()
  for (const row of rows) out.set(rowKeyOf(spec, row), row)
  return out
}

/** 对端是否已经带着这一行某次输家内容的副本（按 `<原 id>~c~` 前缀 + 修订号认） */
function hasCopyOf(candidates: MergeRow[], spec: SyncTableSpec, loser: MergeRow): boolean {
  const idCol = spec.idCol
  if (!idCol) return false
  const prefix = `${String(loser[idCol] ?? '')}${COPY_INFIX}`
  const rev = revOf(loser)
  return candidates.some((row) => String(row[idCol] ?? '').startsWith(prefix) && revOf(row) === rev)
}

/** 副本 id 的中缀：`<原 id>~c~<时间>`，`~` 不出我们的业务 id 字母表 */
const COPY_INFIX = '~c~'

/**
 * 冲突副本：换一个新 id、标题带设备与时间、修订号沿用输家的原值。
 * 换 id 是必需的——副本要和赢家共存，沿用主键会直接 `INSERT OR REPLACE` 掉赢家。
 */
export function makeConflictCopy(
  spec: SyncTableSpec,
  loser: MergeRow,
  device: string,
  stamp: string
): MergeRow {
  const copy: MergeRow = { ...loser }
  const titleCol = spec.titleCol
  const idCol = spec.idCol
  if (titleCol) {
    const base = String(loser[titleCol] ?? '')
    copy[titleCol] = `${base}（冲突副本 · ${device} · ${stamp}）`.slice(0, 240)
  }
  if (idCol) {
    const original = String(loser[idCol] ?? '')
    // 只改尾串、保住前缀可读；~ 与 # 都不在业务 id 的字母表里（uuid / nanoid）
    copy[idCol] = `${original}${COPY_INFIX}${stamp.replace(/[^\w-]/g, '')}`.slice(0, 190)
  }
  return copy
}

/**
 * 一张表的三方合并。返回的是**本地该怎么改**——远端那一侧不在这里动：
 * 合并完本地成了并集，下一次 push 自然把并集交回远端，另一台设备再从它的 state 对称合并。
 */
export function mergeTable(input: MergeInput): MergeOutput {
  const { spec, local, remote, state, now, device, stamp } = input
  const localRows = indexRows(spec, local)
  const remoteRows = indexRows(spec, remote)
  const upsert: MergeRow[] = []
  const removeKeys: string[] = []
  const copies: MergeRow[] = []
  const conflicts: ConflictRecord[] = []
  const nextState: StateTable = {}

  const keys = new Set([...localRows.keys(), ...remoteRows.keys(), ...Object.keys(state)])

  for (const key of keys) {
    const l = localRows.get(key)
    const r = remoteRows.get(key)
    const s = state[key]

    // 「改过」= 这一侧的修订号比上次同步见过的那个版本更新。没有 state 基线时**谁都算不上改过**，
    // 否则第一趟同步（或清过 state 之后）会把两边都判成动了，凭空产出一堆假冲突副本。
    const seen = s && !s.deletedAt ? s.rev : (s?.deletedAt ?? 0)
    const changed = (row: MergeRow | undefined): boolean => !!row && !!s && revOf(row) > seen

    if (l && r) {
      if (!s) {
        // 没有基线：退回到两方比——新的那份留下（不留下就是静默丢数据），
        // 但**不报冲突也不产副本**，因为没有依据说两边真的各改了一次。
        // 判「该不该写本地」只能按修订号比，不能用对象相等：同一次读的 l/r 可能是同一个对象。
        const localWins = revOf(l) >= revOf(r)
        nextState[key] = { rev: revOf(localWins ? l : r) }
        if (!localWins) upsert.push(r)
        continue
      }
      const lChanged = changed(l)
      const rChanged = changed(r)
      if (lChanged && rChanged && sameContent(l, r)) {
        // 内容一样：没有东西需要保住，取较新的修订号当基线就走
        nextState[key] = { rev: Math.max(revOf(l), revOf(r)) }
        continue
      }
      const tie = lChanged && rChanged && revOf(l) === revOf(r)
      const winner =
        lChanged && rChanged
          ? revOf(l) >= revOf(r)
            ? ('local' as const)
            : ('remote' as const)
          : rChanged
            ? ('remote' as const)
            : ('local' as const)
      if (lChanged && rChanged) {
        const loserRow = winner === 'local' ? r : l
        conflicts.push({
          table: spec.table,
          key,
          kind: 'edit-edit',
          loser: winner === 'local' ? 'remote' : 'local'
        })
        // 同一处冲突在合并后的世界里只能有一份副本：两边都找一遍（对面那台可能已经
        // 把这份内容存成副本推过来了）。否则 A 拉一次、B 拉一次，各多出一行内容相同、
        // id 不同的副本，谁也删不完。
        const alreadyCopied =
          !!spec.idCol && hasCopyOf([...localRows.values(), ...remoteRows.values()], spec, loserRow)
        if (spec.conflict === 'copy' && spec.idCol && spec.titleCol && !alreadyCopied) {
          const copy = makeConflictCopy(spec, loserRow, device, stamp)
          copies.push(copy)
          upsert.push(copy)
          nextState[rowKeyOf(spec, copy)] = { rev: revOf(loserRow) }
        }
      }
      nextState[key] = { rev: revOf(winner === 'local' ? l : r) }
      // 赢家是远端且修订号确实不同才写本地；本地是赢家时本地已经是对的
      if (winner === 'remote' && revOf(r) !== revOf(l)) upsert.push(r)
      else if (winner === 'local' && tie)
        // 平手（同一毫秒各改一次）分不出谁更新：这一侧留本地那份、远端那份另存一行。
        // 把赢家也写进 upsert 不是多余的 —— 对端拿到的是同一份合并输出、方向相反，
        // 两边都「明示自己留下的是哪份」才是「两份都还在」，只写副本会让赢家的内容
        // 在对方的 state 里对不上号。
        upsert.push(l)
      continue
    }

    if (l && !r) {
      if (!s) {
        // 本地新增、远端从没见过 → 保留，等 push
        nextState[key] = { rev: revOf(l) }
        continue
      }
      if (changed(l)) {
        // 远端删了，但本地在这之后又改过 → 保住本地那份，报冲突
        conflicts.push({ table: spec.table, key, kind: 'delete-edit', loser: 'remote' })
        nextState[key] = { rev: revOf(l) }
        continue
      }
      if (spec.conflict !== 'copy') {
        // report 型表（KV 文档、追加型集合）不传播「远端没有这行」这件事：
        // 它们的缺席只说明对面没这一格，不等于谁按了删除 —— 拿缺席当删除，
        // 收藏会在两台设备之间来回复活/消失，而这类表连一行冲突副本都留不下。
        // 代价说清楚：这类表上「删掉一行」目前同步不出去（要传播删除得先给它们一个墓碑列）。
        nextState[key] = { rev: revOf(l) }
        continue
      }
      // 删除传播：本地这一行按墓碑删掉
      removeKeys.push(key)
      nextState[key] = { rev: Math.max(s.rev, revOf(l)), deletedAt: now }
      continue
    }

    if (!l && r) {
      if (!s) {
        // 远端新增 → 落地
        upsert.push(r)
        nextState[key] = { rev: revOf(r) }
        continue
      }
      if (changed(r)) {
        // 本地删了，但远端在这之后又改过 → 把远端那份取回来（等于撤销这次删除），报冲突
        conflicts.push({ table: spec.table, key, kind: 'edit-delete', loser: 'local' })
        upsert.push(r)
        nextState[key] = { rev: revOf(r) }
        continue
      }
      // 删除是双方共识 → 墓碑留着，别把它忘掉（忘掉 = 下一次别人家又把这条推回来）
      nextState[key] = { rev: s.rev, deletedAt: s.deletedAt ?? now }
      continue
    }

    // 两边都没有
    if (s) nextState[key] = { rev: s.rev, deletedAt: s.deletedAt ?? now }
  }

  return { upsert, removeKeys, conflicts, copies, nextState }
}

/** 各表合并结果的汇总（状态页与日志用） */
export interface MergeSummary {
  upserted: number
  removed: number
  copies: number
  conflicts: ConflictRecord[]
}

export function summarize(ran: MergeOutput[]): MergeSummary {
  return {
    upserted: ran.reduce((n, r) => n + r.upsert.length, 0),
    removed: ran.reduce((n, r) => n + r.removeKeys.length, 0),
    copies: ran.reduce((n, r) => n + r.copies.length, 0),
    conflicts: ran.flatMap((r) => r.conflicts)
  }
}
