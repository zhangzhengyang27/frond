/**
 * Leaf · 启动器胶囊窗
 *
 * 常驻隐藏的独立 BrowserWindow（frameless/透明/置顶/多屏跟随光标），
 * Alt+Space 全局唤起，失焦自动隐藏，ESC 由渲染端回传隐藏。
 * 窗口本体只创建一次，show 时重新定位到光标所在显示器。
 */
import { BrowserWindow, screen, systemPreferences } from 'electron'
import { join } from 'path'
import { prefRepository } from '../db/repos/PrefRepository'
import { notifyWindowVisibility } from './runtime'
import { shouldHideOnBlur } from './pinLogic'
import {
  animationFrames,
  clampToWorkArea,
  compactRect,
  enterRect,
  expandRect,
  parseBoundsMap,
  rememberBounds,
  resolveBounds,
  serializeBoundsMap,
  type Rect,
  type WorkArea
} from './geometry'

const LAUNCHER_WIDTH = 750
const LAUNCHER_HEIGHT = 520

/** 按显示器记住的落点（P-6⑤）。存的是「用户把窗口拖到哪」，不是默认落点 */
const BOUNDS_PREF = 'launcher:boundsByDisplay'
/** 拖拽过程中 'moved' 会连发，攒一下再写库 */
const MOVE_SAVE_DEBOUNCE_MS = 400

/** show() 后等待 focus 落定、以及拖窗期间的抑制窗口（ms）：期间 blur 不触发自动隐藏 */
let suppressBlurHideUntil = 0

let launcherWindow: BrowserWindow | null = null

/**
 * 「保持打开」（P-1.3）：钉住时失焦不隐藏，用于连续操作（翻文件、连续粘贴）。
 * 会话级状态——窗口销毁即复位，否则重建后主进程说钉住、渲染端显示未钉住。
 */
let launcherPinned = false

export function setLauncherPinned(pinned: boolean): boolean {
  launcherPinned = pinned
  return launcherPinned
}

export function isLauncherPinned(): boolean {
  return launcherPinned
}

function loadLauncherPage(win: BrowserWindow): void {
  if (process.env['ELECTRON_RENDERER_URL']) {
    void win.loadURL(`${process.env['ELECTRON_RENDERER_URL']}/launcher.html`)
  } else {
    void win.loadFile(join(__dirname, '../renderer/launcher.html'))
  }
}

function createLauncherWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: LAUNCHER_WIDTH,
    height: LAUNCHER_HEIGHT,
    show: false,
    frame: false,
    transparent: true,
    resizable: false,
    minimizable: false,
    maximizable: false,
    fullscreenable: false,
    skipTaskbar: true,
    alwaysOnTop: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    // 玻璃材质（v5 主题化）：mac 走系统 vibrancy（深浅随系统外观），
    // win11 走 acrylic（旧系统自动忽略）。内层透明度由 --launcher-bg 深/浅档承担；
    // Electron 透明窗的 CSS backdrop-filter 无系统 backing 不可用，故材质一律交给系统层。
    vibrancy: process.platform === 'darwin' ? 'under-window' : undefined,
    backgroundMaterial: process.platform === 'win32' ? 'acrylic' : undefined,
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: true
    }
  })

  // screen-saver 级置顶；覆盖全屏应用
  win.setAlwaysOnTop(true, 'screen-saver')
  if (process.platform !== 'win32') {
    win.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true })
  }

  // 失焦自动隐藏：判定全在 shouldHideOnBlur（钉住 / 焦点抑制窗口 / 可见性），
  // 走 hideLauncherWindow() 让插件收到 onHide
  win.on('blur', () => {
    if (
      shouldHideOnBlur({
        pinned: launcherPinned,
        visible: win.isVisible(),
        suppressUntil: suppressBlurHideUntil,
        now: Date.now()
      })
    ) {
      hideLauncherWindow()
    }
  })
  win.on('closed', () => {
    launcherWindow = null
    // 渲染端的钉住指示器随窗口一起消失，主进程侧必须同步复位
    launcherPinned = false
  })
  // 用户拖窗（P-6⑤：胶囊可拖，位置按显示器记住）
  win.on('moved', () => {
    // 真机上拖窗口常伴随一次 blur，不压一下就是「一拿起来就消失」
    suppressBlurHideUntil = Date.now() + 250
    onLauncherMoved(win)
  })

  // 首次 show 时渲染端可能尚未挂载监听，loaded 后若窗口可见则补发一次
  win.webContents.once('did-finish-load', () => {
    if (win.isVisible()) {
      win.webContents.send('launcher:shown')
    }
  })

  loadLauncherPage(win)
  return win
}

