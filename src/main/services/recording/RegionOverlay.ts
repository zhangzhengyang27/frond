/**
 * Leaf · RegionOverlay
 *
 * 职责：打开一个跨平台 transparent 全屏 overlay 窗口，让用户在屏上拖拽选择录制区域。
 *
 * 设计要点：
 *   - 使用 BrowserWindow.transparent + kiosk + alwaysOnTop，跨 macOS / Windows / Linux。
 *   - Overlay UI 用内联 HTML（无 Vue 依赖、无 preload），避免额外打包。
 *   - 用户完成拖拽 / 取消时通过 IPC 把 region 传回原窗口。
 *   - 单例模式：同一时刻只允许一个 overlay 窗口存在；重复调用 cancel 幂等。
 *
 * PR-6 扩展：
 *   - openForDisplay(displayId)：单显示器内选择，返回 { region, displayId, crossDisplay:false }
 *   - openCrossDisplay()：跨所有显示器一次性框选，返回 { region, crossDisplay:true }
 *   - 返回的 region 用 Electron 物理坐标系（与 desktopCapturer 一致：全 primary=0,0 起算）
 *
 * PR-4 范围：
 *   - open(): 保留兼容，内部走 openForDisplay(primary)
 *
 * 不在本 PR 范围：
 *   - 跨窗口吸附 / 智能识别
 */

import { BrowserWindow, screen, ipcMain, app, type Display } from 'electron'
import { join } from 'node:path'

export interface RegionSelection {
  x: number
  y: number
  width: number
  height: number
}

export interface RegionSelectionResult {
  region: RegionSelection
  displayId: number
  crossDisplay: boolean
  /** 区域所在显示器的 scaleFactor（renderer 换算物理像素用） */
  scaleFactor: number
}

type Result =
  | {
      ok: true
      region: RegionSelection
      displayId: number
      crossDisplay: boolean
      scaleFactor: number
    }
  | { ok: false; reason: 'canceled' }

let activeWindow: BrowserWindow | null = null

/**
 * 列出所有物理显示器。
 */
export function listDisplays(): Array<{
  id: number
  bounds: { x: number; y: number; width: number; height: number }
  workArea: { x: number; y: number; width: number; height: number }
  scaleFactor: number
  isPrimary: boolean
}> {
  if (!app.isReady()) return []
  return screen.getAllDisplays().map((d: Display) => ({
    id: d.id,
    bounds: {
      x: d.bounds.x,
      y: d.bounds.y,
      width: d.bounds.width,
      height: d.bounds.height
    },
    workArea: {
      x: d.workArea.x,
      y: d.workArea.y,
      width: d.workArea.width,
      height: d.workArea.height
    },
    scaleFactor: d.scaleFactor,
    isPrimary: d.id === screen.getPrimaryDisplay().id
  }))
}

const OVERLAY_HTML_TEMPLATE = `<!doctype html>
<html>
<head>
<meta charset="utf-8">
<style>
  html,body { margin:0; padding:0; height:100%; width:100%; background:rgba(0,0,0,0.35); cursor:crosshair; overflow:hidden; user-select:none; }
  #hint { position:fixed; top:18px; left:50%; transform:translateX(-50%); background:#000000a8; color:#fff; padding:8px 14px; border-radius:8px; font:13px/1.4 -apple-system,Segoe UI,sans-serif; pointer-events:none; z-index:9; }
  #hint kbd { background:#222; border-radius:4px; padding:2px 6px; font-family:inherit; font-size:11px; margin:0 2px; }
  #sel { position:absolute; border:2px solid #ffd83b; background:rgba(255,216,59,0.15); box-shadow:0 0 0 9999px rgba(0,0,0,0.35); display:none; pointer-events:none; }
  #size { position:absolute; background:#ffd83b; color:#111; font:12px/1 -apple-system,Segoe UI,sans-serif; padding:3px 6px; border-radius:4px; transform:translate(8px,-22px); display:none; pointer-events:none; }
  #cancel { position:fixed; bottom:24px; left:50%; transform:translateX(-50%); padding:8px 18px; background:#ffffff; color:#333; border:0; border-radius:8px; cursor:pointer; font:13px -apple-system,Segoe UI,sans-serif; box-shadow:0 4px 14px rgba(0,0,0,0.25); }
  #cancel:hover { background:#f4f4f4; }
</style>
</head>
<body>
  <div id="hint">拖拽以框选录制区域 &nbsp;·&nbsp; <kbd>Esc</kbd> 取消</div>
  <div id="sel"></div><div id="size"></div>
  <button id="cancel">取消 (Esc)</button>
<script>
  // monitorBounds 由 main 在加载前直接内插进 HTML。
  // 旧实现用 did-finish-load + executeJavaScript 注入，但内联脚本在解析时
  // 就读取了该变量，注入永远晚于读取 → 非主屏/跨屏框选坐标整体偏移。
  const monitorBounds = __MONITOR_BOUNDS_JSON__;

  const sel = document.getElementById('sel');
  const sizeEl = document.getElementById('size');
  const cancel = document.getElementById('cancel');
  let sx=0, sy=0, drawing=false;

  function setRect(x,y,w,h){
    sel.style.left = x+'px'; sel.style.top = y+'px';
    sel.style.width = w+'px'; sel.style.height = h+'px';
    sizeEl.style.left = x+'px'; sizeEl.style.top = y+'px';
    sizeEl.textContent = Math.round(w)+' × '+Math.round(h);
    sel.style.display='block'; sizeEl.style.display='block';
  }
