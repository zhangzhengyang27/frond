/**
 * Frond · 系统命令与窗口管理（M2.1 / M2.2 / B3）
 *
 * 系统命令：锁屏 / 睡眠 / 屏保 / 清空废纸篓 / 静音切换 / 显示桌面，
 * 按平台分发（macOS osascript / Windows 原生工具），统一 system:* 通道。
 * B3 补齐（对齐 Raycast System Actions）：媒体控制（播放暂停 / 上一首 / 下一首）、
 * 音量五档、Quit All Apps（±保留前台）、Hide All Except Frontmost、
 * Dismiss Notifications、Eject All Disks。
 * 窗口管理：对「前台应用窗口」执行 左半 / 右半 / 上半 / 下半 / 四分 / 三分 / 六分 /
 * 最大高度 / 最大宽度 / 居中 / 最大化 / 还原 / 下一显示器——
 * macOS 走 osascript System Events（需要辅助功能权限，失败时返回授权提示），
 * Windows 走 PowerShell + SetWindowPos。
 *
 * 设计约束：执行端在主进程，胶囊/⌘K 只发 IPC；命令失败不抛（返回 ok=false + 提示）。
 * 安全约束：B3 起新增命令一律 execFile 传参（osascript / powershell -EncodedCommand），
 * 严禁 shell 字符串拼接；脚本内插值仅限模块内常量（音量档位 / NX 媒体键码），
 * 需要运行时参数的一律走 osascript `on run argv`（execFile 参数数组，无 shell 层）。
 */
import { app, screen, Notification } from 'electron'
import { exec, execFile } from 'child_process'
import { promisify } from 'util'
import { basename } from 'path'
import { isMac, isWin } from '../utils/platform'
import { getLauncherWindow } from '../launcher/window'
import { computeWindowRect, roundRect, type Rect } from './windowGeometry'
import { prefRepository } from '../db/repos'
import { typedHandle } from '../ipc/typedIpc'

/** 窗口 gap（px，窗口与屏幕边缘留白；pref launcher:windowGap，默认 0）。
 *  每次执行时实时读，设置页改动即时生效（V4 P1-7 批次3） */
export function windowGap(): number {
  try {
    const raw = prefRepository.get('launcher:windowGap')
    const n = raw === null ? Number.NaN : Number(raw)
    return Number.isFinite(n) && n >= 0 && n <= 200 ? Math.round(n) : 0
  } catch {
    return 0
  }
}

/** 平台命令执行（promise 化，超时兜底；stdout 供 nextDisplay 探测窗口位置用） */
function run(
  cmd: string,
  timeoutMs = 5000
): Promise<{ ok: boolean; stdout?: string; stderr?: string }> {
  return new Promise((resolve) => {
    const child = exec(cmd, { timeout: timeoutMs }, (error, stdout, stderr) => {
      if (error)
        resolve({
          ok: false,
          stdout: String(stdout || ''),
          stderr: String(stderr || error.message).slice(0, 300)
        })
      else resolve({ ok: true, stdout: String(stdout || '') })
    })
    child.on('error', () => resolve({ ok: false, stderr: 'spawn failed' }))
  })
}

// ─── 系统命令 ───

const MAC_COMMANDS: Record<string, string> = {
  'system.lock': `osascript -e 'tell application "System Events" to keystroke "q" using {command down, control down}'`,
  'system.sleep': `pmset sleepnow`,
  'system.screensaver': `open -a ScreenSaverEngine`,
  'system.restart': `osascript -e 'tell application "System Events" to restart'`,
  'system.shutdown': `osascript -e 'tell application "System Events" to shut down'`,
  'system.emptyTrash': `osascript -e 'tell application "Finder" to empty trash'`,
  'system.hideAll': `osascript -e 'tell application "System Events" to set visible of every process whose visible is true to false'`,
  'system.muteToggle': `osascript -e 'set o to output volume of (get volume settings)' -e 'if o > 0 then set volume output volume 0 else set volume output volume 50' -e 'set volume output muted (not output muted of (get volume settings))'`,
  'system.showDesktop': `osascript -e 'tell application "System Events" to key code 103 using {function down, command down}'`
}

const WIN_COMMANDS: Record<string, string> = {
  'system.lock': `rundll32.exe user32.dll,LockWorkStation`,
  'system.sleep': `powershell -NoProfile -Command "Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.Application]::SetSuspendState('Suspend', $false, $false)"`,
  'system.screensaver': `rundll32.exe user32.dll,LockWorkStation`,
  'system.restart': `shutdown /r /t 0`,
  'system.shutdown': `shutdown /s /t 0`,
  'system.emptyTrash': `powershell -NoProfile -Command "Clear-RecycleBin -Force -ErrorAction SilentlyContinue"`,
  'system.hideAll': `powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).ToggleDesktop()"`,
  'system.muteToggle': `powershell -NoProfile -Command "(New-Object -ComObject WScript.Shell).SendKeys([char]173)"`,
  'system.showDesktop': `powershell -NoProfile -Command "(New-Object -ComObject Shell.Application).ToggleDesktop()"`
}

export function getSystemCommandIds(): string[] {
  const legacy = Object.keys(isMac() ? MAC_COMMANDS : WIN_COMMANDS)
  return [...new Set([...legacy, ...B3_COMMAND_IDS])]
}

