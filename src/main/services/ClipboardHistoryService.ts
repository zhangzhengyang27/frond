  }

  togglePin(id: string): boolean {
    const item = this.items.find((i) => i.id === id)
    if (!item) return false
    item.pinned = !item.pinned
    this.persist()
    return true
  }

  /**
   * 设置条目的用户备注关键词（P0-3：补充索引，搜索时可命中）。
   * 清洗：trim / 去空 / 去重 / 单个 ≤30 字符 / 总数 ≤10；空数组视为清除。
   */
  setKeywords(id: string, raw: string[]): boolean {
    const item = this.items.find((i) => i.id === id)
    if (!item) return false
    const cleaned: string[] = []
    for (const r of Array.isArray(raw) ? raw : []) {
      if (typeof r !== 'string') continue
      const k = r.trim().slice(0, 30)
      if (k && !cleaned.includes(k)) cleaned.push(k)
      if (cleaned.length >= 10) break
    }
    if (cleaned.length > 0) item.keywords = cleaned
    else delete item.keywords
    this.persist()
    return true
  }

  /** 把指定历史条目写回系统剪贴板 */
  copy(id: string): boolean {
    const item = this.items.find((i) => i.id === id)
    if (!item) return false
    if ((item.kind === 'text' || item.kind === 'link') && item.text !== undefined) {
      clipboard.writeText(item.text)
      this.lastTextFingerprint = this.fingerprintText(item.text)
    } else if (item.kind === 'files' && item.paths?.length) {
      this.writeFilesToClipboard(item.paths)
      this.lastFilesFingerprint = this.fingerprintFiles(item.paths)
    } else if (item.kind === 'image' && item.filePath && existsSync(item.filePath)) {
      const img = nativeImage.createFromPath(item.filePath)
      if (!img.isEmpty()) {
        clipboard.writeImage(img)
        this.lastImageFingerprint = this.fingerprintImage(img)
      }
    }
    return true
  }
