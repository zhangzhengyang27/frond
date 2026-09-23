/**
 * Leaf · 启动器热键（M4：主热键可配置 + 命令级全局热键；
 * 两段式直达：主热键后按住修饰键不放再按字母，GAP_ANALYSIS 维度 5 剩余差距）
 *
 * 配置存 launcher_docs kv（sys.hotkeys.config）：
 * { main?: string, commands?: Record<accelerator, Spec>, chords?: Record<letter, Spec> }
 * Spec = { kind: 'module'|'system'|'quicklink'|'firstParty', id?, path?, url?, page? }
 *
 * 注册：全局热键走 globalShortcut + addShortcutRestorer（重启/冲突恢复后仍有效）；
 * 两段式走 globalKeyHook（uiohook）：主热键唤起后 2s 内按住主热键修饰键再按
 * 已配置字母 → 直达命令。要求修饰键仍按住，与「唤起后直接打字搜索」无冲突。
 * 配置变更后 re-register。命令分发在主进程完成（胶囊/主窗口都可不在前台）。
 */
import { globalShortcut } from 'electron'
import { FIRST_PARTY_PAGE_VALUES } from '../../shared/commands'
import { getLauncherDocStore } from './docStore'
import { toggleLauncherWindow, showLauncherWindow, getLauncherWindow } from './window'
import { createWindow } from '../modules/windows'
import { globalKeyHook } from '../modules/globalKeys'
import { acceleratorModifiers, keycodeToLetter, keycodeToModifier } from '../modules/keycodes'
import { dispatchMainAction } from './actionHandlers'

const HOTKEY_NS = 'sys.hotkeys'
const DEFAULT_MAIN = 'Alt+Space'
/**
 * 截图全局热键的默认值。2026-09-23 从 ⌘⇧A 换过来（与微信等 IM 的默认截图键撞），
 * 并且从此走这套可配置热键系统注册 —— 以前它是 modules/screenshot.ts 里的硬编码
 * globalShortcut，本文件的冲突检测根本看不见它。
 */
const DEFAULT_SCREENSHOT = 'Alt+Shift+S'
/** 两段式字母直达的等待窗口（毫秒） */
const CHORD_WINDOW_MS = 2000

export interface CommandHotkeySpec {
  kind: 'module' | 'system' | 'quicklink' | 'firstParty'
  /** module id / system cmdId / firstParty page */
  id?: string
  /** module 路由路径 */
  path?: string
  /** quicklink URL */
  url?: string
}

export interface HotkeyConfig {
  main: string
  /** 截图热键；'' 表示用户关掉了它 */
  screenshot: string
  commands: Record<string, CommandHotkeySpec>
  /** 两段式直达：字母（小写 a-z）→ 命令 spec；主热键后按住修饰键再按字母触发 */
  chords: Record<string, CommandHotkeySpec>
}

export function readHotkeyConfig(): HotkeyConfig {
  try {
    const doc = getLauncherDocStore().get(HOTKEY_NS, 'config')
    const data = (doc?.data ?? {}) as Partial<HotkeyConfig>
    return {
      main: typeof data.main === 'string' && data.main ? data.main : DEFAULT_MAIN,
      // 空串是用户主动「关闭截图热键」的有效值，不能一律回落到默认
      screenshot: typeof data.screenshot === 'string' ? data.screenshot : DEFAULT_SCREENSHOT,
      commands: data.commands && typeof data.commands === 'object' ? data.commands : {},
      chords: data.chords && typeof data.chords === 'object' ? data.chords : {}
    }
  } catch {
    return { main: DEFAULT_MAIN, screenshot: DEFAULT_SCREENSHOT, commands: {}, chords: {} }
  }
}

export function writeHotkeyConfig(patch: Partial<HotkeyConfig>): HotkeyConfig {
  const next = { ...readHotkeyConfig(), ...patch }
  getLauncherDocStore().put(HOTKEY_NS, 'config', next)
  return next
}

let registeredAccelerators: string[] = []
let restorerHooked = false

/** 最近一轮注册的冲突清单（设置页呈现；热键被其他应用占用 / 与主热键重复 / 加速器非法） */
export interface HotkeyConflicts {
  /** 主热键注册失败（重试进行中） */
  main: boolean
  /** 截图热键注册失败（被其他应用占用 / 与主热键重复 / 加速器非法） */
  screenshot: boolean
  /** 注册失败的命令热键加速器 */
  commands: string[]
}

let mainConflict = false
let screenshotConflict = false
let commandConflicts: string[] = []

export function getHotkeyConflicts(): HotkeyConflicts {
  return { main: mainConflict, screenshot: screenshotConflict, commands: [...commandConflicts] }
}