export async function runSystemCommand(id: string): Promise<{ ok: boolean; error?: string }> {
  // B3 新命令优先命中；未命中回落到 M2.1 静态命令表
  const b3 = await runB3SystemCommand(id)
  if (b3) return b3
  const cmd = (isMac() ? MAC_COMMANDS : WIN_COMMANDS)[id]
  if (!cmd) return { ok: false, error: `unsupported: ${id}` }
  const r = await run(cmd)
  if (!r.ok && isMac()) {
    // macOS 系统命令大多走 System Events，失败几乎都是辅助功能权限未授权
    return {
      ok: false,
      error: '需要辅助功能权限：系统设置 → 隐私与安全性 → 辅助功能，勾选本应用后重试'
    }
  }
  return { ok: r.ok, error: r.stderr }
}

// ─── 系统命令 B3 补齐（对齐 Raycast System Actions）───

const execFileAsync = promisify(execFile)

/** 平台命令结果（stderr 仅 B3 执行层内部流转，出错后转成中文 error 提示） */
type CommandResult = { ok: boolean; error?: string; stderr?: string }

/** execFile promise 化（带超时兜底）；参数数组直达进程，无 shell 解析层 */
async function runExecFile(
  file: string,
  args: string[],
  timeoutMs: number
): Promise<{ ok: boolean; stdout?: string; stderr?: string }> {
  try {
    const { stdout } = await execFileAsync(file, args, {
      timeout: timeoutMs,
      maxBuffer: 1024 * 1024
    })
    return { ok: true, stdout: String(stdout ?? '') }
  } catch (err) {
    const e = err as { stderr?: string; message?: string }
    return { ok: false, stderr: String(e.stderr || e.message || 'command failed').slice(0, 300) }
  }
}

/** osascript 执行：args = ['-e', script, ...argv]；argv 仅传模块内派生的可信字符串 */
async function runOsascript(
  args: string[],
  timeoutMs = 5000
): Promise<{ ok: boolean; stdout?: string; stderr?: string }> {
  const r = await runExecFile('osascript', args, timeoutMs)
  return { ok: r.ok, stdout: r.stdout, stderr: r.stderr }
}

/** PowerShell 执行：-EncodedCommand（UTF-16LE base64）绕过 cmd→powershell 引号解析层 */
async function runPowershellScript(script: string, timeoutMs = 8000): Promise<CommandResult> {
  const r = await runExecFile(
    'powershell',
    [
      '-NoProfile',
      '-NonInteractive',
      '-EncodedCommand',
      Buffer.from(script, 'utf16le').toString('base64')
    ],
    timeoutMs
  )
  return { ok: r.ok, stderr: r.stderr }
}

/** osascript 失败信息 → 中文提示（辅助功能 / 自动化授权是最常见失败原因） */
function osascriptErrorHint(stderr: string): string {
  if (/assistive|accessib|not allowed/i.test(stderr)) {
    return '需要辅助功能权限：系统设置 → 隐私与安全性 → 辅助功能，勾选本应用后重试'
  }
  if (/not authorized|-1743|errAEEventNotPermitted/i.test(stderr)) {
    return '需要自动化权限：系统设置 → 隐私与安全性 → 自动化，允许本应用控制系统事件 / Finder'
  }
  return (stderr || '命令执行失败').trim()
}

// ── 媒体控制 ──

/** NX 媒体键码（IOKit hidsystem/ev_keymap.h）：NX_KEYTYPE_PLAY=16 / FAST=19 / REWIND=20 */
export const MEDIA_KEYS = { playPause: 16, nextTrack: 19, previousTrack: 20 } as const

/**
 * NSSystemDefined 媒体事件的 data1 编码：键码 << 16 | 键状态 << 8（0xA 按下 / 0xB 抬起）。
 * data1/data2 存放在 CGEventField 9/10（与键盘 keycode/keyboardtype 同槽位）。
 */
export function mediaKeyData1(keycode: number, pressed: boolean): number {
  return (keycode << 16) | ((pressed ? 0xa : 0xb) << 8)
}

/** macOS 媒体键合成脚本（JXA ObjC 桥 + CGEventPost 到 kCGHIDEventTap）。
 *  事件基座取 CGEventCreateMouseEvent（实测 Ref 桥接最稳），整体改写为
 *  NSSystemDefined(14) + subtype 8（NX_SUBTYPE_AUX_CONTROL_BUTTONS），
 *  press + release 成对投递。对任意前台播放器生效（Raycast 同机制）。 */
function macMediaKeyScript(keycode: number): string {
  const down = mediaKeyData1(keycode, true)
  const up = mediaKeyData1(keycode, false)
  return `ObjC.import("CoreGraphics")
const ev = $.CGEventCreateMouseEvent($(), $.kCGEventLeftMouseDown, $.CGPointMake(0, 0), $.kCGMouseButtonLeft)
$.CGEventSetType(ev, 14)
$.CGEventSetIntegerValueField(ev, 7, 8)
$.CGEventSetIntegerValueField(ev, 9, ${down})
$.CGEventSetIntegerValueField(ev, 10, -1)
$.CGEventPost(0, ev)
$.CGEventSetIntegerValueField(ev, 9, ${up})
$.CGEventPost(0, ev)`
}

