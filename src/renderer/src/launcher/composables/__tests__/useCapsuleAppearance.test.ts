// @vitest-environment happy-dom
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest'
import { ref, type Ref } from 'vue'

/**
 * useCapsuleAppearance（胶囊外观：密度 / 玻璃 / 紧凑模式）单测
 *
 * 这三条逻辑此前埋在 `LauncherApp.vue` 的 1708 行 `script setup` 里，一条测试都写不了
 * （C3-3 Step 1 抽出，见 composables/useCapsuleAppearance.ts）。
 *
 * 用**真实的** `applyDensityVars` / `applyGlassVars`（不 mock），断言 CSS 变量真的落到
 * `document.documentElement` 上 —— 否则「抽出来但接错线」这类问题测不出来。
 */

type Cb<T> = (v: T) => void

let densityCb: Cb<'comfortable' | 'compact'> | null = null
let compactCb: Cb<boolean> | null = null
let glassCb: Cb<'opaque' | 'soft' | 'clear'> | null = null

const unsubDensity = vi.fn()
const unsubCompact = vi.fn()
const unsubGlass = vi.fn()

const setCompact = vi.fn()
const getDensity = vi.fn(async (): Promise<'comfortable' | 'compact'> => 'comfortable')
const getCapsuleGlass = vi.fn(async (): Promise<'opaque' | 'soft' | 'clear'> => 'opaque')
const getCompactMode = vi.fn(async (): Promise<boolean> => false)

let mod: typeof import('../useCapsuleAppearance')

const flush = async (): Promise<void> => {
  // 两轮微任务：applyXxx 是 async，内部 await 一次 IPC
  await Promise.resolve()
  await Promise.resolve()
}

beforeEach(async () => {
  vi.resetModules()
  densityCb = null
  compactCb = null
  glassCb = null
  for (const f of [unsubDensity, unsubCompact, unsubGlass, setCompact]) f.mockClear()
  getDensity.mockClear().mockResolvedValue('comfortable')
  getCapsuleGlass.mockClear().mockResolvedValue('opaque')
  getCompactMode.mockClear().mockResolvedValue(false)

  ;(window as unknown as { api: unknown }).api = {
    launcher: { setCompact },
    preferences: {
      getDensity,
      getCapsuleGlass,
      getCompactMode,
      onDensityChanged: (cb: Cb<'comfortable' | 'compact'>) => {
        densityCb = cb
        return unsubDensity
      },
      onCompactModeChanged: (cb: Cb<boolean>) => {
        compactCb = cb
        return unsubCompact
      },
      onCapsuleGlassChanged: (cb: Cb<'opaque' | 'soft' | 'clear'>) => {
        glassCb = cb
        return unsubGlass
      }
    }
  }
  document.documentElement.removeAttribute('style')
  mod = await import('../useCapsuleAppearance')
})

afterEach(() => {
  document.documentElement.removeAttribute('style')
})

const varOf = (name: string): string =>
  document.documentElement.style.getPropertyValue(name)

function make(opts?: { barOnly?: boolean; barHeight?: number }): {
  api: ReturnType<typeof mod.useCapsuleAppearance>
  barOnly: Ref<boolean>
  dispose: () => void
} {
  // ⚠ barOnly 必须来自**响应式**源：watch 靠 getter 收集依赖，普通对象属性没有依赖可追踪，
  // 形态变化就不会触发上报（真实应用里传的是 computed，见 LauncherApp.vue）
  const barOnly = ref(opts?.barOnly ?? false)
  const barHeight = ref(opts?.barHeight ?? 40)
  const api = mod.useCapsuleAppearance({
    barOnly: () => barOnly.value,
    barHeight: () => barHeight.value
  })
  const dispose = api.start()
  return { api, barOnly, dispose }
}

