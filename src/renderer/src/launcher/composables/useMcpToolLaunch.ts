/**
 * MCP 工具进根搜索的「发射」段（P-4② 收尾；2026-09-25 自 LauncherApp.vue 抽出，第一刀拆分）
 *
 * 三条路共用一份参数清单（`action.args`，出自主进程的工具清单缓存）：
 * 0 个参数直接跑、≤2 格内联填、第 3 格起进表单。格数判定在 shared/argSlots，
 * 这里只管现场：mcparg 表单的 fields/初值、mcpcall 结果页的状态（seq 防复用）、
 * 以及表单提交 / 槽态提交后的统一出口 runMcpToolEntry。
 */
import { computed, ref, type Ref } from 'vue'
import type { CommandEntry } from '@shared/commands'
import type { FormField } from '@shared/plugin-protocol'
import { argPrefill } from './launcherInteractions'

export interface McpToolLaunchDeps {
  /** 搜索框当前词：mcparg 表单的预填从「标题之外的部分」提取 */
  query: Ref<string>
  /** 搜索条组件实例：只依赖 focus() 这一个能力，不绑具体组件类型 */
  searchBarRef: Ref<{ focus: () => void } | null>
  pushPage: (page: 'mcparg' | 'mcpcall') => void
  popPage: () => void
  /** ≤2 格内联槽开成功返回 true（P-1.6b）；false = 继续走表单/直跑 */
  enterArgSlots: (target: CommandEntry) => boolean
}

export function useMcpToolLaunch(deps: McpToolLaunchDeps) {
  const mcpArgTarget = ref<CommandEntry | null>(null)
  const mcpArgPrefill = ref('')
  /** seq 只为「同一个工具连跑两次也要重挂载重发」：ref 内容相同 Vue 会复用组件 */
  const mcpCall = ref<{
    serverId: string
    serverLabel: string
    tool: string
    args: Record<string, string>
    seq: number
  } | null>(null)
  let mcpCallSeq = 0

  /** mcparg 表单字段：description 当标签（服务器写的），没写就用参数名 */
  const mcpArgFields = computed<FormField[]>(() => {
    const t = mcpArgTarget.value
    if (!t || t.action.type !== 'mcpTool') return []
    const firstText = t.action.args.find((arg) => arg.required)?.name ?? t.action.args[0]?.name
    const prefill = mcpArgPrefill.value
    return t.action.args.map((arg) => ({
      key: arg.name,
      label: arg.description || arg.name,
      type: 'text' as const,
      placeholder:
        arg.type === 'boolean'
          ? 'true / false'
          : arg.type === 'number' || arg.type === 'integer'
            ? '数字'
            : undefined,
      initial: arg.name === firstText && prefill ? prefill : undefined
    }))
  })

  /** 初值只落一格：与内联槽同一条规矩（多参数时按空格切剩余词是在猜） */
  const mcpArgInitial = computed<Record<string, string>>(() => {
    const first = mcpArgFields.value[0]
    return first && mcpArgPrefill.value ? { [first.key]: mcpArgPrefill.value } : {}
  })

  /** 真跑一个工具：不在这等结果（未连接时主进程要先连接，可能十几秒），交给结果页显示等待态 */
  function runMcpToolEntry(target: CommandEntry, values: Record<string, string>): void {
    const a = target.action
    if (a.type !== 'mcpTool') return
    mcpCall.value = {
      serverId: a.serverId,
      serverLabel: a.serverLabel,
      tool: a.tool,
      args: values,
      seq: ++mcpCallSeq
    }
    deps.query.value = ''
    deps.pushPage('mcpcall')
  }

  /** 回车一条 MCP 命令：该填参数的先填（内联优先），无参数的直接跑 */
  function openMcpTool(target: CommandEntry): void {
    if (target.action.type !== 'mcpTool') return
    if (deps.enterArgSlots(target)) return
    if (target.action.args.length > 0) {
      mcpArgTarget.value = target
      mcpArgPrefill.value = argPrefill(deps.query.value, target.title)
      deps.pushPage('mcparg')
      deps.query.value = ''
      deps.searchBarRef.value?.focus()
      return
    }
    runMcpToolEntry(target, {})
  }

  /** mcparg 表单提交：必填没填就留在表单（主进程那一关还会按活会话的 schema 再定一次型） */
  function submitMcpArg(values: Record<string, string | boolean>): void {
    const target = mcpArgTarget.value
    if (!target || target.action.type !== 'mcpTool') return
    const args: Record<string, string> = {}
    for (const spec of target.action.args) {
      const v = String(values[spec.name] ?? '').trim()
      if (!v && spec.required) return
      if (v) args[spec.name] = v
    }
    mcpArgTarget.value = null
    deps.popPage() // 退出参数页，结果页不再压回表单（Esc 从结果直接回根列表）
    runMcpToolEntry(target, args)
  }

  return {
    mcpArgTarget,
    mcpArgFields,
    mcpArgInitial,
    mcpCall,
    openMcpTool,
    runMcpToolEntry,
    submitMcpArg
  }
}
