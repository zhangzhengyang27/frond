/**
 * Frond · E2E 探针（仅 FROND_E2E=1 时启用）
 *
 * 为什么要有这个东西：e2e 只看界面变化不足以证明一条链路走通了——本仓库为
 * 「表单渲染出来了但提交值从未回传」踩过一次整轮 flake（`HANDOFF.md §3`），
 * 断言必须落在真实副作用上。探针给 e2e 一个「这次按键确实走到了主进程第 N 条
 * 通道」的可读取证据。
 *
 * 生产环境（未设 FROND_E2E）下 `countE2E` 是 no-op、读取通道根本不注册，
 * 因此不存在「多出一条可被任意渲染端调用的 IPC」的风险面。
 */
import { typedHandle } from './ipc/typedIpc'

const counts = new Map<string, number>()

/** 记一次主进程通道调用；非 e2e 环境完全 no-op */
export function countE2E(channel: string): void {
  if (process.env.FROND_E2E !== '1') return
  counts.set(channel, (counts.get(channel) ?? 0) + 1)
}

/** 注册计数读取通道（e2e 取快照比增量，不需要 reset） */
export function registerE2EProbe(): void {
  if (process.env.FROND_E2E !== '1') return
  typedHandle('e2e:probeCounts', () => Object.fromEntries(counts))
}
