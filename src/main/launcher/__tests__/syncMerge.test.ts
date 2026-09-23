import { describe, it, expect } from 'vitest'
import {
  mergeTable,
  makeConflictCopy,
  pkValues,
  rowKeyOf,
  summarize,
  type MergeRow,
  type StateTable,
  type SyncTableSpec
} from '../syncMerge'

/**
 * 双向同步的三方合并判据（P-5①）。
 *
 * 这一格要钉的不是「能跑」，而是**不许静默丢数据**：
 * 旧实现是「远端没有的本地行一律删」，两台设备各改各的，后同步那台会悄悄吃掉先同步那台的编辑。
 * 所以每条用例都在问同一句话——用户两份劳动是不是都还在？
 */
const notes: SyncTableSpec = {
  table: 'notes',
  pk: ['id'],
  conflict: 'copy',
  idCol: 'id',
  titleCol: 'title'
}

/** KV 类表：没有「另存一行」的意义，只许报冲突 */
const docs: SyncTableSpec = { table: 'launcher_docs', pk: ['doc_id'], conflict: 'report' }

/** 追加型集合：行不可变，presence 就是全部信息 */
const favs: SyncTableSpec = { table: 'usage_favorites', pk: ['module_id'], conflict: 'report' }

const row = (over: Record<string, unknown>): MergeRow => ({ ...over })

const run = (
  local: MergeRow[],
  remote: MergeRow[],
  state: StateTable = {},
  spec: SyncTableSpec = notes,
  over: { now?: number; device?: string; stamp?: string } = {}
) =>
  mergeTable({
    spec,
    local,
    remote,
    state,
    now: over.now ?? 5000,
    device: over.device ?? 'MacBook-Pro',
    stamp: over.stamp ?? '2026-09-21 14:03'
  })

describe('rowKey', () => {
  it('多列主键要能拆回去，且 (a,bc) 不与 (ab,c) 撞', () => {
    const spec: SyncTableSpec = { table: 't', pk: ['a', 'b'], conflict: 'report' }
    expect(rowKeyOf(spec, { a: 'a', b: 'bc' })).not.toBe(rowKeyOf(spec, { a: 'ab', b: 'c' }))
    const k = rowKeyOf(spec, { a: 'x', b: 'y' })
    expect(pkValues(spec, k)).toEqual(['x', 'y'])
  })
})

describe('新增与快进', () => {
  it('远端新增落地、本地新增留着等推送，两边都不删对方', () => {
    const r = run([row({ id: 'l1', __rev: 10 })], [row({ id: 'r1', __rev: 20 })])
    expect(r.upsert.map((x) => x.id)).toEqual(['r1'])
    expect(r.removeKeys).toEqual([])
    expect(r.conflicts).toEqual([])
  })

  it('只有一边改过 → 快进那一侧，不算冲突', () => {
    const state: StateTable = { r1: { rev: 10 } }
    const r = run([row({ id: 'r1', body: 'old', __rev: 10 })], [row({ id: 'r1', body: 'new', __rev: 30 })], state)
    expect(r.conflicts, '远端单方面改过，就是拉下来而已').toEqual([])
    expect(r.upsert).toHaveLength(1)
    expect(r.upsert[0].body).toBe('new')
  })

  it('本地单方面改过 → 本地不动（下一次 push 带走）', () => {
    const state: StateTable = { r1: { rev: 10 } }
    const r = run([row({ id: 'r1', body: 'mine', __rev: 40 })], [row({ id: 'r1', body: 'stale', __rev: 10 })], state)
    expect(r.upsert).toEqual([])
    expect(r.removeKeys).toEqual([])
    expect(r.nextState['r1'].rev).toBe(40)
  })
})

