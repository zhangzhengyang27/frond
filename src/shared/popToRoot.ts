/**
 * Leaf · Pop to Root 三态（对标 Raycast「Pop to Root Search」设置）
 *
 * - immediately：隐藏即清栈，唤起必是根搜索（Leaf 缺省，Raycast 行为）
 * - afterInterval：隐藏保留状态；30 秒内再唤起回到上次位置，超过间隔清栈
 * - manually：唤起永不自动清栈，仅用户手动 Esc / Pop to Root 逐级返回
 *
 * 纯函数供胶囊渲染端（onShown 分支）与偏好层（合法性归一）共用。
 */

export type PopToRootMode = 'immediately' | 'afterInterval' | 'manually'

export const POP_TO_ROOT_MODES: readonly PopToRootMode[] = [
  'immediately',
  'afterInterval',
  'manually'
] as const

/** afterInterval 模式的保留窗口（对标 Raycast 30 秒档） */
export const POP_TO_ROOT_REOPEN_INTERVAL_MS = 30_000

export const POP_TO_ROOT_LABELS: Record<PopToRootMode, string> = {
  immediately: '立即清栈',
  afterInterval: '30 秒内保留',
  manually: '手动返回'
}

/** 非法 / 缺失值一律回退缺省 immediately（fail-safe：保持既有行为） */
export function normalizePopToRootMode(value: unknown): PopToRootMode {
  return typeof value === 'string' && (POP_TO_ROOT_MODES as readonly string[]).includes(value)
    ? (value as PopToRootMode)
    : 'immediately'
}

/**
 * 唤起时是否自动回到根搜索。
 * @param hiddenAt 上次隐藏的时间戳（毫秒）；immediately 模式下由隐藏路径清栈，此处恒 true
 */
export function shouldPopToRootOnShow(
  mode: PopToRootMode,
  hiddenAt: number | null,
  now: number
): boolean {
  if (mode === 'immediately') return true
  if (mode === 'manually') return false
  if (hiddenAt === null) return false
  return now - hiddenAt >= POP_TO_ROOT_REOPEN_INTERVAL_MS
}
