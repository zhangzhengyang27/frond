/**
 * Frond · useMultiPomodoroTimer 状态机单测
 *
 * 为什么值得测：这是番茄钟的核心引擎（628 行），而它此前**零行为层覆盖**——
 * 只有 db 层 pom_pomodoros 的读写测试，引擎本身（阶段推进、Flowtime 推导、
 * 严格模式守卫、预警去重、多项目并行）没有任何断言。这类 bug 的表现是
 * 「计时器数字不对/该响没响」，用户看得见但测试看不见。
 *
 * 覆盖策略：只挑**判别性最强**的行为——写错就必然变红的那种。
 *   - 时长解析的优先级（项目覆盖 > 全局）与下限钳制
 *   - work→break→longBreak 的计数推进（`completed % interval` 的边界）
 *   - Flowtime 的 <10s 丢弃阈值与「时长/5」推导的两端钳制
 *   - 严格模式守卫必须覆盖全部 4 个入口（漏一个就是「严格模式形同虚设」）
 *   - 预警阈值每轮只触发一次（有状态，最容易写成每 tick 都响）
 *   - 多项目并行互不干扰（这是「多项目」这个卖点的全部意义）
 *   - 持久化只在非 running 时落盘（反过来会把暂停态覆盖成运行态）
 *
 * 时间控制：用 fakeTimers，并 `advanceTimersByTimeAsync` —— 引擎的
 * completeInternal 是 async 的，同步版 advance 只会跑到第一个 await 就停，
 * 阶段推进的断言会看到中间态。
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { useMultiPomodoroTimer, type PersistedTimerState } from '../useMultiPomodoroTimer'

type Options = Parameters<typeof useMultiPomodoroTimer>[0]

/** 造一个「记录一切副作用」的引擎实例 */
function makeTimer(overrides: Partial<Options> = {}) {
  const completes: Array<{
    projectId: string
    type: string
    duration: number
    taskId: string | null
    taskTitle: string | null
  }> = []
  const notifies: Array<{ projectId: string; event: string; message?: string }> = []
  const persists: Array<{ projectId: string; state: PersistedTimerState }> = []
  const warnings: Array<{ projectId: string; secondsLeft: number }> = []
  const strictFails: string[] = []

  const api = useMultiPomodoroTimer({
    globalSettings: () => ({
      workDuration: 25,
      shortBreakDuration: 5,
      longBreakDuration: 15,
      longBreakInterval: 4
    }),
    getProjectOverrides: () => null,
    onComplete: (p) => {
      completes.push(p)
    },
    notify: (projectId, event, message) => {
      notifies.push({ projectId, event, message })
    },
    taskById: (id) => (id === 't1' ? { title: '写迁移门禁' } : undefined),
    defaultProjectId: 'p1',
    persist: (projectId, state) => {
      persists.push({ projectId, state })
    },
    onWarning: (projectId, secondsLeft) => {
      warnings.push({ projectId, secondsLeft })
    },
    onStrictFail: (projectId) => {
      strictFails.push(projectId)
    },
    ...overrides
  })

  return { api, completes, notifies, persists, warnings, strictFails }
}

