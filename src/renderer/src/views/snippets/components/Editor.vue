<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onBeforeUnmount } from 'vue'
import type { Snippet, SnippetContent, Tag } from '@preload/index.d'
import CodeMirror from 'codemirror'
import { useDark, useCssVar } from '@vueuse/core'
import { useEditor } from '@composables/useEditor'
import { useSnippetUpdate, enqueueContentsWrite } from '@composables/useSnippetUpdate'
import { useTags } from '@composables/useTags'
import TagInput from '@components/TagInput.vue'
import CodePreview from '@components/CodePreview.vue'
import MarkdownPreview from '@components/MarkdownPreview.vue'
import JsonVisualizer from '@components/JsonVisualizer.vue'
import CodeScreenshot from '@components/CodeScreenshot.vue'
import MarkdownPresentation from '@components/MarkdownPresentation.vue'
import AppIcon from '@components/AppIcon.vue'
import USelect from '@components/ui/USelect.vue'
import UTooltip from '@components/ui/UTooltip.vue'
import 'codemirror/addon/edit/closebrackets'
import 'codemirror/addon/edit/matchbrackets'
import 'codemirror/addon/selection/active-line'
import 'codemirror/addon/scroll/simplescrollbars'
import 'codemirror/addon/scroll/simplescrollbars.css'
import 'codemirror/addon/search/search'
import 'codemirror/addon/search/searchcursor'
import 'codemirror/lib/codemirror.css'
import 'codemirror/theme/neo.css'
import 'codemirror/theme/oceanic-next.css'
import 'codemirror/mode/javascript/javascript'
import 'codemirror/mode/python/python'
import 'codemirror/mode/htmlmixed/htmlmixed'
import 'codemirror/mode/css/css'
import 'codemirror/mode/xml/xml'
import 'codemirror/mode/markdown/markdown'
import 'codemirror/mode/sql/sql'
import 'codemirror/mode/shell/shell'
import 'codemirror/mode/yaml/yaml'

interface Props {
  snippet?: Snippet | null
}

interface Emits {
  (e: 'update:snippet', value: Snippet | null): void
}

const props = defineProps<Props>()
const emit = defineEmits<Emits>()

const { cursorPosition, settings } = useEditor()
const { addToUpdateContentQueue } = useSnippetUpdate()
const { getTagsByIds } = useTags()

const isDark = useDark()
const fontSize = useCssVar('--editor-font-size', document.body, {
  initialValue: `${settings.fontSize}px`
})

const currentContentIndex = ref(0)
const lastLoadedSnippetId = ref<string | null>(null)
const isProgrammaticChange = ref(false)
const isShowDescription = ref(false)
const editingTabIndex = ref<number | null>(null)
const snippetTags = ref<string[]>([])
const allTags = ref<Tag[]>([])
const searchQuery = ref('')
const isFocusedSearch = ref(false)
const searchInputRef = ref<HTMLInputElement | null>(null)
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
const contextMenuTabIndex = ref<number | null>(null)
const isShowCodePreview = ref(false)
const isShowMarkdown = ref(false)
const isShowJsonVisualizer = ref(false)
const isShowCodeScreenshot = ref(false)
const isShowMarkdownPresentation = ref(false)
const allSnippets = ref<Snippet[]>([])

let editor: CodeMirror.Editor | null = null
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let currentSearchOverlay: CodeMirror.Mode<any> | null = null
const editorRef = ref<HTMLDivElement | null>(null)

const selectedSnippetContent = computed(() => {
  if (!props.snippet?.contents || props.snippet.contents.length === 0) {
    return null
  }
  return props.snippet.contents[currentContentIndex.value] || props.snippet.contents[0]
})

const isEmpty = computed(() => {
  return !props.snippet
})

const isShowEditor = computed(() => {
  return !isEmpty.value && props.snippet !== undefined
})

const hasPreviewContent = computed(() => {
  if (!props.snippet?.contents) return false
  return props.snippet.contents.some(
    (content) =>
      content.language === 'html' || content.language === 'css' || content.language === 'javascript'
  )
})

const hasMarkdownContent = computed(() => {
  return selectedSnippetContent.value?.language === 'markdown'
})

const hasJsonContent = computed(() => {
  return selectedSnippetContent.value?.language === 'json'
})

// 获取语言模式映射（CodeMirror 模式名称）
function getLanguageMode(language: string): string {
  // CodeMirror 模式映射
  const modeMap: Record<string, string> = {
    javascript: 'javascript',
    typescript: 'javascript', // TypeScript 使用 JavaScript 模式
    python: 'python',
    html: 'htmlmixed', // HTML 需要使用 htmlmixed 模式
    css: 'css',
    scss: 'css',
    json: 'application/json', // JSON 模式在 CodeMirror 中使用 application/json
    markdown: 'markdown',
    yaml: 'yaml',
    sql: 'sql',
    xml: 'xml',
    bash: 'shell',
    shell: 'shell',
    plaintext: 'null', // 无语法高亮
    plain_text: 'null'
  }

  return modeMap[language] || modeMap[language.toLowerCase()] || 'null'
}

// 编辑器语言下拉选项（供 USelect 使用；与 getLanguageMode 支持的模式保持一致）
const languageOptions = [
  { value: 'plaintext', label: 'Plain Text' },
  { value: 'javascript', label: 'JavaScript' },
  { value: 'typescript', label: 'TypeScript' },
  { value: 'python', label: 'Python' },
  { value: 'java', label: 'Java' },
  { value: 'html', label: 'HTML' },
  { value: 'css', label: 'CSS' },
  { value: 'scss', label: 'SCSS' },
  { value: 'json', label: 'JSON' },
  { value: 'xml', label: 'XML' },
  { value: 'markdown', label: 'Markdown' },
  { value: 'sql', label: 'SQL' },
  { value: 'bash', label: 'Bash' },
  { value: 'shell', label: 'Shell' },
  { value: 'yaml', label: 'YAML' }
]

