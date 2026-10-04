import { ref, watch, onUnmounted, type Ref } from 'vue'
import { useRecordingActions } from './recordingActions'
import { useStreamManager } from './useStreamManager'

/**
 * 录屏模块的窗口级监听器（B57-6）：挂在 Layout（模块常驻层），
 * 切换 历史/回放/剪辑 标签后快捷键与倒计时照常工作。
 *
 * 监听清单：
 *  - frond:shortcut-start / frond:shortcut-togglePause（主进程全局快捷键经 Layout 转发）
 *  - frond:recording-start-after-countdown（倒计时结束）
 *  - frond:cursor-position / frond:cursor-stop（区域录制的光圈推送）
 *  - frond:countdown-tick / begun / cancel（倒计时遮罩状态）
 *
 * 生命周期修复（B57-6 附带 P2-1）：window 监听器**同步**挂载，主进程 attach IPC
 * 异步完成；若组件在 attach resolve 前卸载（快速进出模块），disposed 标记保证
 * 监听器被立即摘除——不再出现「detach 先跑、attach 后挂」的永久泄漏。
 */
export function useRecordingShortcuts(): {
  countdownActive: Ref<boolean>
  countdownRemaining: Ref<number>
  cancelCountdown: () => void
} {
  const actions = useRecordingActions()
  const { setCursorScreenPos } = useStreamManager()

  // 录制停止后关闭 cursor 推送（Layout 生命周期，切标签不丢）
  watch(actions.isRecording, (rec, prev) => {
    if (prev && !rec) actions.stopCursorTracking()
  })

  const countdownActive = ref(false)
  const countdownRemaining = ref(0)
  let disposed = false
  let attached = false

  const onShortcutStart = (e?: Event): void => {
    void e
    actions.shortcutStart()
  }
  const onShortcutTogglePause = (e?: Event): void => {
    void e
    actions.shortcutPause()
  }
  const onAfterCountdown = (e?: Event): void => {
    void e
    void actions.beginAfterCountdown()
  }
  const onCursorPosition = (e?: Event): void => {
    void e
    setCursorScreenPos((e as CustomEvent<{ x: number; y: number }>).detail)
  }
  const onCursorStop = (e?: Event): void => {
    void e
    setCursorScreenPos(null)
  }
  const onCountdownTick = (e?: Event): void => {
    countdownActive.value = true
    countdownRemaining.value = (e as CustomEvent<{ remaining: number }>).detail.remaining
  }
  const onCountdownBegun = (e?: Event): void => {
    void e
    countdownActive.value = false
    countdownRemaining.value = 0
    onAfterCountdown()
  }
  const onCountdownCancel = (e?: Event): void => {
    void e
    countdownActive.value = false
    countdownRemaining.value = 0
  }

  /** 用户主动取消倒计时（遮罩按钮 / ESC）——通知主进程终止，录制不会开始 */
  const cancelCountdown = (): void => {
    const api = (
      window as unknown as {
        api?: { recording?: { countdown?: { cancel?: () => Promise<unknown> } } }
      }
    ).api
    void api?.recording?.countdown?.cancel?.()
    countdownActive.value = false
    countdownRemaining.value = 0
  }

  // B57-19：倒计时遮罩此前无任何取消途径（主进程事件丢失即永久遮罩）——ESC 兜底
  const onOverlayEsc = (e: KeyboardEvent): void => {
    if (countdownActive.value && e.key === 'Escape') {
      e.preventDefault()
      cancelCountdown()
    }
  }
  window.addEventListener('keydown', onOverlayEsc)
  onUnmounted(() => window.removeEventListener('keydown', onOverlayEsc))

  const listeners: Array<[string, (e?: Event) => void]> = [
    ['frond:shortcut-start', onShortcutStart],
    ['frond:shortcut-togglePause', onShortcutTogglePause],
    ['frond:recording-start-after-countdown', onAfterCountdown],
    ['frond:cursor-position', onCursorPosition],
    ['frond:cursor-stop', onCursorStop],
    ['frond:countdown-tick', onCountdownTick],
    ['frond:countdown-begun', onCountdownBegun],
    ['frond:countdown-cancel', onCountdownCancel]
  ]

  // 先同步挂监听（attach IPC 期间到达的事件也不丢），再异步注册主进程全局键
  for (const [name, fn] of listeners) {
    window.addEventListener(name, fn)
  }
  attached = true

  void (async () => {
    const api = (
      window as unknown as {
        api?: {
          recording?: { shortcut?: { attach: () => Promise<{ ok: boolean }> } }
        }
      }
    ).api
    try {
      await api?.recording?.shortcut?.attach?.()
    } catch (e) {
      console.warn('[useRecordingShortcuts] attach failed:', e)
    }
    if (disposed && attached) {
      // attach 期间组件已卸载：立即摘除（P2-1 竞态修复）
      for (const [name, fn] of listeners) {
        window.removeEventListener(name, fn)
      }
      attached = false
    }
  })()

  onUnmounted(() => {
    disposed = true
    if (attached) {
      for (const [name, fn] of listeners) {
        window.removeEventListener(name, fn)
      }
      attached = false
    }
    const api = (
      window as unknown as {
        api?: { recording?: { shortcut?: { detach: () => Promise<{ ok: boolean }> } } }
      }
    ).api
    void api?.recording?.shortcut?.detach?.().catch(() => {})
  })

  return { countdownActive, countdownRemaining, cancelCountdown }
}
