import type { PomodoroProject, PomodoroRecord, PomodoroTask } from './pomodoro'

/**
 * Frond · 番茄钟详情域类型（B60 批C 随 pomodoroDetail.ts 从 store 拆出）。
 * 基础类型复用 store 的本地定义（与 PomodoroRepository 业务接口对齐、
 * exactOptionalPropertyTypes 友好）；type-only 循环引用编译期擦除，无运行时环。
 */
export type { PomodoroProject, PomodoroRecord, PomodoroTask }

export interface PomodoroTaskDetail {
  task: PomodoroTask
  project: PomodoroProject | null
  records: PomodoroRecord[]
  summary: PomodoroTaskSummary | null
}

export interface PomodoroTaskSummary {
  taskId: string
  pomodoroCount: number
  workMs: number
  firstStartedAt: number | null
  lastCompletedAt: number | null
  estimateMs: number | null
  estimateDeviationMs: number | null
}

export interface PomodoroRecordDetail {
  record: PomodoroRecord
  task: PomodoroTask | null
}
