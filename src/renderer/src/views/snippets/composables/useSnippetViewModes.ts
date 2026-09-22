/**
 * Leaf · 片段编辑器视图互斥开关（自 Editor.vue 抽出）
 *
 * 五个视图（代码预览 / Markdown 预览 / JSON 可视化 / 代码截图 / Markdown
 * 演示）互斥显示；切换前先 saveEditorContent（由宿主注入，避免展示旧内容）。
 */
import { ref } from 'vue'
import type { Snippet } from '@preload/index.d'

export function useSnippetViewModes(deps: {
  saveEditorContent: () => Promise<void>
  onUpdateSnippet: (snippet: Snippet) => void
}) {
  const isShowCodePreview = ref(false)
  const isShowMarkdown = ref(false)
  const isShowJsonVisualizer = ref(false)
  const isShowCodeScreenshot = ref(false)
  const isShowMarkdownPresentation = ref(false)
  /** Markdown 演示模式的片段清单（选择后切换宿主当前片段） */
  const allSnippets = ref<Snippet[]>([])

  function closeAll(): void {
    isShowCodePreview.value = false
    isShowMarkdown.value = false
    isShowJsonVisualizer.value = false
    isShowCodeScreenshot.value = false
    isShowMarkdownPresentation.value = false
  }

  // 切换代码预览
  function toggleCodePreview(): void {
    isShowCodePreview.value = !isShowCodePreview.value
    isShowMarkdown.value = false
    isShowJsonVisualizer.value = false
    isShowCodeScreenshot.value = false
  }

  // 切换 Markdown 预览
  function toggleMarkdown(): void {
    isShowMarkdown.value = !isShowMarkdown.value
    isShowCodePreview.value = false
    isShowJsonVisualizer.value = false
    isShowCodeScreenshot.value = false
  }

  // 切换 JSON 可视化
  async function toggleJsonVisualizer(): Promise<void> {
    // 在切换视图前先保存编辑器内容
    await deps.saveEditorContent()
    isShowJsonVisualizer.value = !isShowJsonVisualizer.value
    isShowCodePreview.value = false
    isShowMarkdown.value = false
    isShowCodeScreenshot.value = false
  }

  // 切换代码截图
  async function toggleCodeScreenshot(): Promise<void> {
    // 在切换视图前先保存编辑器内容
    await deps.saveEditorContent()
    isShowCodeScreenshot.value = !isShowCodeScreenshot.value
    isShowCodePreview.value = false
    isShowMarkdown.value = false
    isShowJsonVisualizer.value = false
  }

  // 加载所有代码片段
  async function loadAllSnippets(): Promise<void> {
    try {
      allSnippets.value = await window.api.snippet.getSnippets({ isDeleted: false })
    } catch (error) {
      console.error('加载代码片段失败:', error)
    }
  }

  // 切换 Markdown 演示模式
  async function toggleMarkdownPresentation(): Promise<void> {
    if (!isShowMarkdownPresentation.value) {
      await loadAllSnippets()
    }
    isShowMarkdownPresentation.value = !isShowMarkdownPresentation.value
    isShowCodePreview.value = false
    isShowMarkdown.value = false
    isShowJsonVisualizer.value = false
    isShowCodeScreenshot.value = false
  }

  // 处理演示模式中选择代码片段
  function handleSelectSnippet(snippetId: string): void {
    const snippet = allSnippets.value.find((s) => s.id === snippetId)
    if (snippet) {
      deps.onUpdateSnippet(snippet)
    }
  }

  return {
    isShowCodePreview,
    isShowMarkdown,
    isShowJsonVisualizer,
    isShowCodeScreenshot,
    isShowMarkdownPresentation,
    allSnippets,
    closeAll,
    toggleCodePreview,
    toggleMarkdown,
    toggleJsonVisualizer,
    toggleCodeScreenshot,
    toggleMarkdownPresentation,
    loadAllSnippets,
    handleSelectSnippet
  }
}