/**
 * 定位到光标所在显示器：默认仍是「水平居中、垂直偏上」，
 * 但该显示器被用户拖过就用记住的那一份（夹回工作区之后再用）。
 */
let lastPlacedRect: Rect | null = null

function displayAtCursor(): { id: string; workArea: WorkArea } {
  const d = screen.getDisplayNearestPoint(screen.getCursorScreenPoint())
  return { id: String(d.id), workArea: d.workArea }
}

function placeLauncher(win: BrowserWindow, height = LAUNCHER_HEIGHT): Rect {
  const { id, workArea } = displayAtCursor()
  const target = clampToWorkArea(
    resolveBounds(parseBoundsMap(prefRepository.get(BOUNDS_PREF)), id, workArea, {
      width: LAUNCHER_WIDTH,
      height
    }),
    workArea
  )
  lastPlacedRect = target
  win.setBounds(target)
  return target
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

/**
 * 只在**用户挪过窗**之后才记：'moved' 对我们自己的 setBounds 也会发，
 * 那种情况下矩形与刚写进去的完全相同，跳过——否则默认落点会被当成
 * 「用户选的位置」永久钉住，换了屏幕分辨率也不会再重新居中。
 * 动画期间（`animating`）整体忽略：那是每帧都在 setBounds。
 */
function onLauncherMoved(win: BrowserWindow): void {
  if (animating) return
  const b = win.getBounds()
  if (lastPlacedRect && b.x === lastPlacedRect.x && b.y === lastPlacedRect.y) return
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => {
    saveTimer = null
    const live = getLauncherWindow()
    if (!live) return
    // 攒字的这 400ms 里动画可能又起来了（唤起 / 收窗都在 setBounds）：
    // 进来时判过一次不够，落库前必须再判一次，否则把我们自己放的中间帧当成用户选的落点
    if (animating) return
    const rect = live.getBounds()
    if (lastPlacedRect && rect.x === lastPlacedRect.x && rect.y === lastPlacedRect.y) return
    // 记在**窗口所在**那块屏名下，不是光标所在那块：
    // 拖到副屏后把鼠标移回主屏，按游标存会把副屏的落点写到主屏账上，一换屏就串位
    const d = screen.getDisplayMatching(rect)
    const clamped = clampToWorkArea(rect, d.workArea)
    prefRepository.set(
      BOUNDS_PREF,
      serializeBoundsMap(
        rememberBounds(parseBoundsMap(prefRepository.get(BOUNDS_PREF)), String(d.id), clamped)
      )
    )
  }, MOVE_SAVE_DEBOUNCE_MS)
}

/**
 * 显/隐动画（P-6⑤）：90ms 淡入 + 从上方 12px 落位，隐藏淡出 60ms 再真 hide。
 * 时长刻意短——胶囊是「按了就出」的东西，动画超过 100ms 就开始显得迟钝。
 * `setOpacity` 只在 mac/win 有（Linux 不发包，那里直接瞬现而不是报错）。
 */
const SHOW_STEPS = 6
const SHOW_FRAME_MS = 15
const HIDE_STEPS = 4
const HIDE_FRAME_MS = 15
const CAN_FADE = process.platform === 'darwin' || process.platform === 'win32'

let animTimer: ReturnType<typeof setTimeout> | null = null
let animating = false
/** 淡入淡出在飞时收到的高度请求：先让动画落地，别抢它的计时器 */
let heightPending = false

function stopAnim(): void {
  if (animTimer) {
    clearTimeout(animTimer)
    animTimer = null
  }
  animating = false
}