function getCursorPosition(): void {
  if (!editor) return
  const { line, ch } = editor.getCursor()
  cursorPosition.row = line
  cursorPosition.column = ch
}

async function init(): Promise<void> {
  const el = editorRef.value
  if (!el) return

  // 如果编辑器已存在，先清理
  if (editor) {
    const wrapper = editor.getWrapperElement()
    wrapper.remove()
    editor = null
  }

  // 确保容器可见且有尺寸
  if (el.offsetWidth === 0 || el.offsetHeight === 0) {
    // 如果容器还没有尺寸，等待一下再初始化
    await nextTick()
    const retryEl = editorRef.value
    if (!retryEl || retryEl.offsetWidth === 0 || retryEl.offsetHeight === 0) {
      // 如果还是没有尺寸，延迟初始化
      setTimeout(() => init(), 100)
      return
    }
  }

  editor = CodeMirror(el, {
    value: selectedSnippetContent.value?.value || '',
    mode: getLanguageMode(selectedSnippetContent.value?.language || 'plaintext'),
    theme: isDark.value ? 'oceanic-next' : 'neo',
    lineWrapping: settings.wrap,
    lineNumbers: true,
    tabSize: settings.tabSize,
    autoCloseBrackets: true,
    matchBrackets: settings.matchBrackets,
    styleActiveLine: settings.highlightLine,
    scrollbarStyle: 'null',
    readOnly: false
  })

  // 确保编辑器可以接收输入
  nextTick(() => {
    if (editor) {
      editor.refresh()
      // 不自动聚焦，让用户点击时自然聚焦
    }
  })

  editor.on('change', (e) => {
    // 如果是程序性更改，跳过
    if (isProgrammaticChange.value) return

    // 只有在有 snippet 和 content 时才保存
    if (props.snippet?.id && selectedSnippetContent.value) {
      const updatedValue = e.getValue()
      // 字符串直比：相等说明无变化，直接跳过（避免每次键入两次全文 JSON.stringify）
      if (selectedSnippetContent.value.value === updatedValue) return

      addToUpdateContentQueue(props.snippet.id, selectedSnippetContent.value.id, {
        label: selectedSnippetContent.value.label,
        value: updatedValue,
        language: selectedSnippetContent.value.language
      })
    }
  })

  editor.on('cursorActivity', getCursorPosition)

  // 添加搜索和格式化快捷键
  editor.setOption('extraKeys', {
    'Cmd-F': () => {
      isFocusedSearch.value = true
      nextTick(() => {
        searchInputRef.value?.focus()
      })
    },
    'Ctrl-F': () => {
      isFocusedSearch.value = true
      nextTick(() => {
        searchInputRef.value?.focus()
      })
    },
    'Cmd-Shift-F': () => {
      formatCode()
    },
    'Ctrl-Shift-F': () => {
      formatCode()
    },
    'Cmd-Alt-F': () => {
      formatCode()
    },
    'Ctrl-Alt-F': () => {
      formatCode()
    }
  })
}

// 监听 selectedSnippetContent 变化，更新编辑器内容
watch(selectedSnippetContent, (v, oldV) => {
  if (!editor) return
  nextTick(() => {
    const isNewValue = v?.id !== oldV?.id
    setValue(v?.value || '', true, !isNewValue)
    if (searchQuery.value) {
      updateSearchOverlay()
    }
  })
})

// 监听 selectedSnippetContent 变化，更新语言模式
watch(selectedSnippetContent, (v) => {
  if (!editor) return
  nextTick(() => {
    if (!v) return
    setLanguage(v.language)
  })
})

// 监听搜索查询变化
watch(searchQuery, () => {
  if (!editor) return
  nextTick(() => {
    updateSearchOverlay()
  })
})

// 监听主题变化
watch(isDark, (v) => {
  if (!editor) return
  if (v) {
    editor.setOption('theme', 'oceanic-next')
  } else {
    editor.setOption('theme', 'neo')
  }
})

// 监听字体大小变化
watch(
  () => settings.fontSize,
  () => {
    if (!editor) return
    fontSize.value = `${settings.fontSize}px`
    nextTick(() => {
      editor?.refresh()
    })
  }
)

function setValue(value: string, programmatic = true, preserveViewport = true): void {
  if (!editor) return

  const current = editor.getValue()
  if (current === value) return

  const cursor = preserveViewport ? editor.getCursor() : null
  const { left, top } = preserveViewport ? editor.getScrollInfo() : { left: 0, top: 0 }

  isProgrammaticChange.value = programmatic
  editor.setValue(value)
  isProgrammaticChange.value = false

  if (preserveViewport) {
    if (cursor) editor.setCursor(cursor)
    editor.scrollTo(left, top)
  } else {
    editor.setCursor({ line: 0, ch: 0 })
    editor.scrollTo(0, 0)
  }
}

function setLanguage(language: string): void {
  if (!editor) return
  editor.setOption('mode', getLanguageMode(language))
}

