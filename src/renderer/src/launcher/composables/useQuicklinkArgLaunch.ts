/**
 * 参数化 Quicklink 的「发射」段（M2.3；2026-09-25 自 LauncherApp.vue 抽出，第三刀拆分）
 *
 * URL 含 {query} 或命名占位符的 Quicklink：一两格走内联槽（判定在 shared/argSlots，
 * 由 deps.enterArgSlots 注入），否则进 qlarg 表单页；提交时占位符替换后交系统浏览器。
 */
import { computed, ref, type Ref } from 'vue'
import { buildQuicklinkUrlMulti, quicklinkFieldNames, type CommandEntry } from '@shared/commands'
import { argPrefill } from './launcherInteractions'

export interface QuicklinkArgLaunchDeps {
  /** 搜索框当前词：参数初值从「标题之外的部分」提取（"github react" → react） */
  query: Ref<string>
  /** 搜索条组件实例：只依赖 focus() 能力 */
  searchBarRef: Ref<{ focus: () => void } | null>
  pushPage: (page: 'qlarg') => void
  /** ≤2 格内联槽开成功返回 true（P-1.6b）；false = 继续走表单页 */
  enterArgSlots: (target: CommandEntry) => boolean
  /** 提交成功后收起胶囊（Quicklink 是「打开就走」语义） */
  hideWindow: () => void
}

export function useQuicklinkArgLaunch(deps: QuicklinkArgLaunchDeps) {
  /** 当前待打开的参数化 Quicklink（qlarg 表单页的数据源） */
  const qlArgTarget = ref<CommandEntry | null>(null)
  /** 参数初值：用户搜索词里标题之外的部分，落在第一格 */
  const qlArgInitial = ref('')

  /** qlarg 表单字段：与内联槽同一份 quicklinkFieldNames（{query} + 命名占位符），两边不能各数一遍 */
  const qlArgFields = computed(() => {
    const t = qlArgTarget.value
    if (!t || t.action.type !== 'quicklink') return [] as Array<{ key: string; label: string }>
    return quicklinkFieldNames(t.action.url).map((n) => ({
      key: n,
      label: n === 'query' ? '参数' : n
    }))
  })

  /** 初值落在**第一格**：字段名随 URL 变（{query} / 命名占位符），写死 key:'query' 会让命名参数的预填丢掉 */
  const qlArgInitialMap = computed<Record<string, string>>(() => {
    const first = qlArgFields.value[0]
    return first ? { [first.key]: qlArgInitial.value } : {}
  })

  /** 打开参数表单页：一两格先试内联槽（P-1.6b），进表单后预填并清查询词 */
  function openQuicklinkArg(target: CommandEntry): void {
    if (deps.enterArgSlots(target)) return
    qlArgTarget.value = target
    qlArgInitial.value = argPrefill(deps.query.value, target.title)
    deps.pushPage('qlarg')
    deps.query.value = ''
    deps.searchBarRef.value?.focus()
  }

  /** 参数表单提交 → 占位符替换后用系统浏览器打开（表单值含 checkbox 布尔，此处按字符串取） */
  function submitQuicklinkArg(values: Record<string, string | boolean>): void {
    const target = qlArgTarget.value
    if (!target || target.action.type !== 'quicklink') return
    const url = target.action.url
    // 收齐 quicklinkFieldNames（{query} 与命名占位符都算）：少收一个就把字面量留在地址里
    const names = quicklinkFieldNames(url)
    if (names.length === 0) {
      // 没有占位符却进了参数页（调用方的门槛漏了）：照原样打开，不静默吞掉这次回车
      void window.api.system.openExternal(url)
      deps.hideWindow()
      return
    }
    const vals: Record<string, string> = {}
    for (const n of names) {
      const v = String(values[n] ?? '').trim()
      if (!v) return // 空参数留在表单
      vals[n] = v
    }
    void window.api.system.openExternal(buildQuicklinkUrlMulti(url, vals))
    deps.hideWindow()
  }

  return {
    qlArgTarget,
    qlArgFields,
    qlArgInitialMap,
    openQuicklinkArg,
    submitQuicklinkArg
  }
}
