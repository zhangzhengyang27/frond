import { BrowserWindow, clipboard, type IpcMainInvokeEvent } from 'electron'
import { readFile, writeFile, stat } from 'fs/promises'
import type { Snippet, SnippetDataStore } from '../stores/SnippetDataStore'
import { snippetRepository } from '../db/repos/SnippetRepository'
import { textExpansion } from '../modules/textExpansion'
import { showOpenDialogFor, showSaveDialogFor } from '../modules/dialogs'
import { getLauncherWindow } from '../launcher/window'
import { pasteToActiveApp, PASTE_DELAY_MS } from '../utils/pasteKeystroke'
import {
  buildExportPayload,
  parseImportPayload,
  partitionForImport,
  type SnippetImportResult
} from '../services/SnippetTransferService'
import { typedHandle } from './typedIpc'

/** 导入文件大小上限：超大 JSON 在主进程同步 JSON.parse 会冻结全应用 */
const SNIPPET_IMPORT_MAX_BYTES = 20 * 1024 * 1024

/** B56-4：contents 入参验型——非数组/缺 value 的条目剔除，id 由 repo 生成 */
function sanitizeContents(raw: unknown): Array<{ id: string; label: string; value: string; language: string; contentType: 'rich' | 'text' }> {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((c): c is Record<string, unknown> => !!c && typeof c === 'object' && typeof (c as { value?: unknown }).value === 'string')
    .map((c) => {
      const contentType = (c as { contentType?: unknown }).contentType === 'rich' ? ('rich' as const) : ('text' as const)
      return {
        id: typeof (c as { id?: unknown }).id === 'string' ? (c as { id: string }).id : '',
        label: typeof (c as { label?: unknown }).label === 'string' ? (c as { label: string }).label : '代码',
        value: (c as { value: string }).value,
        language: typeof (c as { language?: unknown }).language === 'string' ? (c as { language: string }).language : 'plaintext',
        contentType
      }
    })
}

/** B56-5：片段变更广播（所有窗口的胶囊片段页/列表即时失效） */
function broadcastSnippetsChanged(): void {
  for (const w of BrowserWindow.getAllWindows()) {
    if (!w.isDestroyed()) w.webContents.send('snippets:changed', null)
  }
}

