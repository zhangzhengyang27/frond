/**
 * 番茄记录导出（渲染端只负责「把数据整成契约要的样子」，落盘与保存对话框在主进程）。
 *
 * 2026-09-22 恢复事故里这文件只剩 10 行、且是从中间开始的。第 1-7 行（批量文件名生成器
 * 的后半段）是**存证原文**，其余按两个消费方的调用形态与
 * `ipc-contract.ts` 里 `pomodoro:task:export` 的请求/响应契约重建：
 * CSV 与 Markdown 的正文由主进程 `buildCsv` / `buildMarkdown` 生成，这里不重复实现。
 */
import type {
  PomodoroProject,
  PomodoroRecord,
  PomodoroTask,
  TimerMode
} from '../../../stores/pomodoro'

/** 与 ipc-contract 的 'pomodoro:task:export' 请求体同形（那边是事实源） */
interface ExportRecord {
  startedAt: number
  endedAt: number
  durationMs: number
  type: TimerMode
  note: string | null
}
interface ExportPayload {
  title: string
  projectName: string | null
  records: ExportRecord[]
}
export interface ExportResult {
  ok: boolean
  path?: string
  canceled?: boolean
  error?: string
}

/** 单任务：详情页传进来的就是这个形状 */
export interface TaskExportArgs {
  task: PomodoroTask
  project: PomodoroProject | null
  records: PomodoroRecord[]
}
/** 批量：统计面板按时间范围取到的扁平行（没有 startedAt，只有 completedAt + duration） */
export interface BulkExportArgs {
  projectName: string
  from: number
  to: number
  records: Array<{
    id: string
    type: TimerMode
    duration: number
    completedAt: number
    taskId?: string
    taskTitle?: string
    date: string
  }>
}

/** 记录只有「结束时刻 + 时长」，起点是倒推的——主进程按区间算每段时长，所以要给全 */
function asExportRecord(r: {
  type: TimerMode
  duration: number
  completedAt: number
  note?: string | null
  taskTitle?: string
}): ExportRecord {
  return {
    startedAt: r.completedAt - r.duration,
    endedAt: r.completedAt,
    durationMs: r.duration,
    type: r.type,
    note: r.note ?? (r.taskTitle ? r.taskTitle : null)
  }
}

function writeViaDialog(
  format: 'csv' | 'markdown',
  fileBaseName: string,
  payload: ExportPayload
): Promise<ExportResult> {
  // 一整行写完别换行：renderer-api-parity 按「window.api.x.y」单行链匹配，
  // 断在 `.export` 前会让这条调用被当成幽灵 API
  return window.api.pomodoro.task.export(format, fileBaseName, payload).then((res) => ({
    ok: res.ok,
    ...(res.path ? { path: res.path } : {}),
    canceled: res.canceled,
    ...(res.error ? { error: res.error } : {})
  }))
}

export async function exportTaskRecordsAsCSV(args: TaskExportArgs): Promise<ExportResult> {
  return sendTask('csv', args)
}

export async function exportTaskRecordsAsMarkdown(args: TaskExportArgs): Promise<ExportResult> {
  return sendTask('markdown', args)
}

async function sendTask(format: 'csv' | 'markdown', args: TaskExportArgs): Promise<ExportResult> {
  const payload: ExportPayload = {
    title: args.task.title,
    projectName: args.project?.name ?? null,
    records: args.records.map(asExportRecord)
  }
  return writeViaDialog(format, `frond_pomodoro_${safeName(args.task.title)}`, payload)
}

/** 文件名里的项目名要先把跨平台非法字符压掉，没项目名时用 all */
function safeName(text: string): string {
  return text
    .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
    .replace(/\s+/g, '_')
    .slice(0, 30)
}

function bulkFileBaseName({ projectName, from, to }: BulkExportArgs): string {
  const safeProject = projectName
    ? projectName
        .replace(/[\\/:*?"<>|\r\n\t]/g, '_')
        .replace(/\s+/g, '_')
        .slice(0, 30)
    : 'all'
  const fmt = (ts: number): string => new Date(ts).toISOString().slice(0, 10)
  return `frond_pomodoro_bulk_${safeProject}_${fmt(from)}_to_${fmt(to)}`
}

function bulkPayload(args: BulkExportArgs): ExportPayload {
  return {
    title: `${args.projectName} 番茄记录`,
    projectName: args.projectName,
    records: args.records.map(asExportRecord)
  }
}

export async function exportBulkAsCSV(args: BulkExportArgs): Promise<ExportResult> {
  const payload = bulkPayload(args)
  return writeViaDialog('csv', bulkFileBaseName(args), payload)
}

export async function exportBulkAsMarkdown(args: BulkExportArgs): Promise<ExportResult> {
  const payload = bulkPayload(args)
  return writeViaDialog('markdown', bulkFileBaseName(args), payload)
}
