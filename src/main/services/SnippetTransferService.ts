/**
 * Leaf · 片段导入导出服务（B3，对齐 Raycast Snippets Import/Export）
 *
 * - snippet:exportAll：showSaveDialog 选路径 → 全部片段导出为 JSON 文件
 * - snippet:importFile：showOpenDialog 选 JSON → 校验结构 → 幂等去重导入
 *   （对话框 + 仓库读写粘合层在 ipc/snippets.ts，本文件只放类型与纯逻辑）
 *
 * 导出结构 {app, kind, version, exportedAt, snippets[]}，snippets 形态与
 * SnippetRepository.Snippet（S3 snippet 表）逐字段结构对齐，importMany 直接可吃；
 * 历史旧版 JSON（仅含 snippets 数组的简化文件）只要字段合法也接受。
 *
 * 纯逻辑（结构校验 / 默认值归一 / 去重切分）独立导出供单测覆盖。
 * 注意：本文件被 preload/index.d.ts 引用类型，会进入 web tsconfig 程序，
 * 因此不得 import electron / node 模块 / 仓库实现（只保留无依赖纯逻辑）。
 */

export const SNIPPET_EXPORT_VERSION = 1

/** 导出文件中的一条片段（与 SnippetRepository.Snippet 结构对齐） */
export interface ExportedSnippet {
  id: string
  name: string
  description?: string
  contents: Array<{
    id: string
    label: string
    value: string
    language: string
    contentType?: 'text' | 'rich'
  }>
  /** 文本扩展触发词（如 ";brb"）；空 = 不参与全局扩展 */
  trigger?: string
  folderId?: string | null
  tagIds: string[]
  isDeleted: boolean
  isFavorites: boolean
  createdAt: number
  updatedAt: number
}

/** 导出 JSON 文件结构 */
export interface SnippetExportFile {
  app: 'leaf'
  kind: 'snippets'
  version: number
  /** 导出时间（epoch ms） */
  exportedAt: number
  snippets: ExportedSnippet[]
}

/** 导入结果：imported = 新写入条数；skipped = 同 id 去重跳过 + 结构不完整丢弃 */
export interface SnippetImportResult {
  imported: number
  skipped: number
  /** 文件中解析出的总条数（含 skipped） */
  total: number
}

// ─── 纯逻辑（单测覆盖）───

/** 仓库片段的最小结构投影（结构兼容 SnippetRepository.Snippet，避免跨层 import） */
export interface TransferableSnippet {
  id: string
  name: string
  description?: string
  contents: Array<{
    id: string
    label: string
    value: string
    language: string
    contentType?: 'text' | 'rich'
  }>
  trigger?: string
  folderId?: string | null
  tagIds: string[]
  isDeleted: boolean
  isFavorites: boolean
  createdAt: number
  updatedAt: number
}

/** 由仓库片段构建导出文件负载（保持传入顺序，字段显式投影避免夹带内部字段） */