export function registerSnippetIpcHandlers(snippetStore: SnippetDataStore): void {
  // B53-3b：胶囊根搜索轻路径（LIMIT + 不解密 contents）
  typedHandle('snippet:quickSearch', (_event, { query, limit }) =>
    snippetRepository.quickSearch(String(query ?? ''), Math.min(Math.max(Number(limit) || 3, 1), 10))
  )
  typedHandle('snippet:getSnippets', (_event, { filters }) => snippetStore.getSnippets(filters))

  // B56-10：limit/offset 运行时钳制——SQLite 语义下 LIMIT <=0 = 不限行数，
  // 异常值会让主进程单次全库解密（每行 AES）卡死
  typedHandle('snippet:listSnippets', (_event, { filters, limit, offset }) =>
    snippetStore.listSnippets(
      filters,
      Math.min(Math.max(Number(limit) || 200, 1), 1000),
      Math.max(Number(offset) || 0, 0)
    )
  )

  typedHandle('snippet:getSnippetById', (_event, { id }) => snippetStore.getSnippetById(id))

  typedHandle('snippet:addSnippet', (_event, raw) => {
    // B56-4：入参白名单——isDeleted 强制 false（渲染端不能直落回收站）、
    // contents 验型；id/createdAt/updatedAt 由 repo 生成
    const req = (raw ?? {}) as Record<string, unknown>
    const result = snippetStore.addSnippet({
      name: typeof req.name === 'string' && req.name.trim() ? req.name : '未命名片段',
      description: typeof req.description === 'string' ? req.description : '',
      trigger: typeof req.trigger === 'string' ? req.trigger : undefined,
      folderId: typeof req.folderId === 'string' ? req.folderId : null,
      tagIds: Array.isArray(req.tagIds) ? req.tagIds.filter((t): t is string => typeof t === 'string') : [],
      isFavorites: req.isFavorites === true,
      isDeleted: false,
      contents: sanitizeContents(req.contents)
    } as Parameters<typeof snippetStore.addSnippet>[0])
    textExpansion.invalidateTriggers()
    broadcastSnippetsChanged()
    return result
  })

  typedHandle('snippet:updateSnippet', (_event, raw) => {
    const { id, updates } = (raw ?? {}) as { id?: unknown; updates?: Record<string, unknown> }
    if (typeof id !== 'string' || !id) return undefined
    // B56-4：updates.contents/tagIds 必须是数组（此前非数组直传 repo 会 forEach 抛 500）
    const clean = { ...updates } as Record<string, unknown>
    if ('contents' in clean && !Array.isArray(clean.contents)) delete clean.contents
    if ('tagIds' in clean && !Array.isArray(clean.tagIds)) delete clean.tagIds
    const result = snippetStore.updateSnippet(id, clean as Parameters<typeof snippetStore.updateSnippet>[1])
    textExpansion.invalidateTriggers()
    broadcastSnippetsChanged()
    return result
  })

  typedHandle('snippet:deleteSnippet', (_event, { id }) => {
    const result = snippetStore.deleteSnippet(id)
    textExpansion.invalidateTriggers()
    // 广播必须在 return 之前——此前写在 return 之后是死代码，
    // 胶囊页 onSnippetsChanged 收不到删除通知
    broadcastSnippetsChanged()
    return result
  })

  typedHandle('snippet:permanentlyDeleteSnippet', (_event, { id }) =>
    snippetStore.permanentlyDeleteSnippet(id)
  )

  typedHandle('snippet:restoreSnippet', (_event, { id }) => {
    const result = snippetStore.restoreSnippet(id)
    textExpansion.invalidateTriggers()
    broadcastSnippetsChanged()
    return result
  })

  typedHandle('snippet:duplicateSnippet', (_event, { id }) => {
    const result = snippetStore.duplicateSnippet(id)
    broadcastSnippetsChanged()
    return result
  })

  typedHandle('snippet:getStatistics', () => snippetStore.getStatistics())

  typedHandle('snippet:emptyTrash', () => {
    const result = snippetStore.emptyTrash()
    broadcastSnippetsChanged()
    return result
  })

  // B3：导入导出（对话框绑定发起方窗口；无窗口时走 windowless 重载）。
  // 纯逻辑（构建负载 / 解析校验 / 去重切分）在 services/SnippetTransferService.ts。
  typedHandle('snippet:exportAll', async (event: IpcMainInvokeEvent) => {
    const win: BrowserWindow | null = BrowserWindow.fromWebContents(event.sender)
    const snippets = snippetRepository.getSnippets({ isDeleted: false })
    const payload = buildExportPayload(snippets)
    const dialogResult = await showSaveDialogFor(win, {
      title: '导出代码片段',
      defaultPath: `frond-snippets-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`,
      filters: [{ name: 'JSON', extensions: ['json'] }]
    })
    if (dialogResult.canceled || !dialogResult.filePath) return { ok: false, canceled: true }
    try {
      await writeFile(dialogResult.filePath, JSON.stringify(payload, null, 2), 'utf-8')
    } catch (error) {
      return { ok: false, error: `写入文件失败：${(error as Error).message}` }
    }
    return { ok: true, filePath: dialogResult.filePath, count: snippets.length }
  })

  typedHandle('snippet:importFile', async (event: IpcMainInvokeEvent) => {
    const win: BrowserWindow | null = BrowserWindow.fromWebContents(event.sender)
    const fail = (error: string): SnippetImportResult & { ok: boolean; error: string } => ({
      ok: false,
      error,
      imported: 0,
      skipped: 0,
      total: 0
    })
    const dialogResult = await showOpenDialogFor(win, {
      title: '导入代码片段',
      filters: [{ name: 'JSON', extensions: ['json'] }],
      properties: ['openFile']
    })
    if (dialogResult.canceled || dialogResult.filePaths.length === 0) {
      return { ok: false, canceled: true, imported: 0, skipped: 0, total: 0 }
    }
    let jsonText: string
    try {
      const filePath = dialogResult.filePaths[0]! // canceled/空列表已在上方守卫
      // 大小上限：超大 JSON 在主进程 JSON.parse 会冻结全应用（同步解析）
      const statResult = await stat(filePath)
      if (statResult.size > SNIPPET_IMPORT_MAX_BYTES) {
        return fail(`文件超过 ${Math.round(SNIPPET_IMPORT_MAX_BYTES / 1024 / 1024)}MB 上限`)
      }
      jsonText = await readFile(filePath, 'utf-8')
    } catch (error) {
      return fail(`读取文件失败：${(error as Error).message}`)
    }
    const parsed = parseImportPayload(jsonText)
    if (!parsed.ok) return fail(parsed.error)
    // 全库 id（含回收站）做去重：回收站行占用主键，重导入会覆盖它
    const existingIds = new Set(snippetRepository.getSnippets().map((s) => s.id))
    const { toImport, skipped } = partitionForImport(parsed.snippets, existingIds)
    if (toImport.length > 0) {
      snippetRepository.importMany(toImport as Snippet[])
      // 新片段可能携带触发词，触发词缓存需重建
      textExpansion.invalidateTriggers()
      broadcastSnippetsChanged()
    }
    return { ok: true, imported: toImport.length, skipped, total: parsed.snippets.length }
  })

  // B58：触发词冲突查询——编辑器输入触发词时实时提示重复（此前 repo 方法无任何消费者）
  typedHandle('snippet:findTriggerConflict', (_event, { trigger, excludeId }) =>
    snippetRepository.findTriggerConflict(String(trigger ?? ''), String(excludeId ?? ''))
  )

  // B58 批C：胶囊轻路径索引——列表/搜索投影就地位，不再全库解密 contents
  typedHandle('snippet:getIndex', () => snippetRepository.getIndex())

  // B58 批C：粘贴到前台应用（胶囊 ⇧↵）——写剪贴板 → 收起胶囊 → 延迟注入 ⌘V。
  // 无辅助功能授权时注入失败但内容已在剪贴板，调用方退化为手动粘贴
  typedHandle('snippet:pasteToForeground', async (_event, { id, blockIndex }) => {
    const snippet = snippetRepository.getSnippetById(String(id ?? ''))
    if (!snippet) return { ok: false, error: 'snippet not found' }
    const idx = Number(blockIndex) || 0
    const value = snippet.contents[idx]?.value ?? snippet.contents[0]?.value ?? ''
    if (!value) return { ok: false, error: 'snippet is empty' }
    clipboard.writeText(value)
    getLauncherWindow()?.hide()
    try {
      await new Promise((resolve) => setTimeout(resolve, PASTE_DELAY_MS))
      await pasteToActiveApp()
      return { ok: true }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })
}
