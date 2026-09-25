/**
 * 参数内联槽引擎（P-1.6b；2026-09-25 自 LauncherApp.vue 抽出，第五刀拆分）
 *
 * 命令名进 chip，参数一格一格排在搜索框里：只接「≤2 格且都是文本/密码」的命令，
 * 含 dropdown 或第 3 格起仍走 FormPage。格数/校验/移动判定全在 `shared/argSlots`
 * （那部分能被单测钉住），这里只管状态与按键。
 *
 * 提交分发通过 deps.dispatch 回调交还宿主：plugin / mcpTool / quicklink 三种去向
 * 各由对应发射 composable 承接（宿主用提升的函数声明接线，规避创建顺序的 TDZ）。
 */
import { computed, nextTick, ref, type Ref } from 'vue'
import type { CommandEntry } from '@shared/commands'
import {
  argLayoutOf,
  backspaceExits,
  missingRequiredIndexes,
  moveSlot,
  prefillSlots,
  slotArgs,
  type ArgSlot
} from '@shared/argSlots'
import { argPrefill } from './launcherInteractions'

export interface ArgSlotsDeps {
  query: Ref<string>
  /** 搜索条组件实例：只依赖 focus() 能力 */
  searchBarRef: Ref<{ focus: () => void } | null>
  /** 校验通过后的去向分发（plugin / mcpTool / quicklink 由宿主决定） */
  dispatch: (target: CommandEntry, values: Record<string, string>) => void
}

export function useArgSlots(deps: ArgSlotsDeps) {
  const argTarget = ref<CommandEntry | null>(null)
  const argSlotsOf = computed<ArgSlot[]>(() => {
    const t = argTarget.value
    if (!t) return []
    const layout = argLayoutOf(t)
    return layout.kind === 'inline' ? layout.slots : []
  })
  const argValues = ref<string[]>([])
  const argIndex = ref(0)
  /** 缺必填的格子下标：只用来标红，不弹提示（用户在填字，弹提示是打断） */
  const argInvalid = ref<number[]>([])
  const argModeOn = computed(() => argTarget.value !== null && argSlotsOf.value.length > 0)

  /** 用户开始填某一格，就撤掉那一格的红色标记（不整体清：另一格可能确实还缺着） */
  function setArgValue(index: number, value: string): void {
    argValues.value[index] = value
    if (argInvalid.value.includes(index)) {
      argInvalid.value = argInvalid.value.filter((i) => i !== index)
    }
  }

  function enterArgSlots(target: CommandEntry): boolean {
    const layout = argLayoutOf(target)
    if (layout.kind !== 'inline') return false
    argTarget.value = target
    argValues.value = prefillSlots(layout.slots, argPrefill(deps.query.value, target.title))
    argIndex.value = 0
    argInvalid.value = []
    // 标题已经进了 chip，搜索框不该再留一遍同样的字
    deps.query.value = ''
    void nextTick(() => deps.searchBarRef.value?.focus())
    return true
  }

  function exitArgSlots(): void {
    if (!argTarget.value) return
    argTarget.value = null
    argValues.value = []
    argInvalid.value = []
    void nextTick(() => deps.searchBarRef.value?.focus())
  }

  /** 提交复用表单页那条路（同一套 required 校验与 title→value 还原），先清槽态再走它 */
  function submitArgSlots(): void {
    const target = argTarget.value
    const slots = argSlotsOf.value
    if (!target || slots.length === 0) return
    const missing = missingRequiredIndexes(slots, argValues.value)
    if (missing.length > 0) {
      argInvalid.value = missing
      return
    }
    const values = slotArgs(slots, argValues.value)
    exitArgSlots()
    deps.dispatch(target, values)
  }

  function onArgSlotKeydown(e: KeyboardEvent, index: number): void {
    // IME 组合态（拼音还没上屏）：↵ 是「选这个词」、Esc 是「取消候选」、←→ 是「选词」，
    // 全属于输入法。搜索框那条 handler 早就有这个守卫，槽态是后加的，别少一份
    if (e.isComposing || e.keyCode === 229) return
    const count = argSlotsOf.value.length
    if (e.key === 'ArrowLeft') {
      e.preventDefault()
      argIndex.value = moveSlot(index, -1, count)
      return
    }
    if (e.key === 'ArrowRight') {
      e.preventDefault()
      argIndex.value = moveSlot(index, 1, count)
      return
    }
    // 槽态里 Tab 是「下一格」。与「Tab = Quick AI」不冲突：那时搜索输入框根本没渲染，
    // 键盘语义整套属于格子（Quick AI 那条走的是输入框自己的 keydown handler）
    if (e.key === 'Tab' || e.key === 'Shift+Tab') {
      e.preventDefault()
      // 与 ←/→ 同一条规则：夹在两端，不绕圈（绕圈会让人找不到光标在哪）
      argIndex.value = moveSlot(index, e.shiftKey ? -1 : 1, count)
      return
    }
    if (e.key === 'Enter') {
      e.preventDefault()
      submitArgSlots()
      return
    }
    if (e.key === 'Backspace' && backspaceExits(index, argValues.value[index] ?? '')) {
      e.preventDefault()
      exitArgSlots()
      return
    }
    if (e.key === 'Escape') {
      e.preventDefault()
      exitArgSlots()
      return
    }
    // 槽态没有结果列表可导航：↑↓ 按下去，别打到列表逻辑
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') e.preventDefault()
  }

  return {
    argTarget,
    argSlotsOf,
    argValues,
    argIndex,
    argInvalid,
    argModeOn,
    setArgValue,
    enterArgSlots,
    exitArgSlots,
    submitArgSlots,
    onArgSlotKeydown
  }
}
