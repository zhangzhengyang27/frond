/**
 * Frond · 崩溃上报纯逻辑层
 *
 * 不 import electron——供 CrashReportService（electron 接线层）与单测共用。
 * 产品约束（2026-10-07 拍板）：崩溃转储只留本机，没有服务器自动上传；
 * 本模块只负责三件纯事：哪些转储是新的、诊断摘要长什么样、Issue 链接怎么拼。
 */

export interface CrashDumpInfo {
  file: string
  sizeBytes: number
  modifiedAt: number
}

/** crash-report-state.json：已确认过的转储文件名（只记名字，目录被清自然失效） */
export interface CrashReportState {
  seen: string[]
}

export const CRASH_STATE_FILENAME = 'crash-report-state.json'

/** Electron crashDumps 目录里的转储文件；metadata/settings 等非 .dmp 一律忽略 */
export function isDumpFile(name: string): boolean {
  return /\.dmp$/i.test(name)
}

/** 当前目录里还没确认过的新转储（顺序保持目录枚举序） */
export function diffPendingDumps(dumps: CrashDumpInfo[], seen: string[]): CrashDumpInfo[] {
  const known = new Set(seen)
  return dumps.filter((d) => !known.has(d.file))
}

/** seen 里文件已不存在的条目剔除，防止状态文件随历史转储无限膨胀 */
export function pruneSeen(dumps: CrashDumpInfo[], seen: string[]): string[] {
  const present = new Set(dumps.map((d) => d.file))
  return seen.filter((name) => present.has(name))
}

/** 损坏/缺失的状态文件一律按「从未确认过」处理——宁可多提醒一次，不静默吞转储 */
export function parseState(raw: string | null | undefined): CrashReportState {
  if (!raw) return { seen: [] }
  try {
    const parsed = JSON.parse(raw) as unknown
    const seen = (parsed as CrashReportState | null)?.seen
    if (Array.isArray(seen)) {
      return { seen: seen.filter((x): x is string => typeof x === 'string') }
    }
  } catch {
    /* 非法 JSON 走默认 */
  }
  return { seen: [] }
}

export function serializeState(state: CrashReportState): string {
  return JSON.stringify({ seen: state.seen } satisfies CrashReportState)
}

export interface DiagnosticInput {
  appVersion: string
  electronVersion: string
  platform: string
  arch: string
  osRelease: string
  locale: string
  optIn: boolean
  dumps: CrashDumpInfo[]
  userDataDir: string
  crashDumpsDir: string
  capturedAt?: string | undefined
}

/** 人读的诊断摘要：用户贴进 Issue 的正文，主进程同时会写进日志 */
export function buildDiagnosticSummary(input: DiagnosticInput): string {
  const lines = [
    'Frond 崩溃诊断摘要',
    `- 版本: ${input.appVersion}（Electron ${input.electronVersion}）`,
    `- 平台: ${input.platform} ${input.arch}（OS ${input.osRelease}，locale ${input.locale}）`,
    `- 崩溃收集: ${input.optIn ? '已开启' : '未开启'}`,
    `- 转储份数: ${input.dumps.length}`,
    ...input.dumps.map((d) => {
      const mb = (d.sizeBytes / 1024 / 1024).toFixed(2)
      return `  - ${d.file}（${mb} MB，${new Date(d.modifiedAt).toISOString()}）`
    }),
    `- 采集时间: ${input.capturedAt ?? new Date().toISOString()}`,
    `- 应用数据目录: ${input.userDataDir}`,
    `- 转储目录: ${input.crashDumpsDir}`,
    '日志请在「设置 → 高级 → 导出日志」后随 Issue 一并附上。'
  ]
  return lines.join('\n')
}

/** Issue 标题：版本 + 平台架构，够作者扫一眼分流 */
export function buildIssueTitle(input: {
  appVersion: string
  platform: string
  arch: string
}): string {
  return `[Crash] v${input.appVersion} ${input.platform}-${input.arch}`
}

/**
 * GitHub Issue 模板链接。诊断摘要太长且含本机路径，不进 query——
 * 走剪贴板由用户自己粘贴，URL 只带模板与预填标题。
 */
export function buildIssueUrl(baseUrl: string, title: string): string {
  return `${baseUrl.replace(/\/+$/, '')}/issues/new?template=crash-report.md&title=${encodeURIComponent(title)}`
}