// 监听代码片段变化
watch(
  () => props.snippet?.id,
  (newSnippetId, oldSnippetId) => {
    if (
      newSnippetId &&
      newSnippetId !== oldSnippetId &&
      newSnippetId !== lastLoadedSnippetId.value
    ) {
      currentContentIndex.value = 0
      lastLoadedSnippetId.value = newSnippetId
      editingTabIndex.value = null
      if (props.snippet && !props.snippet.description) {
        isShowDescription.value = false
      }
      loadTags()
      nextTick(() => {
        if (editor && selectedSnippetContent.value) {
          setValue(selectedSnippetContent.value.value || '', true, false)
          setLanguage(selectedSnippetContent.value.language)
        }
      })
    } else if (!newSnippetId) {
      lastLoadedSnippetId.value = null
      editingTabIndex.value = null
      isShowDescription.value = false
      snippetTags.value = []
      allTags.value = []
    }
  },
  { immediate: true }
)

// 监听标签变化
watch(
  () => props.snippet?.tagIds,
  () => {
    loadTags()
  }
)

// 监听代码片段切换时清除搜索
watch(
  () => props.snippet?.id,
  () => {
    if (searchQuery.value) {
      clearSearch()
    }
  }
)

// 切换代码块
function switchContent(index: number): void {
  if (!props.snippet || index < 0 || index >= props.snippet.contents.length) return

  currentContentIndex.value = index

  // 确保编辑器内容同步更新
  nextTick(() => {
    if (editor && selectedSnippetContent.value) {
      setValue(selectedSnippetContent.value.value || '', true, false)
      setLanguage(selectedSnippetContent.value.language)
      // 清除搜索
      if (searchQuery.value) {
        clearSearch()
      }
    }
  })
}

// 添加代码块
async function addContent(): Promise<void> {
  if (!props.snippet) return
  try {
    const lastContentIndex = props.snippet.contents.length
    const newContent: SnippetContent = {
      id: '',
      label: `代码 ${lastContentIndex + 1}`,
      value: '',
      language: 'plaintext'
    }

    // 与防抖 flush 共用同一条写入链（enqueueContentsWrite 内做序列化深拷贝）
    const updated = await enqueueContentsWrite(props.snippet.id, [
      ...props.snippet.contents,
      newContent
    ])

    if (updated) {
      currentContentIndex.value = updated.contents.length - 1

      // 确保编辑器内容同步更新
      nextTick(() => {
        if (editor && selectedSnippetContent.value) {
          setValue(selectedSnippetContent.value.value || '', true, false)
          setLanguage(selectedSnippetContent.value.language)
        }
      })

      emit('update:snippet', updated)
    }
  } catch (error) {
    console.error('添加代码块失败:', error)
  }
}

// 删除代码块
async function removeContent(index: number): Promise<void> {
  if (!props.snippet || props.snippet.contents.length <= 1) return
  try {
    const newContents = props.snippet.contents.filter((_, i) => i !== index)

    // contents 均为纯对象，ipcRenderer.invoke 走结构化克隆，无需手动 JSON 深拷贝
    const updated = await enqueueContentsWrite(props.snippet.id, newContents)

    if (updated) {
      // 调整当前索引
      if (currentContentIndex.value >= updated.contents.length) {
        currentContentIndex.value = updated.contents.length - 1
      } else if (currentContentIndex.value > index) {
        // 如果删除的是当前之前的代码块，索引需要减1
        currentContentIndex.value--
      }

      // 确保编辑器内容同步更新
      nextTick(() => {
        if (editor && selectedSnippetContent.value) {
          setValue(selectedSnippetContent.value.value || '', true, false)
          setLanguage(selectedSnippetContent.value.language)
        }
      })

      emit('update:snippet', updated)
    }
  } catch (error) {
    console.error('删除代码块失败:', error)
  }
}

// 更新标签名称
async function updateContentLabel(index: number, label: string): Promise<void> {
  if (!props.snippet || !selectedSnippetContent.value) return
  try {
    const newContents = props.snippet.contents.map((c, i) => (i === index ? { ...c, label } : c))
    // contents 均为纯对象，ipcRenderer.invoke 走结构化克隆，无需手动 JSON 深拷贝
    const updated = await enqueueContentsWrite(props.snippet.id, newContents)

    if (updated) {
      emit('update:snippet', updated)
    }
  } catch (error) {
    console.error('更新标签失败:', error)
  }
}

// 更新语言
async function updateLanguage(language: string): Promise<void> {
  if (!props.snippet || !selectedSnippetContent.value) return

  // 获取编辑器当前的值，确保不会丢失用户正在编辑的内容
  const currentEditorValue = editor?.getValue() || selectedSnippetContent.value.value || ''

  try {
    const newContents = props.snippet.contents.map((c) =>
      c.id === selectedSnippetContent.value!.id ? { ...c, language, value: currentEditorValue } : c
    )
    // contents 均为纯对象，ipcRenderer.invoke 走结构化克隆，无需手动 JSON 深拷贝
    const updated = await enqueueContentsWrite(props.snippet.id, newContents)

    if (updated) {
      emit('update:snippet', updated)
      // 确保编辑器内容与更新后的内容同步
      nextTick(() => {
        if (editor && selectedSnippetContent.value) {
          const updatedContent = updated.contents.find(
            (c) => c.id === selectedSnippetContent.value!.id
          )
          if (updatedContent && editor.getValue() !== updatedContent.value) {
            setValue(updatedContent.value, true, true)
          }
          setLanguage(language)
        }
      })
    }
  } catch (error) {
    console.error('更新语言失败:', error)
  }
}

