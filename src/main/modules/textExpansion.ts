/**
 * Frond · 片段文本扩展引擎（M5.1，Raycast Snippets 模式）
 *
 * 全局监听按键（globalKeyHook），在任意应用里键入触发词（如 ";brb"）后：
 * 1. 注入 N 次退格删掉触发词
 * 2. 把片段文本写入系统剪贴板（先存旧内容）+ 模拟 ⌘V 粘贴 + 延迟还原剪贴板
 *
 * 约束：
 * - Frond 自身窗口持有焦点时不触发（避免自己扩自己）
 * - macOS 依赖辅助功能授权（监听与注入同一权限）；未授权时静默失效，
 *   由管理页「权限诊断」探测并引导
 * - 键位映射为 US 布局（见 keycodes.ts），触发词建议字母数字与常见符号
 * - 注入期间（~600ms）不再触发，防止连环扩展
 */
import { clipboard, BrowserWindow, shell, app } from 'electron'
import { execFile } from 'child_process'
import { promisify } from 'util'
import { globalKeyHook, hasFocusedFrondWindow, type GlobalKeyEvent } from './globalKeys'
import { isDirectTypable } from '../utils/pasteKeystroke'
import {
  renderExpansionWithCursor,
  htmlToPlainText,
  extractDynamicParams,
  applyDynamicParams
} from './expansionTemplate'
import { showInputBox } from '../utils/inputBox'
import { clipboardHistory } from '../services/ClipboardHistoryService'
import { ExpansionBuffer, type ExpansionHit, type ExpansionTrigger } from './expansionBuffer'
import { snippetRepository } from '../db/repos/SnippetRepository'
import { getLauncherDocStore } from '../launcher/docStore'

const execFileAsync = promisify(execFile)

const EXPANSION_NS = 'sys.expansion'
const CLIPBOARD_RESTORE_DELAY_MS = 600

export interface ExpansionConfig {
  /** 总开关；无触发词片段时开启也无副作用 */
  enabled: boolean
  /** 扩展完成提示音（B3）；默认关——Raycast 同款默认，避免连续扩展时打扰 */
  soundOn: boolean
}

function readConfig(): ExpansionConfig {
  try {
    const doc = getLauncherDocStore().get(EXPANSION_NS, 'config')
    const data = (doc?.data ?? {}) as Partial<ExpansionConfig>
    return { enabled: data.enabled !== false, soundOn: data.soundOn === true }
  } catch {
    return { enabled: true, soundOn: false }
  }
}

function writeConfig(patch: Partial<ExpansionConfig>): ExpansionConfig {
  const next = { ...readConfig(), ...patch }
  getLauncherDocStore().put(EXPANSION_NS, 'config', next)
  return next
}

class TextExpansionService {
  private buffer = new ExpansionBuffer()
  private stopListening: (() => void) | null = null
  private expanding = false
  private triggersStale = true
  /** 待执行的剪贴板还原（下一轮 expand 前立即落定，防止把片段文本当原内容读回） */
  private pendingRestore: (() => void) | null = null
  /** 本次扩展写入剪贴板的纯文本指纹（还原前比对：剪贴板已归用户所有则跳过还原） */
  private expansionClipboardText: string | null = null
  private quitHookInstalled = false
  /** 完成音效偏好通道只在 start() 注册一次 */

  /** 从 DB 重建触发词缓存（snippet 增删改后由 IPC 侧 invalidate） */
  invalidateTriggers(): void {
    this.triggersStale = true
  }

  private loadTriggers(): void {
    if (!this.triggersStale) return
    try {
      const snippets = snippetRepository.getSnippets({ isDeleted: false })
      const triggers: ExpansionTrigger[] = snippets
        .filter((s) => s.trigger && s.trigger.trim())
        .map((s) => ({
          trigger: s.trigger!.trim(),
          text: s.contents[0]?.value ?? '',
          contentType: s.contents[0]?.contentType
        }))
      this.buffer.setTriggers(triggers)
      this.triggersStale = false
    } catch (error) {
      console.warn('[TextExpansion] 触发词加载失败:', (error as Error).message)
    }
  }