/**
 * 主热键注册失败重试（验收发现 2026-09-18）：快速重启时旧实例的 Carbon 热键
 * 尚未从窗口服务器释放，新实例 register 返回 false 且原本永不重试——表现为主热键
 * 彻底失效（打包版快速重启 / 登录启动同样会踩）。指数退避重试直至成功或轮次用尽。
 */
let mainHotkeyRetryTimer: ReturnType<typeof setTimeout> | null = null
const MAIN_HOTKEY_RETRY_DELAYS_MS = [1000, 2000, 4000, 8000, 15000, 30000]

function clearMainHotkeyRetry(): void {
  if (mainHotkeyRetryTimer) {
    clearTimeout(mainHotkeyRetryTimer)
    mainHotkeyRetryTimer = null
  }
}

function scheduleMainHotkeyRetry(): void {
  clearMainHotkeyRetry()
  const attempt = (i: number): void => {
    if (i >= MAIN_HOTKEY_RETRY_DELAYS_MS.length) {
      console.error('[Launcher] 主热键多轮重试后仍未注册成功:', readHotkeyConfig().main)
      return
    }
    mainHotkeyRetryTimer = setTimeout(() => {
      mainHotkeyRetryTimer = null
      const config = readHotkeyConfig()
      // 配置可能在等待期间变更且已由新一轮 registerAllHotkeys 注册成功
      if (registeredAccelerators.includes(config.main)) return
      const ok = globalShortcut.register(config.main, () => onMainHotkey())
      if (ok) {
        registeredAccelerators.push(config.main)
        mainConflict = false // 重试成功，冲突解除
        console.warn('[Launcher] 主热键重试注册成功:', config.main)
      } else {
        attempt(i + 1)
      }
    }, MAIN_HOTKEY_RETRY_DELAYS_MS[i])
  }
  attempt(0)
}

function unregisterAll(): void {
  clearMainHotkeyRetry()
  for (const accel of registeredAccelerators) {
    try {
      globalShortcut.unregister(accel)
    } catch {
      /* noop */
    }
  }
  registeredAccelerators = []
}

/** 命令热键触发：主进程直接分发（无需任何窗口在前台）；
 * system / quicklink 复用统一动作执行端（#4：与胶囊/⌘K 同一执行语义） */
function dispatchCommand(spec: CommandHotkeySpec): void {
  switch (spec.kind) {
    case 'module': {
      if (spec.path) createWindow(`${spec.path}?immersive=1`)
      break
    }
    case 'system': {
      if (spec.id) void dispatchMainAction({ type: 'system', cmdId: spec.id })
      break
    }
    case 'quicklink': {
      // 参数化链接经全局热键触发时无参数输入，退化为打开基础链接
      // （执行端内做 scheme 校验 + 优先复用已有浏览器标签）
      if (spec.url) void dispatchMainAction({ type: 'quicklink', url: spec.url })
      break
    }
    case 'firstParty': {
      showLauncherWindow()
      const capsule = getLauncherWindow()
      // 与 launcher:openFirstParty 同一白名单（本地配置可能过期/损坏）
      if (capsule && spec.id && FIRST_PARTY_PAGE_VALUES.includes(spec.id as never)) {
        capsule.webContents.send('launcher:firstparty:open', { page: spec.id })
      }
      break
    }
  }
}

/** Hyper Key（F18+字母，hyperKey.ts）复用两段式 chord 绑定分发；无绑定返回 false */
export function dispatchChordLetter(letter: string): boolean {
  const spec = readHotkeyConfig().chords[letter]
  if (!spec) return false
  dispatchCommand(spec)
  return true
}

/** 当前活跃的两段式等待窗口（同一时间最多一个） */
let chordCleanup: (() => void) | null = null

/**
 * 主热键按下：切换胶囊 + 开启两段式字母直达窗口。
 * 窗口期内「主热键修饰键仍按住 + 按下已配置字母」→ 直达命令。
 * 要求修饰键按住是关键：与「唤起后直接打字搜索」天然无冲突。
 */
function onMainHotkey(): void {
  toggleLauncherWindow()
  startChordWindow()
}

