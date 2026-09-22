/**
 * 胶囊窗 blur 判定（P-1.3 纯逻辑，无 electron 依赖以便单测）
 */

export interface BlurHideState {
  /** 用户开了「保持打开」 */
  pinned: boolean
  visible: boolean
  /** show() 后等待焦点落定的抑制截止时间戳（与 now 同一时钟） */
  suppressUntil: number
  now: number
}

/** 失焦是否应当隐藏胶囊窗 */
export function shouldHideOnBlur(state: BlurHideState): boolean {
  if (state.pinned) return false
  if (!state.visible) return false
  return state.now >= state.suppressUntil
}