describe('useMultiPomodoroTimer', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  // ── 时长解析 ────────────────────────────────────────────────

  describe('时长解析', () => {
    it('新建项目时 timeLeft 初始化为该模式的完整时长（不是 0）', () => {
      const { api } = makeTimer()
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60)
      expect(api.getTimer('p1').mode).toBe('work')
      expect(api.getTimer('p1').status).toBe('idle')
    })

    it('项目级 overrides 优先于全局设置', () => {
      const { api } = makeTimer({
        getProjectOverrides: (id) => (id === 'p1' ? { workDuration: 50 } : null)
      })
      expect(api.getTimer('p1').timeLeft).toBe(50 * 60)
      // 没有覆盖的项目仍走全局
      expect(api.getTimer('p2').timeLeft).toBe(25 * 60)
    })

    it('overrides 里写 null 表示「不覆盖」，回落到全局（?? 而非 ||）', () => {
      const { api } = makeTimer({
        getProjectOverrides: () => ({ workDuration: null, shortBreakDuration: null })
      })
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60)
    })

    it('分钟数向下取整且下限 1 秒（防 0 分钟导致计时器立刻结束）', () => {
      const { api } = makeTimer({
        globalSettings: () => ({
          workDuration: 0,
          shortBreakDuration: 0.001,
          longBreakDuration: 15
        })
      })
      expect(api.getTimer('p1').timeLeft).toBe(1)
    })

    it('setMode 切到休息时，timeLeft 换成该模式时长', () => {
      const { api } = makeTimer()
      api.setMode('shortBreak', 'p1')
      expect(api.getTimer('p1').mode).toBe('shortBreak')
      expect(api.getTimer('p1').timeLeft).toBe(5 * 60)

      api.setMode('longBreak', 'p1')
      expect(api.getTimer('p1').timeLeft).toBe(15 * 60)
    })
  })

  // ── 基本状态迁移 ────────────────────────────────────────────

  describe('基本状态迁移', () => {
    it('start → running；重复 start 不重置已走的进度', async () => {
      const { api } = makeTimer()
      api.start('p1')
      expect(api.getTimer('p1').status).toBe('running')

      await vi.advanceTimersByTimeAsync(3000)
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60 - 3)

      api.start('p1') // 已在跑，应当直接 return
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60 - 3)
    })

    it('pause → paused 且清掉 lastTickAt（避免恢复时把暂停时长算进去）', async () => {
      const { api } = makeTimer()
      api.start('p1')
      await vi.advanceTimersByTimeAsync(2000)
      api.pause('p1')

      expect(api.getTimer('p1').status).toBe('paused')
      expect(api.getTimer('p1').lastTickAt).toBe(0)
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60 - 2)
    })

    it('toggle 在 running / 非 running 之间双向切换', () => {
      const { api } = makeTimer()
      api.toggle('p1')
      expect(api.getTimer('p1').status).toBe('running')
      api.toggle('p1')
      expect(api.getTimer('p1').status).toBe('paused')
      api.toggle('p1')
      expect(api.getTimer('p1').status).toBe('running')
    })

    it('reset 回到 idle 并把 timeLeft 恢复成完整时长', async () => {
      const { api } = makeTimer()
      api.start('p1')
      await vi.advanceTimersByTimeAsync(5000)
      api.reset('p1')

      expect(api.getTimer('p1').status).toBe('idle')
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60)
      expect(api.getTimer('p1').startedAt).toBeNull()
    })

    it('timeLeft 归零后 start 会重新填满时长（不是从 0 起跑）', () => {
      const { api } = makeTimer()
      const t = api.getTimer('p1')
      t.timeLeft = 0
      api.start('p1')
      expect(t.timeLeft).toBe(25 * 60)
    })
  })

  // ── 计时推进 ────────────────────────────────────────────────

  describe('计时推进', () => {
    it('每秒减 1；跑 10 秒减 10', async () => {
      const { api } = makeTimer()
      api.start('p1')
      await vi.advanceTimersByTimeAsync(10_000)
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60 - 10)
    })

    it('多项目并行：各自独立推进，切焦点不会暂停后台项目', async () => {
      const { api } = makeTimer()
      api.start('p1')
      await vi.advanceTimersByTimeAsync(4000)

      api.focus('p2')
      api.start('p2')
      await vi.advanceTimersByTimeAsync(2000)

      // p1 先跑了 4s，又跟着跑了 2s = 6s
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60 - 6)
      // p2 只跑了 2s
      expect(api.getTimer('p2').timeLeft).toBe(25 * 60 - 2)
      expect(api.activeProjects().map((t) => t.projectId).sort()).toEqual(['p1', 'p2'])
    })

    it('pause 的项目在 tick 里被跳过（暂停期间不计时）', async () => {
      const { api } = makeTimer()
      api.start('p1')
      await vi.advanceTimersByTimeAsync(2000)
      api.pause('p1')

      await vi.advanceTimersByTimeAsync(10_000)
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60 - 2)
    })
  })

  // ── 阶段推进 ────────────────────────────────────────────────

  describe('阶段推进', () => {
    it('work 跑完：上报 work 记录、进入短休息、连续计数 +1', async () => {
      const { api, completes } = makeTimer({
        getProjectOverrides: () => ({ workDuration: 1 / 60 }) // 1 秒
      })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1500)

      expect(completes).toHaveLength(1)
      expect(completes[0]).toMatchObject({ projectId: 'p1', type: 'work', duration: 1000 })
      expect(api.getTimer('p1').mode).toBe('shortBreak')
      expect(api.getTimer('p1').consecutiveCount).toBe(1)
      expect(api.getTimer('p1').timeLeft).toBe(5 * 60)
    })

    it('第 N 个 work 跑完进长休息（longBreakInterval=4 时第 4 个）', async () => {
      const { api, completes } = makeTimer({
        getProjectOverrides: () => ({ workDuration: 1 / 60 })
      })
      const t = api.getTimer('p1')

      // 手动把前 3 个 work 的连续计数推到位，只跑第 4 个
      t.consecutiveCount = 3
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1500)

      expect(completes).toHaveLength(1)
      expect(api.getTimer('p1').mode).toBe('longBreak')
      expect(api.getTimer('p1').timeLeft).toBe(15 * 60)
    })

    it('长休息结束回到 work 并置 justFinishedLongBreak（供 UI 弹 resume banner）', async () => {
      const { api } = makeTimer({
        getProjectOverrides: () => ({ longBreakDuration: 1 / 60 })
      })
      const t = api.getTimer('p1')
      t.mode = 'longBreak'
      t.timeLeft = 1
      t.warnBase = 1
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1500)

      expect(api.getTimer('p1').mode).toBe('work')
      expect(api.getTimer('p1').justFinishedLongBreak).toBe(true)
      // 休息不计入连续专注数
      expect(api.getTimer('p1').consecutiveCount).toBe(0)
    })

    it('项目级 longBreakInterval 覆盖全局', async () => {
      const { api } = makeTimer({
        getProjectOverrides: () => ({ workDuration: 1 / 60, longBreakInterval: 2 })
      })
      const t = api.getTimer('p1')
      t.consecutiveCount = 1 // 这是第 2 个 work
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1500)

      expect(api.getTimer('p1').mode).toBe('longBreak')
    })

    it('longBreakInterval 下限为 2（配 1 不会变成每轮都长休息）', async () => {
      const { api } = makeTimer({
        globalSettings: () => ({
          workDuration: 25,
          shortBreakDuration: 5,
          longBreakDuration: 15,
          longBreakInterval: 1
        }),
        getProjectOverrides: () => ({ workDuration: 1 / 60 })
      })
      const t = api.getTimer('p1')
      t.consecutiveCount = 0 // 第 1 个 work：1 % 2 !== 0 → 短休息
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1500)

      expect(api.getTimer('p1').mode).toBe('shortBreak')
    })

    it('skip 不经过定时器：running 时跳过 → paused，且上报记录', async () => {
      const { api, completes } = makeTimer()
      api.start('p1')
      await vi.advanceTimersByTimeAsync(3000)
      await api.skip('p1')

      expect(completes).toHaveLength(1)
      expect(api.getTimer('p1').status).toBe('paused')
      expect(api.getTimer('p1').mode).toBe('shortBreak')
    })

    it('onComplete 带上当前任务的标题（用于写进专注记录）', async () => {
      const { api, completes } = makeTimer({
        getProjectOverrides: () => ({ workDuration: 1 / 60 })
      })
      api.setCurrentTask('t1', 'p1')
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1500)

      expect(completes[0]).toMatchObject({ taskId: 't1', taskTitle: '写迁移门禁' })
    })

    it('计时器到点会自动开始下一阶段（当 shouldAutoStart 允许）', async () => {
      const { api } = makeTimer({
        getProjectOverrides: () => ({ workDuration: 1 / 60 }),
        shouldAutoStart: () => ({ break: true, work: true })
      })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1500)

      expect(api.getTimer('p1').mode).toBe('shortBreak')
      expect(api.getTimer('p1').status).toBe('running')
    })
  })

  // ── Flowtime 正计时 ─────────────────────────────────────────

  describe('Flowtime 正计时', () => {
    it('work 模式下正向累加，且永不自动结束', async () => {
      const { api, completes } = makeTimer({ isFlowtime: () => true })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(5000)

      expect(api.getTimer('p1').timeLeft).toBe(5)
      expect(api.getTimer('p1').elapsed).toBe(5)
      // 跑很久也不该触发完成
      await vi.advanceTimersByTimeAsync(60_000)
      expect(completes).toHaveLength(0)
      expect(api.getTimer('p1').status).toBe('running')
    })

    it('finishFlowtime：不足 10 秒直接丢弃，不写记录', async () => {
      const { api, completes } = makeTimer({ isFlowtime: () => true })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(5000)
      await api.finishFlowtime('p1')

      expect(completes).toHaveLength(0)
      expect(api.getTimer('p1').status).toBe('idle')
      expect(api.getTimer('p1').elapsed).toBe(0)
    })

    it('finishFlowtime：按累计时长写记录，休息时长 = 时长/5', async () => {
      const { api, completes } = makeTimer({ isFlowtime: () => true })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(10 * 60 * 1000) // 10 分钟
      await api.finishFlowtime('p1')

      expect(completes).toHaveLength(1)
      expect(completes[0]).toMatchObject({ type: 'work', duration: 600 * 1000 })
      expect(api.getTimer('p1').mode).toBe('shortBreak')
      // 600 / 5 = 120 秒
      expect(api.getTimer('p1').timeLeft).toBe(120)
    })

    it('Flowtime 休息推导有下限 60 秒 / 上限 20 分钟', async () => {
      const { api } = makeTimer({ isFlowtime: () => true })

      // 下限：只专注 30 秒 → 30/5 = 6 → 钳到 60
      api.start('p1')
      await vi.advanceTimersByTimeAsync(30_000)
      await api.finishFlowtime('p1')
      expect(api.getTimer('p1').timeLeft).toBe(60)

      // 上限：专注 3 小时 → 3600/5 = 720 → 钳到 1200
      api.setMode('work', 'p1')
      api.start('p1')
      await vi.advanceTimersByTimeAsync(3 * 60 * 60 * 1000)
      await api.finishFlowtime('p1')
      expect(api.getTimer('p1').timeLeft).toBe(20 * 60)
    })

    it('Flowtime 下 skip 等价于结束本次专注', async () => {
      const { api, completes } = makeTimer({ isFlowtime: () => true })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(60_000)
      await api.skip('p1')

      expect(completes).toHaveLength(1)
      expect(api.getTimer('p1').mode).toBe('shortBreak')
    })
  })

  // ── 严格模式 ────────────────────────────────────────────────

  describe('严格模式', () => {
    it('work 计时中：pause / skip / reset / setMode 全部被挡下', async () => {
      const { api } = makeTimer({ isStrict: () => true })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(3000)
      const before = api.getTimer('p1').timeLeft

      api.pause('p1')
      expect(api.getTimer('p1').status).toBe('running')

      api.reset('p1')
      expect(api.getTimer('p1').timeLeft).toBe(before)

      api.setMode('shortBreak', 'p1')
      expect(api.getTimer('p1').mode).toBe('work')

      await api.skip('p1')
      expect(api.getTimer('p1').mode).toBe('work')
      expect(api.getTimer('p1').status).toBe('running')
    })

    it('严格模式只在 work 计时中生效：休息阶段照常可暂停', () => {
      const { api } = makeTimer({ isStrict: () => true })
      api.setMode('shortBreak', 'p1')
      api.start('p1')
      api.pause('p1')
      expect(api.getTimer('p1').status).toBe('paused')
    })

    it('严格模式只挡「运行中」：idle 的 work 仍可改模式', () => {
      const { api } = makeTimer({ isStrict: () => true })
      api.setMode('shortBreak', 'p1')
      expect(api.getTimer('p1').mode).toBe('shortBreak')
    })

    it('failStrict：作废当前番茄（回 idle、清进度）并回调通知 UI', async () => {
      const { api, strictFails } = makeTimer({ isStrict: () => true })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(5000)
      api.failStrict('p1')

      expect(api.getTimer('p1').status).toBe('idle')
      expect(api.getTimer('p1').timeLeft).toBe(25 * 60)
      expect(strictFails).toEqual(['p1'])
    })
  })

  // ── 临近预警 ────────────────────────────────────────────────

  describe('临近预警', () => {
    it('越过 60s 与 30s 各触发一次，且同一阈值不重复', async () => {
      const { api, warnings } = makeTimer({
        getProjectOverrides: () => ({ workDuration: 61 / 60 }) // 61 秒
      })
      api.start('p1')

      // 走到剩 60 秒（61 → 60 的那一步）
      await vi.advanceTimersByTimeAsync(1000)
      expect(warnings).toEqual([{ projectId: 'p1', secondsLeft: 60 }])

      // 继续走到剩 30 秒
      await vi.advanceTimersByTimeAsync(30_000)
      expect(warnings).toEqual([
        { projectId: 'p1', secondsLeft: 60 },
        { projectId: 'p1', secondsLeft: 30 }
      ])

      // 再走一会儿，不应重复触发
      await vi.advanceTimersByTimeAsync(10_000)
      expect(warnings).toHaveLength(2)
    })

    it('reset 后重新开始，预警阈值可再次触发（warned 被清空）', async () => {
      const { api, warnings } = makeTimer({
        getProjectOverrides: () => ({ workDuration: 61 / 60 })
      })
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1000)
      expect(warnings).toHaveLength(1)

      api.reset('p1')
      api.start('p1')
      await vi.advanceTimersByTimeAsync(1000)
      expect(warnings).toHaveLength(2)
    })
  })

  // ── 特殊休息 ────────────────────────────────────────────────

  describe('特殊休息（P2-8）', () => {
    it('startSpecialBreak 直接进入指定时长的短休息并自动开始', () => {
      const { api } = makeTimer()
      api.startSpecialBreak(30, 'p1')

      expect(api.getTimer('p1').mode).toBe('shortBreak')
      expect(api.getTimer('p1').timeLeft).toBe(30 * 60)
      expect(api.getTimer('p1').status).toBe('running')
      expect(api.getTimer('p1').specialBreak).toBe(true)
    })

    it('特殊休息完成时按「实际时长」写记录，而不是配置的短休息时长', async () => {
      const { api, completes } = makeTimer()
      api.startSpecialBreak(1, 'p1') // 1 分钟
      await vi.advanceTimersByTimeAsync(61_000)

      expect(completes).toHaveLength(1)
      expect(completes[0].duration).toBe(60 * 1000)
      // 完成后标志位清掉，回到正常节奏
      expect(api.getTimer('p1').specialBreak).toBe(false)
      expect(api.getTimer('p1').mode).toBe('work')
    })
  })

  // ── 持久化 ──────────────────────────────────────────────────

  describe('持久化', () => {
    it('running 时不落盘（避免把「正在跑」这个瞬时态写进去）', async () => {
      const { api, persists } = makeTimer()
      api.start('p1')
      await vi.advanceTimersByTimeAsync(3000)
      expect(persists).toHaveLength(0)
    })

    it('pause 时落盘，且状态记为 paused', async () => {
      const { api, persists } = makeTimer()
      api.start('p1')
      await vi.advanceTimersByTimeAsync(3000)
      api.pause('p1')

      expect(persists).toHaveLength(1)
      expect(persists[0].projectId).toBe('p1')
      expect(persists[0].state).toMatchObject({ status: 'paused', timeLeft: 25 * 60 - 3 })
    })

    it('stopAll 把 running 转成 paused 并逐个落盘', async () => {
      const { api, persists } = makeTimer()
      api.start('p1')
      api.start('p2')
      await vi.advanceTimersByTimeAsync(2000)
      api.stopAll()

      expect(api.getTimer('p1').status).toBe('paused')
      expect(api.getTimer('p2').status).toBe('paused')
      expect(persists.map((p) => p.projectId).sort()).toEqual(['p1', 'p2'])

      // stopAll 之后 interval 已停：再推进时间不应改变 timeLeft
      const frozen = api.getTimer('p1').timeLeft
      await vi.advanceTimersByTimeAsync(5000)
      expect(api.getTimer('p1').timeLeft).toBe(frozen)
    })
  })

  // ── 恢复持久化快照 ──────────────────────────────────────────

  describe('restorePersisted', () => {
    it('快照里有剩余时长就用快照的（不重置成完整时长）', () => {
      const { api } = makeTimer()
      api.restorePersisted('p1', {
        mode: 'work',
        status: 'paused',
        timeLeft: 600,
        currentTaskId: 't1',
        consecutiveCount: 2
      })

      expect(api.getTimer('p1').timeLeft).toBe(600)
      expect(api.getTimer('p1').status).toBe('paused')
      expect(api.getTimer('p1').currentTaskId).toBe('t1')
      expect(api.getTimer('p1').consecutiveCount).toBe(2)
    })

    it('快照剩余时长非正时回落到有效时长', () => {
      const { api } = makeTimer()
      api.restorePersisted('p1', {
        mode: 'shortBreak',
        status: 'idle',
        timeLeft: 0,
        currentTaskId: null,
        consecutiveCount: 0
      })
      expect(api.getTimer('p1').timeLeft).toBe(5 * 60)
    })

    it('恢复出来的计时器不会自动开始（status 只可能是 idle/paused）', () => {
      const { api } = makeTimer()
      api.restorePersisted('p1', {
        mode: 'work',
        status: 'paused',
        timeLeft: 100,
        currentTaskId: null,
        consecutiveCount: 0
      })
      expect(api.getTimer('p1').status).not.toBe('running')
      expect(api.activeProjects()).toHaveLength(0)
    })
  })
})
