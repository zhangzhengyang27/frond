/**
 * 详情面板的加载判定（P-1.5，纯逻辑以便单测）
 */
import type { CommandDetail } from '@shared/commandRegistry'

export type DetailInput =
  | CommandDetail
  | (() => Promise<CommandDetail | null> | CommandDetail | null)
  | undefined
  | null

/** detail 字段三态：没详情 / 直给 / 要异步取 */
export function detailKind(detail: DetailInput): 'none' | 'static' | 'async' {
  if (typeof detail === 'function') return 'async'
  if (detail && typeof detail === 'object') return 'static'
  return 'none'
}

/**
 * 「只认最后一次选中」的过期判定：详情异步回来时如果用户已经换行，
 * 旧响应必须丢弃，否则右侧面板会闪回上一项的内容。
 */
export class DetailToken {
  private current = 0

  /** 开始一次加载，返回本次的凭据 */
  begin(): number {
    this.current += 1
    return this.current
  }

  /** 这次加载是否仍然有效 */
  isCurrent(token: number): boolean {
    return token === this.current
  }
}