/** Windows 媒体键注入：keybd_event + VK_MEDIA_*（0xB0 下一首 / 0xB1 上一首 / 0xB3 播放暂停） */
function winMediaKeyScript(vk: number): string {
  return `Add-Type @'
using System;
using System.Runtime.InteropServices;
public class FrondMediaKey {
  [DllImport("user32.dll")]
  public static extern void keybd_event(byte vk, byte scan, uint flags, UIntPtr extra);
}
'@
[FrondMediaKey]::keybd_event(${vk}, 0, 0, [UIntPtr]::Zero)
Start-Sleep -Milliseconds 30
[FrondMediaKey]::keybd_event(${vk}, 0, 2, [UIntPtr]::Zero)`
}

const WIN_MEDIA_VK: Record<number, number> = {
  [MEDIA_KEYS.playPause]: 0xb3,
  [MEDIA_KEYS.nextTrack]: 0xb0,
  [MEDIA_KEYS.previousTrack]: 0xb1
}

/** mac 媒体控制：优先系统媒体键合成；失败时兜底直连「运行中的」常见播放器
 *  （is running 判断避免把未启动的 Music/Spotify 拉起来） */
async function macMediaControl(keycode: number, fallbackAction: string): Promise<CommandResult> {
  const posted = await runOsascript(['-l', 'JavaScript', '-e', macMediaKeyScript(keycode)], 4000)
  if (posted.ok) return { ok: true }
  for (const player of ['Music', 'Spotify']) {
    const probe = await runOsascript([
      '-e',
      `if application "${player}" is running then\n  tell application "${player}" to ${fallbackAction}\n  return 1\nend if\nreturn 0`
    ])
    if (probe.ok && probe.stdout?.trim() === '1') return { ok: true }
  }
  return { ok: false, error: osascriptErrorHint(posted.stderr ?? '') }
}

// ── 音量五档 ──

/** 音量档位（Raycast System Actions 同款五档；自定义档位后续按需扩展） */
export const VOLUME_PRESETS = [0, 25, 50, 75, 100] as const

export function volumeIdOf(pct: number): string {
  return `system.volume${pct}`
}

/** 'system.volume25' → 25；仅接受预设档位且拒绝前导零（校验后才允许进脚本，杜绝拼出任意数字） */
export function volumePercentOf(id: string): number | null {
  const m = /^system\.volume((?:0|100|[1-9]\d?))$/.exec(id)
  if (!m) return null
  const pct = Number(m[1])
  return (VOLUME_PRESETS as readonly number[]).includes(pct) ? pct : null
}

async function runSetVolume(pct: number): Promise<CommandResult> {
  if (isMac()) {
    // set volume 不经 System Events，无需辅助功能权限
    const r = await runOsascript(['-e', `set volume output volume ${pct}`])
    return r.ok ? { ok: true } : { ok: false, error: osascriptErrorHint(r.stderr ?? '') }
  }
  if (isWin()) {
    const r = await runPowershellScript(winSetVolumeScript(pct), 10000)
    return r.ok ? { ok: true } : { ok: false, error: r.stderr || '音量设置失败' }
  }
  return { ok: false, error: '当前平台暂不支持该系统命令' }
}

/** Windows 绝对音量：Core Audio IAudioEndpointVolume（COM interop，vtable 按头文件顺序声明前缀） */
function winSetVolumeScript(pct: number): string {
  return `Add-Type -TypeDefinition @'
using System;
using System.Runtime.InteropServices;

[ComImport, Guid("BCDE0395-E52F-467C-8E3D-C4579291692E")]
class MMDeviceEnumeratorComObject {}

[Guid("A95664D2-9614-4F35-A746-DE8DB63617E6"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDeviceEnumerator {
  int EnumAudioEndpoints(int dataFlow, int stateMask, IntPtr devices);
  int GetDefaultAudioEndpoint(int dataFlow, int role, out IMMDevice endpoint);
}

[Guid("D666063F-1587-4E43-81F1-B948E807363F"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IMMDevice {
  int Activate(ref Guid iid, int clsCtx, IntPtr activationParams, out IAudioEndpointVolume iface);
}

[Guid("5CDF2C82-F84B-441E-8A9A-F10AA9F3E1F9"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
interface IAudioEndpointVolume {
  int RegisterControlChangeNotify(IntPtr notify);
  int UnregisterControlChangeNotify(IntPtr notify);
  int GetChannelCount(out uint count);
  int SetMasterVolumeLevel(float level, Guid ctx);
  int SetMasterVolumeLevelScalar(float level, Guid ctx);
  int GetMasterVolumeLevel(out float level);
  int GetMasterVolumeLevelScalar(out float level);
  int SetChannelVolumeLevel(int idx, float level, Guid ctx);
  int SetChannelVolumeLevelScalar(int idx, float level, Guid ctx);
  int GetChannelVolumeLevel(int idx, out float level);
  int GetChannelVolumeLevelScalar(int idx, out float level);
  int SetMute(bool mute, Guid ctx);
  int GetMute(out bool mute);
}

public static class FrondVolume {
  public static void Set(int pct) {
    var en = (IMMDeviceEnumerator)(object)new MMDeviceEnumeratorComObject();
    IMMDevice dev;
    en.GetDefaultAudioEndpoint(0, 1, out dev);
    var iid = typeof(IAudioEndpointVolume).GUID;
    IAudioEndpointVolume vol;
    dev.Activate(ref iid, 1, IntPtr.Zero, out vol);
    vol.SetMasterVolumeLevelScalar(pct / 100f, Guid.Empty);
  }
}
'@
[FrondVolume]::Set(${pct})`
}

// ── Quit All Apps / Hide All Except Frontmost ──