function startChordWindow(): void {
  const config = readHotkeyConfig()
  const letters = Object.keys(config.chords)
  if (letters.length === 0) return

  const requiredMods = acceleratorModifiers(config.main)
  if (requiredMods.size === 0) return // 主热键无修饰键（如单独 F 键）不支持两段式

  chordCleanup?.()
  const offKeydown = globalKeyHook.onKeydown((e) => {
    if (!modsStillHeld(e, requiredMods)) return
    const letter = keycodeToLetter(e.keycode, e.shiftKey)
    if (!letter) return
    const spec = config.chords[letter]
    if (!spec) return
    endChordWindow()
    dispatchChord(spec)
  })
  const offKeyup = globalKeyHook.onKeyup((e) => {
    // 主热键修饰键松开 → 两段式意图结束。
    // 只认「松开的键本身是修饰键」：keyup 事件的 mask 表示此刻仍按着的键，
    // 对修饰键自身并不可靠；而普通键（如主热键的 Space）松开不应终止窗口。
    const released = keycodeToModifier(e.keycode)
    if (released && requiredMods.has(released)) endChordWindow()
  })
  const timer = setTimeout(endChordWindow, CHORD_WINDOW_MS)
  chordCleanup = () => {
    clearTimeout(timer)
    offKeydown()
    offKeyup()
    chordCleanup = null
  }
}

function endChordWindow(): void {
  chordCleanup?.()
}

function eventModifierSet(e: {
  ctrlKey: boolean
  metaKey: boolean
  altKey: boolean
  shiftKey: boolean
}): Set<string> {
  const mods = new Set<string>()
  if (e.ctrlKey) mods.add('ctrl')
  if (e.metaKey) mods.add('meta')
  if (e.altKey) mods.add('alt')
  if (e.shiftKey) mods.add('shift')
  return mods
}

function modsStillHeld(
  e: { ctrlKey: boolean; metaKey: boolean; altKey: boolean; shiftKey: boolean },
  required: Set<string>
): boolean {
  const held = eventModifierSet(e)
  for (const m of required) {
    if (!held.has(m)) return false
  }
  return true
}

/** 两段式命中：执行命令；胶囊保持唤起态，命令本身决定最终形态 */
function dispatchChord(spec: CommandHotkeySpec): void {
  if (spec.kind === 'firstParty') {
    // 内联页：胶囊已在屏上，直接切页（query 由渲染端 onOpenFirstParty 重置）
    showLauncherWindow()
    const capsule = getLauncherWindow()
    if (capsule && spec.id && FIRST_PARTY_PAGE_VALUES.includes(spec.id as never)) {
      capsule.webContents.send('launcher:firstparty:open', { page: spec.id })
    }
    return
  }
  dispatchCommand(spec)
  // 其余命令直接执行并收起胶囊（唤起只是两段式的中间态）
  getLauncherWindow()?.hide()
}

/** 截图热键触发：延迟 import，理由同 globalShortcuts（避免模块初始化环） */
function onScreenshotHotkey(): void {
  void import('../modules/screenshot').then(({ triggerScreenshot }) => {
    void triggerScreenshot()
  })
}

/** 注册主热键 + 全部命令热键；配置变更 / 快捷键恢复时复用 */
export function registerAllHotkeys(): void {
  unregisterAll()
  mainConflict = false
  screenshotConflict = false
  commandConflicts = []
  const config = readHotkeyConfig()

  const okMain = globalShortcut.register(config.main, () => onMainHotkey())
  if (okMain) {
    registeredAccelerators.push(config.main)
  } else {
    mainConflict = true
    console.error('[Launcher] 主热键注册失败（可能被占用，将自动重试）:', config.main)
    scheduleMainHotkeyRetry()
  }

  // '' = 用户关掉了截图热键；与主热键同串时不注册（Electron 只会留一个，行为看运气）
  if (config.screenshot && config.screenshot !== config.main) {
    try {
      const okShot = globalShortcut.register(config.screenshot, () => onScreenshotHotkey())
      if (okShot) registeredAccelerators.push(config.screenshot)
      else {
        screenshotConflict = true
        console.warn('[Launcher] 截图热键注册失败（可能被占用）:', config.screenshot)
      }
    } catch {
      screenshotConflict = true
      console.warn('[Launcher] 截图热键加速器非法:', config.screenshot)
    }
  }

  for (const [accel, spec] of Object.entries(config.commands)) {
    try {
      const ok = globalShortcut.register(accel, () => dispatchCommand(spec))
      if (ok) registeredAccelerators.push(accel)
      else {
        commandConflicts.push(accel)
        console.warn('[Launcher] 命令热键注册失败:', accel)
      }
    } catch {
      commandConflicts.push(accel)
      console.warn('[Launcher] 命令热键加速器非法:', accel)
    }
  }

  if (!restorerHooked) {
    restorerHooked = true
    // 延迟 import 避免与 globalShortcuts 模块初始化环
    void import('../modules/globalShortcuts').then(({ addShortcutRestorer }) => {
      addShortcutRestorer(registerAllHotkeys)
    })
  }
}

/** 当前已成功注册的加速器（UI 展示/诊断用） */
export function getRegisteredAccelerators(): string[] {
  return [...registeredAccelerators]
}
