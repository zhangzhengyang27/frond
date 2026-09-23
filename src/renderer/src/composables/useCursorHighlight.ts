/**
 * Frond · useCursorHighlight
 *
 * 职责：订阅主进程推送的系统光标位置（30fps），并暴露给 canvas draw 循环调用。
 *
 * 设计要点：
 *   - 仅在录制期间订阅，避免常驻推送
 *   - start()/stop() 是幂等的
 *   - preload 用 CustomEvent 把 'frond:cursor-position' / 'frond:cursor-stop'
 *     从 main world 转发到 window
 *   - B6 修复：命名 handler + onUnmounted 统一 removeEventListener，
 *     旧版匿名监听器永不清除，多次进出录屏页会累积并阻止 GC
 */

import { ref, onUnmounted, type Ref } from 'vue'

export function useCursorHighlight(): {
  cursorPos: Ref<{ x: number; y: number } | null>
  active: Ref<boolean>
  start: () => Promise<void>
  stop: () => Promise<void>
} {
  const cursorPos = ref<{ x: number; y: number } | null>(null)
  const active = ref(false)

  // 命名 handler：保证 add/remove 引用一致
  const onPosition = (e: Event): void => {
    cursorPos.value = (e as CustomEvent<{ x: number; y: number }>).detail
  }
  const onStop = (): void => {
    cursorPos.value = null
    active.value = false
  }

  function addListeners(): void {
    window.addEventListener('frond:cursor-position', onPosition)
    window.addEventListener('frond:cursor-stop', onStop)
  }

  function removeListeners(): void {
    window.removeEventListener('frond:cursor-position', onPosition)
    window.removeEventListener('frond:cursor-stop', onStop)
  }

  async function start(): Promise<void> {
    if (active.value) return
    const api = (
      window as unknown as {
        api?: {
          recording?: {
            cursor?: {
              start?: () => Promise<{ ok: boolean }>
              stop?: () => Promise<{ ok: boolean }>
            }
          }
        }
      }
    ).api
    if (!api?.recording?.cursor?.start) return
    addListeners()
    void api.recording.cursor.start()
    active.value = true
  }

  async function stop(): Promise<void> {
    if (!active.value) return
    const api = (
      window as unknown as {
        api?: { recording?: { cursor?: { stop?: () => Promise<{ ok: boolean }> } } }
      }
    ).api
    if (api?.recording?.cursor?.stop) await api.recording.cursor.stop()
    cursorPos.value = null
    active.value = false
    removeListeners()
  }

  onUnmounted(() => {
    // 无论 stop 与否都清理监听器（防止卸载后残留）
    removeListeners()
    void stop()
  })

  return { cursorPos, active, start, stop }
}