/** System Events 的进程名 = 可执行文件名（dev 为 Electron，打包后为 Frond） */
function selfProcessName(): string {
  return basename(process.execPath)
}

/** 胶囊隐藏后等前台交还（macOS 激活切换的落地窗口期） */
const CAPSULE_HIDE_SETTLE_MS = 250

/**
 * 解析「前台应用」（Raycast 语义：调起命令面板之前你在用的应用）。
 * 只有 Frond 胶囊本身（launcher window 实例）持有焦点时才先隐藏自己，
 * 等系统把前台交还上一个应用后再探测——不能按「isFocused && isAlwaysOnTop」
 * 泛化判定：Pin 贴纸/悬浮笔记也是置顶窗，误隐藏后不会有人恢复它们。
 * 主窗 / 设置窗 / ⌘K 面板（非胶囊）聚焦时探测到 Frond 自身进程名，
 * 调用方降级为「不保留」——已知局限，文档化接受。
 * 探测失败返回 null。
 */
async function resolveFrontmostName(): Promise<string | null> {
  const launcher = getLauncherWindow()
  if (launcher && !launcher.isDestroyed() && launcher.isFocused()) {
    launcher.hide()
    await new Promise((resolve) => setTimeout(resolve, CAPSULE_HIDE_SETTLE_MS))
  }
  const probe = await runOsascript([
    '-e',
    'tell application "System Events" to get name of first application process whose frontmost is true'
  ])
  if (!probe.ok) return null
  const name = (probe.stdout ?? '').trim()
  return name || null
}

/** 逐个优雅退出可见前台应用（tell application … quit，可触发保存提示）。
 *  跳过 Finder 与 Frond 自身；argv[2] 非空时额外保留该应用。
 *  argv 经 execFile 参数数组传入，无 shell 解析层。 */
const MAC_QUIT_ALL_SCRIPT = `on run argv
  set _self to item 1 of argv as text
  set _keep to item 2 of argv as text
  set _skipped to {"Finder", _self}
  tell application "System Events"
    set _names to name of every application process whose visible is true and background only is false
  end tell
  set _quitCount to 0
  repeat with _n in _names
    set _appName to _n as text
    if _skipped does not contain _appName and (_keep is "" or _appName is not _keep) then
      try
        tell application _appName to quit
        set _quitCount to _quitCount + 1
      end try
    end if
  end repeat
  return _quitCount as text
end run`

/** Windows 优雅关闭带主窗口的进程（CloseMainWindow = 点 X，非强杀）；
 *  resolveFrontmost 为 true 时先解析前台窗口进程并保留之（Raycast「保留前台」语义） */
function winQuitAllScript(resolveFrontmost: boolean): string {
  const fgProbe = resolveFrontmost
    ? `$keepName = ''
Add-Type @'
using System;
using System.Runtime.InteropServices;
public class FrondFG {
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
}
'@
$fg = [FrondFG]::GetForegroundWindow()
if ($fg -ne [IntPtr]::Zero) {
  $fgPid = 0
  [void][FrondFG]::GetWindowThreadProcessId($fg, [ref]$fgPid)
  $fgProc = Get-Process -Id $fgPid -ErrorAction SilentlyContinue
  if ($fgProc) { $keepName = $fgProc.ProcessName }
}
`
    : ''
  return `${fgProbe}$self = [System.Diagnostics.Process]::GetCurrentProcess().Id
$selfName = [System.Diagnostics.Process]::GetCurrentProcess().ProcessName
Get-Process | Where-Object {
  $_.MainWindowHandle -ne 0 -and
  $_.Id -ne $self -and
  $_.ProcessName -ne $selfName -and
  $_.ProcessName -ne $keepName -and
  $_.ProcessName -notin @('explorer')
} | ForEach-Object { try { [void]$_.CloseMainWindow() } catch {} }`
}

async function runQuitAllApps(keepFrontmost: boolean): Promise<CommandResult> {
  if (isMac()) {
    let keep = ''
    if (keepFrontmost) {
      const front = await resolveFrontmostName()
      if (front && front !== selfProcessName()) keep = front
    }
    const r = await runOsascript(['-e', MAC_QUIT_ALL_SCRIPT, selfProcessName(), keep], 15000)
    return r.ok ? { ok: true } : { ok: false, error: osascriptErrorHint(r.stderr ?? '') }
  }
  if (isWin()) {
    const r = await runPowershellScript(winQuitAllScript(keepFrontmost), 15000)
    return r.ok ? { ok: true } : { ok: false, error: r.stderr || '批量退出应用失败' }
  }
  return { ok: false, error: '当前平台暂不支持该系统命令' }
}

/** 隐藏除前台应用外的所有可见应用（self 不动；argv[1] 为空 = 全部隐藏） */
const MAC_HIDE_EXCEPT_FRONTMOST_SCRIPT = `on run argv
  set _keep to item 1 of argv as text
  set _self to item 2 of argv as text
  tell application "System Events"
    if _keep is "" then
      set visible of (every application process whose visible is true and name is not _self) to false
    else
      set visible of (every application process whose visible is true and name is not _keep and name is not _self) to false
    end if
  end tell
end run`

