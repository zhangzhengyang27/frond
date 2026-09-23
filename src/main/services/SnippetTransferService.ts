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
export function buildExportPayload(list: TransferableSnippet[]): SnippetExportFile {
  return {
    app: 'leaf',
    kind: 'snippets',
    version: SNIPPET_EXPORT_VERSION,
    exportedAt: Date.now(),
    snippets: list.map((s) => {
      const out: ExportedSnippet = {
        id: s.id,
        name: s.name,
        contents: s.contents.map((c) => ({
          id: c.id,
          label: c.label,
          value: c.value,
          language: c.language,
          contentType: c.contentType === 'rich' ? 'rich' : 'text'
        })),
        folderId: s.folderId ?? null,
        tagIds: [...s.tagIds],
        isDeleted: s.isDeleted === true,
        isFavorites: s.isFavorites === true,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt
      }
      if (typeof s.description === 'string') out.description = s.description
      if (typeof s.trigger === 'string') out.trigger = s.trigger
      return out
    })
  }
}

/** 解析结果：文件级失败给 error；条目级问题只丢该条（不进 error，避免一个坏条目否定整份文件） */
export type ParseImportResult =
  | { ok: true; snippets: ExportedSnippet[] }
  | { ok: false; error: string }

export function parseImportPayload(raw: unknown): ParseImportResult {
  let parsed: unknown
  try {
    parsed = JSON.parse(typeof raw === 'string' ? raw : String(raw))
  } catch {
    return { ok: false, error: '文件不是合法 JSON' }
  }
  if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed)) {
    return { ok: false, error: '文件结构不正确：应为对象' }
  }
  const snippets = (parsed as { snippets?: unknown }).snippets
  if (!Array.isArray(snippets)) {
    return { ok: false, error: '文件结构不正确：缺少 snippets 数组' }
  }
  const out: ExportedSnippet[] = []
  for (const item of snippets) {
    const s = toExportedSnippet(item)
    if (s) out.push(s)
  }
  return { ok: true, snippets: out }
}

/** 单条归一：任何必填字段不合规格就整条返回 null（宁可少导一条，不导进一条结构不完整的片段） */
function toExportedSnippet(item: unknown): ExportedSnippet | null {
  if (typeof item !== 'object' || item === null) return null
  const rec = item as Record<string, unknown>
  if (typeof rec.id !== 'string' || rec.id === '') return null
  if (typeof rec.name !== 'string' || rec.name === '') return null
  if (!Array.isArray(rec.contents)) return null
  if (typeof rec.createdAt !== 'number' || typeof rec.updatedAt !== 'number') return null

  const contents: ExportedSnippet['contents'] = []
  for (const c of rec.contents) {
    if (typeof c !== 'object' || c === null) continue
    const cRec = c as Record<string, unknown>
    if (typeof cRec.value !== 'string') continue
    contents.push({
      id: typeof cRec.id === 'string' ? cRec.id : '',
      label: typeof cRec.label === 'string' ? cRec.label : '',
      value: cRec.value,
      language: typeof cRec.language === 'string' && cRec.language !== '' ? cRec.language : 'plaintext',
      contentType: cRec.contentType === 'rich' ? 'rich' : 'text'
    })
  }

  const out: ExportedSnippet = {
    id: rec.id,
    name: rec.name,
    contents,
    tagIds: Array.isArray(rec.tagIds) ? rec.tagIds.filter((t): t is string => typeof t === 'string') : [],
    isDeleted: rec.isDeleted === true,
    isFavorites: rec.isFavorites === true,
    createdAt: rec.createdAt,
    updatedAt: rec.updatedAt,
    folderId: typeof rec.folderId === 'string' ? rec.folderId : null
  }
  if (typeof rec.description === 'string') out.description = rec.description
  if (typeof rec.trigger === 'string') out.trigger = rec.trigger
  return out
}

/**
 * 去重切分：existingIds 必须含回收站内的 id —— 回收站里的片段用户随时可能恢复，
 * 同 id 再导一份会变成两条同名片段，跳过比制造重复好。
 */
export function partitionForImport(
  snippets: ExportedSnippet[],
  existingIds: Set<string>
): { toImport: ExportedSnippet[]; skipped: number } {
  const toImport = snippets.filter((s) => !existingIds.has(s.id))
  return { toImport, skipped: snippets.length - toImport.length }
}