  start(): void {
    // 应用退出时若还原还未到点，立即落定，避免片段文本永久留在用户剪贴板
    if (!this.quitHookInstalled) {
      this.quitHookInstalled = true
      app.on('will-quit', () => this.settlePendingRestore())
    }
    this.applyConfig(readConfig())
  }

  stop(): void {
    this.stopListening?.()
    this.stopListening = null
  }

  /** 开关变更（IPC）：启用即订阅全局按键，停用即退订 */
  applyConfig(config: ExpansionConfig): void {
    if (config.enabled && !this.stopListening) {
      this.stopListening = globalKeyHook.onKeydown((e) => {
        this.onKeydown(e)
      })
      this.triggersStale = true
    } else if (!config.enabled && this.stopListening) {
      this.stopListening()
      this.stopListening = null
    }
  }

  getConfig(): ExpansionConfig {
    return readConfig()
  }

  setConfig(patch: Partial<ExpansionConfig>): ExpansionConfig {
    const next = writeConfig(patch)
    this.applyConfig(next)
    return next
  }

  /** 触发词数量（管理页展示） */
  getTriggerCount(): number {
    this.loadTriggers()
    return this.bufferTextCount()
  }

  private bufferTextCount(): number {
    // 借由 match 前的 triggers 引用不可见，这里直接从 DB 统计
    try {
      return snippetRepository
        .getSnippets({ isDeleted: false })
        .filter((s) => s.trigger && s.trigger.trim()).length
    } catch {
      return 0
    }
  }

  private onKeydown(e: GlobalKeyEvent): void {
    // Ctrl/Alt/Meta 组合键是快捷键而非打字（Cmd+C、Alt+Tab…）：
    // 视为上下文切换清空缓冲，避免快捷键字母拼进触发词造成误扩展
    if (e.ctrlKey || e.metaKey || e.altKey) {
      this.buffer.reset()
      return
    }
    this.loadTriggers()
    const hit = this.buffer.feed(e.keycode, e.shiftKey)
    if (!hit) return
    if (this.expanding) return // 注入期间不连环触发（字符已进缓冲，不丢键）
    // Frond 窗口持有焦点时不触发（管理页/片段编辑器里输入触发词不扩展）
    if (hasFocusedFrondWindow(BrowserWindow.getAllWindows())) {
      this.buffer.reset()
      return
    }
    void this.expand(hit)
  }

