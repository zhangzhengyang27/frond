/**
 * Frond · CursorTracker (main process)
 *
 * 职责：在录制时把系统鼠标坐标按 30fps 推送给 renderer，让 UI / canvas
 *      可以叠加鼠标光圈/高亮效果。
 *
 * 设计要点：
 *   - 通过 webContents.send 单向推送：'cursor:position' { x, y } (屏幕坐标系)
 *   - 用 setInterval 而不是 IPC pull，避免每帧 invoke
 *   - start/stop 幂等；stop 后立刻发 cursor:stop 让 renderer 清理
 *
 * PR-4 范围：仅推送位置；不持久化、不写库
 */

import { BrowserWindow, screen } from 'electron'

type CursorChannel = 'cursor:position' | 'cursor:stop'

let timer: NodeJS.Timeout | null = null
const attached: Set<number> = new Set() // webContents.id

const PUSH_INTERVAL_MS = 33 // ~30fps

function tick(): void {
  if (attached.size === 0) {
    stop()
    return
  }
  const pt = screen.getCursorScreenPoint()
  const windows = BrowserWindow.getAllWindows()
  for (const id of attached) {
    const wc = windows.map((w) => w.webContents).find((c) => c.id === id)
    if (!wc || wc.isDestroyed()) {
      // 窗口已销毁（关闭/刷新）：清掉挂着的 id，否则 interval 永不停止
      attached.delete(id)
      continue
    }
    wc.send('cursor:position' as CursorChannel, { x: pt.x, y: pt.y })
  }
  if (attached.size === 0) {
    stop()
  }
}

export const CursorTracker = {
  start(webContentsId: number): void {
    attached.add(webContentsId)
    if (!timer) {
      timer = setInterval(tick, PUSH_INTERVAL_MS)
    }
  },

  stop(webContentsId?: number): void {
    if (webContentsId != null) {
      attached.delete(webContentsId)
    } else {
      attached.clear()
    }
    if (attached.size === 0 && timer) {
      clearInterval(timer)
      timer = null
      // 通知所有窗口停止（renderer 端会清除最后一帧）
      for (const w of BrowserWindow.getAllWindows()) {
        if (!w.isDestroyed()) {
          w.webContents.send('cursor:stop' as CursorChannel)
        }
      }
    }
  },

  isActive(webContentsId?: number): boolean {
    if (webContentsId == null) return attached.size > 0
    return attached.has(webContentsId)
  }
}
