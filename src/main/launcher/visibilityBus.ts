/**
 * Frond · 胶囊窗显隐事件总线（批 7a 循环依赖拆解）
 *
 * 此前的环：window → runtime（notifyWindowVisibility）与 window → frontmostCache
 * （noteLauncherHidden），而 runtime / frontmostCache 又各自 import window 的
 * getLauncherWindow —— 初始化顺序脆弱（B43 类病灶）。
 *
 * 反转后：window 只 emit；runtime（转插件 onHide/Show 钩子）与 frontmostCache
 * （隐藏后补拍前台快照，B36）各自订阅本总线。三方向均指向 bus，零环。
 */

export type LauncherVisibilityListener = (visible: boolean) => void

const listeners = new Set<LauncherVisibilityListener>()

/** 订阅胶囊窗显隐（可见=true / 隐藏=false）；返回退订函数 */
export function onLauncherVisibility(cb: LauncherVisibilityListener): () => void {
  listeners.add(cb)
  return () => {
    listeners.delete(cb)
  }
}

/** 仅由 launcher/window.ts 在 show/hide 完成点发射 */
export function emitLauncherVisibility(visible: boolean): void {
  for (const cb of listeners) {
    try {
      cb(visible)
    } catch (error) {
      // 订阅者异常不阻断其他订阅者（总线职责只是转发）
      console.error('[visibilityBus] 订阅者处理失败:', error)
    }
  }
}