describe('两边都改过', () => {
  const state: StateTable = { n1: { rev: 10 } }

  it('较新的落地，较旧的原地另存一行副本（新 id + 标题带设备与时间）', () => {
    const r = run(
      [row({ id: 'n1', title: '购物清单', __rev: 20 })],
      [row({ id: 'n1', title: '购物清单（远端）', __rev: 40 })],
      state
    )
    expect(r.conflicts).toEqual([{ table: 'notes', key: 'n1', kind: 'edit-edit', loser: 'local' }])
    // 赢家是远端：本地要写成远端那份
    const winner = r.upsert.find((x) => x.id === 'n1')
    expect(winner?.title).toBe('购物清单（远端）')
    // 输家（本地那份）没消失，而是变成了另一行
    const copy = r.copies[0]
    expect(r.copies).toHaveLength(1)
    expect(copy.id).not.toBe('n1')
    expect(String(copy.id).startsWith('n1~c~')).toBe(true)
    expect(copy.title).toContain('冲突副本')
    expect(copy.title).toContain('MacBook-Pro')
    expect(copy.__rev, '副本沿用输家自己的修订号，别伪装成刚改的').toBe(20)
    // 两份都得有 state 记录，否则下一次同步会再判一次冲突
    expect(Object.keys(r.nextState).sort()).toEqual([copy.id, 'n1'].sort())
  })

  it('本地更新时赢家是本地，副本装的是远端那份', () => {
    const r = run(
      [row({ id: 'n1', title: '本地新', __rev: 90 })],
      [row({ id: 'n1', title: '远端旧', __rev: 30 })],
      state
    )
    expect(r.upsert.find((x) => x.id === 'n1'), '本地已经是赢家，不该被远端盖掉').toBeUndefined()
    expect(r.copies[0].title).toContain('远端旧')
  })

  it('修订号相同（同一毫秒各改一次）也要留两份，不许只活一份', () => {
    const r = run(
      [row({ id: 'n1', title: 'A', __rev: 50 })],
      [row({ id: 'n1', title: 'B', __rev: 50 })],
      state
    )
    expect(r.conflicts).toHaveLength(1)
    expect(r.copies).toHaveLength(1)
    const titles = [r.upsert.find((x) => x.id === 'n1')?.title, r.copies[0].title].filter(Boolean)
    expect(new Set(['A', 'B']).size).toBe(2)
    expect(titles.join(' ')).toContain('A')
    expect(titles.join(' ')).toContain('B')
  })

  it('KV 类表不产副本，但冲突必须被记下来（不许静默）', () => {
    const st: StateTable = { quicklinks: { rev: 10 } }
    const r = run(
      [row({ doc_id: 'quicklinks', data: 'local', __rev: 20 })],
      [row({ doc_id: 'quicklinks', data: 'remote', __rev: 40 })],
      st,
      docs
    )
    expect(r.copies, '一份文档另存成第二行没有意义').toEqual([])
    expect(r.conflicts).toEqual([
      { table: 'launcher_docs', key: 'quicklinks', kind: 'edit-edit', loser: 'local' }
    ])
    expect(r.upsert[0].data).toBe('remote')
  })
})

describe('删除与编辑撞车', () => {
  it('远端删了、本地没动过 → 本地跟着删，并留墓碑', () => {
    const r = run([row({ id: 'n1', __rev: 10 })], [], { n1: { rev: 10 } })
    expect(r.removeKeys).toEqual(['n1'])
    expect(r.nextState['n1']).toEqual({ rev: 10, deletedAt: 5000 })
    expect(r.conflicts).toEqual([])
  })

  it('远端删了、本地在那之后又改过 → 保住本地，报 delete-edit', () => {
    const r = run([row({ id: 'n1', __rev: 80 })], [], { n1: { rev: 10 } })
    expect(r.removeKeys, '删除是一次操作，编辑是用户的劳动，前者不盖后者').toEqual([])
    expect(r.conflicts).toEqual([
      { table: 'notes', key: 'n1', kind: 'delete-edit', loser: 'remote' }
    ])
    expect(r.nextState['n1'].deletedAt, '留着的行不能被记成墓碑').toBeUndefined()
  })

  it('本地删了、远端又改过 → 把远端那份取回来（等于撤销删除）并报告', () => {
    const r = run([], [row({ id: 'n1', __rev: 70 })], { n1: { rev: 10 } })
    expect(r.upsert.map((x) => x.id)).toEqual(['n1'])
    expect(r.conflicts).toEqual([
      { table: 'notes', key: 'n1', kind: 'edit-delete', loser: 'local' }
    ])
  })

  it('双方都删了 → 墓碑必须留着；下一次谁都不许把它复活', () => {
    const first = run([], [], { n1: { rev: 10 } })
    expect(first.nextState['n1']).toEqual({ rev: 10, deletedAt: 5000 })
    const second = run([], [], first.nextState)
    expect(second.upsert).toEqual([])
    expect(second.nextState['n1'].deletedAt, '墓碑过期前一直算墓碑').toBe(5000)
    // 对端把这条又推过来（它还没同步到删除）：按墓碑基线判，不算「远端新增」
    const revived = run([], [row({ id: 'n1', __rev: 5 })], second.nextState)
    expect(revived.upsert, '比删除还旧的行不得借推送复活').toEqual([])
  })
})

