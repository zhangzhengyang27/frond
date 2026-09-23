import { BrowserWindow, ipcMain } from 'electron'
import { typedHandle } from '../ipc/typedIpc'
import { PomodoroDataStore } from '../stores/PomodoroDataStore'
import { projectRepository } from '../db/repos/ProjectRepository'
import { pomodoroTimerStateRepository } from '../db/repos/PomodoroTimerStateRepository'
import {
  pomodoroIntegrationService,
  type PomodoroTraySnapshot
} from '../services/PomodoroIntegrationService'
import { registerPomodoroShortcuts } from './pomodoroShortcuts'
import { addShortcutRestorer } from './globalShortcuts'
import { updatePomodoroProjects } from './tray'

export function registerPomodoroHandlers(
  store: PomodoroDataStore,
  getMainWindow: () => BrowserWindow | null
): void {
  typedHandle('pomodoro:getTasks', () => store.getTasks())
  typedHandle('pomodoro:addTask', (_event, { title, options }) => store.addTask(title, options))
  typedHandle('pomodoro:updateTask', (_event, { id, updates }) => store.updateTask(id, updates))
  typedHandle('pomodoro:deleteTask', (_event, { id }) => store.deleteTask(id))
  typedHandle('pomodoro:completeTask', (_event, { id }) => store.completeTask(id))

  typedHandle('pomodoro:projects:getAll', () => projectRepository.getAll())
  typedHandle('pomodoro:projects:add', (_event, { name, color }) =>
    projectRepository.add(name, color)
  )
  typedHandle('pomodoro:projects:update', (_event, { id, updates }) =>
    projectRepository.update(id, updates)
  )
  typedHandle('pomodoro:projects:delete', (_event, { id }) => projectRepository.softDelete(id))

  // P1-2：项目时长覆盖
  typedHandle('pomodoro:projects:settings:get', (_event, { projectId }) =>
    store.getProjectSettings(projectId)
  )
  typedHandle('pomodoro:projects:settings:all', () => store.getAllProjectSettings())
  typedHandle('pomodoro:projects:settings:save', (_event, { projectId, overrides }) =>
    store.saveProjectSettings(projectId, overrides)
  )
  typedHandle('pomodoro:projects:settings:delete', (_event, { projectId }) =>
    store.deleteProjectSettings(projectId)
  )

  // M14 / M15：timer 状态持久化
  typedHandle('pomodoro:timerState:getAll', () => pomodoroTimerStateRepository.getAll())
  typedHandle('pomodoro:timerState:get', (_event, { projectId }) =>
    pomodoroTimerStateRepository.get(projectId)
  )
  typedHandle('pomodoro:timerState:save', (_event, { projectId, state }) =>
    pomodoroTimerStateRepository.save(projectId, state)
  )
  typedHandle('pomodoro:timerState:delete', (_event, { projectId }) =>
    pomodoroTimerStateRepository.delete(projectId)
  )

  typedHandle('pomodoro:addRecord', (_event, { record }) => store.addRecord(record))
  typedHandle('pomodoro:getRecords', () => store.getRecords())
  typedHandle('pomodoro:getTodayRecords', () => store.getTodayRecords())
  typedHandle('pomodoro:getFreeRecords', () => store.getFreeRecords())
  typedHandle('pomodoro:getRecordsByRange', (_event, opts) => store.getRecordsByRange(opts))
  typedHandle('pomodoro:getThisWeekRecords', () => store.getThisWeekRecords())
  typedHandle('pomodoro:getThisMonthRecords', () => store.getThisMonthRecords())
  typedHandle('pomodoro:getStatistics', () => store.getStatistics())

  typedHandle('pomodoro:stats:dailyTrend', (_event, { days, endDate }) =>
    store.getDailyTrend(days, endDate)
  )
  typedHandle('pomodoro:stats:projectDistribution', (_event, { from, to }) =>
    store.getProjectDistribution(from, to)
  )
  typedHandle('pomodoro:stats:focusHeatmap', (_event, { days, endDate }) =>
    store.getFocusHeatmap(days, endDate)
  )
  typedHandle('pomodoro:stats:taskCompletionStats', (_event, { from, to }) =>
    store.getTaskCompletionStats(from, to)
  )

  typedHandle('pomodoro:getSettings', () => store.getSettings())
  typedHandle('pomodoro:saveSettings', (_event, { settings }) => store.saveSettings(settings))

  // 死通道清理：pomodoro:sendNotification 曾是 stub（原样回传、不创建通知），
  // 渲染端也无调用方；番茄钟通知统一走 NotificationService 集成链路

  // ───────────── P1-1：详情页 ─────────────
  typedHandle('pomodoro:task:detail', (_event, { taskId }) => {
    const task = store.getTasks().find((t) => t.id === taskId)
    if (!task) return null
    const project = task.projectId ? (projectRepository.getById(task.projectId) ?? null) : null
    const records = store.getRecordsByTaskId(taskId)
    const summary = store.getTaskSummary(taskId)
    return { task, project, records, summary }
  })

  typedHandle('pomodoro:record:get', (_event, { id }) => store.getRecordDetail(id))

  typedHandle('pomodoro:record:updateNote', (_event, { id, note }) =>
    store.updateRecordNote(id, note)
  )

  // P1-1：导出
  typedHandle('pomodoro:task:export', async (_event, { format, fileBaseName, payload }) => {
    const { showSaveDialogFor } = await import('../modules/dialogs')
    const { writeFile } = await import('fs/promises')
    const defaultName = `${fileBaseName}.${format === 'csv' ? 'csv' : 'md'}`
    const filters =
      format === 'csv'
        ? [{ name: 'CSV', extensions: ['csv'] }]
        : [{ name: 'Markdown', extensions: ['md', 'markdown'] }]

    const win = BrowserWindow.getFocusedWindow() ?? BrowserWindow.getAllWindows()[0] ?? null
    const res = await showSaveDialogFor(win, {
      title: format === 'csv' ? '导出任务番茄记录（CSV）' : '导出任务番茄记录（Markdown）',
      defaultPath: defaultName,
      filters
    })
    if (res.canceled || !res.filePath) {
      return { ok: false, canceled: true, path: null }
    }

    const content = format === 'csv' ? buildCsv(payload) : buildMarkdown(payload, fileBaseName)
    try {
      await writeFile(res.filePath, content, 'utf-8')
      return { ok: true, canceled: false, path: res.filePath }
    } catch (err) {
      return { ok: false, canceled: false, path: null, error: String(err) }
    }
  })

  // ───────────── P2-7：Todoist 任务集成 ─────────────
  typedHandle('pomodoro:todoist:getToken', () => store.getTodoistToken())
  typedHandle('pomodoro:todoist:setToken', (_event, { token }) => {
    store.setTodoistToken(token)
    return { ok: true }
  })
  typedHandle('pomodoro:todoist:import', async () => {
    const token = store.getTodoistToken()
    if (!token) return { ok: false as const, error: '未配置 Todoist API Token' }
    try {
      const res = await fetch('https://api.todoist.com/rest/v2/tasks?limit=50', {
        headers: { Authorization: `Bearer ${token}` }
      })
      if (!res.ok) {
        return {
          ok: false as const,
          error: `Todoist 请求失败（HTTP ${res.status}），请检查 Token 或网络`
        }
      }
      const tasks = (await res.json()) as Array<{ id: string; content: string }>
      return {
        ok: true as const,
        tasks: tasks.map((t) => ({ externalId: t.id, title: t.content }))
      }
    } catch (err) {
      return { ok: false as const, error: `网络错误：${String(err)}` }
    }
  })
  typedHandle('pomodoro:todoist:complete', async (_event, { externalId }) => {
    const token = store.getTodoistToken()
    if (!token) return { ok: false as const, error: '未配置 Todoist API Token' }
    try {
      const res = await fetch(
        `https://api.todoist.com/rest/v2/tasks/${encodeURIComponent(externalId)}/close`,
        {
          method: 'POST',
          headers: { Authorization: `Bearer ${token}` }
        }
      )
      return res.ok
        ? { ok: true as const }
        : { ok: false as const, error: `Todoist 关闭任务失败（HTTP ${res.status}）` }
    } catch (err) {
      return { ok: false as const, error: `网络错误：${String(err)}` }
    }
  })

  // ───────────── Integration (P0-4) ─────────────
  const integration = pomodoroIntegrationService()

  typedHandle('pomodoro:integration:getMode', () => integration.getNotificationMode())
  typedHandle('pomodoro:integration:setMode', (_event, { mode }) =>
    integration.setNotificationMode(mode)
  )
  typedHandle('pomodoro:integration:testNotification', () =>
    integration.testNotification(getMainWindow)
  )
  typedHandle('pomodoro:integration:notify', (_event, { event, message }) =>
    integration.notify(event, message)
  )

  typedHandle('pomodoro:integration:getShortcuts', () => integration.getShortcuts())
  typedHandle('pomodoro:integration:setShortcut', (_event, { action, accelerator }) => {
    const next = integration.setShortcut(action, accelerator)
    const result = registerPomodoroShortcuts(getMainWindow)
    return { shortcuts: next, failed: result.failed }
  })
  typedHandle('pomodoro:integration:resetShortcuts', () => {
    const shortcuts = integration.resetShortcuts()
    const result = registerPomodoroShortcuts(getMainWindow)
    return { shortcuts, failed: result.failed }
  })

  typedHandle('pomodoro:integration:updateTraySnapshot', (_event, { patch }) =>
    integration.updateTraySnapshot(patch)
  )
  typedHandle('pomodoro:integration:getTraySnapshot', () => integration.getTraySnapshot())
  typedHandle('pomodoro:integration:describeTraySnapshot', () => integration.describeTraySnapshot())

  // M7：专注模式
  typedHandle('pomodoro:integration:setFocusMode', (_event, { enabled }) =>
    integration.setFocusMode(enabled)
  )
  typedHandle('pomodoro:integration:getFocusMode', () => integration.getFocusMode())

  // M5：renderer 订阅 snapshot 变化（用于 mini 悬浮窗）
  ipcMain.on('pomodoro:integration:subscribeSnapshot', (event) => {
    const send = (snap: PomodoroTraySnapshot): void => {
      if (!event.sender.isDestroyed()) event.sender.send('pomodoro:integration:traySnapshot', snap)
    }
    send(integration.getTraySnapshot())
    const unsub = integration.onSnapshotUpdate(send)
    event.sender.once('destroyed', () => unsub())
  })

  // P1-2：renderer 推送项目列表（用于 tray / dock「切换焦点」子菜单）
  typedHandle('pomodoro:integration:updateProjects', (_event, { projects, focusedProjectId }) => {
    updatePomodoroProjects(projects, focusedProjectId)
    return { ok: true }
  })

  // 启动时一次性注册
  registerPomodoroShortcuts(getMainWindow)
  // registerGlobalShortcuts 的 unregisterAll 会清掉全局快捷键，挂恢复回调
  addShortcutRestorer(() => registerPomodoroShortcuts(getMainWindow))
}

