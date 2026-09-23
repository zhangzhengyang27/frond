import { describe, it, expect } from 'vitest'
import {
  mergeRunHistory,
  sanitizeAction,
  sanitizeTasks,
  tick,
  type TickDeps
} from '../store'
import type { AutomationAction, AutomationTask } from '../../../../shared/automation'

/**
 * Automations 的清洗与调度（P-4④）。
 * tick 的时钟/执行器/存储全是注入的，所以「同一分钟只跑一次」这种判据能真验，
 * 不用等真时间过一分钟。
 */
const base: AutomationTask = {
  id: 't1',
  label: '每天问一次',
  cron: '30 9 * * *',
  enabled: true,
  action: { type: 'ai', prompt: '今天的待办有什么' },
  lastFiredAt: null,
  lastOk: null
}

function harness(
  tasks: AutomationTask[],
  nowMs: number,
  run: (
    action: AutomationAction,
    pluginId: string | null
  ) => Promise<{ ok: boolean; error?: string }> = async () => ({ ok: true })
): { deps: TickDeps; fired: () => string[]; saved: () => AutomationTask[]; runs: () => number } {
  let saved: AutomationTask[] = []
  let fired: string[] = []
  let calls = 0
  const deps: TickDeps = {
    now: () => new Date(nowMs),
    tasks: () => tasks,
    save: (t) => {
      saved = t
    },
    run: async (action, pluginId) => {
      calls++
      return run(action, pluginId)
    }
  }
  return {
    deps,
    fired: () => fired,
    saved: () => saved,
    runs: () => calls,
    ...{
      setFired: (v: string[]) => {
        fired = v
      }
    }
  } as never
}

/** 2026-09-20 09:30:00 本地时间 */
const at0930 = new Date(2026, 8, 20, 9, 30, 0, 0).getTime()
const at0931 = at0930 + 60_000
const at1030 = at0930 + 3_600_000

describe('sanitizeAction：动作面刻意收窄', () => {
  it('五类合法动作收得下', () => {
    expect(sanitizeAction({ type: 'ai', prompt: 'x' })).toEqual({ type: 'ai', prompt: 'x' })
    expect(sanitizeAction({ type: 'copyText', text: 'hi' })).toEqual({ type: 'copyText', text: 'hi' })
    expect(sanitizeAction({ type: 'system', cmdId: 'sleep-display' })).toEqual({
      type: 'system',
      cmdId: 'sleep-display'
    })
  })

  it('剪贴板项 / 片段 / 文件这类「要人看着结果」的动作不在面上', () => {
    expect(sanitizeAction({ type: 'clipboardItem', id: 'x' })).toBeNull()
    expect(sanitizeAction({ type: 'file', path: '/etc' })).toBeNull()
    expect(sanitizeAction({ type: 'snippetItem', id: 'x' })).toBeNull()
  })

  it('openUrl 只收 http(s)，file:// 之类在无人值守下没有正当用途', () => {
    expect(sanitizeAction({ type: 'openUrl', url: 'https://a.test' })).not.toBeNull()
    expect(sanitizeAction({ type: 'openUrl', url: 'file:///etc/passwd' })).toBeNull()
    expect(sanitizeAction({ type: 'openUrl', url: 'javascript:alert(1)' })).toBeNull()
  })

  it('app 只收绝对路径；空提示词与空文本一律拒', () => {
    expect(sanitizeAction({ type: 'app', path: '/Applications/Safari.app' })).not.toBeNull()
    expect(sanitizeAction({ type: 'app', path: 'Safari.app' })).toBeNull()
    expect(sanitizeAction({ type: 'ai', prompt: '   ' })).toBeNull()
    expect(sanitizeAction({ type: 'copyText', text: '' })).toBeNull()
  })
})

describe('sanitizeTasks', () => {
  it('合法任务通过并保留必填字段', () => {
    const { tasks, rejected } = sanitizeTasks([{ id: 't1', cron: '30 9 * * *', action: { type: 'copyText', text: 'a' } }])
    expect(rejected).toEqual([])
    expect(tasks[0]).toMatchObject({ id: 't1', label: 't1', enabled: true, lastFiredAt: null })
  })

  it('cron 写坏的任务被拒并带原因（不能存进去后靠引擎不跑）', () => {
    const { tasks, rejected } = sanitizeTasks([{ id: 't1', cron: '99 9 * * *', action: { type: 'copyText', text: 'a' } }])
    expect(tasks).toEqual([])
    expect(rejected[0].reason).toContain('cron 不合法')
  })

  it('外部回传的 lastFiredAt 一律丢弃：触发历史只能由引擎写', () => {
    const { tasks } = sanitizeTasks([
      { ...base, lastFiredAt: 1, lastOk: true, lastError: '伪造' }
    ])
    expect(tasks[0].lastFiredAt).toBeNull()
    expect(tasks[0].lastOk).toBeNull()
    expect(tasks[0].lastError).toBeUndefined()
  })

  it('id 重复与超过上限都要报', () => {
    const many = Array.from({ length: 25 }, (_, i) => ({ ...base, id: `t${i}` }))
    const r = sanitizeTasks(many)
    expect(r.tasks).toHaveLength(20)
    expect(r.rejected[0].reason).toContain('上限')
    expect(sanitizeTasks([base, { ...base, label: '第二条' }]).rejected[0].reason).toContain('id 重复')
  })
})

