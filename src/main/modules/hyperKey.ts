/**
 * Frond · Hyper Key（V4 P1-8，设计见 docs/HYPER_KEY_DESIGN.md 方案 A）
 *
 * 机制：
 * 1. hidutil 系统级重映射 Caps Lock → F18（HID 0x700000039 → 0x700000068），
 *    启用时应用、停用/退出时还原（不做 LaunchAgent 持久化，重启后由应用启动重申）
 * 2. uiohook 监听 F18 keydown/keyup（UiohookKey.F18 = 101）：
 *    - 单按（< TAP_THRESHOLD_MS 且期间未触发命令）→ 快按行为
 *    - 按住 + 字母 → 分发与「两段式直达」相同的 chord 命令绑定
 *
 * 已知实验性限制（文档化接受）：
 * - uiohook 只观察不拦截：按住 Hyper+字母时，字母仍会被输入到前台应用
 * - 重映射是系统级的：启用期间所有应用都看到 F18（这正是 Hyper Key 语义），
 *   与 Karabiner 等虚拟键盘驱动冲突（同 Raycast 限制）
 * - 应用崩溃时重映射会残留，再次启用/停用一次即可还原
 */
import { execFile, execFileSync } from 'child_process'
import { promisify } from 'util'
import { UiohookKey } from 'uiohook-napi'
import { getLauncherDocStore } from '../launcher/docStore'
import { globalKeyHook } from './globalKeys'
import { keycodeToLetter } from './keycodes'
import { dispatchChordLetter } from '../launcher/hotkeys'
import { toggleLauncherWindow } from '../launcher/window'
import { isMac } from '../utils/platform'

const execFileAsync = promisify(execFile)

const HYPERKEY_NS = 'sys.hyperkey'
/** 单按判定阈值（ms）：按下到抬起短于此且期间未触发命令 → 快按 */
export const TAP_THRESHOLD_MS = 300
/** hidutil 重映射表：Caps Lock（0x39）→ F18（0x68），键盘 HID usage page 0x07 */
const HIDUTIL_CAPS_TO_F18 = JSON.stringify({
  UserKeyMapping: [
    {
      HIDKeyboardModifierMappingSrc: 0x700000039,
      HIDKeyboardModifierMappingDst: 0x700000068
    }
  ]
})
const HIDUTIL_CLEAR = JSON.stringify({ UserKeyMapping: [] })

export type QuickPressAction = 'toggle' | 'escape' | 'caps' | 'nothing'

export interface HyperKeyConfig {
  enabled: boolean
  quickPress: QuickPressAction
}

const QUICK_PRESS_VALUES: QuickPressAction[] = ['toggle', 'escape', 'caps', 'nothing']

/** 规范化快按行为（未知值回落 toggle，纯函数可单测） */
export function normalizeQuickPress(v: unknown): QuickPressAction {
  return QUICK_PRESS_VALUES.includes(v as QuickPressAction)
    ? (v as QuickPressAction)
    : 'toggle'
}

/** 单按判定（纯函数，可单测）：窗口期内且期间未触发命令 */
export function decideQuickPress(
  downAt: number,
  upAt: number,
  dispatchedDuringHold: boolean
): boolean {
  return !dispatchedDuringHold && upAt - downAt < TAP_THRESHOLD_MS
}

export function readHyperKeyConfig(): HyperKeyConfig {
  try {
    const doc = getLauncherDocStore().get(HYPERKEY_NS, 'config')
    const data = (doc?.data ?? {}) as Partial<HyperKeyConfig>
    return {
      enabled: data.enabled === true,
      quickPress: normalizeQuickPress(data.quickPress)
    }
  } catch {
    return { enabled: false, quickPress: 'toggle' }
  }
}

export function writeHyperKeyConfig(patch: Partial<HyperKeyConfig>): HyperKeyConfig {
  const next: HyperKeyConfig = { ...readHyperKeyConfig(), ...patch }
  getLauncherDocStore().put(HYPERKEY_NS, 'config', next)
  return next
}

// ── hidutil 系统级重映射（mac only；execFile 参数数组，无 shell 层）──

export async function applyCapsRemap(): Promise<void> {
  await execFileAsync('hidutil', ['property', '--set', HIDUTIL_CAPS_TO_F18])
}

export async function clearCapsRemap(): Promise<void> {
  await execFileAsync('hidutil', ['property', '--set', HIDUTIL_CLEAR])
}

/**
 * will-quit 用的同步版：异步 execFile 在窗口期内不一定跑完，
 * 崩溃/退出时系统映射会留在Caps→F18 上，下次开机前键盘都是错的。
 */
export function clearCapsRemapSync(): void {
  execFileSync('hidutil', ['property', '--set', HIDUTIL_CLEAR])
}

// ── F18 监听与分发 ──

class HyperKeyService {
  private active = false
  private hyperHeld = false
  private downAt = 0
  private dispatchedDuringHold = false
  private unsubscribers: Array<() => void> = []

  isActive(): boolean {
    return this.active
  }

  /** 启用：应用系统重映射 + 挂 uiohook 监听。重复调用幂等。 */
  async enable(): Promise<void> {
    if (this.active || !isMac()) return
    await applyCapsRemap()
    this.unsubscribers.push(
      globalKeyHook.onKeydown((e) => this.onKeydown(e.keycode)),
      globalKeyHook.onKeyup((e) => this.onKeyup(e.keycode))
    )
    this.active = true
  }

  /** 停用：还原系统重映射 + 解绑监听。重复调用幂等。 */
  async disable(): Promise<void> {
    if (!this.active) return
    this.active = false
    this.hyperHeld = false
    for (const off of this.unsubscribers) off()
    this.unsubscribers = []
    await clearCapsRemap()
  }

  private onKeydown(keycode: number): void {
    if (!this.active) return
    if (keycode === UiohookKey.F18) {
      if (!this.hyperHeld) {
        this.hyperHeld = true
        this.downAt = Date.now()
        this.dispatchedDuringHold = false
      }
      return
    }
    if (!this.hyperHeld) return
    const letter = keycodeToLetter(keycode, false)
    if (letter && dispatchChordLetter(letter)) {
      this.dispatchedDuringHold = true
    }
  }

  private onKeyup(keycode: number): void {
    if (!this.active) return
    if (keycode === UiohookKey.F18 && this.hyperHeld) {
      this.hyperHeld = false
      if (decideQuickPress(this.downAt, Date.now(), this.dispatchedDuringHold)) {
        this.runQuickPress()
      }
    }
  }

  private runQuickPress(): void {
    const { quickPress } = readHyperKeyConfig()
    switch (quickPress) {
      case 'toggle':
        toggleLauncherWindow()
        break
      case 'escape':
      case 'caps': {
        // ESC(53) / 真 Caps(57)：osascript 注入的合成事件在 HID 层之上，
        // 不会被 hidutil 重映射二次改写（caps 仍是真 Caps）
        const key = quickPress === 'escape' ? 53 : 57
        execFile('osascript', ['-e', `tell application "System Events" to key code ${key}`]).unref?.()
        break
      }
      case 'nothing':
        break
    }
  }
}

export const hyperKeyService = new HyperKeyService()