async function runHideAllExceptFrontmost(): Promise<CommandResult> {
  if (isMac()) {
    const front = await resolveFrontmostName()
    const keep = front && front !== selfProcessName() ? front : ''
    const r = await runOsascript(
      ['-e', MAC_HIDE_EXCEPT_FRONTMOST_SCRIPT, keep, selfProcessName()],
      8000
    )
    return r.ok ? { ok: true } : { ok: false, error: osascriptErrorHint(r.stderr ?? '') }
  }
  // Windows：无可靠「隐藏其他应用」原生路径（ToggleDesktop 是 Show Desktop 语义），暂不支持
  return { ok: false, error: '当前平台暂不支持该系统命令' }
}

// ── Dismiss Notifications / Eject All Disks ──

/** 尽力版：递归执行通知中心 UI 树上名字含 Close / Clear 的动作。
 *  macOS 13+ 通知中心 UI 结构随大版本变动，动作名可达性待实机验证；
 *  无通知窗口时按成功幂等返回。 */
const MAC_DISMISS_NOTIFICATIONS_SCRIPT = `on dismissTree(el)
  tell application "System Events"
    try
      repeat with a in (actions of el whose name contains "Close")
        perform a
      end repeat
    end try
    try
      repeat with a in (actions of el whose name contains "Clear")
        perform a
      end repeat
    end try
    try
      set _subs to UI elements of el
      repeat with _sub in _subs
        my dismissTree(_sub)
      end repeat
    end try
  end tell
end dismissTree

tell application "System Events"
  if not (exists process "NotificationCenter") then return
  if (count of windows of process "NotificationCenter") is 0 then return
  my dismissTree(window 1 of process "NotificationCenter")
end tell`

async function runDismissNotifications(): Promise<CommandResult> {
  if (isMac()) {
    const r = await runOsascript(['-e', MAC_DISMISS_NOTIFICATIONS_SCRIPT], 10000)
    return r.ok ? { ok: true } : { ok: false, error: osascriptErrorHint(r.stderr ?? '') }
  }
  return { ok: false, error: '当前平台暂不支持该系统命令' }
}

/** Finder 逐盘弹出（可移动磁盘 / 卷），无可弹出盘时按成功幂等返回 */
const MAC_EJECT_ALL_DISKS_SCRIPT = `tell application "Finder"
  set _disks to (every disk whose ejectable is true)
  repeat with d in _disks
    try
      eject d
    end try
  end repeat
end tell`

/** Windows 尽力版：经 Shell COM 对挂载卷执行「弹出」动词 */
const WIN_EJECT_ALL_DISKS_SCRIPT = `$shell = New-Object -ComObject Shell.Application
$drives = $shell.NameSpace(17).Items()
foreach ($d in $drives) {
  foreach ($v in $d.Verbs()) {
    $n = $v.Name -replace '&', ''
    if ($n -eq 'Eject' -or $n -eq '弹出') { $v.DoIt() }
  }
}`

async function runEjectAllDisks(): Promise<CommandResult> {
  if (isMac()) {
    const r = await runOsascript(['-e', MAC_EJECT_ALL_DISKS_SCRIPT], 10000)
    return r.ok ? { ok: true } : { ok: false, error: osascriptErrorHint(r.stderr ?? '') }
  }
  if (isWin()) {
    const r = await runPowershellScript(WIN_EJECT_ALL_DISKS_SCRIPT, 10000)
    return r.ok ? { ok: true } : { ok: false, error: r.stderr || '弹出磁盘失败' }
  }
  return { ok: false, error: '当前平台暂不支持该系统命令' }
}

// ── B3 命令注册表与分发 ──

/** B3 新增命令 id 清单（媒体 3 + 音量 5 + 退出 2 + 隐藏 1 + 通知 1 + 弹盘 1） */
export const B3_COMMAND_IDS: string[] = [
  'system.playPause',
  'system.nextTrack',
  'system.previousTrack',
  ...VOLUME_PRESETS.map(volumeIdOf),
  'system.quitAllApps',
  'system.quitAllAppsExceptFrontmost',
  'system.hideAllExceptFrontmost',
  'system.dismissNotifications',
  'system.ejectAllDisks'
]

const B3_HANDLERS: Record<string, () => Promise<CommandResult>> = {
  'system.playPause': () => macWinMedia(MEDIA_KEYS.playPause, 'playpause'),
  'system.nextTrack': () => macWinMedia(MEDIA_KEYS.nextTrack, 'next track'),
  'system.previousTrack': () => macWinMedia(MEDIA_KEYS.previousTrack, 'previous track'),
  'system.quitAllApps': () => runQuitAllApps(false),
  'system.quitAllAppsExceptFrontmost': () => runQuitAllApps(true),
  'system.hideAllExceptFrontmost': () => runHideAllExceptFrontmost(),
  'system.dismissNotifications': () => runDismissNotifications(),
  'system.ejectAllDisks': () => runEjectAllDisks(),
  ...Object.fromEntries(VOLUME_PRESETS.map((pct) => [volumeIdOf(pct), () => runSetVolume(pct)]))
}

function macWinMedia(keycode: number, fallbackAction: string): Promise<CommandResult> {
  if (isMac()) return macMediaControl(keycode, fallbackAction)
  if (isWin()) {
    const vk = WIN_MEDIA_VK[keycode] ?? 0xb3
    return runPowershellScript(winMediaKeyScript(vk)).then((r) =>
      r.ok ? { ok: true } : { ok: false, error: r.stderr || '媒体键注入失败' }
    )
  }
  return Promise.resolve({ ok: false, error: '当前平台暂不支持该系统命令' })
}

