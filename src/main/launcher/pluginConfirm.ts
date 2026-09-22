/**
 * Leaf · 插件导入确认闸（审查 I5：市场安装与本地导入共用同一道闸）
 *
 * 原设计意图：系统级模态框是「被攻陷渲染端无法自动点掉」的防线，
 * 本地导入与远程市场安装必须同等受闸，否则市场索引联网化后确认形同虚设。
 */
import { readManifest } from './pluginStore'
import { isPluginPermission, PLUGIN_PERMISSION_LABELS } from '../../shared/plugin-protocol'
import { getLauncherWindow } from './window'

/** 系统级模态确认：展示插件声明的敏感权限清单；E2E 旁路 */
export async function confirmPluginImport(dirPath: string): Promise<boolean> {
  if (process.env.LEAF_E2E === '1') return true
  const { dialog } = await import('electron')
  // 读取目标插件声明的敏感权限，把笼统提醒换成具体清单（读不到 manifest 就用兜底文案）
  let permDetail = ''
  try {
    const manifest = readManifest(dirPath)
    const perms = (manifest.permissions ?? []).filter(isPluginPermission)
    permDetail =
      perms.length > 0
        ? `声明的敏感权限：\n${perms.map((p) => `· ${PLUGIN_PERMISSION_LABELS[p]}（${p}）`).join('\n')}\n\n`
        : '未声明敏感权限（读取剪贴板 / 网络 / 打开文件将被拒绝）。\n\n'
  } catch {
    permDetail = '（无法读取 plugin.json，导入后将按未声明处理）\n\n'
  }
  const win = getLauncherWindow()
  const result = await dialog.showMessageBox(win ?? undefined!, {
    type: 'question',
    title: '导入插件',
    message: '确认导入以下来源的插件？',
    detail: `${dirPath}\n\n${permDetail}请仅导入来源可信的插件。`,
    buttons: ['取消', '导入'],
    defaultId: 1,
    cancelId: 0
  })
  return result.response === 1
}