  /** 注入回删 + 展开（异步，失败仅记日志不打扰用户） */
  private async expand(hit: ExpansionHit): Promise<void> {
    if (!hit.text) return
    this.expanding = true
    try {
      // 上一轮还原未到点时立即执行：保证这里读到的是用户真实剪贴板，
      // 而不是上一轮写入的片段文本（还原延迟 600ms > 锁释放 200ms 的窗口期）
      this.settlePendingRestore()
      this.expansionClipboardText = null
      const previousText = clipboard.readText()
      const previousImage = clipboard.readImage()
      const hadImage = !previousImage.isEmpty()

      // 用户输入动态参数（{{paramName}}）：弹出对话框逐个询问
      let expandedText = hit.text
      const dynamicParams = extractDynamicParams(hit.text)
      if (dynamicParams.length > 0) {
        const values: Record<string, string> = {}
        let cancelled = false
        for (const param of dynamicParams) {
          const result = await showInputBox({
            title: '片段参数',
            message: `请输入「${param}」的值：`,
            default: ''
          })
          if (result === null) {
            cancelled = true
            break
          }
          values[param] = result
        }
        if (cancelled) {
          this.expanding = false
          return
        }
        expandedText = applyDynamicParams(hit.text, values)
      }

      // 动态占位符（{date}/{time}/{datetime}/{clipboard}）在注入前求值；
      // {cursor} 提取光标位（V4 P1-6，Raycast 同语义：展开后光标落到该处）
      const renderedExpansion = renderTemplate(expandedText)
      const rendered = renderedExpansion.text
      const isRich = hit.contentType === 'rich'
      // 回删触发词 + 尾随分隔符；「内容 + 分隔符」（保留用户的空格/换行）
      const payload = rendered + hit.trailing
      // 光标定位：尾随分隔符追加在渲染文本之后，不影响光标前的字符数
      const leftArrows =
        renderedExpansion.cursorIndex === null
          ? 0
          : Math.max(0, [...payload].length - renderedExpansion.cursorIndex)
      const backspaces = hit.trigger.length + 1
      let injected = false

      if (!isRich && isDirectTypable(payload)) {
        // 短文本直接键入：不碰剪贴板（无需保存/还原，也避免覆盖大内容剪贴板）
        await injectBackspacesThenText(backspaces, payload)
        if (leftArrows > 0) await injectLeftArrows(leftArrows)
        injected = true
      } else {
        if (isRich) {
          // 富文本：text/html 双格式写入，目标应用按能力取用（保留排版）；
          // 尾随分隔符只加在纯文本回退格式上，不污染 HTML
          clipboard.write({
            text: htmlToPlainText(rendered) + hit.trailing,
            html: rendered
          })
        } else {
          clipboard.writeText(payload)
        }
        // 扩展写入是程序化行为：同步指纹让剪贴板历史轮询视为无变化，
        // 否则每次扩展都会把片段内容混进用户剪贴板历史
        clipboardHistory.noteExternalTextWrite(
          isRich ? htmlToPlainText(rendered) + hit.trailing : payload
        )
        // 记录本次写入指纹：还原定时器到期时用于判断剪贴板是否仍归我们所有
        this.expansionClipboardText = isRich ? htmlToPlainText(rendered) + hit.trailing : payload
        await injectKeys(backspaces)
        this.scheduleClipboardRestore(previousText, previousImage, hadImage)
        if (leftArrows > 0) await injectLeftArrows(leftArrows)
        injected = true
      }
      // 注入完成（B3）：按偏好播一声系统提示音（默认关，见 soundOn）
      if (injected && readConfig().soundOn) {
        playExpansionSound()
      }
    } catch (error) {
      console.error('[TextExpansion] 扩展失败（检查辅助功能授权）:', (error as Error).message)
    } finally {
      // 注入完成后再放宽；剪贴板还原不在锁内
      setTimeout(() => {
        this.expanding = false
      }, 200)
    }
  }

  private scheduleClipboardRestore(
    text: string,
    image: Electron.NativeImage,
    hadImage: boolean
  ): void {
    const writeBack = (): void => {
      // 600ms 窗口期内用户可能已复制新内容：仅当剪贴板仍是我们写入的片段文本
      // 时才还原，否则旧内容会覆盖用户的新复制
      if (
        this.expansionClipboardText != null &&
        clipboard.readText() !== this.expansionClipboardText
      ) {
        return
      }
      this.writeClipboard(text, image, hadImage)
    }
    const timer = setTimeout(() => {
      this.pendingRestore = null
      writeBack()
    }, CLIPBOARD_RESTORE_DELAY_MS)
    this.pendingRestore = () => {
      clearTimeout(timer)
      this.pendingRestore = null
      writeBack()
    }
  }

  private settlePendingRestore(): void {
    const restore = this.pendingRestore
    this.pendingRestore = null
    restore?.()
  }

  private writeClipboard(text: string, image: Electron.NativeImage, hadImage: boolean): void {
    try {
      clipboard.writeText(text)
      if (hadImage) clipboard.writeImage(image)
      // 还原同样是程序化写入：同步指纹，避免把用户原剪贴板内容再次收进历史
      clipboardHistory.noteExternalTextWrite(text)
    } catch {
      /* noop */
    }
  }
}

/**
 * 动态占位符求值：见 expansionTemplate.ts（{date}/{time}/{datetime}/{clipboard}/{cursor}）
 */
function renderTemplate(text: string): { text: string; cursorIndex: number | null } {
  return renderExpansionWithCursor(text, {
    now: new Date(),
    clipboardText: () => clipboard.readText()
  })
}