/** B3 命令分发：命中返回执行结果，未命中返回 null（交回旧命令表） */
export async function runB3SystemCommand(id: string): Promise<CommandResult | null> {
  const handler = B3_HANDLERS[id]
  if (!handler) return null
  try {
    return await handler()
  } catch (err) {
    return { ok: false, error: ((err as Error).message || '命令执行失败').slice(0, 200) }
  }
}

// ─── 窗口管理（M2.2）───

type WinAction =
  | 'left'
  | 'right'
  | 'maximize'
  | 'restore'
  | 'top'
  | 'bottom'
  | 'topLeft'
  | 'topRight'
  | 'bottomLeft'
  | 'bottomRight'
  | 'center'
  | 'nextDisplay'
  | 'maximizeHeight'
  | 'maximizeWidth'
  | 'thirdFirst'
  | 'thirdFirstTwo'
  | 'thirdCenter'
  | 'thirdLastTwo'
  | 'thirdLast'
  | 'sixthTopLeft'
  | 'sixthTopCenter'
  | 'sixthTopRight'
  | 'sixthBottomLeft'
  | 'sixthBottomCenter'
  | 'sixthBottomRight'

const WINDOW_ACTIONS: WinAction[] = [
  'left',
  'right',
  'maximize',
  'restore',
  'top',
  'bottom',
  'topLeft',
  'topRight',
  'bottomLeft',
  'bottomRight',
  'center',
  'nextDisplay',
  'maximizeHeight',
  'maximizeWidth',
  'thirdFirst',
  'thirdFirstTwo',
  'thirdCenter',
  'thirdLastTwo',
  'thirdLast',
  'sixthTopLeft',
  'sixthTopCenter',
  'sixthTopRight',
  'sixthBottomLeft',
  'sixthBottomCenter',
  'sixthBottomRight'
]

/** macOS 窗口几何（V4 P1-7 批次3 重构）：「JS 算矩形 + AppleScript 只写值」。
 *  workArea 取 Electron screen.getPrimaryDisplay().workArea（与旧 Finder 桌面
 *  bounds 同为主屏可见区域），gap 从偏好读取；restore（zoom 切换）与
 *  nextDisplay 有专门路径，不经此函数。 */
const MAC_PROBE_WINDOW_CMD = `osascript -e 'tell application "System Events" to set _app to name of first application process whose frontmost is true' -e 'tell application "System Events" to tell process _app to get (position of front window) & (size of front window)'`

async function macProbeFrontWindow(): Promise<{ ok: boolean; rect?: Rect }> {
  const probe = await run(MAC_PROBE_WINDOW_CMD, 4000)
  const nums = String(probe.stdout ?? '').match(/-?\d+/g)
  if (!probe.ok || !nums || nums.length < 4) return { ok: false }
  const [x, y, w, h] = nums.map(Number)
  return { ok: true, rect: { x, y, width: w, height: h } }
}

/** mac restore：zoom 切换（系统级记忆上一次尺寸/位置，真还原语义） */
const MAC_RESTORE_CMD = `osascript -e 'tell application "System Events" to set _app to name of first application process whose frontmost is true' -e 'tell application "System Events" to tell process _app to set zoomed of front window to not zoomed of front window'`

/** mac 几何动作统一执行：探测前台窗口 → JS 计算目标矩形（含 gap）→ AppleScript 写回 */
async function macApplyGeometry(
  action: Exclude<WinAction, 'restore' | 'nextDisplay'>
): Promise<{ ok: boolean; error?: string }> {
  const workArea = screen.getPrimaryDisplay().workArea
  const probe = await macProbeFrontWindow()
  if (!probe.ok || !probe.rect) return { ok: false, error: '无法读取前台窗口位置' }
  let target: Rect
  try {
    target = roundRect(computeWindowRect(action, workArea, windowGap(), probe.rect))
  } catch (error) {
    return { ok: false, error: (error as Error).message }
  }
  const apply = await run(
    `osascript -e 'tell application "System Events" to set _app to name of first application process whose frontmost is true' -e 'tell application "System Events" to tell process _app to set position of front window to {${target.x}, ${target.y}}' -e 'tell application "System Events" to tell process _app to set size of front window to {${target.width}, ${target.height}}'`,
    5000
  )
  return { ok: apply.ok, error: apply.stderr }
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), Math.max(lo, hi))
}

/** macOS：nextDisplay——用 Electron screen 模块取全部显示器 workArea 做循环
 *  （AppleScript 侧拿不到可靠的显示器列表），窗口位置仍经 osascript 读写；
 *  尺寸与相对 workArea 位置保持不变。 */
async function macMoveToNextDisplay(): Promise<{ ok: boolean; error?: string }> {
  const displays = screen.getAllDisplays()
  if (displays.length <= 1) return { ok: true } // 单显示器无处可去，按成功幂等
  const probe = await run(
    `osascript -e 'tell application "System Events" to set _app to name of first application process whose frontmost is true' -e 'tell application "System Events" to tell process _app to get (position of front window) & (size of front window)'`,
    4000
  )
  const nums = String(probe.stdout ?? '').match(/-?\d+/g)
  if (!probe.ok || !nums || nums.length < 4) {
    return { ok: false, error: '无法读取前台窗口位置' }
  }
  const [wx, wy, ww, wh] = nums.map(Number)
  const cur = screen.getDisplayNearestPoint({ x: wx, y: wy })
  const curIdx = Math.max(
    0,
    displays.findIndex((d) => d.id === cur.id)
  )
  const next = displays[(curIdx + 1) % displays.length]
  // 相对 workArea 的偏移平移到目标屏，越界时夹回目标屏可见区域内
  const nx = clamp(
    next.workArea.x + (wx - cur.workArea.x),
    next.workArea.x,
    next.workArea.x + Math.max(0, next.workArea.width - ww)
  )
  const ny = clamp(
    next.workArea.y + (wy - cur.workArea.y),
    next.workArea.y,
    next.workArea.y + Math.max(0, next.workArea.height - wh)
  )
  const apply = await run(
    `osascript -e 'tell application "System Events" to set _app to name of first application process whose frontmost is true' -e 'tell application "System Events" to tell process _app to set position of front window to {${nx}, ${ny}}'`,
    4000
  )
  return { ok: apply.ok, error: apply.stderr }
}

