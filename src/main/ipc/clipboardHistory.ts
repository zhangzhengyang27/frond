/**
 * Leaf · 剪贴板历史 IPC
 *
 * - cliphist:list/copy/remove/clear  基础历史操作
 * - cliphist:togglePin               置顶（置顶不受容量/保留期淘汰）
 * - cliphist:getEnabled/setEnabled   历史采集开关（胶囊「快捷设置」）
 * - cliphist:pasteBack               复制并向前台应用粘贴（收起胶囊 → ⌘V）
 * - cliphist:getBlockedApps/setBlockedApps  P1-6：敏感应用屏蔽
 * - cliphist:startPasteSequence/pasteNext   P1-6：依次粘贴
 */
import { clipboard, nativeImage } from 'electron'
import { clipboardHistory } from '../services/ClipboardHistoryService'
import { pasteToActiveApp, PASTE_DELAY_MS } from '../utils/pasteKeystroke'
import { getLauncherWindow } from '../launcher/window'
import { decodeQrFromImage } from '../utils/qrDecode'
import { typedHandle } from './typedIpc'

export function registerClipboardHistoryIpc(): void {
  typedHandle('cliphist:list', () => clipboardHistory.list())
  typedHandle('cliphist:copy', (_e, { id }) => clipboardHistory.copy(id))
  typedHandle('cliphist:remove', (_e, { id }) => clipboardHistory.remove(id))
  typedHandle('cliphist:clear', () => {
    clipboardHistory.clear()
    return true
  })
  typedHandle('cliphist:togglePin', (_e, { id }) => clipboardHistory.togglePin(id))
  // P0-3：条目备注关键词（补充索引，搜索可命中）
  typedHandle('cliphist:setKeywords', (_e, { id, keywords }) =>
    clipboardHistory.setKeywords(
      String(id ?? ''),
      Array.isArray(keywords) ? keywords.filter((k): k is string => typeof k === 'string') : []
    )
  )
  typedHandle('cliphist:getEnabled', () => clipboardHistory.getEnabled())
  typedHandle('cliphist:setEnabled', (_e, { on }) => {
    clipboardHistory.setEnabled(Boolean(on))
    return clipboardHistory.getEnabled()
  })

  // P1-6：敏感应用屏蔽配置
  typedHandle('cliphist:getBlockedApps', () => clipboardHistory.getBlockedApps())
  typedHandle('cliphist:setBlockedApps', (_e, { apps }) => {
    // 元素必须为字符串：坏元素会让 isAppBlocked 每秒轮询抛 TypeError，
    // 被 poll 的 catch 吞掉后剪贴板采集整体静默停摆
    clipboardHistory.setBlockedApps(
      Array.isArray(apps) ? apps.filter((a): a is string => typeof a === 'string') : []
    )
    return clipboardHistory.getBlockedApps()
  })

  // P1-6：依次粘贴——从指定条目开始，每次调用粘贴下一条
  typedHandle('cliphist:startPasteSequence', (_e, { id }) =>
    clipboardHistory.startPasteSequence(id)
  )
  typedHandle('cliphist:pasteNext', async () => {
    const result = clipboardHistory.pasteNext()
    if (!result.ok) return result
    // 复制已在 pasteNext 中完成，这里注入 ⌘V
    getLauncherWindow()?.hide()
    try {
      await new Promise((resolve) => setTimeout(resolve, PASTE_DELAY_MS))
      await pasteToActiveApp()
      return { ok: true, hasMore: result.hasMore }
    } catch (error) {
      return { ok: false, hasMore: result.hasMore, error: (error as Error).message }
    }
  })

  // 二维码识别：图片条目 → 解码文本并回填剪贴板（V4 P1-12 批次3）
  typedHandle('cliphist:decodeQr', (_e, { id }) => {
    const item = clipboardHistory.list().find((i) => i.id === id)
    if (!item || item.kind !== 'image' || !item.filePath) return { ok: false, error: '条目不存在' }
    try {
      const img = nativeImage.createFromPath(item.filePath)
      const text = decodeQrFromImage(img)
      if (!text) return { ok: false, error: '未识别到二维码' }
      clipboard.writeText(text)
      return { ok: true, text }
    } catch (error) {
      return { ok: false, error: (error as Error).message }
    }
  })

  // 粘贴直达：写回剪贴板 → 收起胶囊（焦点回落目标应用）→ 延迟注入 ⌘V
  typedHandle('cliphist:pasteBack', async (_e, { id }) => {
    if (!clipboardHistory.copy(id)) return { ok: false, error: 'item not found' }
    getLauncherWindow()?.hide()
    try {
      await new Promise((resolve) => setTimeout(resolve, PASTE_DELAY_MS))
      await pasteToActiveApp()
      return { ok: true }
    } catch (error) {
      // 常见原因：macOS 未授予辅助功能权限。内容已写入剪贴板，退化为手动粘贴
      return { ok: false, error: (error as Error).message }
    }
  })
}
