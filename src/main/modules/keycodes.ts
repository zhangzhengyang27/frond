/**
 * Leaf · libuiohook keycode 映射（纯函数，可单测）
 *
 * uiohook-napi 上报的 keycode 是 libuiohook 的虚拟键码（VC），即 XT set-1
 * 扫描码体系——与 USB HID usage code 是两套编码（A 在 VC 里是 0x1E 而非
 * 0x04）。可运行时对照依赖包导出的 UiohookKey 常量核实（测试中有对齐断言）。
 * 这里只维护「可打印字符 + 退格 + 修饰键」的 US 布局映射，覆盖片段扩展触发词
 * 与两段式热键字母的需要。中文输入法组合键 / 其他布局不在覆盖范围
 * （触发词建议用字母数字与常见符号）。
 */

/** 退格键（libuiohook VC_BACKSPACE） */
export const VC_BACKSPACE = 0x0e

/** 修饰键 keycode（L/R Ctrl/Shift/Alt/Meta），修饰键本身不进扩展缓冲 */
export const VC_MODIFIERS = new Set<number>([
  0x1d, // Ctrl
  0xe1d, // CtrlRight
  0x2a, // Shift
  0x36, // ShiftRight
  0x38, // Alt
  0xe38, // AltRight
  0xe5b, // Meta（macOS Cmd / Windows Win）
  0xe5c // MetaRight
])

/** keycode → 修饰键名（与 acceleratorModifiers 的集合元素一致）；非修饰键返回 null */
export function keycodeToModifier(keycode: number): 'ctrl' | 'shift' | 'alt' | 'meta' | null {
  switch (keycode) {
    case 0x1d:
    case 0xe1d:
      return 'ctrl'
    case 0x2a:
    case 0x36:
      return 'shift'
    case 0x38:
    case 0xe38:
      return 'alt'
    case 0xe5b:
    case 0xe5c:
      return 'meta'
    default:
      return null
  }
}

/** keycode → [无 shift 字符, 有 shift 字符]（US 布局） */
const CHAR_MAP = new Map<number, [string, string]>([
  // 字母行
  [0x1e, ['a', 'A']],
  [0x30, ['b', 'B']],
  [0x2e, ['c', 'C']],
  [0x20, ['d', 'D']],
  [0x12, ['e', 'E']],
  [0x21, ['f', 'F']],
  [0x22, ['g', 'G']],
  [0x23, ['h', 'H']],
  [0x17, ['i', 'I']],
  [0x24, ['j', 'J']],
  [0x25, ['k', 'K']],
  [0x26, ['l', 'L']],
  [0x32, ['m', 'M']],
  [0x31, ['n', 'N']],
  [0x18, ['o', 'O']],
  [0x19, ['p', 'P']],
  [0x10, ['q', 'Q']],
  [0x13, ['r', 'R']],
  [0x1f, ['s', 'S']],
  [0x14, ['t', 'T']],
  [0x16, ['u', 'U']],
  [0x2f, ['v', 'V']],
  [0x11, ['w', 'W']],
  [0x2d, ['x', 'X']],
  [0x15, ['y', 'Y']],
  [0x2c, ['z', 'Z']],
  // 数字行（shift 产出 US 布局符号）
  [0x02, ['1', '!']],
  [0x03, ['2', '@']],
  [0x04, ['3', '#']],
  [0x05, ['4', '$']],
  [0x06, ['5', '%']],
  [0x07, ['6', '^']],
  [0x08, ['7', '&']],
  [0x09, ['8', '*']],
  [0x0a, ['9', '(']],
  [0x0b, ['0', ')']],
  // 符号区（US 布局）
  [0x39, [' ', ' ']], // Space（同时也是分隔符；未命中触发词时作为普通字符进缓冲）
  [0x27, [';', ':']], // Semicolon
  [0x0d, ['=', '+']], // Equal
  [0x33, [',', '<']], // Comma
  [0x0c, ['-', '_']], // Minus
  [0x34, ['.', '>']], // Period
  [0x35, ['/', '?']], // Slash
  [0x29, ['`', '~']], // Backquote
  [0x1a, ['[', '{']], // BracketLeft
  [0x2b, ['\\', '|']], // Backslash
  [0x1b, [']', '}']], // BracketRight
  [0x28, ["'", '"']] // Quote
])

/** keycode → 字符；不在映射内返回 null（调用方决定 reset 还是忽略） */
export function keycodeToChar(keycode: number, shift: boolean): string | null {
  const pair = CHAR_MAP.get(keycode)
  if (!pair) return null
  return shift ? pair[1] : pair[0]
}

/** keycode → 小写字母（两段式热键字母）；非字母返回 null */
export function keycodeToLetter(keycode: number, shift: boolean): string | null {
  const ch = keycodeToChar(keycode, shift)
  if (!ch) return null
  const lower = ch.toLowerCase()
  return lower >= 'a' && lower <= 'z' ? lower : null
}

/** 解析 Electron accelerator 的修饰键集合（'Alt+Space' → ['alt']）；CommandOrControl 按当前平台解析 */
export function acceleratorModifiers(accelerator: string): Set<string> {
  const mods = new Set<string>()
  for (const part of accelerator.split('+')) {
    const p = part.trim().toLowerCase()
    if (p === 'alt' || p === 'option') mods.add('alt')
    else if (p === 'control' || p === 'ctrl') mods.add('ctrl')
    else if (p === 'commandorcontrol') mods.add(process.platform === 'darwin' ? 'meta' : 'ctrl')
    else if (p === 'meta' || p === 'command' || p === 'cmd' || p === 'super') mods.add('meta')
    else if (p === 'shift') mods.add('shift')
  }
  return mods
}