/** Windows：PowerShell 对前台窗口 SetWindowPos。
 *  新动作统一走 -EncodedCommand（UTF-16LE base64）：内联 -Command 经 cmd →
 *  PowerShell 两层引号解析会吃掉 C# 里 "user32.dll" 的引号（Add-Type 编译失败），
 *  base64 参数不含引号，是最稳的传法。 */
function winEncodedCommand(script: string): string {
  return `powershell -NoProfile -EncodedCommand ${Buffer.from(script, 'utf16le').toString('base64')}`
}

/** Windows 新动作共用的前置段：P/Invoke 声明 + 前台窗口与其所在屏的 workArea */
const WIN_WINDOW_HEAD = `Add-Type @'
using System;
using System.Runtime.InteropServices;
public class W {
  [DllImport("user32.dll")] public static extern bool SetWindowPos(IntPtr h, IntPtr a, int x, int y, int cx, int cy, uint f);
  [DllImport("user32.dll")] public static extern IntPtr GetForegroundWindow();
  [StructLayout(LayoutKind.Sequential)] public struct RECT { public int Left; public int Top; public int Right; public int Bottom; }
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr h, out RECT r);
}
'@
Add-Type -AssemblyName System.Windows.Forms
$h = [W]::GetForegroundWindow()
if ($h -eq [IntPtr]::Zero) { throw 'no foreground window' }
$cur = [System.Windows.Forms.Screen]::FromHandle($h)
$a = $cur.WorkingArea
`

/** Windows：PowerShell 对前台窗口 SetWindowPos */
function winWindowCommand(action: WinAction): string {
  // gap（px）：窗口与屏幕边缘留白，与 mac 侧同语义（V4 P1-7 批次3）
  const p = windowGap()
  // 通用前置：按前台窗口所在屏的 WorkingArea 内缩 gap 得到可排布区
  const head = `${WIN_WINDOW_HEAD}$p = ${p}
$ax = $a.X + $p
$ay = $a.Y + $p
$aw = $a.Width - 2 * $p
$ah = $a.Height - 2 * $p
`
  // 左右半 / 最大化 / 还原：迁移到 EncodedCommand + 窗口所在屏（旧实现写死主屏）
  if (action === 'left' || action === 'right' || action === 'maximize' || action === 'restore') {
    const rect = {
      left: '$ax, $ay, [int]($aw / 2), $ah',
      right: '$ax + [int]($aw / 2), $ay, [int]($aw / 2), $ah',
      maximize: '$ax, $ay, $aw, $ah',
      restore: '$ax + [int]($aw / 4), $ay + [int]($ah / 4), [int]($aw / 2), [int]($ah / 2)'
    }[action]
    return winEncodedCommand(`${head}[W]::SetWindowPos($h, [IntPtr]::Zero, ${rect}, 0x0040)`)
  }
  // maximizeWidth：宽铺满可排布区，y/高读窗口自身矩形保持不变
  if (action === 'maximizeWidth') {
    return winEncodedCommand(`${head}
$r = New-Object 'W+RECT'
[W]::GetWindowRect($h, [ref]$r) | Out-Null
[W]::SetWindowPos($h, [IntPtr]::Zero, $ax, $r.Top, $aw, $r.Bottom - $r.Top, 0x0040)`)
  }
  // center：在可排布区内居中，尺寸不变
  if (action === 'center') {
    return winEncodedCommand(`${head}
$r = New-Object 'W+RECT'
[W]::GetWindowRect($h, [ref]$r) | Out-Null
$ww = [Math]::Min($r.Right - $r.Left, $aw)
$wh = [Math]::Min($r.Bottom - $r.Top, $ah)
$cx = $ax + [int](($aw - $ww) / 2)
$cy = $ay + [int](($ah - $wh) / 2)
[W]::SetWindowPos($h, [IntPtr]::Zero, $cx, $cy, $ww, $wh, 0x0040)`)
  }
  // nextDisplay：跨屏移动（尺寸与相对位置保持；目标屏 gap 暂不应用，文档化接受）
  if (action === 'nextDisplay') {
    return winEncodedCommand(`${WIN_WINDOW_HEAD}
$all = [System.Windows.Forms.Screen]::AllScreens
if ($all.Length -lt 2) { exit 0 }
$r = New-Object 'W+RECT'
[W]::GetWindowRect($h, [ref]$r) | Out-Null
$ww = $r.Right - $r.Left
$wh = $r.Bottom - $r.Top
$idx = -1
for ($i = 0; $i -lt $all.Length; $i++) { if ($all[$i].DeviceName -eq $cur.DeviceName) { $idx = $i; break } }
if ($idx -lt 0) { $idx = 0 }
$n = $all[($idx + 1) % $all.Length]
$nx = [Math]::Max($n.WorkingArea.X, [Math]::Min($n.WorkingArea.X + ($r.Left - $a.X), $n.WorkingArea.X + [Math]::Max(0, $n.WorkingArea.Width - $ww)))
$ny = [Math]::Max($n.WorkingArea.Y, [Math]::Min($n.WorkingArea.Y + ($r.Top - $a.Y), $n.WorkingArea.Y + [Math]::Max(0, $n.WorkingArea.Height - $wh)))
[W]::SetWindowPos($h, [IntPtr]::Zero, $nx, $ny, $ww, $wh, 0x0040)`)
  }
  // 其余：上下半 / 四分 / 三分 / 六分（含 gap 的可排布区分数切分）
  const rect = {
    top: '$ax, $ay, $aw, [int]($ah / 2)',
    bottom: '$ax, $ay + [int]($ah / 2), $aw, [int]($ah / 2)',
    topLeft: '$ax, $ay, [int]($aw / 2), [int]($ah / 2)',
    topRight: '$ax + [int]($aw / 2), $ay, [int]($aw / 2), [int]($ah / 2)',
    bottomLeft: '$ax, $ay + [int]($ah / 2), [int]($aw / 2), [int]($ah / 2)',
    bottomRight: '$ax + [int]($aw / 2), $ay + [int]($ah / 2), [int]($aw / 2), [int]($ah / 2)',
    maximizeHeight: '$ax, $ay, $aw, $ah',
    thirdFirst: '$ax, $ay, [int]($aw / 3), $ah',
    thirdFirstTwo: '$ax, $ay, [int]((2 * $aw) / 3), $ah',
    thirdCenter: '$ax + [int]($aw / 3), $ay, [int]($aw / 3), $ah',
    thirdLastTwo: '$ax + [int]($aw / 3), $ay, [int]((2 * $aw) / 3), $ah',
    thirdLast: '$ax + [int]((2 * $aw) / 3), $ay, [int]($aw / 3), $ah',
    sixthTopLeft: '$ax, $ay, [int]($aw / 6), [int]($ah / 2)',
    sixthTopCenter: '$ax + [int]($aw / 3), $ay, [int]($aw / 3), [int]($ah / 2)',
    sixthTopRight: '$ax + [int]((5 * $aw) / 6), $ay, [int]($aw / 6), [int]($ah / 2)',
    sixthBottomLeft: '$ax, $ay + [int]($ah / 2), [int]($aw / 6), [int]($ah / 2)',
    sixthBottomCenter: '$ax + [int]($aw / 3), $ay + [int]($ah / 2), [int]($aw / 3), [int]($ah / 2)',
    sixthBottomRight:
      '$ax + [int]((5 * $aw) / 6), $ay + [int]($ah / 2), [int]($aw / 6), [int]($ah / 2)'
  }[action]
  return winEncodedCommand(`${head}[W]::SetWindowPos($h, [IntPtr]::Zero, ${rect}, 0x0040)`)
}

