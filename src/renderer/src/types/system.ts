/**
 * Frond · 系统信息页的界面形状
 *
 * 只是转发桥上的类型：`window.api.system.info()` 的返回形状由主进程
 * `src/main/ipc/system.ts` 定义，渲染层再抄一份必然漂（历史上漂过一次）。
 */
export type { SystemInfo } from '@preload/index.d'