/** 每个动画的落点都要过这里：挂着的改高请求在动画结束后补上 */
function endAnim(): void {
  animating = false
  if (heightPending) applyLauncherHeight()
}

/** 系统「减弱动态效果」开着就不动画（与渲染端 useTheme 同一口径，读的是平台设置） */
function noAnimation(): boolean {
  return !CAN_FADE || systemPreferences.getAnimationSettings().prefersReducedMotion === true
}

function runShowFrames(win: BrowserWindow, from: Rect, to: Rect): void {
  const frames = animationFrames(from, to, SHOW_STEPS)
  let i = 0
  animating = true
  const tick = (): void => {
    if (win.isDestroyed()) {
      endAnim()
      return
    }
    win.setBounds(frames[i])
    win.setOpacity(Math.min(1, (i + 1) / frames.length))
    i += 1
    if (i < frames.length) {
      animTimer = setTimeout(tick, SHOW_FRAME_MS)
    } else {
      animTimer = null
      // 落点才是「我们放的位置」，中间帧不是——否则动画最后一下会被当成用户拖动
      lastPlacedRect = to
      endAnim()
    }
  }
  tick()
}

/* ── Compact Mode（P-6⑤）：空查询时整窗收成一条栏 ── */

/** 收成多高由渲染端报来（它才知道搜索行多高；主进程复制一份 CSS 值必然漂移），
 *  但那是跨进程来的数：先夹进 [COMPACT_MIN_HEIGHT, LAUNCHER_HEIGHT]，
 *  不给一个坏值把窗收成 0 高的机会。 */
const COMPACT_MIN_HEIGHT = 48
const RESIZE_STEPS = 4
const RESIZE_FRAME_MS = 16

let compactState = { on: false, height: LAUNCHER_HEIGHT }

function launcherHeight(): number {
  return compactState.on ? compactState.height : LAUNCHER_HEIGHT
}

/** 高度变了就动一动：顶边不动（compactRect 的取舍），只收放高度 */
function applyLauncherHeight(): void {
  const win = getLauncherWindow()
  if (!win) {
    heightPending = false
    return
  }
  // 淡入 / 淡出在飞时**不能**抢它的计时器：淡出被掐断就等于 finishHide 永远不执行——
  // 窗停在 opacity 0 的「可见」态（抢不回焦点、插件收不到 onHide），比慢一帧收窗难查得多。
  // 把这次改高挂起来，动画落地后补做（唤起路径本来也按当前 compact 高度重新放置）。
  if (animating) {
    heightPending = true
    return
  }
  heightPending = false
  // 窗藏着的时候不用收放：下一次唤起 placeLauncher 就按当前该有的高度放
  if (!win.isVisible()) return
  const { workArea } = displayAtCursor()
  const cur = win.getBounds()
  const want = launcherHeight()
  if (cur.height === want) return
  const target =
    want < cur.height ? compactRect(cur, want, workArea) : expandRect(cur, want, workArea)
  if (target.x === cur.x && target.y === cur.y && target.height === cur.height) return
  if (noAnimation()) {
    win.setBounds(target)
    lastPlacedRect = target
    return
  }
  const frames = animationFrames(cur, target, RESIZE_STEPS)
  let i = 0
  animating = true
  const tick = (): void => {
    if (win.isDestroyed()) {
      endAnim()
      return
    }
    win.setBounds(frames[i])
    i += 1
    if (i < frames.length) {
      animTimer = setTimeout(tick, RESIZE_FRAME_MS)
    } else {
      animTimer = null
      lastPlacedRect = target
      endAnim()
    }
  }
  tick()
}

/** 渲染端报来当前该不该收成一条栏（空查询 & 没开页面/插件时才可能是 true） */
export function setLauncherCompact(on: boolean, heightPx: number): void {
  const raw = Number(heightPx)
  const height = Number.isFinite(raw)
    ? Math.min(LAUNCHER_HEIGHT, Math.max(COMPACT_MIN_HEIGHT, Math.round(raw)))
    : LAUNCHER_HEIGHT
  compactState = { on: on === true, height: on === true ? height : LAUNCHER_HEIGHT }
  applyLauncherHeight()
}

