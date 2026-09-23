/**
 * 回调 id 注册表（#11）：函数 props（onAction/onChange 等）在序列化时替换为
 * 回调 id，宿主交互后经 Callback 钩子回传 id，这里分发回真实函数。
 * 提交后清理未引用的 id，防泄漏。
 */

const registry = new Map<string, (args?: unknown) => void>()
let nextId = 0

/** 注册回调 → 生成 id */
export function registerCallback(fn: (args?: unknown) => void): string {
  const id = `cb-${++nextId}`
  registry.set(id, fn)
  return id
}

/** 宿主回传：按 id 分发。id 失效要说得出口——「点了没反应且零诊断」是最贵的一类 bug */
export function dispatchCallback(id: string, args?: unknown): boolean {
  const fn = registry.get(id)
  if (!fn) {
    console.warn(
      `[frond-sdk] 回调 id 已失效：${id}（注册表内 ${registry.size} 个；多为视图切换后 retainCallbacks 已清理，宿主仍在回传旧 id）`
    )
    return false
  }
  fn(args)
  return true
}

/** 提交后调用：保留本轮引用的 id，清掉其余（组件卸载即释放） */
export function retainCallbacks(usedIds: Set<string>): void {
  for (const id of [...registry.keys()]) {
    if (!usedIds.has(id)) registry.delete(id)
  }
}

/** 测试用：清空注册表 */
export function resetCallbacks(): void {
  registry.clear()
  nextId = 0
}
