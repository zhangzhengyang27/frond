/**
 * Frond · 插件静默自动更新（P-3.2）
 *
 * 启动后 30s 首查 + 每 24h 一查。语义：
 * - 只对市场链条目生效；bundled（随包内置）来源的新版本由启动时的
 *   autoInstallBuiltinPlugins 负责，这里跳过，避免两条链打架
 * - 每轮先 best-effort 刷新远程索引（没配 URL 立即失败返回，无副作用）
 * - 静默应用走 installFromMarket({silent:true})：新版本**多声明任何权限**
 *   即拒绝更新并发通知请用户手动确认——权限闸绝不静默跨越
 * - 更新保留启停状态与安装时间（importFromFolder isUpdate 路径），
 *   来源与版本变化落 audit.jsonl（P-3.4）
 */
import { computePluginUpdates, installFromMarket, refreshRemoteIndex } from './market'
import { notifyCommandTableChanged } from './ipc'
import { reloadPluginView } from './runtime'
import { getLauncherWindow } from './window'
import { log } from '../services/LogService'
import { NotificationService } from '../services/NotificationService'

const FIRST_CHECK_DELAY_MS = 30_000
const CHECK_INTERVAL_MS = 24 * 60 * 60 * 1000

let timer: ReturnType<typeof setInterval> | null = null
let firstCheck: ReturnType<typeof setTimeout> | null = null
let checking = false

export interface PluginAutoUpdateOutcome {
  updated: Array<{ id: string; name: string }>
  blocked: Array<{ id: string; name: string; addedPermissions: string[] }>
  failed: Array<{ id: string; error: string }>
}

/** 跑一轮更新检查（导出便于测试与未来手动触发入口复用） */
export async function runPluginUpdateCheck(): Promise<PluginAutoUpdateOutcome> {
  const outcome: PluginAutoUpdateOutcome = { updated: [], blocked: [], failed: [] }
  try {
    await refreshRemoteIndex()
  } catch {
    // 没配远程索引或网络失败都无所谓：打包/精选索引仍可驱动更新
  }
  for (const u of computePluginUpdates().filter((x) => x.source !== 'bundled')) {
    try {
      const result = await installFromMarket(u.id, { silent: true })
      if (result.success) {
        outcome.updated.push({ id: u.id, name: u.name })
        // 与手动更新（launcher:market:update）同一收尾：刷新命令表 + 就地重载
        // 存活插件视图，否则自动更新后开着插件的视图短暂新旧混载
        reloadPluginView(u.id, getLauncherWindow())
        notifyCommandTableChanged('plugins')
      } else if (result.blocked) {
        outcome.blocked.push({
          id: u.id,
          name: u.name,
          addedPermissions: result.addedPermissions ?? []
        })
      } else {
        outcome.failed.push({ id: u.id, error: result.error ?? '未知错误' })
      }
    } catch (e) {
      outcome.failed.push({ id: u.id, error: (e as Error).message })
    }
  }
  if (outcome.updated.length > 0) {
    NotificationService.getInstance().showInfo(
      '插件已自动更新',
      `${outcome.updated.map((u) => u.name).join('、')} 已更新到最新版本`
    )
  }
  if (outcome.blocked.length > 0) {
    NotificationService.getInstance().showWarning(
      '插件更新需要确认',
      `${outcome.blocked
        .map((b) => `「${b.name}」新增权限：${b.addedPermissions.join('、') || '未知'}`)
        .join('；')}。可在插件中心手动更新。`
    )
  }
  if (outcome.updated.length > 0 || outcome.blocked.length > 0 || outcome.failed.length > 0) {
    log.info(
      'plugin-auto-update',
      `检查完成：${outcome.updated.length} 更新 / ${outcome.blocked.length} 待确认 / ${outcome.failed.length} 失败`
    )
  }
  return outcome
}

async function checkOnce(): Promise<void> {
  if (checking) return
  checking = true
  try {
    await runPluginUpdateCheck()
  } catch (e) {
    log.warn('plugin-auto-update', `更新检查失败: ${(e as Error).message}`)
  } finally {
    checking = false
  }
}

export function startPluginAutoUpdate(): void {
  if (timer || firstCheck) return
  firstCheck = setTimeout(() => {
    firstCheck = null
    void checkOnce()
  }, FIRST_CHECK_DELAY_MS)
  timer = setInterval(() => {
    void checkOnce()
  }, CHECK_INTERVAL_MS)
}

export function stopPluginAutoUpdate(): void {
  if (firstCheck) {
    clearTimeout(firstCheck)
    firstCheck = null
  }
  if (timer) {
    clearInterval(timer)
    timer = null
  }
}
