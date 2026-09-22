const { folders: allFolders, folderTree, findFolderById } = useFolders()

const snippets = ref<Snippet[]>([])
const searchInput = ref('')
// 防抖后的搜索词：filteredSnippets 只消费它，每次键入不再全量扫描片段全文
const debouncedSearch = ref('')
// 搜索输入防抖定时器（卸载时 flush/clear，见下方 onBeforeUnmount）
let searchDebounceTimer: number | null = null

// 右键菜单相关状态
const showContextMenu = ref(false)
const contextMenuPosition = ref({ x: 0, y: 0 })
