import { BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { readFile, writeFile, stat } from 'fs/promises'
import type { Snippet, SnippetDataStore } from '../stores/SnippetDataStore'
import { snippetRepository } from '../db/repos/SnippetRepository'
import { textExpansion } from '../modules/textExpansion'
import { showOpenDialogFor, showSaveDialogFor } from '../modules/dialogs'
import {
  buildExportPayload,
  parseImportPayload,
  partitionForImport,
  type SnippetImportResult
} from '../services/SnippetTransferService'
import { typedHandle } from './typedIpc'

/** 导入文件大小上限：超大 JSON 在主进程同步 JSON.parse 会冻结全应用 */
const SNIPPET_IMPORT_MAX_BYTES = 20 * 1024 * 1024

export function registerSnippetIpcHandlers(snippetStore: SnippetDataStore): void {
  typedHandle('snippet:getSnippets', (_event, { filters }) => snippetStore.getSnippets(filters))

  typedHandle('snippet:getSnippetById', (_event, { id }) => snippetStore.getSnippetById(id))

  typedHandle('snippet:addSnippet', (_event, snippet) => {
    const result = snippetStore.addSnippet(snippet)
    textExpansion.invalidateTriggers()
    return result
  })

  typedHandle('snippet:updateSnippet', (_event, { id, updates }) => {
    const result = snippetStore.updateSnippet(id, updates)
    textExpansion.invalidateTriggers()
    return result
  })

  typedHandle('snippet:deleteSnippet', (_event, { id }) => {
    const result = snippetStore.deleteSnippet(id)
    textExpansion.invalidateTriggers()
    return result
  })

  typedHandle('snippet:permanentlyDeleteSnippet', (_event, { id }) =>
    snippetStore.permanentlyDeleteSnippet(id)
  )

  typedHandle('snippet:restoreSnippet', (_event, { id }) => {
    const result = snippetStore.restoreSnippet(id)
    textExpansion.invalidateTriggers()
    return result
  })

  typedHandle('snippet:duplicateSnippet', (_event, { id }) => snippetStore.duplicateSnippet(id))

  typedHandle('snippet:getStatistics', () => snippetStore.getStatistics())

  typedHandle('snippet:emptyTrash', () => snippetStore.emptyTrash())

  // B3：导入导出（对话框绑定发起方窗口；无窗口时走 windowless 重载）。
  // 纯逻辑（构建负载 / 解析校验 / 去重切分）在 services/SnippetTransferService.ts。
  typedHandle('snippet:exportAll', async (event: IpcMainInvokeEvent) => {
    const win: BrowserWindow | null = BrowserWindow.fromWebContents(event.sender)
    const snippets = snippetRepository.getSnippets({ isDeleted: false })
    const payload = buildExportPayload(snippets)
    const dialogResult = await showSaveDialogFor(win, {
      title: '导出代码片段',
      defaultPath: `leaf-snippets-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}.json`,
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
      const filePath = dialogResult.filePaths[0]
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
    }
    return { ok: true, imported: toImport.length, skipped, total: parsed.snippets.length }
  })
}
