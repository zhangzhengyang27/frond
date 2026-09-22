}

export interface PomodoroRecord {
  id: string
  taskId?: string
  taskTitle?: string
  projectId?: string
  type: 'work' | 'shortBreak' | 'longBreak'
  /** 毫秒，对应 pom_pomodoros.duration_ms 列（v4 迁移起锁定单位契约） */
  duration: number
  completedAt: number
  date: string // YYYY-MM-DD
}

export interface PomodoroSettings {
