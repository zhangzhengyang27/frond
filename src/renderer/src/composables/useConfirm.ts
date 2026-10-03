import { computed, reactive, type ComputedRef } from 'vue'

/**
 * useConfirm · 命令式确认弹窗（全局单例，Promise API；对称 useToast）
 *
 * 用法：
 *   import { confirm } from '@composables/useConfirm'
 *   const ok = await confirm({ title: '彻底删除片段？', message: '该操作不可撤销。',
 *                              confirmText: '删除', danger: true })
 *   if (!ok) return
 *
 * 渲染端需在 AppShell 挂 <UConfirmProvider />（与 UToastProvider 并列）。
 * 同一时刻仅一个 pending：后到的 confirm 会让先到的立即以 false 兑现。
 */
export interface ConfirmOptions {
  title: string
  message?: string
  confirmText?: string
  cancelText?: string
  danger?: boolean
}

interface PendingConfirm extends ConfirmOptions {
  resolve: (ok: boolean) => void
}

const state = reactive<{ pending: PendingConfirm | undefined }>({ pending: undefined })

export function confirm(opts: ConfirmOptions): Promise<boolean> {
  return new Promise((resolve) => {
    const prev = state.pending
    if (prev) {
      state.pending = undefined
      prev.resolve(false)
    }
    state.pending = { ...opts, resolve }
  })
}

export function resolveConfirm(ok: boolean): void {
  const cur = state.pending
  state.pending = undefined
  cur?.resolve(ok)
}

export interface ConfirmApi {
  /** ComputedRef：Provider 模板自动解包，watch 可响应 */
  pending: ComputedRef<PendingConfirm | undefined>
}

export function useConfirm(): ConfirmApi {
  return {
    pending: computed(() => state.pending)
  }
}
