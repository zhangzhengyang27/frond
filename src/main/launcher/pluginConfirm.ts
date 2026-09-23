/**
 * Frond · 插件导入确认闸（审查 I5：市场安装与本地导入共用同一道闸）
 *
 * 原设计意图：系统级模态框是「被攻陷渲染端无法自动点掉」的防线，
 * 本地导入与远程市场安装必须同等受闸，否则市场索引联网化后确认形同虚设。
 */
import { getPlugin, readManifest } from './pluginStore'
import {
  isPluginPermission,
  PLUGIN_PERMISSION_LABELS,
  type PluginPermission
} from '../../shared/plugin-protocol'
import { getLauncherWindow } from './window'

export interface PermissionDiff {
  /** 新清单里多出来的那几条（已过滤未知值、已去重） */
  added: string[]
  /** 新清单里放掉的权限（如实报，但不换问法：少要权限不该吓用户） */
  removed: string[]
  /** 首次安装：调用方给 hasInstalled=false 才是 true（两侧都缺省时按「不是首装」处理） */
  fresh: boolean
}

/**
 * 已声明权限 vs 新清单的差分（P-3④）。
 *
 * 拦的是这个场景：用户装过 v1（只要 clipboard.write），市场推来 v2 悄悄多要 net ——
 * 旧确认框把两版一视同仁列个清单就放行，那几条新权限等于从没被确认过。
 * 只比 `isPluginPermission` 认得的值：宿主本来就不认未知权限名，差分它们没有意义。
 */
export function diffPermissions(
  before: string[] | undefined,
  after: string[] | undefined,
  hasInstalled?: boolean
): PermissionDiff {
  const known = (list: string[] | undefined): string[] => [
    ...new Set((list ?? []).filter(isPluginPermission))
  ]
  const from = known(before)
  const to = known(after)
  return {
    added: to.filter((p) => !from.includes(p)),
    removed: from.filter((p) => !to.includes(p)),
    fresh: hasInstalled === false
  }
}

/** 系统级模态确认：展示插件声明的敏感权限清单；E2E 旁路 */
export async function confirmPluginImport(dirPath: string): Promise<boolean> {
  if (process.env.FROND_E2E === '1') return true
  const { dialog } = await import('electron')
  // 读取目标插件声明的敏感权限，把笼统提醒换成具体清单（读不到 manifest 就用兜底文案）
  let permDetail = ''
  let pendingAsk:
    | {
        type: 'warning'
        title: string
        message: string
        detail: string
        buttons: string[]
        defaultId: number
        cancelId: number
      }
    | undefined
  try {
    const manifest = readManifest(dirPath)
    // 已装的同 id 插件：拿得到就走「更新」问法，拿不到就是首次导入
    const installed = typeof manifest.id === 'string' ? getPlugin(manifest.id) : undefined
    const diff = diffPermissions(installed?.permissions, manifest.permissions, !!installed)
    if (!diff.fresh && diff.added.length > 0) {
      // 多要了权限 → 换重一档的问法，且**默认是拒绝**（defaultId=0 落在「保留当前版本」）
      pendingAsk = {
        type: 'warning' as const,
        title: '插件更新申请更多权限',
        message: `「${manifest.name ?? manifest.id}」新版本比已装版本多要 ${diff.added.length} 项权限`,
        detail: `新增：\n${diff.added
          .map((p) => `· ${PLUGIN_PERMISSION_LABELS[p as PluginPermission]}（${p}）`)
          .join('\n')}\n\n${dirPath}`,
        buttons: ['保留当前版本', '仍要更新'],
        defaultId: 0,
        cancelId: 0
      }
    } else {
      const perms = (manifest.permissions ?? []).filter(isPluginPermission)
      permDetail =
        perms.length > 0
          ? `声明的敏感权限：\n${perms.map((p) => `· ${PLUGIN_PERMISSION_LABELS[p]}（${p}）`).join('\n')}\n\n`
          : '未声明敏感权限（读取剪贴板 / 网络 / 打开文件将被拒绝）。\n\n'
    }
  } catch {
    permDetail = '（无法读取 plugin.json，导入后将按未声明处理）\n\n'
  }
  const win = getLauncherWindow()
  const ask = pendingAsk ?? {
    type: 'question' as const,
    title: '导入插件',
    message: '确认导入以下来源的插件？',
    detail: `${dirPath}\n\n${permDetail}请仅导入来源可信的插件。`,
    buttons: ['取消', '导入'],
    defaultId: 1,
    cancelId: 0
  }
  const result = await dialog.showMessageBox(win ?? undefined!, ask)
  // 两条问法的「放行」都落在第二个按钮上（重档里那一个是「仍要更新」）
  return result.response === 1
}