// 更新内容类型（纯文本 / 富文本 HTML）：富文本片段在全局扩展时走
// 剪贴板 text/html 双格式粘贴，保留排版（邮件/文档/聊天可用）
async function updateContentType(contentType: 'text' | 'rich'): Promise<void> {
  if (!props.snippet || !selectedSnippetContent.value) return
  const content = selectedSnippetContent.value
  if ((content.contentType ?? 'text') === contentType) return

  const currentEditorValue = editor?.getValue() || content.value || ''
  // rich 用 html 语法编辑源码；切回 text 时若是 html 还原为 plaintext
  const language =
    contentType === 'rich' ? 'html' : content.language === 'html' ? 'plaintext' : content.language

  try {
    const newContents = props.snippet.contents.map((c) =>
      c.id === content.id ? { ...c, contentType, language, value: currentEditorValue } : c
    )
    const updated = await enqueueContentsWrite(props.snippet.id, newContents)
    if (updated) {
      emit('update:snippet', updated)
      nextTick(() => {
        setLanguage(language)
      })
    }
  } catch (error) {
    console.error('更新内容类型失败:', error)
  }
}

// 复制代码
async function copyCode(): Promise<void> {
  if (!selectedSnippetContent.value) return
  try {
    await navigator.clipboard.writeText(selectedSnippetContent.value.value)
  } catch (error) {
    console.error('复制失败:', error)
  }
}

// 切换收藏
async function toggleFavorite(): Promise<void> {
  if (!props.snippet) return
  try {
    const updated = await window.api.snippet.updateSnippet(props.snippet.id, {
      isFavorites: !props.snippet.isFavorites
    })
    if (updated) {
      emit('update:snippet', updated)
    }
  } catch (error) {
    console.error('更新收藏状态失败:', error)
  }
}

// 更新名称（blur/确认时直写；不再叠加 addToUpdateQueue——那会在 500ms 后
// 对同一字段重复写一次 IPC，防抖队列对这些非连续输入场景形同虚设）
async function updateName(name: string): Promise<void> {
  if (!props.snippet) return
  const updated = await window.api.snippet.updateSnippet(props.snippet.id, { name })
  if (updated) {
    emit('update:snippet', updated)
  }
}

// 更新描述
async function updateDescription(description: string): Promise<void> {
  if (!props.snippet) return
  const updated = await window.api.snippet.updateSnippet(props.snippet.id, { description })
  if (updated) {
    emit('update:snippet', updated)
  }
}

// 更新文本扩展触发词（M5.1）
async function updateTrigger(trigger: string): Promise<void> {
  if (!props.snippet) return
  const updated = await window.api.snippet.updateSnippet(props.snippet.id, { trigger })
  if (updated) {
    emit('update:snippet', updated)
  }
}

// 更新标签
async function updateTags(tagIds: string[]): Promise<void> {
  if (!props.snippet) return
  // 清理数据，确保只传递可序列化的基本类型
  const cleanTagIds = JSON.parse(JSON.stringify(tagIds))
  const updated = await window.api.snippet.updateSnippet(props.snippet.id, {
    tagIds: cleanTagIds
  })
  if (updated) {
    emit('update:snippet', updated)
  }
}

// 加载标签
async function loadTags(): Promise<void> {
  if (props.snippet?.tagIds && props.snippet.tagIds.length > 0) {
    snippetTags.value = [...props.snippet.tagIds]
    allTags.value = await getTagsByIds(props.snippet.tagIds)
  } else {
    snippetTags.value = []
    allTags.value = []
  }
}

// 开始编辑标签
function startEditTab(index: number): void {
  editingTabIndex.value = index
  nextTick(() => {
    const input = document.querySelector(`.tab-label-input-${index}`) as HTMLInputElement
    if (input) {
      input.focus()
      input.select()
    }
  })
}

// 结束编辑标签
function endEditTab(): void {
  editingTabIndex.value = null
}

// Tab 右键菜单的 document 监听句柄（B12：卸载时清理，避免残留监听）
let closeTabMenuHandler: (() => void) | null = null

function removeTabMenuListener(): void {
  if (closeTabMenuHandler) {
    document.removeEventListener('click', closeTabMenuHandler)
    closeTabMenuHandler = null
  }
}

onBeforeUnmount(() => {
  removeTabMenuListener()
})

// 显示 Tab 右键菜单
function showTabContextMenu(event: MouseEvent, index: number): void {
  if (props.snippet?.contents.length === 1) return // 只有一个标签时不显示删除选项

  contextMenuPosition.value = { x: event.clientX, y: event.clientY }
  contextMenuTabIndex.value = index
  showContextMenu.value = true

  // 点击其他地方时关闭菜单
  removeTabMenuListener()
  const closeMenu = (): void => {
    showContextMenu.value = false
    removeTabMenuListener()
  }
  closeTabMenuHandler = closeMenu
  setTimeout(() => {
    document.addEventListener('click', closeMenu)
  }, 0)
}

// 处理重命名标签
function handleRenameTab(): void {
  if (contextMenuTabIndex.value !== null) {
    startEditTab(contextMenuTabIndex.value)
    showContextMenu.value = false
  }
}

// 处理删除标签
function handleDeleteTab(): void {
  if (contextMenuTabIndex.value !== null && props.snippet) {
    removeContent(contextMenuTabIndex.value)
    showContextMenu.value = false
  }
}

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
  if (currentSearchOverlay && editor) {
    editor.removeOverlay(currentSearchOverlay)
    currentSearchOverlay = null
  }
}

// 增加字体大小
function increaseFontSize(): void {
  if (settings.fontSize < 24) {
    settings.fontSize++
  }
}

// 减少字体大小
function decreaseFontSize(): void {
  if (settings.fontSize > 10) {
    settings.fontSize--
  }
}

