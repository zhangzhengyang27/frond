/**
 * Leaf · 「能不能无人值守跑这条插件命令」的判定（P-2③）
 *
 * 单独一个不 import electron 的小模块，理由与 `pinLogic.ts` 一样：这一串判据是
 * 整条通道唯一的风险面（放开了就是「插件的界面在凌晨自己弹出来」或者「定时任务把用户
 * 正在用的那个插件关掉」），必须能被单测钉住；而它旁边就是 `runtime.ts` 里的
 * BrowserView / Notification，混在一起就只能靠 e2e 碰运气。
 */
import { isActionCommand } from '../../shared/plugin-protocol'

/** 判定只要三样：装了什么、要跑哪条、现在有没有活跃视图 */
export interface HeadlessRunPlugin {
  enabled: boolean
  commands?: Array<{ code: string; mode?: 'view' | 'action' }>
}

/**
 * @param hasActiveView 此刻胶囊里有没有正在用的插件视图（含 headless 那条）——
 *  活跃槽只有一个，定时任务挤进去会把用户手上那个插件关掉。
 * @returns null = 可以跑；字符串 = 拒绝原因（原样进设置页的「上次结果」，别写成黑话）
 */
export function headlessRunBlocker(
  plugin: HeadlessRunPlugin | undefined,
  cmd: string,
  hasActiveView: boolean
): string | null {
  if (!plugin) return '插件未安装'
  if (!plugin.enabled) return '插件已停用'
  if (!cmd) return '没写要跑哪个命令'
  if (!plugin.commands?.some((c) => c.code === cmd)) return `插件没有这条命令：${cmd}`
  if (!isActionCommand(plugin.commands, cmd))
    return `只有 mode:'action' 的命令能无人值守跑（${cmd} 会弹出界面）`
  if (hasActiveView) return '胶囊里正有插件在用，这次跳过'
  return null
}