/** 性能基线（M0）：最近一次「隐藏 → 唤起」的窗口可见耗时（ms），-1 表示尚无样本 */
let lastShowLatencyMs = -1

export function getLastShowLatencyMs(): number {
  return lastShowLatencyMs
}

/** 唤起/聚焦胶囊窗（已可见则忽略） */
export function showLauncherWindow(): void {
  const t0 = performance.now()
  if (!launcherWindow || launcherWindow.isDestroyed()) {
    launcherWindow = createLauncherWindow()
  }
  const win = launcherWindow
  if (win.isVisible()) {
    // 淡出还没跑完就被再次唤起：接管计时器，别让它把刚 show 的窗藏掉
    stopAnim()
    win.setOpacity(1)
    // 改高动画可能刚被上面那句掐断（停在半高）——补一次，落回该在的高度
    applyLauncherHeight()
    win.focus()
    return
  }
  const target = placeLauncher(win, launcherHeight())
  if (noAnimation()) {
    win.setOpacity(1)
    win.show()
  } else {
    const from = enterRect(target, displayAtCursor().workArea)
    lastPlacedRect = from
    win.setBounds(from)
    win.setOpacity(0)
    win.show()
    runShowFrames(win, from, target)
  }
  // 首次唤起含窗口懒创建，单独记录冷/热样本都有意义，这里统一记最近一次
  lastShowLatencyMs = performance.now() - t0
  win.focus()
  if (!win.isFocused()) {
    // macOS 多显示器/全屏应用下 show() 后 focus 可能未落定，blur 会立刻触发
    // 自动隐藏；短暂抑制 + 重试一次
    suppressBlurHideUntil = Date.now() + 250
    setTimeout(() => {
      if (launcherWindow === win && !win.isDestroyed() && win.isVisible() && !win.isFocused()) {
        win.focus()
      }
    }, 50)
  }
  win.webContents.send('launcher:shown')
  notifyWindowVisibility(true)
}

/**
 * 取（必要时**不显示地**）建一个胶囊窗，作为 headless 插件视图的宿主。
 * Automations 在后台跑插件命令时用它：那一刻用户可能从没开过胶囊，
 * 但不该为了跑一条命令就把窗口弹到他脸上——创建时 show:false，这里也不 show。
 */
export function ensureLauncherWindow(): BrowserWindow | null {
  if (!launcherWindow || launcherWindow.isDestroyed()) {
    try {
      launcherWindow = createLauncherWindow()
    } catch (error) {
      console.error('[Launcher] 建不出宿主窗:', error)
      return null
    }
  }
  return launcherWindow
}

/** 获取胶囊窗实例（未创建或已销毁返回 null） */
export function getLauncherWindow(): BrowserWindow | null {
  return launcherWindow && !launcherWindow.isDestroyed() ? launcherWindow : null
}

function finishHide(win: BrowserWindow): void {
  win.setOpacity(1)
  win.hide()
  notifyWindowVisibility(false)
}

/** 隐藏胶囊窗（淡出到点后真的 hide；插件的 onHide 也在那一刻才发） */
export function hideLauncherWindow(): void {
  const win = getLauncherWindow()
  if (!win || !win.isVisible()) return
  stopAnim()
  if (noAnimation()) {
    finishHide(win)
    return
  }
  let step = 0
  animating = true
  const tick = (): void => {
    if (win.isDestroyed()) {
      endAnim()
      return
    }
    step += 1
    win.setOpacity(Math.max(0, 1 - step / HIDE_STEPS))
    if (step < HIDE_STEPS) {
      animTimer = setTimeout(tick, HIDE_FRAME_MS)
    } else {
      animTimer = null
      // finishHide 在前：淡出的终点**就是**真的 hide，挂着的改高请求排在它后面
      finishHide(win)
      endAnim()
    }
  }
  tick()
}

/** 全局快捷键动作：可见且聚焦 → 隐藏，否则唤起 */
export function toggleLauncherWindow(): void {
  if (launcherWindow && !launcherWindow.isDestroyed() && launcherWindow.isVisible()) {
    hideLauncherWindow()
  } else {
    showLauncherWindow()
  }
}