// 切换主题
function toggleTheme(): void {
  isDark.value = !isDark.value
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

// 保存编辑器内容到 selectedSnippetContent
async function saveEditorContent(): Promise<void> {
  if (!editor || !props.snippet?.id || !selectedSnippetContent.value) return

  const currentValue = editor.getValue()
  const contentValue = selectedSnippetContent.value.value || ''

  // 如果内容有变化，立即保存
  if (currentValue !== contentValue) {
    // 创建干净的、可序列化的内容数组
    const updatedContents = props.snippet.contents.map((c) => {
      if (c.id === selectedSnippetContent.value!.id) {
        return {
          id: c.id,
          label: c.label,
          value: currentValue,
          language: c.language,
          contentType: c.contentType
        }
      }
      return {
        id: c.id,
        label: c.label,
        value: c.value,
        language: c.language,
        contentType: c.contentType
      }
    })

    // 创建干净的、可序列化的 snippet 对象
    const updatedSnippet: Snippet = {
      id: props.snippet.id,
      name: props.snippet.name,
      description: props.snippet.description || '',
      contents: updatedContents,
      folderId: props.snippet.folderId || null,
      tagIds: props.snippet.tagIds || [],
      isDeleted: props.snippet.isDeleted || false,
      isFavorites: props.snippet.isFavorites || false,
      createdAt: props.snippet.createdAt,
      updatedAt: props.snippet.updatedAt
    }

    emit('update:snippet', updatedSnippet)

    // 保存到数据库
    addToUpdateContentQueue(props.snippet.id, selectedSnippetContent.value.id, {
      label: selectedSnippetContent.value.label,
      value: currentValue,
      language: selectedSnippetContent.value.language
    })
  }
}

// 切换 JSON 可视化
async function toggleJsonVisualizer(): Promise<void> {
  // 在切换视图前先保存编辑器内容
  await saveEditorContent()
  isShowJsonVisualizer.value = !isShowJsonVisualizer.value
  isShowCodePreview.value = false
  isShowMarkdown.value = false
  isShowCodeScreenshot.value = false
}

// 切换代码截图
async function toggleCodeScreenshot(): Promise<void> {
  // 在切换视图前先保存编辑器内容
  await saveEditorContent()
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
    emit('update:snippet', snippet)
  }
}

// 格式化代码
async function formatCode(): Promise<void> {
  if (!editor || !selectedSnippetContent.value) return

  const availableLang = [
    'css',
    'html',
    'javascript',
    'json',
    'json5',
    'typescript',
    'scss',
    'yaml',
    'markdown',
    'xml'
  ]

  if (!availableLang.includes(selectedSnippetContent.value.language)) {
    return
  }

  const lang = selectedSnippetContent.value.language
  const value = selectedSnippetContent.value.value

  if (!value.trim()) return

  let parser = lang as string

  // 映射语言到 Prettier parser
  const parserMap: Record<string, string> = {
    javascript: 'babel',
    typescript: 'typescript',
    json: 'json',
    json5: 'json5',
    html: 'html',
    css: 'css',
    scss: 'scss',
    yaml: 'yaml',
    markdown: 'markdown',
    xml: 'html' // XML 使用 HTML parser
  }

  parser = parserMap[lang] || lang

  try {
    const formatted = await window.api.prettier.format(value, parser)
    if (formatted && formatted !== value) {
      setValue(formatted, false)
      // 更新内容
      if (props.snippet && selectedSnippetContent.value) {
        addToUpdateContentQueue(props.snippet.id, selectedSnippetContent.value.id, {
          label: selectedSnippetContent.value.label,
          value: formatted,
          language: selectedSnippetContent.value.language
        } as Partial<SnippetContent>)
      }
    }
  } catch (error) {
    console.error('格式化失败:', error)
  }
}

// 计算编辑器是否应该显示
const isEditorVisible = computed(() => {
  return (
    !isShowCodePreview.value &&
    !isShowMarkdown.value &&
    !isShowJsonVisualizer.value &&
    !isShowCodeScreenshot.value &&
    selectedSnippetContent.value !== null
  )
})

// 监听编辑器可见性变化，确保编辑器正确初始化
watch(isEditorVisible, (visible) => {
  if (visible) {
    // 当编辑器应该显示时，确保编辑器已初始化
    nextTick(() => {
      if (!editorRef.value) return

      // 检查编辑器实例是否存在且有效
      const editorExists = editor && editor.getWrapperElement()?.parentNode === editorRef.value

      if (!editorExists && selectedSnippetContent.value) {
        // 编辑器不存在或无效，重新初始化
        init()
      } else if (editor && selectedSnippetContent.value) {
        // 编辑器已存在，确保内容是最新的
        const currentValue = editor.getValue()
        const expectedValue = selectedSnippetContent.value.value || ''
        if (currentValue !== expectedValue) {
          setValue(expectedValue, true, true)
        }
        // 刷新编辑器以确保正确显示和可编辑
        editor.refresh()
        // 确保编辑器不是只读状态
        editor.setOption('readOnly', false)
      }
    })
  }
})

onMounted(() => {
  nextTick(() => {
    init()
    if (props.snippet) {
      loadTags()
    }
  })
})
</script>

