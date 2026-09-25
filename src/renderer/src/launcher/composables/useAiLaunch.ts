/**
 * 胶囊 AI 接线段（P-4③ / Quick AI；2026-09-25 自 LauncherApp.vue 抽出，第四刀拆分）
 *
 * 三个「把一段文字交给 AI 内联页自动发送」的入口（模块内容 askAIWithText / 当前搜索词
 * askAIWithQuery / 一条结果 askAIAbout）共用同一条管线：pushPage('ai') → 清查询词 →
 * 焦点回搜索框 → nextTick 后调 AIChatPage 挂载暴露的 queueInitial。
 * aiReady 供动作面板决定要不要出「问 AI」那条（没配就摆一条必失败的动作是噪音）。
 */
import { nextTick, ref, type Ref } from 'vue'
import type { CommandEntry } from '@shared/commands'
import { buildEntryAsk, type AiAskSource } from '@shared/aiAsk'

export interface AiLaunchDeps {
  /** 当前内联页组件实例（AIChatPage 需 expose queueInitial） */
  pageRef: Ref<unknown>
  pushPage: (page: 'ai') => void
  query: Ref<string>
  /** 搜索条组件实例：只依赖 focus() 能力 */
  searchBarRef: Ref<{ focus: () => void } | null>
}

export function useAiLaunch(deps: AiLaunchDeps) {
  /** P-4③：AI 是否配好——动作面板据此决定要不要出「问 AI」那条 */
  const aiReady = ref(false)

  /** 排队发送的公共尾：等 AIChatPage 挂载后调它的 queueInitial（配置未就绪时它自己会挂起） */
  function queueOnAiPage(text: string): void {
    void nextTick(() => {
      const aiPage = deps.pageRef.value as { queueInitial?: (t: string) => void } | null
      if (aiPage?.queueInitial && text) aiPage.queueInitial(text)
    })
  }

  /** V4 批次5：模块内容问 AI（截图识字 / 笔记摘要共用入口） */
  function askAIWithText(text: string): void {
    deps.pushPage('ai')
    deps.query.value = ''
    deps.searchBarRef.value?.focus()
    queueOnAiPage(text)
  }

  /** P0-3 / B1 · Quick AI：把当前搜索词交给 AI 页自动发送（Tab 键与搜索框右侧按钮共用） */
  function askAIWithQuery(): void {
    const q = deps.query.value.trim()
    deps.pushPage('ai')
    deps.query.value = ''
    deps.searchBarRef.value?.focus()
    queueOnAiPage(q)
  }

  /** 把一条结果变成一次可见的提问：复用 AI 内联页的排队发送，不另开一套对话面 */
  function askAIAbout(entry: CommandEntry): void {
    const text = buildEntryAsk(entry as unknown as AiAskSource)
    deps.pushPage('ai')
    deps.query.value = ''
    deps.searchBarRef.value?.focus()
    queueOnAiPage(text)
  }

  /**
   * 挂载时读一次配置态；面板打开后的补读由消费方 watch actionPanelEntry 触发
   * （补读对本次已渲染的列表不生效，影响的是下一次打开；代价一次 IPC，不订阅式同步）
   */
  async function refreshAiReady(): Promise<void> {
    try {
      aiReady.value = await window.api.ai.isConfigured()
    } catch {
      aiReady.value = false
    }
  }

  return { aiReady, refreshAiReady, askAIWithText, askAIWithQuery, askAIAbout }
}