describe('tick 的调度判据', () => {
  it('命中当前分钟才跑，且跑完写下 lastFiredAt', async () => {
    const h = harness([{ ...base }], at0930)
    const fired = await tick(h.deps)
    expect(fired).toEqual(['t1'])
    expect(h.saved()[0].lastFiredAt).toBe(at0930)
    expect(h.saved()[0].lastOk).toBe(true)
  })

  it('同一分钟再 tick 一次不会重复跑', async () => {
    const task = { ...base, lastFiredAt: at0930 + 1000, lastOk: true }
    const fired = await tick(harness([task], at0930 + 20_000).deps)
    expect(fired).toEqual([])
  })

  it('不匹配的分钟不跑，也不写存储', async () => {
    const h = harness([{ ...base }], at0931)
    expect(await tick(h.deps)).toEqual([])
    expect(h.saved()).toEqual([])
  })

  it('停用的任务永远不跑，哪怕表达式命中', async () => {
    const fired = await tick(harness([{ ...base, enabled: false }], at0930).deps)
    expect(fired).toEqual([])
  })

  it('执行失败要把原因留在任务上（界面要看得见为什么没成）', async () => {
    const h = harness([{ ...base }], at0930, async () => ({ ok: false as const, error: 'AI 未配置' }))
    await tick(h.deps)
    expect(h.saved()[0]).toMatchObject({ lastOk: false, lastError: 'AI 未配置' })
  })

  it('执行器抛异常也算失败，且不影响下一个任务', async () => {
    const boom: AutomationTask = { ...base, id: 'boom', action: { type: 'copyText', text: 'x' } }
    const okTask: AutomationTask = { ...base, id: 'ok', action: { type: 'copyText', text: 'y' } }
    let saved: AutomationTask[] = []
    const fired = await tick({
      now: () => new Date(at0930),
      tasks: () => [boom, okTask],
      save: (t) => {
        saved = t
      },
      run: async (a) => {
        if (a.type === 'copyText' && a.text === 'x') throw new Error('炸了')
        return { ok: true }
      }
    })
    expect(fired).toEqual(['boom', 'ok'])
    expect(saved.find((t) => t.id === 'boom')).toMatchObject({ lastOk: false, lastError: '炸了' })
    expect(saved.find((t) => t.id === 'ok')).toMatchObject({ lastOk: true })
  })

  it('跨小时后仍然只在各自那一分钟跑一次', async () => {
    expect(await tick(harness([{ ...base }], at1030).deps)).toEqual([])
    const everyMinute = { ...base, cron: '* * * * *', lastFiredAt: at0930 }
    expect(await tick(harness([everyMinute], at0931).deps)).toEqual(['t1'])
  })
})

describe('mergeRunHistory：改配置不能把触发历史洗掉', () => {
  const old: AutomationTask = { ...base, lastFiredAt: at0930, lastOk: false, lastError: '上次失败' }

  it('cron 与 action 没变 → 保留历史', () => {
    const merged = mergeRunHistory([{ ...base, label: '改个名' }], [old])
    expect(merged[0]).toMatchObject({ label: '改个名', lastFiredAt: at0930, lastError: '上次失败' })
  })

  it('改了 cron 或 action → 视为换了件事，历史清零（否则当分钟会被旧记录挡住不跑）', () => {
    expect(mergeRunHistory([{ ...base, cron: '0 10 * * *' }], [old])[0].lastFiredAt).toBeNull()
    expect(
      mergeRunHistory([{ ...base, action: { type: 'copyText', text: 'z' } }], [old])[0].lastFiredAt
    ).toBeNull()
  })

  it('新任务没有历史就是没有', () => {
    expect(mergeRunHistory([{ ...base, id: 'new' }], [old])[0].lastFiredAt).toBeNull()
  })
})
