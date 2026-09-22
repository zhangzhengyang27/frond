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

// 过期请求守卫：mode/关键词切换后，慢的旧响应不得覆盖新结果
let searchSeq = 0

async function runSearch(q: string): Promise<void> {
  const seq = ++searchSeq
  loading.value = true
  try {
    const result = await window.api.fileSearch.query(q, 30, {
      mode: mode.value,
      onlyIn: onlyIn.value.trim() || undefined
    })
    if (seq !== searchSeq) return
    supported.value = result.supported
    items.value = result.items ?? []
  } catch {
    if (seq !== searchSeq) return
    items.value = []
  } finally {
    if (seq === searchSeq) {
      loading.value = false
    }
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
