/**
 * Frond · 自动更新的界面形状
 *
 * 放渲染层是因为它是**界面**的形状（设置页按这些档位显示文案与按钮可用性）；
 * 主进程的 `AutoUpdateService` re-export 同一份，两处不各写一套。
 * 这里刻意**不 import electron**：`ProgressInfo` 按结构写一遍就好，把一个 electron 类型
 * 引进渲染层会让所有引用它的渲染文件都拖上主进程依赖。
 */

/** 更新的六个档位 + idle（没检查过）。与 electron-log 的 autoUpdater 事件一一对应 */
export type UpdateStatus =
  | 'idle'
  | 'checking'
  | 'available'
  | 'not-available'
  | 'downloading'
  | 'downloaded'
  | 'error'

/** 下载进度（对应 electron-updater 的 ProgressInfo） */
export interface UpdateProgress {
  percent: number
  total: number
  transferred: number
  bytesPerSecond: number
}

/**
 * 一次状态推送。各字段只在对应档位出现：`version` 在 available / downloaded，
 * `progress` 在 downloading，`error` 在 error —— 界面按 `status` 取，不去猜组合。
 */
export interface UpdateEvent {
  status: UpdateStatus
  version?: string
  releaseNotes?: string | null
  progress?: UpdateProgress
  error?: string
}
