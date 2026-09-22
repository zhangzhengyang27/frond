~~~ 第 1 行未留存 ~~~
~~~ 第 2 行未留存 ~~~
~~~ 第 3 行未留存 ~~~
~~~ 第 4 行未留存 ~~~
~~~ 第 5 行未留存 ~~~
~~~ 第 6 行未留存 ~~~
~~~ 第 7 行未留存 ~~~
~~~ 第 8 行未留存 ~~~
~~~ 第 9 行未留存 ~~~
~~~ 第 10 行未留存 ~~~
~~~ 第 11 行未留存 ~~~
~~~ 第 12 行未留存 ~~~
~~~ 第 13 行未留存 ~~~
~~~ 第 14 行未留存 ~~~
~~~ 第 15 行未留存 ~~~
~~~ 第 16 行未留存 ~~~
~~~ 第 17 行未留存 ~~~
~~~ 第 18 行未留存 ~~~
~~~ 第 19 行未留存 ~~~
~~~ 第 20 行未留存 ~~~
~~~ 第 21 行未留存 ~~~
~~~ 第 22 行未留存 ~~~
~~~ 第 23 行未留存 ~~~
~~~ 第 24 行未留存 ~~~
~~~ 第 25 行未留存 ~~~
~~~ 第 26 行未留存 ~~~
~~~ 第 27 行未留存 ~~~
~~~ 第 28 行未留存 ~~~
~~~ 第 29 行未留存 ~~~
~~~ 第 30 行未留存 ~~~
~~~ 第 31 行未留存 ~~~
~~~ 第 32 行未留存 ~~~
~~~ 第 33 行未留存 ~~~
~~~ 第 34 行未留存 ~~~
~~~ 第 35 行未留存 ~~~
~~~ 第 36 行未留存 ~~~
~~~ 第 37 行未留存 ~~~
~~~ 第 38 行未留存 ~~~
~~~ 第 39 行未留存 ~~~
~~~ 第 40 行未留存 ~~~
~~~ 第 41 行未留存 ~~~
~~~ 第 42 行未留存 ~~~
~~~ 第 43 行未留存 ~~~
~~~ 第 44 行未留存 ~~~
~~~ 第 45 行未留存 ~~~
~~~ 第 46 行未留存 ~~~
~~~ 第 47 行未留存 ~~~
~~~ 第 48 行未留存 ~~~
~~~ 第 49 行未留存 ~~~
~~~ 第 50 行未留存 ~~~
~~~ 第 51 行未留存 ~~~
~~~ 第 52 行未留存 ~~~
~~~ 第 53 行未留存 ~~~
~~~ 第 54 行未留存 ~~~
~~~ 第 55 行未留存 ~~~
~~~ 第 56 行未留存 ~~~
~~~ 第 57 行未留存 ~~~
~~~ 第 58 行未留存 ~~~
~~~ 第 59 行未留存 ~~~
~~~ 第 60 行未留存 ~~~
~~~ 第 61 行未留存 ~~~
~~~ 第 62 行未留存 ~~~
~~~ 第 63 行未留存 ~~~
~~~ 第 64 行未留存 ~~~
~~~ 第 65 行未留存 ~~~
~~~ 第 66 行未留存 ~~~
~~~ 第 67 行未留存 ~~~
~~~ 第 68 行未留存 ~~~
~~~ 第 69 行未留存 ~~~
~~~ 第 70 行未留存 ~~~
~~~ 第 71 行未留存 ~~~
~~~ 第 72 行未留存 ~~~
~~~ 第 73 行未留存 ~~~
~~~ 第 74 行未留存 ~~~
~~~ 第 75 行未留存 ~~~
~~~ 第 76 行未留存 ~~~
~~~ 第 77 行未留存 ~~~
~~~ 第 78 行未留存 ~~~
~~~ 第 79 行未留存 ~~~
~~~ 第 80 行未留存 ~~~
~~~ 第 81 行未留存 ~~~
~~~ 第 82 行未留存 ~~~
~~~ 第 83 行未留存 ~~~
~~~ 第 84 行未留存 ~~~
~~~ 第 85 行未留存 ~~~
~~~ 第 86 行未留存 ~~~
~~~ 第 87 行未留存 ~~~
~~~ 第 88 行未留存 ~~~
~~~ 第 89 行未留存 ~~~
~~~ 第 90 行未留存 ~~~
~~~ 第 91 行未留存 ~~~
~~~ 第 92 行未留存 ~~~
~~~ 第 93 行未留存 ~~~
~~~ 第 94 行未留存 ~~~
const loading = ref(false)
const supported = ref(true)
const selectedIndex = ref(0)
/** 搜索模式：文件名（-name）/ 全文（内容与元数据，较慢） */
const mode = ref<'name' | 'content'>('name')
/** 限定目录（可选）：填绝对路径时加 mdfind -onlyin */
const onlyIn = ref('')
let searchTimer: ReturnType<typeof setTimeout> | null = null

const selected = computed(() => items.value[selectedIndex.value] ?? null)

const hints = [
  { keys: '↵', label: '打开' },
  { keys: '⌘R', label: '在 Finder 显示' },
  { keys: '⌘C', label: '复制路径' },
  { keys: 'ESC', label: '返回' }
]

