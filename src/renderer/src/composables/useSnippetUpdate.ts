import { ref } from 'vue'
import type { Snippet, SnippetContent } from '../../../preload/index.d'

interface UpdateContentQueueItem {
  snippetId: string
  contentId: string
  data: Partial<SnippetContent>
}

const UPDATE_DEBOUNCE_TIME = 500

const updateContentQueue = ref<Map<string, UpdateContentQueueItem>>(new Map())

// 每个 key 独立 timer：共用单个 timer 时，500ms 内先后编辑 A、B 两个片段
// 只会 flush 最后一次调用的 key，A 的改动永久滞留队列（丢失保存）
const updateContentTimers = new Map<string, ReturnType<typeof setTimeout>>()

// 按 snippetId 串行化写入：content flush 是「读全文→改→整体写回」，
// 同一片段的两个 content 并行 flush 会互相覆盖（后写者吞掉先写者的修改）。
// 所有 updateSnippet 调用按片段排队，保证读改写不交错。
const snippetWriteChains = new Map<string, Promise<void>>()

function enqueueSnippetWrite<T>(snippetId: string, task: () => Promise<T>): Promise<T> {
  const prev = snippetWriteChains.get(snippetId) ?? Promise.resolve()
  // 前一个写入失败不阻塞后续写入
  const next = prev.then(task, task)
  const settled = next.then(
    () => undefined,
    () => undefined
  )
  snippetWriteChains.set(snippetId, settled)
  // 链空闲（此后没有新写入追加）时清理条目，避免长会话下 Map 无限增长
  void settled.then(() => {
    if (snippetWriteChains.get(snippetId) === settled) {
      snippetWriteChains.delete(snippetId)
    }
  })
  return next
}

// ── B56-1 编辑真相回流 ─────────────────────────────────────────
// 此前 flush/结构写落库后不回写组件状态，props 永远陈旧：切 tab 旧值回填丢输入、
// 结构操作 payload 携带旧值回滚已落库编辑、复制按钮复制旧内容。
// 现在每次成功写入都广播 DB 返回的新对象，Editor 订阅后 emit 给父级同步 props。

type SyncListener = (snippet: Snippet) => void
const syncListeners = new Set<SyncListener>()

function notifySynced(snippet: Snippet): void {
  for (const l of syncListeners) l(snippet)
}

/** 订阅「片段已落库的新对象」；Editor 据此把真相同步回父级 props */
export function onSnippetSynced(cb: SyncListener): () => void {
  syncListeners.add(cb)
  return () => {
    syncListeners.delete(cb)
  }
}

/** 执行单个队列条目的落库；成功才出队（失败保留待重试，B56-6 前置） */
async function flushQueueKey(key: string): Promise<void> {
  const update = updateContentQueue.value.get(key)
  if (!update) return
  try {
    // 获取完整的 snippet 来更新特定的 content；
    // 同一片段的写入已串行化，读到的全文必然包含上一笔写入
    const fullSnippet = await window.api.snippet.getSnippetById(update.snippetId)
    if (!fullSnippet) {
      // 片段已被删除：安静出队
      if (updateContentQueue.value.get(key) === update) updateContentQueue.value.delete(key)
      return
    }
    const updatedContents = fullSnippet.contents.map((c) =>
      c.id === update.contentId
        ? {
            id: c.id,
            label: update.data.label ?? c.label,
            value: update.data.value ?? c.value,
            language: update.data.language ?? c.language,
            contentType:
              (update.data as { contentType?: 'text' | 'rich' }).contentType ?? c.contentType
          }
        : {
            id: c.id,
            label: c.label,
            value: c.value,
            language: c.language,
            contentType: c.contentType
          }
    )
    // 清理数据，确保只传递可序列化的基本类型
    const cleanContents = JSON.parse(JSON.stringify(updatedContents)) as typeof updatedContents
    const saved = (await window.api.snippet.updateSnippet(update.snippetId, {
      contents: cleanContents
    } as unknown as Parameters<typeof window.api.snippet.updateSnippet>[1])) as Snippet | undefined
    if (saved) notifySynced(saved)
    // 出队条件：条目仍是 flush 时读到的那份（执行期间用户又键入会替换条目，
    // 新条目有自己的 timer，不能被旧 flush 误删）
    if (updateContentQueue.value.get(key) === update) updateContentQueue.value.delete(key)
  } catch (e) {
    // 写失败保留条目（下次 flush/键入重试）；不再静默——至少 console.error 可经
    // 日志桥导出（B52）
    console.error('[useSnippetUpdate] content flush failed（保留队列待重试）:', e)
  }
}

/**
 * 立即排空某片段的全部待写队列（不等 500ms 防抖）。
 * 结构性操作（增删块/改语言/复制/切 tab）前调用——调用后 props 经订阅回调
 * 已是 DB 最新，后续 payload 构建不再携带陈旧值。
 */
export async function flushPendingContentWrites(snippetId: string): Promise<void> {
  const keys = [...updateContentQueue.value.keys()].filter((k) =>
    k.startsWith(`${snippetId}-`)
  )
  if (keys.length === 0) return
  for (const k of keys) {
    const t = updateContentTimers.get(k)
    updateContentTimers.delete(k)
    if (t) clearTimeout(t)
  }
  await enqueueSnippetWrite(snippetId, async () => {
    for (const k of keys) await flushQueueKey(k)
  })
}

/** 排空所有片段的待写队列（窗口失焦/隐藏时调用，收敛丢编辑窗口） */
export async function flushAllPendingContentWrites(): Promise<void> {
  const ids = new Set([...updateContentQueue.value.keys()].map((k) => k.split('-')[0]!))
  for (const id of ids) await flushPendingContentWrites(id)
}

/**
 * 整体 contents 写入（增删/改名/排序代码块），与防抖 flush 共用同一条
 * 按 snippetId 串行的写入链——绕开链条直写的话，交错的读改写会复活
 * 刚被删除的 content（flush 读到的旧全文写回时把删除抵消掉）。
 */
export function enqueueContentsWrite(
  snippetId: string,
  contents: SnippetContent[]
): Promise<Snippet | undefined> {
  return enqueueSnippetWrite(snippetId, async () => {
    const cleanContents = JSON.parse(JSON.stringify(contents)) as SnippetContent[]
    const saved = (await window.api.snippet.updateSnippet(snippetId, {
      contents: cleanContents
    } as unknown as Parameters<typeof window.api.snippet.updateSnippet>[1])) as Snippet | undefined
    if (saved) notifySynced(saved)
    return saved
  })
}

function updateContentDebounced(snippetId: string, key: string): void {
  const existing = updateContentTimers.get(key)
  if (existing) {
    clearTimeout(existing)
  }
  updateContentTimers.set(
    key,
    setTimeout(() => {
      updateContentTimers.delete(key)
      if (updateContentQueue.value.has(key)) {
        void enqueueSnippetWrite(snippetId, () => flushQueueKey(key))
      }
    }, UPDATE_DEBOUNCE_TIME)
  )
}

export function addToUpdateContentQueue(
  snippetId: string,
  contentId: string,
  data: Partial<SnippetContent>
): void {
  const key = `${snippetId}-${contentId}`
  updateContentQueue.value.set(key, { snippetId, contentId, data })
  updateContentDebounced(snippetId, key)
}

export function useSnippetUpdate(): {
  addToUpdateContentQueue: (
    snippetId: string,
    contentId: string,
    data: Partial<SnippetContent>
  ) => void
} {
  return {
    addToUpdateContentQueue
  }
}