/** 类型守卫：IPC / 热键分发传入的字符串是否为合法窗口动作 */
export function isWindowAction(v: string): v is WinAction {
  return (WINDOW_ACTIONS as string[]).includes(v)
}

export function getWindowActionIds(): string[] {
  return WINDOW_ACTIONS.map((a) => `window.${a}`)
}

export async function runWindowAction(action: WinAction): Promise<{ ok: boolean; error?: string }> {
  let result: { ok: boolean; error?: string }
  if (!isMac()) {
    const r = await run(winWindowCommand(action), 8000)
    result = { ok: r.ok, error: r.stderr }
  } else if (action === 'nextDisplay') {
    result = await macMoveToNextDisplay()
  } else if (action === 'restore') {
    const r = await run(MAC_RESTORE_CMD, 5000)
    result = { ok: r.ok, error: r.stderr }
  } else {
    result = await macApplyGeometry(action)
  }
  if (!result.ok && isMac()) {
    return {
      ok: false,
      error: '需要辅助功能权限：系统设置 → 隐私与安全性 → 辅助功能，勾选本应用后重试'
    }
  }
  return result
}

export function registerSystemCommandIpc(): void {
  typedHandle('systemcmd:run', async (_e, req) => {
    const id = req.id
    let result: { ok: boolean; error?: string }
    if (id.startsWith('system.')) {
      result = await runSystemCommand(id)
    } else if (id.startsWith('window.')) {
      const action = id.slice('window.'.length) as WinAction
      if (!WINDOW_ACTIONS.includes(action)) return { ok: false, error: 'unknown action' }
      result = await runWindowAction(action)
    } else {
      return { ok: false, error: 'unknown command' }
    }
    // 渲染端 executeCommand 不展示 run 返回值，失败统一弹系统通知，
    // 否则「点了没反应」（权限被拒 / 命令出错）无从得知
    if (!result.ok && result.error) {
      try {
        const label = id.startsWith('window.') ? '窗口操作' : '系统命令'
        new Notification({ title: `${label}失败`, body: result.error }).show()
      } catch {
        /* 通知失败静默 */
      }
    }
    return result
  })
  typedHandle('systemcmd:ids', () => ({
    system: getSystemCommandIds(),
    window: getWindowActionIds()
  }))
  // app ready 前调用 exec 会失败，这里仅注册通道（exec 在触发时才执行）
  void app
}

