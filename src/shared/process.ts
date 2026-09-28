/**
 * Frond · 进程查杀共享类型（Kill Process，Raycast parity）
 *
 * 放 shared 是因为契约（ipc-contract）、主进程服务（ProcessService /
 * processKillLogic）、preload 推导类型三方都要引用——sharedLayering 棘轮
 * 禁止契约反向引 main 实现（PluginStateSnapshot 同款教训）。
 */

export interface ProcessInfo {
  pid: number
  /** CPU%（瞬时采样值） */
  cpu: number
  /** 物理内存% */
  mem: number
  /** 完整命令路径（含空格原样保留） */
  command: string
  /** 人类可读名：.app bundle 取 bundle 名，否则 basename */
  displayName: string
}
