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

  function clearRect(){ sel.style.display='none'; sizeEl.style.display='none'; }

  const MIN_SIZE_PX = 20;

  // 页面 (0,0) 就是 overlay 窗口的左上角，回主进程前换算成屏幕坐标（见 monitorBounds）
  function report(x0,y0,x1,y1){
    const x = Math.min(x0,x1), y = Math.min(y0,y1);
    const width = Math.abs(x1-x0), height = Math.abs(y1-y0);
    location.href = 'leaf-region://select?x='+Math.round(x+monitorBounds.x)
      +'&y='+Math.round(y+monitorBounds.y)
      +'&width='+Math.round(width)+'&height='+Math.round(height);
  }

  function requestCancel(){ location.href = 'leaf-region://cancel'; }

  document.addEventListener('mousedown', (e)=>{
    if(e.button!==0) return;
    drawing=true; sx=e.clientX; sy=e.clientY; setRect(sx,sy,0,0);
  });
  document.addEventListener('mousemove', (e)=>{
    if(!drawing) return;
    setRect(sx,sy,e.clientX-sx,e.clientY-sy);
  });
  document.addEventListener('mouseup', (e)=>{
    if(!drawing) return;
    drawing=false;
    if(Math.abs(e.clientX-sx)<MIN_SIZE_PX || Math.abs(e.clientY-sy)<MIN_SIZE_PX){
      clearRect(); return;   // 太小多半是误点：清掉重来，不关窗
    }
    report(sx,sy,e.clientX,e.clientY);
  });
  document.addEventListener('keydown', (e)=>{ if(e.key==='Escape') requestCancel(); });
  if (cancel) cancel.addEventListener('click', requestCancel);
</script>
</body>
</html>`

/** 把显示器原点注入内联页（占位符留在模板里，避免拼接被选区内容打断） */
function overlayHtml(origin: { x: number; y: number }): string {
  return OVERLAY_HTML_TEMPLATE.replace(
    '__MONITOR_BOUNDS_JSON__',
    JSON.stringify({ x: origin.x, y: origin.y })
  )
}

interface PendingSelection {
  win: BrowserWindow
  resolve: (r: Result) => void
}

let pending: PendingSelection | null = null

/** 同一时刻只允许一个 overlay：重复调用先把上一个按「取消」结掉 */
function closePending(): void {
  if (!pending) return
  const { win, resolve } = pending
  pending = null
  try {
    if (!win.isDestroyed()) win.close()
  } catch {
    /* 窗口已在销毁流程里 */
  }
  resolve({ ok: false, reason: 'canceled' })
}

/** region 以 primary 显示器为 0,0（与 desktopCapturer 的坐标系一致，见文件头） */
function primaryOrigin(): { x: number; y: number } {
  if (!app.isReady()) return { x: 0, y: 0 }
  const p = screen.getPrimaryDisplay().bounds
  return { x: p.x, y: p.y }
}

/**
 * 打开 overlay 等一次框选。内联页没有 preload，回程走 location.href +
 * will-navigate 拦截：透明无边框窗口不值得为它再挂一份受控 preload。
 */
function openOverlay(target: {
  x: number
  y: number
  width: number
  height: number
  displayId: number
  crossDisplay: boolean
  scaleFactor: number
}): Promise<Result> {
  closePending()
  const win = new BrowserWindow({
    x: target.x,
    y: target.y,
    width: target.width,
    height: target.height,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    movable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    webPreferences: { contextIsolation: true, sandbox: true }
  })
  win.setKiosk(true)
  win.setAlwaysOnTop(true, 'screen-saver')

  const origin = primaryOrigin()

  return new Promise<Result>((resolve) => {
    pending = { win, resolve }

    const settle = (r: Result): void => {
      if (!pending || pending.win !== win) return
      pending = null
      try {
        if (!win.isDestroyed()) win.close()
      } catch {
        /* 已在销毁流程里 */
      }
      resolve(r)
    }

    win.webContents.on('will-navigate', (event, url) => {
      if (!url.startsWith('leaf-region://')) return
      event.preventDefault()
      const m = /^leaf-region:\/\/([^?]*)(?:\?(.*))?$/.exec(url)
      const kind = m?.[1]
      const params = new URLSearchParams(m?.[2] ?? '')
      const num = (k: string): number => Number(params.get(k))
      if (kind !== 'select') {
        settle({ ok: false, reason: 'canceled' })
        return
      }
      settle({
        ok: true,
        region: {
          x: num('x') - origin.x,
          y: num('y') - origin.y,
          width: num('width'),
          height: num('height')
        },
        displayId: target.displayId,
        crossDisplay: target.crossDisplay,
        scaleFactor: target.scaleFactor
      })
    })

    win.on('closed', () => settle({ ok: false, reason: 'canceled' }))

    void win
      .loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(overlayHtml(target)))
      .then(() => win.show())
      .catch(() => settle({ ok: false, reason: 'canceled' }))
  })
}

function displayTarget(displayId: number | null): {
  x: number
  y: number
  width: number
  height: number
  displayId: number
  crossDisplay: boolean
  scaleFactor: number
} {
  const all = screen.getAllDisplays()
  const pick = displayId == null ? screen.getPrimaryDisplay() : all.find((d) => d.id === displayId)
  if (!pick) throw new Error(`[RegionOverlay] display not found: ${displayId}`)
  return { ...pick.bounds, displayId: pick.id, crossDisplay: false, scaleFactor: pick.scaleFactor }
}

function virtualTarget(): ReturnType<typeof displayTarget> {
  const all = screen.getAllDisplays()
  const x = Math.min(...all.map((d) => d.bounds.x))
  const y = Math.min(...all.map((d) => d.bounds.y))
  const right = Math.max(...all.map((d) => d.bounds.x + d.bounds.width))
  const bottom = Math.max(...all.map((d) => d.bounds.y + d.bounds.height))
  // 跨屏以 primary 的 scaleFactor 为准；多屏缩放比例不一致时由 renderer 侧再校正
  const primary = screen.getPrimaryDisplay()
  return {
    x,
    y,
    width: right - x,
    height: bottom - y,
    displayId: primary.id,
    crossDisplay: true,
    scaleFactor: primary.scaleFactor
  }
}

export class RegionOverlay {
  /** PR-4 兼容入口：主显示器内框选。取消时 reject 'canceled'（IPC 层转提示） */
  static async open(): Promise<RegionSelection> {
    const r = await openOverlay(displayTarget(null))
    if (!r.ok) throw new Error('canceled')
    return r.region
  }

  static async openForDisplay(displayId: number): Promise<RegionSelectionResult> {
    const r = await openOverlay(displayTarget(displayId))
    if (!r.ok) throw new Error('canceled')
    return {
      region: r.region,
      displayId: r.displayId,
      crossDisplay: r.crossDisplay,
      scaleFactor: r.scaleFactor
    }
  }

  static async openCrossDisplay(): Promise<RegionSelectionResult> {
    const r = await openOverlay(virtualTarget())
    if (!r.ok) throw new Error('canceled')
    return {
      region: r.region,
      displayId: r.displayId,
      crossDisplay: r.crossDisplay,
      scaleFactor: r.scaleFactor
    }
  }

  /** 程序主动收尾（幂等） */
  static cancel(): void {
    closePending()
  }
}