// ─── CSV / Markdown 导出序列化 ───

interface ExportRecordPayload {
  startedAt: number
  endedAt: number
  durationMs: number
  type: 'work' | 'shortBreak' | 'longBreak'
  note: string | null
}

interface ExportPayload {
  title: string
  projectName: string | null
  records: ExportRecordPayload[]
}

function pad(n: number): string {
  return n.toString().padStart(2, '0')
}

function formatIso(ts: number): string {
  const d = new Date(ts)
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`
}

function modeText(type: ExportRecordPayload['type']): string {
  if (type === 'work') return '专注'
  if (type === 'shortBreak') return '短休息'
  return '长休息'
}

/**
 * 转义 CSV 字段（包含逗号、引号、换行）。
 * RFC 4180：值用双引号包裹，内部双引号 "" 转义。
 */
function csvEscape(value: string): string {
  if (value.includes(',') || value.includes('"') || value.includes('\n') || value.includes('\r')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}

export function buildCsv(payload: ExportPayload): string {
  const header = '序号,开始时间,结束时间,时长(秒),模式,备注'
  const rows = payload.records.map((r, i) =>
    [
      String(i + 1),
      formatIso(r.startedAt),
      formatIso(r.endedAt),
      String(Math.round(r.durationMs / 1000)),
      modeText(r.type),
      r.note ?? ''
    ]
      .map(csvEscape)
      .join(',')
  )
  return [header, ...rows].join('\n') + '\n'
}

export function buildMarkdown(payload: ExportPayload, fileBaseName: string): string {
  const projectLine = payload.projectName ? `**项目**：${payload.projectName}\n\n` : ''
  const totalMs = payload.records.reduce(
    (sum, r) => sum + (r.type === 'work' ? r.durationMs : 0),
    0
  )
  const totalMinutes = Math.round(totalMs / 60_000)
  const focusCount = payload.records.filter((r) => r.type === 'work').length
  const exportDate = formatIso(Date.now())

  const tableHeader = '| # | 开始时间 | 结束时间 | 时长 | 模式 | 备注 |\n|---|---|---|---|---|---|'
  const rows = payload.records
    .map(
      (r, i) =>
        `| ${i + 1} | ${formatIso(r.startedAt)} | ${formatIso(r.endedAt)} | ${Math.round(r.durationMs / 60_000)} 分 | ${modeText(r.type)} | ${(r.note ?? '').replace(/\|/g, '\\|')} |`
    )
    .join('\n')

  return [
    `# ${payload.title}`,
    '',
    projectLine.trim(),
    `**专注番茄**：${focusCount} 个`,
    `**专注总时长**：${totalMinutes} 分`,
    `**记录条数**：${payload.records.length}`,
    `**导出时间**：${exportDate}`,
    '',
    '## 番茄记录',
    '',
    tableHeader,
    rows,
    '',
    `> 由 Frond 自动导出 · 文件名：${fileBaseName}`,
    ''
  ]
    .filter((line, idx, arr) => !(line === '' && arr[idx - 1] === ''))
    .join('\n')
}
