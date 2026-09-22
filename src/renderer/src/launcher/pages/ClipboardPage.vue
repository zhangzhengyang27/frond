  const item = selected.value
  if (!item) return
  const ok = await window.api.clipHist.copy(item.id)
  if (ok) flash('已复制到剪贴板')
}

async function pinSelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  await window.api.clipHist.togglePin(item.id)
  item.pinned = !item.pinned
  flash(item.pinned ? '已置顶' : '已取消置顶')
}

async function removeSelected(): Promise<void> {
  const item = selected.value
  if (!item) return
  await window.api.clipHist.remove(item.id)
  items.value = items.value.filter((i) => i.id !== item.id)
  if (selectedIndex.value >= filtered.value.length) {
    selectedIndex.value = Math.max(0, filtered.value.length - 1)
  }
}

// ───── P0-3：备注关键词编辑（补充索引，根搜索与本页筛选均可命中）─────
const keywordEditing = ref(false)
const keywordDraft = ref('')
const keywordInputRef = ref<HTMLInputElement | null>(null)

function startKeywordEdit(): void {
  keywordDraft.value = (selected.value?.keywords ?? []).join(' ')
  keywordEditing.value = true
  void nextTick(() => keywordInputRef.value?.focus())
}

async function saveKeywords(): Promise<void> {
  if (!keywordEditing.value || !selected.value) return
  const item = selected.value
  const keywords = keywordDraft.value.split(/[\s,，、]+/).filter(Boolean)
  keywordEditing.value = false
  try {
    await window.api.clipHist.setKeywords(item.id, keywords)
    const target = items.value.find((i) => i.id === item.id)
    if (target) target.keywords = keywords
    flash(keywords.length ? '关键词已保存' : '关键词已清除')
  } catch {
    /* 保存失败静默：重开页面回读真实值 */
  }
}

/** 识别图片条目二维码：成功后文本已在剪贴板（主进程回填），flash 提示 */
async function decodeQrOf(item: ClipItem): Promise<void> {
  if (!item.filePath) return
  const result = await window.api.clipHist.decodeQr(item.id)
  if (result.ok && result.text) {
    flash(
      `已复制二维码文本：${result.text.length > 24 ? result.text.slice(0, 24) + '…' : result.text}`
    )
  } else {
    flash(result.error ?? '未识别到二维码')
  }
}

/** 按条目类型组装 AI 加工提示词（仅发送单条内容） */
function aiProcess(item: ClipItem): void {
  if (item.kind === 'image') {
