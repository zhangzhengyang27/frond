/**
 * 番茄钟集成层的线格式（通知模式 / 快捷键 / 托盘快照）
 *
 * 放在 shared 而不是留在 PomodoroIntegrationService.ts：IPC 登记册要引用这些类型，
 * 而登记册被 preload 与 web tsconfig 编译，从 service 直接 import 会把主进程侧
 * 依赖（NotificationService 的 `resources/icon.png?asset` 等）拖进渲染端编译程序。
 */
export type PomodoroNotificationMode = 'normal' | 'strong' | 'silent'

export type PomodoroShortcutAction = 'toggle' | 'skip' | 'reset'

export interface PomodoroShortcuts {
  toggle: string
  skip: string
  reset: string
}

export interface PomodoroTraySnapshot {
  isRunning: boolean
  currentMode: 'work' | 'shortBreak' | 'longBreak' | null
  taskTitle: string
  timeLeftSeconds: number
  /** 当前模式总时长（秒），供 MiniTimer 计算进度环 */
  totalSeconds?: number
  todayCompleted: number
  projectId: string | null
  projectName: string
  /** M7：专注模式开关（抑制通知 + tray 标记） */
  focusMode?: boolean
  backgroundProjects: Array<{
    id: string
    name: string
    timeLeftSeconds: number
    mode: 'work' | 'shortBreak' | 'longBreak'
  }>
  updatedAt: number
}
