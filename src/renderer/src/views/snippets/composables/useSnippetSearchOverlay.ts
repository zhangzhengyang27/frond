/**
 * Leaf · 片段编辑器搜索叠加层（自 Editor.vue 抽出）
 *
 * 基于 CodeMirror overlay 的高亮搜索：query 变化即重建 overlay 并滚动到
 * 首个匹配；editor 实例由宿主以 getter 传入（实例由宿主生命周期管理）。
 */
import { nextTick, ref, watch } from 'vue'
import type CodeMirror from 'codemirror'

export function useSnippetSearchOverlay(getEditor: () => CodeMirror.Editor | null) {
  const searchQuery = ref('')
  const isFocusedSearch = ref(false)
  const searchInputRef = ref<HTMLInputElement | null>(null)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let currentSearchOverlay: CodeMirror.Mode<any> | null = null

  // 创建搜索叠加层
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function createSearchOverlay(query: string): CodeMirror.Mode<any> | null {
    if (!query) return null

    let regexp: RegExp

    try {
      regexp = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi')
    } catch {
      return null
    }

    return {
      token: (stream: CodeMirror.StringStream) => {
        regexp.lastIndex = stream.pos
        const match = regexp.exec(stream.string)
        if (match && match.index === stream.pos) {
          stream.pos += match[0].length
          return 'searching'
        } else if (match) {
          stream.pos = match.index
        } else {
          stream.skipToEnd()
        }
        return null
      }
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
    } as CodeMirror.Mode<any>
  }

  // 更新搜索叠加层
  function updateSearchOverlay(): void {
    const editor = getEditor()
    if (!editor) return

    if (currentSearchOverlay) {
      editor.removeOverlay(currentSearchOverlay)
      currentSearchOverlay = null
    }

    if (searchQuery.value) {
      currentSearchOverlay = createSearchOverlay(searchQuery.value)
      if (currentSearchOverlay) {
        editor.addOverlay(currentSearchOverlay)

        // 滚动到第一个匹配项
        const cursor = editor.getSearchCursor(searchQuery.value, { line: 0, ch: 0 }, true)
        if (cursor.findNext()) {
          editor.scrollIntoView(cursor.from(), 50)
        }
      }
    }
  }

  // 清除搜索
  function clearSearch(): void {
    searchQuery.value = ''
    isFocusedSearch.value = false
    const editor = getEditor()
    if (currentSearchOverlay && editor) {
      editor.removeOverlay(currentSearchOverlay)
      currentSearchOverlay = null
    }
  }

  // 监听搜索查询变化
  watch(searchQuery, () => {
    if (!getEditor()) return
    nextTick(() => {
      updateSearchOverlay()
    })
  })

  return { searchQuery, isFocusedSearch, searchInputRef, updateSearchOverlay, clearSearch }
}