<template>
  <!-- Markdown 演示模式（全屏显示） -->
  <MarkdownPresentation
    v-if="isShowMarkdownPresentation"
    :current-snippet="snippet || null"
    :all-snippets="allSnippets"
    @close="isShowMarkdownPresentation = false"
    @select-snippet="handleSelectSnippet"
  />

  <div v-else class="flex h-full flex-col overflow-hidden bg-surface-1">
    <div
      v-if="isEmpty || !isShowEditor"
      class="flex flex-1 items-center justify-center bg-surface-0"
    >
      <div class="text-center text-fg-muted">
        <AppIcon icon="ri-file-code-line" :size="56" class="mb-3 opacity-30" />
        <p class="m-0 text-sm">选择一个代码片段查看详情</p>
      </div>
    </div>

    <div v-else data-editor class="flex h-full flex-col">
      <!-- 头部 -->
      <div
        class="flex items-center justify-between border-b border-line-subtle bg-surface-1 px-4 py-3"
      >
        <div class="min-w-0 flex-1">
          <input
            :value="snippet?.name"
            type="text"
            class="w-full border-none bg-transparent p-0 text-lg font-semibold text-fg-primary outline-none placeholder:text-fg-muted"
            placeholder="未命名代码片段"
            @blur="(e) => updateName((e.target as HTMLInputElement).value)"
          />
        </div>
        <div class="flex shrink-0 items-center gap-1">
          <UTooltip content="收藏" position="bottom">
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-md transition-colors duration-fast"
              :class="
                snippet?.isFavorites
                  ? 'bg-warning/10 text-warning'
                  : 'text-fg-tertiary hover:bg-surface-hover hover:text-fg-primary'
              "
              @click="toggleFavorite"
            >
              <AppIcon :icon="snippet?.isFavorites ? 'ri-star-fill' : 'ri-star-line'" :size="17" />
            </button>
          </UTooltip>
          <UTooltip content="添加描述" position="bottom">
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-md transition-colors duration-fast"
              :class="
                isShowDescription
                  ? 'bg-brand-500/10 text-fg-brand'
                  : 'text-fg-tertiary hover:bg-surface-hover hover:text-fg-primary'
              "
              @click="isShowDescription = !isShowDescription"
            >
              <AppIcon icon="ri-text" :size="17" />
            </button>
          </UTooltip>
          <UTooltip content="添加代码块" position="bottom">
            <button
              type="button"
              class="flex size-8 items-center justify-center rounded-md text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
              @click="addContent"
            >
              <AppIcon icon="ri-add-line" :size="17" />
            </button>
          </UTooltip>
        </div>
      </div>

      <!-- 文本扩展触发词（M5.1）：任意应用中键入即展开为片段内容 -->
      <div class="border-b border-line-subtle bg-surface-0 px-4 py-2">
        <div class="flex items-center gap-2">
          <AppIcon icon="flashlight-line" :size="14" class="shrink-0 text-fg-muted" />
          <input
            :value="snippet?.trigger || ''"
            type="text"
            class="w-40 shrink-0 rounded-md border border-line-subtle bg-surface-1 px-2 py-1 font-mono text-xs text-fg-primary outline-none focus:border-brand-500/40"
            placeholder="触发词，如 ;sig"
            spellcheck="false"
            @change="(e) => updateTrigger((e.target as HTMLInputElement).value.trim())"
          />
          <span class="min-w-0 flex-1 truncate text-[11px] text-fg-faint">
            <!-- 待核：以下 416 行模板与样式由 2026-09-23 按同文件较早副本（_recovery-partials/zcode-older）回填，本 revision 若在此区间另有改动需人工比对 -->
            在任意应用键入该关键词再按空格/回车即展开第一块内容；支持占位符
            <code class="font-mono">{date}</code>
            <code class="font-mono">{time}</code>
            <code class="font-mono">{clipboard}</code>（需在启动器管理页开启）
          </span>
        </div>
      </div>

      <!-- 描述区域 -->
      <div
        v-if="isShowDescription || snippet?.description"
        class="border-b border-line-subtle bg-surface-0 px-4 py-2.5"
      >
        <textarea
          :value="snippet?.description || ''"
          class="max-h-[200px] min-h-[60px] w-full resize-none border-none bg-transparent font-sans text-[13px] leading-relaxed text-fg-secondary outline-none placeholder:text-fg-muted"
          placeholder="添加描述…"
          @blur="(e) => updateDescription((e.target as HTMLTextAreaElement).value)"
        />
      </div>

      <!-- 标签区域 -->
      <div class="border-b border-line-subtle bg-surface-0 px-4 py-2.5">
        <TagInput
          :model-value="snippetTags"
          :suggestions="allTags"
          @update:model-value="updateTags"
        />
      </div>

      <!-- 代码块标签栏 -->
      <div
        v-if="snippet?.contents && snippet.contents.length > 1"
        class="scrollbar-thin flex items-center gap-1 overflow-x-auto border-b border-line-subtle bg-surface-0 px-4 py-2"
      >
        <div
          v-for="(content, index) in snippet.contents"
          :key="content.id || index"
          class="group flex cursor-pointer items-center gap-1.5 rounded-md border px-3 py-1.5 transition-all duration-fast"
          :class="
            currentContentIndex === index
              ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
              : 'border-transparent text-fg-secondary hover:bg-surface-hover hover:text-fg-primary'
          "
          @click="switchContent(index)"
          @contextmenu.prevent="(e) => showTabContextMenu(e, index)"
        >
          <input
            v-if="editingTabIndex === index"
            :value="content.label"
            :class="`tab-label-input tab-label-input-${index}`"
            @click.stop
            @blur="
              (e) => {
                updateContentLabel(index, (e.target as HTMLInputElement).value)
                endEditTab()
              }
            "
            @keydown.esc="endEditTab"
            @keydown.enter="(e) => (e.target as HTMLInputElement).blur()"
          />
          <span v-else class="cursor-text select-none text-xs" @dblclick.stop="startEditTab(index)">
            {{ content.label }}
          </span>
          <button
            v-if="snippet.contents.length > 1"
            type="button"
            class="flex size-4 items-center justify-center rounded-sm text-fg-muted transition-colors duration-fast hover:bg-surface-active hover:text-fg-primary"
            @click.stop="removeContent(index)"
          >
            <AppIcon icon="ri-close-line" :size="12" />
          </button>
        </div>
      </div>

      <!-- Tab 右键菜单 -->
      <div
        v-if="showContextMenu"
        class="fixed z-[1000] min-w-36 overflow-hidden rounded-md border border-line-subtle bg-surface-3 py-1 shadow-lg"
        :style="{ left: contextMenuPosition.x + 'px', top: contextMenuPosition.y + 'px' }"
        @click.stop
      >
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-fg-secondary transition-colors duration-instant hover:bg-surface-hover hover:text-fg-primary"
          @click="handleRenameTab"
        >
          <AppIcon icon="ri-edit-line" :size="14" />
          <span>重命名</span>
        </button>
        <div class="my-1 h-px bg-line-subtle" />
        <button
          type="button"
          class="flex w-full items-center gap-2 px-3.5 py-2 text-left text-[13px] text-danger transition-colors duration-instant hover:bg-danger/8"
          @click="handleDeleteTab"
        >
          <AppIcon icon="ri-delete-bin-line" :size="14" />
          <span>删除</span>
        </button>
      </div>

      <!-- 编辑器区域 -->
      <div class="flex min-h-0 flex-1 flex-col overflow-hidden">
        <!-- 代码预览 -->
        <div
          v-if="isShowCodePreview && hasPreviewContent && snippet"
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <CodePreview :snippet="snippet" @close="isShowCodePreview = false" />
        </div>

        <!-- Markdown 预览 -->
        <div
          v-else-if="isShowMarkdown && hasMarkdownContent"
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <MarkdownPreview :content="selectedSnippetContent" @close="isShowMarkdown = false" />
        </div>

        <!-- JSON 可视化 -->
        <div
          v-else-if="isShowJsonVisualizer && hasJsonContent"
          class="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <JsonVisualizer
            :content="
              selectedSnippetContent
                ? {
                    id: selectedSnippetContent.id,
                    label: selectedSnippetContent.label,
                    value: selectedSnippetContent.value,
                    language: selectedSnippetContent.language
                  }
                : null
            "
            @close="isShowJsonVisualizer = false"
          />
        </div>

        <!-- 代码截图 -->
        <div v-else-if="isShowCodeScreenshot" class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <CodeScreenshot
            :content="
              selectedSnippetContent
                ? {
                    id: selectedSnippetContent.id,
                    label: selectedSnippetContent.label,
                    value: selectedSnippetContent.value,
                    language: selectedSnippetContent.language
                  }
                : null
            "
            @close="isShowCodeScreenshot = false"
          />
        </div>

        <!-- 编辑器 -->
        <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
          <!-- 搜索框 -->
          <div
            v-if="searchQuery || isFocusedSearch"
            class="flex items-center gap-2 border-b border-line-subtle bg-surface-0 px-4 py-2"
          >
            <!-- 保持原生 input：脚本通过 searchInputRef 调 focus()/select()，
                 换成组件实例后 ref 不再指向 DOM 元素会导致聚焦失效 -->
            <input
              ref="searchInputRef"
              v-model="searchQuery"
              type="text"
              placeholder="搜索…"
              class="h-8 min-w-0 flex-1 rounded-md border border-line-subtle bg-surface-1 px-3 text-[13px] text-fg-primary outline-none transition-all duration-fast focus-visible:border-brand-500/50 focus-visible:shadow-ring-focus"
              @blur="isFocusedSearch = false"
              @keydown.esc="clearSearch"
            />
            <button
              type="button"
              class="flex size-8 shrink-0 items-center justify-center rounded-md text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
              @click="clearSearch"
            >
              <AppIcon icon="ri-close-line" :size="16" />
            </button>
          </div>

          <div v-if="selectedSnippetContent" class="flex min-h-0 flex-1 flex-col overflow-hidden">
            <!-- 工具条 -->
            <div
              class="flex flex-wrap items-center gap-1.5 border-b border-line-subtle bg-surface-0 px-4 py-2"
            >
              <USelect
                :model-value="selectedSnippetContent.language"
                :options="languageOptions"
                class="w-36"
                @update:model-value="updateLanguage(String($event))"
              />

              <USelect
                :model-value="selectedSnippetContent.contentType ?? 'text'"
                :options="[
                  { label: '纯文本', value: 'text' },
                  { label: '富文本 (HTML)', value: 'rich' }
                ]"
                class="w-36"
                @update:model-value="updateContentType($event as 'text' | 'rich')"
              />

              <div
                class="flex items-center gap-1 rounded-md border border-line-subtle bg-surface-1 px-1 py-0.5"
              >
                <button
                  type="button"
                  title="减小字体"
                  class="flex size-6 items-center justify-center rounded-sm text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
                  @click="decreaseFontSize"
                >
                  <AppIcon icon="ri-subtract-line" :size="14" />
                </button>
                <span class="min-w-8 text-center font-mono text-[11px] text-fg-secondary">
                  {{ settings.fontSize }}px
                </span>
                <button
                  type="button"
                  title="增大字体"
                  class="flex size-6 items-center justify-center rounded-sm text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
                  @click="increaseFontSize"
                >
                  <AppIcon icon="ri-add-line" :size="14" />
                </button>
              </div>

              <div class="mx-1 h-5 w-px bg-line-subtle" />

              <UTooltip content="代码预览" position="bottom">
                <button
                  v-if="hasPreviewContent"
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md border transition-colors duration-fast"
                  :class="
                    isShowCodePreview
                      ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
                      : 'border-transparent text-fg-tertiary hover:bg-surface-hover hover:text-fg-primary'
                  "
                  @click="toggleCodePreview"
                >
                  <AppIcon icon="ri-eye-line" :size="16" />
                </button>
              </UTooltip>
              <UTooltip content="Markdown 预览" position="bottom">
                <button
                  v-if="hasMarkdownContent"
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md border transition-colors duration-fast"
                  :class="
                    isShowMarkdown
                      ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
                      : 'border-transparent text-fg-tertiary hover:bg-surface-hover hover:text-fg-primary'
                  "
                  @click="toggleMarkdown"
                >
                  <AppIcon icon="ri-markdown-line" :size="16" />
                </button>
              </UTooltip>
              <UTooltip content="演示模式" position="bottom">
                <button
                  v-if="hasMarkdownContent"
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md border transition-colors duration-fast"
                  :class="
                    isShowMarkdownPresentation
                      ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
                      : 'border-transparent text-fg-tertiary hover:bg-surface-hover hover:text-fg-primary'
                  "
                  @click="toggleMarkdownPresentation"
                >
                  <AppIcon icon="ri-slideshow-line" :size="16" />
                </button>
              </UTooltip>
              <UTooltip content="JSON 可视化" position="bottom">
                <button
                  v-if="hasJsonContent"
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md border transition-colors duration-fast"
                  :class="
                    isShowJsonVisualizer
                      ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
                      : 'border-transparent text-fg-tertiary hover:bg-surface-hover hover:text-fg-primary'
                  "
                  @click="toggleJsonVisualizer"
                >
                  <AppIcon icon="ri-node-tree" :size="16" />
                </button>
              </UTooltip>
              <UTooltip content="代码截图" position="bottom">
                <button
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md border transition-colors duration-fast"
                  :class="
                    isShowCodeScreenshot
                      ? 'border-brand-500/40 bg-brand-500/10 text-fg-brand'
                      : 'border-transparent text-fg-tertiary hover:bg-surface-hover hover:text-fg-primary'
                  "
                  @click="toggleCodeScreenshot"
                >
                  <AppIcon icon="ri-image-line" :size="16" />
                </button>
              </UTooltip>

              <div class="mx-1 h-5 w-px bg-line-subtle" />

              <UTooltip content="切换主题" position="bottom">
                <button
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
                  @click="toggleTheme"
                >
                  <AppIcon :icon="isDark ? 'ri-sun-line' : 'ri-moon-line'" :size="16" />
                </button>
              </UTooltip>
              <UTooltip content="搜索 (⌘/Ctrl+F)" position="bottom">
                <button
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
                  @click="isFocusedSearch = true"
                >
                  <AppIcon icon="ri-search-line" :size="16" />
                </button>
              </UTooltip>
              <UTooltip content="格式化代码 (⌘/Ctrl+Shift+F)" position="bottom">
                <button
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
                  @click="formatCode"
                >
                  <AppIcon icon="ri-code-s-slash-line" :size="16" />
                </button>
              </UTooltip>
              <UTooltip content="复制" position="bottom">
                <button
                  type="button"
                  class="flex size-8 items-center justify-center rounded-md text-fg-tertiary transition-colors duration-fast hover:bg-surface-hover hover:text-fg-primary"
                  @click="copyCode"
                >
                  <AppIcon icon="ri-file-copy-line" :size="16" />
                </button>
              </UTooltip>
            </div>

            <div ref="editorRef" class="min-h-0 flex-1 overflow-hidden" />
          </div>
        </div>
      </div>

      <!-- 底部状态栏 -->
      <div
        class="flex shrink-0 items-center justify-between border-t border-line-subtle bg-surface-0 px-4 py-2 text-xs text-fg-tertiary"
      >
        <span class="capitalize">{{ selectedSnippetContent?.language || 'Plain Text' }}</span>
        <span class="font-mono">
          行 {{ cursorPosition.row + 1 }}, 列 {{ cursorPosition.column + 1 }}
        </span>
      </div>
    </div>
  </div>
