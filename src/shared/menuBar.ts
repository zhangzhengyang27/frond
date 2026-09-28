/**
 * Frond · 菜单栏项搜索共享类型（Raycast「Search Menu Bar Items」parity）
 *
 * 放 shared 是因为契约（ipc-contract）、主进程（MenuBarService/menuBarLogic）、
 * 渲染端页面三方都要引用——sharedLayering 棘轮禁止契约引 main 实现。
 */

export interface MenuBarItem {
  /** 完整路径段（不含条目名本身）：['文件', '导出为'] */
  segments: string[]
  /** 条目名（点击目标） */
  title: string
  /** 展示用：'文件 › 导出为' */
  pathLabel: string
}
