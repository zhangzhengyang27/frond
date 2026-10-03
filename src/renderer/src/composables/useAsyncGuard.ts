/**
 * 异步竞态守卫（B50）：渲染端「切文件夹/切视频/换录制」后，旧请求晚到覆盖新状态
 * 的家族病统一收口。模式完全一致——领 token、回写前验token：
 *
 *   const guard = useAsyncGuard()
 *   async function load(x: string) {
 *     const mine = guard.begin()
 *     const res = await fetchSomething(x)
 *     if (!guard.isCurrent(mine)) return // 过期：期间有新请求发起，丢弃本次回写
 *     state.value = res
 *   }
 *
 * 只做计数与比较，不持有任何组件状态；每个使用处各自建实例（互不干扰）。
 */
export function useAsyncGuard(): {
  /** 领取本轮 token；每次调用都令此前所有 token 过期 */
  begin: () => number
  /** token 是否仍是当前轮 */
  isCurrent: (token: number) => boolean
} {
  let seq = 0
  return {
    begin: () => ++seq,
    isCurrent: (token: number) => token === seq
  }
}