/** {cursor} 定位：N 次左方向键（注入完成后光标在末尾） */
async function injectLeftArrows(count: number): Promise<void> {
  if (process.platform === 'darwin') {
    const script = `tell application "System Events"
  repeat ${count} times
    key code 123
  end repeat`
    await execFileAsync('osascript', ['-e', script], { timeout: 10000 })
  } else if (process.platform === 'win32') {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('{LEFT ${count}}')`
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeout: 10000
    })
  }
}

/** 平台相关按键注入：N 次退格 + ⌘V/Ctrl+V 粘贴（剪贴板由 Electron 侧已写好） */
async function injectKeys(backspaceCount: number): Promise<void> {
  if (process.platform === 'darwin') {
    const script = `
tell application "System Events"
  repeat ${backspaceCount} times
    key code 51
  end repeat
  keystroke "v" using command down
end tell`
    // 超时必须有：注入挂起会让 expand() 的 expanding 锁永不释放，文本扩展静默失效
    await execFileAsync('osascript', ['-e', script], { timeout: 10000 })
  } else if (process.platform === 'win32') {
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('{BS ${backspaceCount}}^v')`
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeout: 10000
    })
  } else {
    throw new Error('文本扩展暂不支持当前平台')
  }
}

/**
 * 平台相关注入：N 次退格后直接键入文本（不经剪贴板，Raycast 同策略）。
 * 文本已由 isDirectTypable 限定为 US 可打印字符 + \n/\t。
 * mac：换行拆为 key code 36（Return）、制表为 key code 48（Tab）——
 * AppleScript 字符串字面量不支持裸换行。
 */
async function injectBackspacesThenText(backspaceCount: number, text: string): Promise<void> {
  if (process.platform === 'darwin') {
    const statements: string[] = []
    for (let i = 0; i < backspaceCount; i += 1) statements.push('key code 51')
    const lines = text.split('\n')
    lines.forEach((line, i) => {
      if (i > 0) statements.push('key code 36') // Return
      const segments = line.split('\t')
      segments.forEach((seg, j) => {
        if (j > 0) statements.push('key code 48') // Tab
        if (seg) statements.push(`keystroke "${seg.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`)
      })
    })
    const script = `tell application "System Events"\n  ${statements.join('\n  ')}\nend tell`
    await execFileAsync('osascript', ['-e', script], { timeout: 10000 })
  } else if (process.platform === 'win32') {
    const escaped = text
      .replace(/([+^%~(){}[\]])/g, '{$1}')
      .replace(/\n/g, '{ENTER}')
      .replace(/\t/g, '{TAB}')
      .replace(/'/g, "''")
    const script = `
Add-Type -AssemblyName System.Windows.Forms
[System.Windows.Forms.SendKeys]::SendWait('{BS ${backspaceCount}}${escaped}')`
    await execFileAsync('powershell', ['-NoProfile', '-NonInteractive', '-Command', script], {
      timeout: 10000
    })
  } else {
    throw new Error('文本扩展暂不支持当前平台')
  }
}

/**
 * 扩展完成提示音（B3）：mac afplay 系统音效 / win SystemSounds，Linux 无声。
 * fire-and-forget：音效失败绝不影响扩展主流程（静默吞掉）。
 */
function playExpansionSound(): void {
  try {
    if (process.platform === 'darwin') {
      execFileAsync('afplay', ['/System/Library/Sounds/Pop.aiff'], { timeout: 3000 }).catch(
        () => {}
      )
    } else if (process.platform === 'win32') {
      execFileAsync(
        'powershell',
        [
          '-NoProfile',
          '-NonInteractive',
          '-Command',
          '[System.Media.SystemSounds]::Asterisk.Play()'
        ],
        { timeout: 3000 }
      ).catch(() => {})
    }
  } catch {
    /* 音效失败静默 */
  }
}

/** 打开 macOS 辅助功能授权面板（管理页引导用） */
export function openAccessibilitySettings(): void {
  if (process.platform === 'darwin') {
    void shell.openExternal(
      'x-apple.systempreferences:com.apple.preference.security?Privacy_Accessibility'
    )
  }
}

export const textExpansion = new TextExpansionService()

