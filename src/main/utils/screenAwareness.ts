/**
 * Frond · 前台窗口上下文（P-4⑤ Screen Awareness 的第一层）
 *
 * 本期只做「应用名 + 窗口标题」这一层——它要的是**辅助功能**授权，
 * 不碰剪贴板、不抓屏、不读文档内容。选中文本与截屏识图是后面的事：
 * 那两样分别要模拟 ⌘C（会动用户的剪贴板）与屏幕录制 + 视觉模型，
 * 都不该在一个「顺手带个上下文」的动作里悄悄发生。
 *
 * 未授权时的表现必须是可解释的：错误分类成 accessibility-denied，
 * 界面据此给出「打开系统设置」的入口，而不是显示一个空上下文。
 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const SCRIPT_TIMEOUT_MS = 3000

export type ContextError = 'accessibility-denied' | 'no-frontmost' | 'unsupported' | 'failed'

export interface FrontmostContext {
  ok: boolean
  appName: string | null
  windowTitle: string | null
  error?: ContextError
  /** 提示要不要带「去开设置」的按钮 */
  needsAccessibility?: boolean
}

/** 一段 applescript：应用名 + 前台窗口标题，取不到窗口时只给应用名 */
export function frontmostContextScript(): string {
  return [
    'tell application "System Events"',
    'set p to first application process whose frontmost is true',
    'set appName to name of p',
    'set winTitle to ""',
    'try',
    'set winTitle to name of front window of p',
    'end try',
    'return appName & linefeed & winTitle',
    'end tell'
  ].join('\n')
}

/** 解析 stdout：第一行应用名，其余是窗口标题（标题里可能本身带换行的应用不多，但按剩余整体保留更安全） */
export function parseFrontmostContext(stdout: string): {
  appName: string | null
  windowTitle: string | null
} {
  const raw = String(stdout ?? '').replace(/\r/g, '')
  const nl = raw.indexOf('\n')
  const appName = (nl === -1 ? raw : raw.slice(0, nl)).trim()
  const title = nl === -1 ? '' : raw.slice(nl + 1).trim()
  return { appName: appName || null, windowTitle: title || null }
}

/** System Events 被拒时的报错形态有好几种文案，全部归到同一档 */
export function classifyContextError(stderr: string): ContextError {
  const s = String(stderr ?? '').toLowerCase()
  if (
    s.includes('-1719') ||
    s.includes('not authorized to send apple events') ||
    s.includes('assistive access') ||
    s.includes('accessibility') ||
    s.includes('(-25211)') ||
    s.includes('-25211')
  ) {
    return 'accessibility-denied'
  }
  if (s.includes('no process') || s.includes('can’t get') || s.includes("can't get")) {
    return 'no-frontmost'
  }
  return 'failed'
}

/** 拼成给模型的一句话上下文（界面插入输入框也用这一句，两边不许各写一份） */
export function formatFrontmostContext(ctx: FrontmostContext): string {
  if (!ctx.appName && !ctx.windowTitle) return ''
  return `【当前前台】${ctx.appName ?? '未知应用'}${ctx.windowTitle ? ` · ${ctx.windowTitle}` : ''}`
}

type Exec = (script: string) => Promise<{ stdout: string; stderr: string }>

const defaultExec: Exec = async (script) => {
  const { stdout, stderr } = await execFileAsync('osascript', ['-e', script], {
    timeout: SCRIPT_TIMEOUT_MS
  })
  return { stdout, stderr }
}

/**
 * @param exec 注入点：单测里换掉，不必真去动本机 TCC 授权
 * @param platform 注入点：非 darwin 直接 unsupported（Windows 的等价物是 UIA，本期不做）
 */
export async function readFrontmostContext(
  opts: { exec?: Exec; platform?: NodeJS.Platform } = {}
): Promise<FrontmostContext> {
  const platform = opts.platform ?? process.platform
  if (platform !== 'darwin') {
    return { ok: false, appName: null, windowTitle: null, error: 'unsupported' }
  }
  const run = opts.exec ?? defaultExec
  try {
    const { stdout, stderr } = await run(frontmostContextScript())
    const parsed = parseFrontmostContext(stdout)
    if (!parsed.appName) {
      // 脚本没报错但什么都没说：按失败处理，不给界面一个「空上下文」
      const err = stderr ? classifyContextError(stderr) : 'no-frontmost'
      return {
        ok: false,
        ...parsed,
        error: err,
        needsAccessibility: err === 'accessibility-denied'
      }
    }
    return { ok: true, ...parsed }
  } catch (error) {
    const err = classifyContextError((error as Error).message)
    return {
      ok: false,
      appName: null,
      windowTitle: null,
      error: err,
      needsAccessibility: err === 'accessibility-denied'
    }
  }
}