describe('没有基线时不产假冲突', () => {
  it('首次同步（state 全空）两边都有同一行 → 新的留下，不产副本也不报冲突', () => {
    const r = run([row({ id: 'n1', title: '本地', __rev: 20 })], [row({ id: 'n1', title: '远端', __rev: 40 })])
    expect(r.conflicts).toEqual([])
    expect(r.copies).toEqual([])
    expect(r.upsert[0].title, '但也不能静默丢掉更新的那份').toBe('远端')
  })

  it('清空 state 之后重跑一遍也不会满屏冲突副本', () => {
    const same = [row({ id: 'n1', __rev: 100 }), row({ id: 'n2', __rev: 100 })]
    const r = run(same, same)
    expect(r.copies).toEqual([])
    expect(r.upsert).toEqual([])
    expect(r.removeKeys).toEqual([])
  })
})

describe('收敛', () => {
  it('合并两次是幂等的：第二次没有新行、没有新冲突', () => {
    const state: StateTable = { n1: { rev: 10 } }
    const local = [row({ id: 'n1', title: '本地', __rev: 20 })]
    const remote = [row({ id: 'n1', title: '远端', __rev: 40 })]
    const first = run(local, remote, state)
    // 把第一次的结果落到本地（模拟 apply），再拿同一份远端合一次
    const localAfter = [
      ...local.filter((l) => !first.upsert.some((u) => u.id === l.id)),
      ...first.upsert
    ]
    const second = run(localAfter, remote, first.nextState)
    expect(second.upsert, '第二趟又写一遍 = apply 没收敛').toEqual([])
    expect(second.conflicts).toEqual([])
    expect(second.copies).toEqual([])
  })

  it('追加型集合（收藏）做并集，谁都不被删', () => {
    const r = run(
      [row({ module_id: 'a', __rev: 10 })],
      [row({ module_id: 'b', __rev: 20 })],
      { a: { rev: 10 } },
      favs
    )
    expect(r.upsert.map((x) => x.module_id)).toEqual(['b'])
    expect(r.removeKeys).toEqual([])
  })

  it('汇总把各表的产出加起来（状态页要的那几个数）', () => {
    const a = run([row({ id: 'n1', __rev: 20 })], [row({ id: 'n1', __rev: 40 })], { n1: { rev: 10 } })
    const b = run([row({ id: 'x', __rev: 5 })], [], {}, notes)
    const s = summarize([a, b])
    expect(s.copies).toBe(0 + 0)
    expect(s.conflicts.length).toBe(a.conflicts.length)
    expect(s.removed).toBe(b.removeKeys.length)
  })
})

describe('makeConflictCopy', () => {
  it('标题超长要截住，id 只长尾串不动前缀', () => {
    const loser = row({ id: 'abc123', title: 'x'.repeat(230), __rev: 7 })
    const copy = makeConflictCopy(notes, loser, 'Mac', '2026-09-21 14:03')
    expect((copy.title as string).length).toBeLessThanOrEqual(240)
    expect((copy.id as string).startsWith('abc123~c~')).toBe(true)
    expect((copy.id as string).length).toBeLessThanOrEqual(190)
    expect(loser.id, '不能改动传进来的行').toBe('abc123')
  })

  it('副本时间串里的标点不会污染 id（id 会被当主键比较）', () => {
    const copy = makeConflictCopy(notes, row({ id: 'a1', title: 't', __rev: 1 }), 'D', '2026/09/21 14:03')
    expect(copy.id).toBe('a1~c~202609211403')
  })
})
