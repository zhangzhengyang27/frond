/**
 * 插件带参命令的「发射」段（P-1.6；2026-09-25 自 LauncherApp.vue 抽出，第二刀拆分）
 *
 * 多参数插件命令在胶囊内逐参数填写（pluginarg 表单页，对标 Raycast argument1-3）。
 * 这里只管现场：fields（text/password/dropdown 三态）、dropdown 的 title→value 还原、
 * 预填快照与提交出口。格数判定（≤2 格走内联槽）在 shared/argSlots，由 deps.enterArgSlots 注入。
 */
import { computed, ref, type Ref } from 'vue'
import type { CommandEntry } from '@shared/commands'
import type { FormField } from '@shared/plugin-protocol'
import { argPrefill } from './launcherInteractions'

export interface PluginArgLaunchDeps {
  /** 搜索框当前词：预填从「标题之外的部分」提取 */
  query: Ref<string>
  /** 搜索条组件实例：只依赖 focus() 能力 */
  searchBarRef: Ref<{ focus: () => void } | null>
  pushPage: (page: 'pluginarg') => void
  popPage: () => void
  /** ≤2 格内联槽开成功返回 true（P-1.6b）；false = 继续走表单页 */
  enterArgSlots: (target: CommandEntry) => boolean
}

export function usePluginArgLaunch(deps: PluginArgLaunchDeps) {
  /** 当前待带参打开的插件命令（pluginarg 表单页数据源） */
  const pluginArgTarget = ref<CommandEntry | null>(null)

  /**
   * 插件参数初值快照（P-1.6）：进表单前从搜索词里取出的「标题之外的部分」。
   * 存快照而不是在 fields 里直接读 query，是因为 pushPage 之后 query 会被清空——
   * 直接读 query 会让初值在下一帧就消失。
   */
  const pluginArgPrefill = ref('')

  /** pluginarg 表单字段：text/password 掩码输入，dropdown 以 title 展示（FormPage select） */
  const pluginArgFields = computed<FormField[]>(() => {
    const t = pluginArgTarget.value
    if (!t || t.action.type !== 'plugin' || !t.action.arguments) return []
    // 只预填第一个文本参数：多参数时按空格切剩余词是在猜，宁可不填
    const firstTextArg = t.action.arguments.find((arg) => arg.type === 'text')?.name
    const prefill = pluginArgPrefill.value
    return t.action.arguments.map((arg) =>
      arg.type === 'dropdown'
        ? {
            key: arg.name,
            label: arg.placeholder || arg.name,
            type: 'select' as const,
            options: (arg.data ?? []).map((o) => o.title)
          }
        : {
            key: arg.name,
            label: arg.placeholder || arg.name,
            type: arg.type === 'password' ? ('password' as const) : ('text' as const),
            placeholder: arg.placeholder,
            initial: arg.name === firstTextArg && prefill ? prefill : undefined
          }
    )
  })

  /** dropdown 展示值（title）→ 提交值（value）映射 */
  const pluginArgValueMap = computed<Map<string, string>>(() => {
    const map = new Map<string, string>()
    const t = pluginArgTarget.value
    if (!t || t.action.type !== 'plugin' || !t.action.arguments) return map
    for (const arg of t.action.arguments) {
      if (arg.type === 'dropdown') for (const o of arg.data ?? []) map.set(o.title, o.value)
    }
    return map
  })

  /** 打开参数表单页：一两格先试内联槽（P-1.6b），进表单后预填并清查询词 */
  function openPluginArg(target: CommandEntry): void {
    if (deps.enterArgSlots(target)) return
    pluginArgTarget.value = target
    pluginArgPrefill.value = argPrefill(deps.query.value, target.title)
    deps.pushPage('pluginarg')
    deps.query.value = ''
    deps.searchBarRef.value?.focus()
  }

  /**
   * pluginarg 表单提交：required 校验 → title→value 还原 → 带参打开插件
   * （表单值含 checkbox 布尔，此处按字符串取）
   */
  function openPluginWithArgs(values: Record<string, string | boolean>): void {
    const target = pluginArgTarget.value
    if (!target || target.action.type !== 'plugin') return
    const args: Record<string, string> = {}
    for (const arg of target.action.arguments ?? []) {
      let v = String(values[arg.name] ?? '').trim()
      if (arg.type === 'dropdown') v = pluginArgValueMap.value.get(v) ?? v
      if (!v && arg.required) return // 必填参数为空：留在表单
      if (v) args[arg.name] = v
    }
    pluginArgTarget.value = null
    window.api.launcher.openPlugin(target.action.pluginId, target.action.cmd, args)
    deps.popPage() // 退出参数页，胶囊保持可见进入插件交互（与无参插件路径一致）
    deps.query.value = ''
  }

  return {
    pluginArgTarget,
    pluginArgFields,
    openPluginArg,
    openPluginWithArgs
  }
}
