  height?: number
  pinned?: boolean
  sourceApp?: string
  /** 图片条目的 OCR 文本（异步回填，可能暂缺） */
  ocrText?: string
  /** P0-3：用户备注关键词（补充索引，可搜索） */
  keywords?: string[]
  createdAt: number
}

export type DateGroupKey = 'today' | 'yesterday' | 'earlier'
export type GroupKey = 'pinned' | DateGroupKey