/** 根据文件扩展名返回对应图标 */
function fileIcon(name: string): string {
  const ext = name.split('.').pop()?.toLowerCase() ?? ''
  const iconMap: Record<string, string> = {
    // 图片
    png: 'image-line',
    jpg: 'image-line',
    jpeg: 'image-line',
    gif: 'image-line',
    svg: 'image-line',
    webp: 'image-line',
    bmp: 'image-line',
    ico: 'image-line',
    // 文档
    pdf: 'file-pdf-line',
    doc: 'file-text-line',
    docx: 'file-text-line',
    txt: 'file-text-line',
    md: 'file-text-line',
    rtf: 'file-text-line',
    // 表格
    xls: 'file-excel-line',
    xlsx: 'file-excel-line',
    csv: 'file-excel-line',
    // 演示
    ppt: 'file-ppt-line',
    pptx: 'file-ppt-line',
    key: 'file-ppt-line',
    // 代码
    js: 'code-line',
    ts: 'code-line',
    jsx: 'code-line',
    tsx: 'code-line',
    py: 'code-line',
    java: 'code-line',
    c: 'code-line',
    cpp: 'code-line',
    h: 'code-line',
    go: 'code-line',
    rs: 'code-line',
    rb: 'code-line',
    php: 'code-line',
    swift: 'code-line',
    kt: 'code-line',
    json: 'braces-line',
    xml: 'code-line',
    html: 'code-line',
    css: 'code-line',
    scss: 'code-line',
    less: 'code-line',
    vue: 'code-line',
    sql: 'code-line',
    sh: 'terminal-line',
    bash: 'terminal-line',
    zsh: 'terminal-line',
    // 压缩
    zip: 'file-zip-line',
    rar: 'file-zip-line',
    '7z': 'file-zip-line',
    tar: 'file-zip-line',
    gz: 'file-zip-line',
    // 视频
    mp4: 'film-line',
    mov: 'film-line',
    avi: 'film-line',
    mkv: 'film-line',
    flv: 'film-line',
    wmv: 'film-line',
    webm: 'film-line',
    // 音频
    mp3: 'music-line',
    wav: 'music-line',
    flac: 'music-line',
    aac: 'music-line',
    ogg: 'music-line',
    m4a: 'music-line',
    // 字体
    ttf: 'font-size',
    otf: 'font-size',
    woff: 'font-size',
    woff2: 'font-size',
    // 可执行
    app: 'app-line',
    exe: 'app-line',
    dmg: 'hard-drive-line',
    pkg: 'hard-drive-line',
    msi: 'hard-drive-line',
    // 设计
    psd: 'palette-line',
    ai: 'palette-line',
    sketch: 'palette-line',
    fig: 'palette-line',
    xd: 'palette-line'
  }
  return iconMap[ext] ?? 'file-line'
}

/** 格式化文件大小 */
function formatSize(bytes?: number): string {
  if (bytes === undefined || bytes === null) return ''
  if (bytes < 1024) return bytes + ' B'
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
  if (bytes < 1024 * 1024 * 1024) return (bytes / (1024 * 1024)).toFixed(1) + ' MB'
  return (bytes / (1024 * 1024 * 1024)).toFixed(1) + ' GB'
}

/** 格式化修改时间 */
function formatTime(ts?: number): string {
  if (!ts) return ''
  const d = new Date(ts)
  const now = new Date()
  if (d.toDateString() === now.toDateString()) {
    return d.toLocaleTimeString('zh-CN', { hour: '2-digit', minute: '2-digit' })
  }
  return d.toLocaleDateString('zh-CN', { month: '2-digit', day: '2-digit' })
}

watch([() => props.query, mode, onlyIn], ([q]) => {
  selectedIndex.value = 0
  if (searchTimer) clearTimeout(searchTimer)
  if (!q.trim()) {
    items.value = []
    return
  }
  // 300ms 防抖后走 mdfind
  searchTimer = setTimeout(() => {
    void runSearch(q)
  }, 300)
})

async function runSearch(q: string): Promise<void> {
  loading.value = true
  try {
    const result = await window.api.fileSearch.query(q, 30, {
      mode: mode.value,
      onlyIn: onlyIn.value.trim() || undefined
    })
    supported.value = result.supported
    items.value = result.items ?? []
  } catch {
    items.value = []
  } finally {
    loading.value = false
  }
}

function openSelected(): void {
  const item = selected.value
  if (!item) return
  void window.api.system.openPath(item.path)
  window.api.launcher.hide()
}

function revealSelected(): void {
  const item = selected.value
  if (!item) return
  void window.api.fileSearch.reveal(item.path)
  window.api.launcher.hide()
}

function copyPath(): void {
  const item = selected.value
  if (!item) return
  navigator.clipboard.writeText(item.path).catch(() => {
    /* 剪贴板写入失败时静默 */
  })
}

function moveSelection(delta: number): void {
  if (items.value.length === 0) return
  selectedIndex.value = (selectedIndex.value + delta + items.value.length) % items.value.length
  document
    .querySelectorAll('.files-item')
    [selectedIndex.value]?.scrollIntoView({ block: 'nearest' })
}

/** 键盘分发（LauncherApp 集中转发）；返回 true 表示已消费 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'ArrowDown') {
    moveSelection(1)
    return true
  }
  if (e.key === 'ArrowUp') {
    moveSelection(-1)
    return true
  }
  if (e.key === 'Enter') {
    openSelected()
    return true
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'r' || e.key === 'R')) {
    revealSelected()
    return true
  }
  if ((e.metaKey || e.ctrlKey) && (e.key === 'c' || e.key === 'C')) {
    copyPath()
    return true
  }
  return false
}

defineExpose({ handleKey })
