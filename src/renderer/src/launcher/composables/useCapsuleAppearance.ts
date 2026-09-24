/**
 * Frond · 胶囊外观（密度档 / 玻璃档 / 紧凑模式）
 *
 * 自 `LauncherApp.vue` 抽出（C3-3 Step 1，2026-09-24）。该 SFC 当时 2496 行，
 * `script setup` 独占 1708 行，任何一处都写不了单测 —— 抽出来的直接收益就是
 * 这三条逻辑第一次变得**可测**（见 `__tests__/useCapsuleAppearance.test.ts`）。
 *
 * 三件事同构：**读偏好 → 应用到 documentElement（或上报主进程）→ 订阅变更推送**。
 * - 密度：变量写在根元素上，样式里读（`.launcher-result` 的 var(...) 兜底）。
 *   不另开推送通道之外的机制：胶囊每次被唤起都会重新可见，那时补读一次兜住
 *   「推送前就开窗」的情况。
 * - 玻璃：默认 opaque —— 读不到就**不覆盖**任何变量，保持默认的不透明底。
 * - 紧凑模式：默认关。开着时空态那一屏（下一个会议 / 固定建议 / 最近搜索）就不
 *   显示了，那是另一格 Raycast 对齐拍板过的东西，不能被这个开关悄悄推翻。
 *
 * **刻意不搬走的部分**：`barOnlyMode`（紧凑空态 ∨ 参数槽态）依赖 `query` /
 * `pluginState` / `firstPartyPage` / `actionPanelEntry` / `showShortcuts` 这些核心
 * 页面状态，硬搬会把半个 LauncherApp 拖进来。改为由调用方以 getter 传入。
 */
import { ref, watch, type Ref } from 'vue'
import { applyDensityVars, type Density } from '@shared/density'
import { applyGlassVars } from '@shared/capsuleGlass'

export interface CapsuleAppearanceOptions {
  /**
   * 是否处于「只占一条栏」的形态（紧凑空态或参数槽态）。由调用方计算。
   *
   * ⚠ 必须读**响应式**源（真实用法传 `computed`）。`start()` 里的 `watch` 靠这个 getter
   * 收集依赖，若它读的是普通对象属性，就没有依赖可追踪 —— 形态变化不会触发上报，
   * 表现为「窗口高度不跟着变」而完全不报错。
   */
  barOnly: () => boolean
  /** 搜索行实际高度（**不含**描边）。高度只有渲染端知道，主进程复制一份 CSS 值必然漂移 */
  barHeight: () => number
}

export interface CapsuleAppearance {
  /** 当前密度档（模板 / 样式可读） */
  density: Ref<Density>
  /** 用户偏好里的紧凑模式开关（注意：不等于「当前是否收成一条栏」，那还要看空态） */
  compactModePref: Ref<boolean>
  /** 把当前形态上报给主进程（主进程据此调窗口高度） */
  reportCompact: () => void
  /** 挂上全部读取与订阅；返回**统一退订函数**，由调用方在 onUnmounted 时调用 */
  start: () => () => void
}

export function useCapsuleAppearance(opts: CapsuleAppearanceOptions): CapsuleAppearance {
  const density = ref<Density>('comfortable')
  const compactModePref = ref(false)

  /** 高度由这里量：搜索行多高只有渲染端知道（主进程复制一份 CSS 值必然漂移） */
  function reportCompact(): void {
    if (!opts.barOnly()) {
      void window.api.launcher.setCompact(false, 0)
      return
    }
    // +2：窗口自己那圈 1px 描边，不加会露出 2px 的透明缝
    void window.api.launcher.setCompact(true, opts.barHeight() + 2)
  }

  async function applyDensity(): Promise<void> {
    try {
      const d = await window.api.preferences.getDensity()
      density.value = d
      applyDensityVars(document.documentElement, d)
    } catch {
      /* 读不到就用样式里的 comfortable 兜底值 */
    }
  }

  async function applyGlass(): Promise<void> {
    try {
      applyGlassVars(document.documentElement, await window.api.preferences.getCapsuleGlass())
    } catch {
      /* 读不到就不覆盖：胶囊保持默认的不透明底 */
    }
  }

  async function initCompact(): Promise<void> {
    try {
      compactModePref.value = await window.api.preferences.getCompactMode()
    } catch {
      compactModePref.value = false // 读不到就按关：保持整屏建议列表在
    }
    reportCompact()
  }

  // ⚠ watch 必须建在 start() 里，不能建在本函数体里：
  // `watch(getter, …)` 建好时会**立刻求值一次** getter 来收集依赖，而 `opts.barOnly`
  // 通常访问的是调用方声明在 `useCapsuleAppearance()` **之后**的 computed ——
  // 在函数体里建会撞上 TDZ（ReferenceError: Cannot access before initialization）。
  // 放进 start()（调用方在 onMounted 里调）时，那些 computed 早已初始化。

  function start(): () => void {
    const unsubs: Array<() => void> = []

    // 形态一变就重新上报（原来是 setup 期的 watch(barOnlyMode, …)，语义相同）
    unsubs.push(watch(opts.barOnly, () => reportCompact()))

    void applyDensity()
    // 主进程改档会推过来（与主题同一路子）；可见时再补读一次，兜住推送前就开窗的情况
    unsubs.push(
      window.api.preferences.onDensityChanged((d) => {
        density.value = d
        applyDensityVars(document.documentElement, d)
      })
    )

    void initCompact()
    unsubs.push(
      window.api.preferences.onCompactModeChanged((on) => {
        compactModePref.value = on
      })
    )

    void applyGlass()
    unsubs.push(
      window.api.preferences.onCapsuleGlassChanged((g) =>
        applyGlassVars(document.documentElement, g)
      )
    )

    const onVisibilityChange = (): void => {
      if (document.visibilityState === 'visible') void applyDensity()
    }
    document.addEventListener('visibilitychange', onVisibilityChange)
    unsubs.push(() => document.removeEventListener('visibilitychange', onVisibilityChange))

    return () => {
      unsubs.forEach((fn) => fn())
      unsubs.length = 0
    }
  }

  return { density, compactModePref, reportCompact, start }
}
