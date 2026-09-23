/**
 * Frond · B1 Pop to Root 闲置计时（自 LauncherApp.vue 抽出）
 *
 * 任何键入/点击/鼠标移动重置计时；窗口隐藏（visibilitychange → hidden）暂停，
 * 重新可见或 onShown 时重启。判定逻辑在 launcherInteractions.ts（可单测）。
 */
import {
  POP_TO_ROOT_TIMEOUT_MS,
  idleRemainingMs,
  isIdleExpired,
  shiftLastActivity
} from './launcherInteractions'

export function useIdleWatcher(onIdleExpiredCb: () => void) {
  const idleState = { lastActivityAt: Date.now(), pausedAt: 0 }
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  /** mousemove 活动探测节流：1s 内的连续移动只记一次（mousemove 高频触发，
   * noteActivity 每次 clearTimeout/setTimeout，不节流会有无谓开销） */
  let lastMouseMoveNoteAt = 0

  function noteActivity(): void {
    if (document.visibilityState !== 'visible') return
    idleState.lastActivityAt = Date.now()
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(onIdleExpired, POP_TO_ROOT_TIMEOUT_MS)
  }

  function onIdleExpired(): void {
    idleTimer = null
    if (document.visibilityState !== 'visible') return
    // 双保险：定时器可能被浏览器节流/扰动，用空闲判定函数复核
    if (!isIdleExpired(idleState.lastActivityAt, Date.now(), POP_TO_ROOT_TIMEOUT_MS)) return
    onIdleExpiredCb()
  }

  function onVisibilityChangeForIdle(): void {
    if (document.visibilityState === 'hidden') {
      // 暂停：冻结剩余时间并停掉定时器
      idleState.pausedAt = Date.now()
      if (idleTimer) {
        clearTimeout(idleTimer)
        idleTimer = null
      }
    } else {
      // 恢复：扣除暂停时长后按剩余时间继续（onShown 若随后到达会全量重置）。
      // pausedAt 防护：可见事件先于隐藏事件到达的异常序列下不平移（避免把
      // lastActivityAt 平移到未来导致该轮 60s 计时失效）
      if (idleState.pausedAt > 0) {
        idleState.lastActivityAt = shiftLastActivity(
          idleState.lastActivityAt,
          idleState.pausedAt,
          Date.now()
        )
        idleState.pausedAt = 0
      }
      const remaining = idleRemainingMs(
        idleState.lastActivityAt,
        Date.now(),
        POP_TO_ROOT_TIMEOUT_MS
      )
      if (idleTimer) clearTimeout(idleTimer)
      idleTimer = setTimeout(onIdleExpired, remaining)
    }
  }

  function onWindowMouseMove(): void {
    const now = Date.now()
    if (now - lastMouseMoveNoteAt < 1000) return
    lastMouseMoveNoteAt = now
    noteActivity()
  }

  return { noteActivity, onVisibilityChangeForIdle, onWindowMouseMove }
}
