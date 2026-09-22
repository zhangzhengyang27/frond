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
    return window.api.snippet.updateSnippet(snippetId, {
      contents: cleanContents
    } as Partial<Snippet>)
  })
}

function updateContentDebounced(snippetId: string, contentId: string): void {
  const key = `${snippetId}-${contentId}`
  const existing = updateContentTimers.get(key)
  if (existing) {
    clearTimeout(existing)
  }
  updateContentTimers.set(
    key,
    setTimeout(() => {
      updateContentTimers.delete(key)
      const update = updateContentQueue.value.get(key)
      if (update) {
        const snippet = update.data
        enqueueSnippetWrite(snippetId, async () => {
          // 获取完整的 snippet 来更新特定的 content；
          // 同一片段的写入已串行化，读到的全文必然包含上一笔写入
          const fullSnippet = await window.api.snippet.getSnippetById(update.snippetId)
          if (!fullSnippet) return
          const updatedContents = fullSnippet.contents.map((c) =>
            c.id === update.contentId
              ? {
                  id: c.id,
                  label: snippet.label ?? c.label,
                  value: snippet.value ?? c.value,
                  language: snippet.language ?? c.language,
                  contentType:
                    (snippet as { contentType?: 'text' | 'rich' }).contentType ?? c.contentType
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
          const cleanContents = JSON.parse(JSON.stringify(updatedContents))
          await window.api.snippet.updateSnippet(update.snippetId, {
            contents: cleanContents
          } as Partial<Snippet>)
        }).catch((e) => console.warn('[useSnippetUpdate] content flush failed:', e))
        updateContentQueue.value.delete(key)
      }
    }, UPDATE_DEBOUNCE_TIME)
  )
}

function addToUpdateContentQueue(
  snippetId: string,
  contentId: string,
  data: Partial<SnippetContent>
): void {
  const key = `${snippetId}-${contentId}`
  updateContentQueue.value.set(key, { snippetId, contentId, data })
  updateContentDebounced(snippetId, contentId)
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