describe('useCapsuleAppearance · 读偏好并应用', () => {
  it('start() 读三档偏好：密度落到 CSS 变量、紧凑模式落到 ref', async () => {
    getDensity.mockResolvedValue('compact')
    getCompactMode.mockResolvedValue(true)
    const { api } = make()
    await flush()

    expect(getDensity).toHaveBeenCalledTimes(1)
    expect(getCapsuleGlass).toHaveBeenCalledTimes(1)
    expect(getCompactMode).toHaveBeenCalledTimes(1)

    expect(api.density.value).toBe('compact')
    expect(api.compactModePref.value).toBe(true)
    // 真实的 applyDensityVars 结果：compact 档 rowPadY = 3px
    expect(varOf('--frond-row-pad-y')).toBe('3px')
    expect(varOf('--frond-row-min-h')).toBe('28px')
  })

  it('玻璃档 opaque（默认）**不覆盖**任何变量 —— 观感必须与改动前一致', async () => {
    make()
    await flush()
    expect(getCapsuleGlass).toHaveBeenCalled()
    // opaque 档每个键都是 null → applyGlassVars 走 removeProperty
    expect(varOf('--frond-capsule-bg')).toBe('')
    expect(varOf('--frond-capsule-blur')).toBe('')
  })

  it('玻璃档 clear 会把半透明底色写上根元素', async () => {
    getCapsuleGlass.mockResolvedValue('clear')
    make()
    await flush()
    expect(varOf('--frond-capsule-bg')).toContain('78%')
    expect(varOf('--frond-capsule-blur')).toBe('blur(26px)')
  })

  it('读密度失败时回落 comfortable 默认档，且不抛（读不到不能把胶囊搞白屏）', async () => {
    getDensity.mockRejectedValue(new Error('EACCES'))
    const { api } = make()
    await flush()
    expect(api.density.value).toBe('comfortable')
    // 失败时不写变量 → 保持样式里的兜底值
    expect(varOf('--frond-row-pad-y')).toBe('')
  })

  it('读玻璃失败时不覆盖变量（胶囊保持默认的不透明底）', async () => {
    getCapsuleGlass.mockRejectedValue(new Error('boom'))
    make()
    await flush()
    expect(varOf('--frond-capsule-bg')).toBe('')
  })

  it('读紧凑模式失败时按「关」处理（宁可多显示，不少显示）', async () => {
    getCompactMode.mockRejectedValue(new Error('boom'))
    const { api } = make()
    await flush()
    expect(api.compactModePref.value).toBe(false)
  })
})

describe('useCapsuleAppearance · reportCompact 上报主进程', () => {
  it('barOnly=false 上报 (false, 0)', async () => {
    const { api } = make({ barOnly: false })
    await flush()
    setCompact.mockClear()
    api.reportCompact()
    expect(setCompact).toHaveBeenCalledWith(false, 0)
  })

  it('barOnly=true 上报 (true, 高度 + 2) —— 那 +2 是窗口自己那圈 1px 描边', async () => {
    const { api } = make({ barOnly: true, barHeight: 64 })
    await flush()
    setCompact.mockClear()
    api.reportCompact()
    // 少加这 2px 会露出 2px 透明缝（原注释）
    expect(setCompact).toHaveBeenCalledWith(true, 66)
  })

  it('barOnly 变化会自动重新上报（watch 接上了）', async () => {
    const { barOnly } = make({ barOnly: false, barHeight: 50 })
    await flush()
    setCompact.mockClear()

    barOnly.value = true
    await flush()
    expect(setCompact).toHaveBeenCalledWith(true, 52)

    setCompact.mockClear()
    barOnly.value = false
    await flush()
    expect(setCompact).toHaveBeenCalledWith(false, 0)
  })

  it('barOnly 不变时不会重复上报（watch 不该被无关变更触发）', async () => {
    make({ barOnly: false })
    await flush()
    setCompact.mockClear()
    // 触发一次密度推送（与形态无关）
    densityCb?.('compact')
    await flush()
    expect(setCompact).not.toHaveBeenCalled()
  })
})

describe('useCapsuleAppearance · 变更推送', () => {
  it('onDensityChanged 推送同时更新 ref 与 CSS 变量', async () => {
    const { api } = make()
    await flush()
    expect(api.density.value).toBe('comfortable')

    densityCb?.('compact')
    expect(api.density.value).toBe('compact')
    expect(varOf('--frond-row-pad-y')).toBe('3px')
  })

  it('onCapsuleGlassChanged 推送更新 CSS 变量（不经过 ref）', async () => {
    make()
    await flush()
    glassCb?.('soft')
    expect(varOf('--frond-capsule-bg')).toContain('92%')
    expect(varOf('--frond-capsule-blur')).toBe('blur(18px)')
  })

  it('onCompactModeChanged 推送更新 compactModePref', async () => {
    const { api } = make()
    await flush()
    compactCb?.(true)
    expect(api.compactModePref.value).toBe(true)
  })
})

describe('useCapsuleAppearance · 退订', () => {
  it('dispose 会退掉全部三条订阅', async () => {
    const { dispose } = make()
    await flush()
    dispose()
    expect(unsubDensity).toHaveBeenCalledTimes(1)
    expect(unsubCompact).toHaveBeenCalledTimes(1)
    expect(unsubGlass).toHaveBeenCalledTimes(1)
  })

  it('dispose 会停掉 watch：之后改 barOnly 不再上报', async () => {
    const { barOnly, dispose } = make({ barOnly: false, barHeight: 40 })
    await flush()
    dispose()
    setCompact.mockClear()

    barOnly.value = true
    await flush()
    expect(setCompact).not.toHaveBeenCalled()
  })
})