</template>

<style scoped>
/* Tab 内联重命名输入框（宽度约束，其余样式走 token） */
.tab-label-input {
  border: none;
  outline: none;
  background: transparent;
  font-size: 12px;
  padding: 0;
  min-width: 60px;
  max-width: 120px;
  color: inherit;
}
</style>

<style>
/* CodeMirror 容器：旧版写死 white !important，导致暗色主题下编辑器仍是白底
   （主题切换只换了 CodeMirror 主题类，背景被这条规则覆盖）→ 改为跟随 token */
.CodeMirror {
  font-size: var(--editor-font-size, 14px);
  font-family: 'Monaco', 'Menlo', 'Ubuntu Mono', monospace;
  line-height: calc(var(--editor-font-size, 14px) * 1.5);
  height: 100%;
  background-color: var(--surface-1) !important;
  color: var(--text-primary) !important;
}

.CodeMirror-gutters {
  background-color: var(--surface-0) !important;
  border-right: 1px solid var(--border-subtle) !important;
}

.CodeMirror-linenumber {
  color: var(--text-muted) !important;
}

.CodeMirror-cursor {
  border-left: 2px solid var(--text-primary) !important;
  background-color: transparent !important;
}

.CodeMirror-selected {
  background-color: var(--surface-active) !important;
}

.CodeMirror .cm-searching {
  background-color: var(--warning) !important;
  color: var(--surface-0) !important;
  border-radius: 2px;
  padding: 1px 2px;
}
</style>
