/**
 * Frond · 插件的视图栈（P-2④ 第二半：「插件推不动视图栈」的正解）
 *
 * 单独一个不 import 任何运行时的模块，理由与 `headlessRun.ts` / `pinLogic.ts` 一样：
 * 「什么时候该长出一层」判错很难看 —— 该压不压，返回键一步跳回根；不该压乱压，
 * 用户按一次返回退的是上一次的搜索结果，看起来像坏了。这种判据要能在毫秒级单测里钉住。
 *
 * 关键取舍（第一版在这里踩过）：**不靠比对数据猜「这是不是新的一层」**。
 * 列表型插件边打字边重画，条目数、内容每分钟都在变，任何从数据推出来的「指纹」
 * 都会把同一次搜索的逐次重绘认成一路往下钻。所以压不压由插件**说出来**：
 * `renderList` = 替换当前层，`pushView` = 我要进下一层。宿主只做上限、弹出与引用不变性。
 */

/** 一层的身份。数据本体仍由 runtime 那份快照持有，这里只留判据要用的东西 */
export interface PluginViewLayer {
  kind: 'list' | 'form'
  /** 给渲染端当 key：同一层重绘不换 id，输入焦点与滚动位置才留得住 */
  id: string
}

/** 栈深上限：再多就不是「钻了几层」而是「出不去了」，胶囊的面包屑也放不下 */
export const PLUGIN_VIEW_STACK_MAX = 8

/**
 * 替换栈顶（插件重绘当前层）。层里是带着数据来的，所以每次都真换一份 ——
 * 「不换引用以省一次推送」这个念头在带数据的层上是错的（数据变了却不推送就是白屏）。
 * 稳定的是 **id**：渲染端拿它当 key，重绘因此复用实例，输入焦点不丢。
 */
export function replaceLayer(stack: PluginViewLayer[], next: PluginViewLayer): PluginViewLayer[] {
  return stack.length === 0 ? [next] : [...stack.slice(0, -1), next]
}

/** 显式进一层（插件说「我导航了」）。超上限时**丢最底下一层**而不是拒收： */
export function pushLayer(
  stack: PluginViewLayer[],
  layer: PluginViewLayer,
  max = PLUGIN_VIEW_STACK_MAX
): PluginViewLayer[] {
  const next = [...stack, layer]
  return next.length > max ? next.slice(next.length - max) : next
}

/** 弹一层；已在根层（长度 ≤ 1）返回 null —— 退根层等于关插件，那是胶囊的另一个动作 */
export function popLayer(stack: PluginViewLayer[]): PluginViewLayer[] | null {
  if (stack.length <= 1) return null
  return stack.slice(0, -1)
}

export function topLayer(stack: PluginViewLayer[]): PluginViewLayer | null {
  return stack[stack.length - 1] ?? null
}

/** 插件里还有得退吗（长度 1 不算：那一层就是插件自己） */
export function pluginCanGoBack(stack: PluginViewLayer[]): boolean {
  return stack.length > 1
}
