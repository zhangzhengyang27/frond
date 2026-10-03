/**
 * Frond · 渲染端 console 桥（B52①）
 *
 * 此前渲染端 172 处裸 console.* 全部蒸发：主进程 LogService 的环形缓冲 + 导出
 * 只收主进程日志，preload 的 log 命名空间没有写入口。本桥把 console.debug/log/
 * info/warn/error 转发到 window.api.log.add，渲染端日志从此随诊断包导出——
 * 不需要逐个改写调用点（那 172 处本身就是各模块既有的打点习惯）。
 *
 * 安全阀：
 * - 限流：5s 滑窗内最多 40 条，超出丢弃并在窗口结束后补一条摘要（防日志风暴
 *   把 IPC 和主进程环形缓冲打爆）
 * - Error 序列化为 {message, stack}（Error 过 structured clone 不可靠，显式取字段）
 * - 桥自身任何错误吞掉且绝不递归（转发里不再打 console）
 * - 幂等：多次 install 只挂一次（入口模块可能被 HMR 重放）
 */

interface ConsoleError {
  message: string
  stack?: string
}

type AddFn = (
  level: 'debug' | 'info' | 'warn' | 'error',
  scope: string,
  message: string,
  error?: ConsoleError
) => void

const WINDOW_MS = 5_000
const WINDOW_CAP = 40
const MESSAGE_CAP = 2_000

let installed = false
/** 5s 滑窗：窗口起点时间戳 + 已转发条数；超限后 dropped 累计，窗口结束补摘要 */
let windowStart = 0
let windowCount = 0
let dropped = 0
let originals: Array<[string, (...a: unknown[]) => void]> | null = null

function getAdd(): AddFn | null {
  const api = (globalThis as { window?: { api?: { log?: { add?: AddFn } } } }).window
  return api?.api?.log?.add ?? null
}

function serialize(args: unknown[]): { message: string; error?: ConsoleError } {
  let error: ConsoleError | undefined
  const parts: string[] = []
  for (const a of args) {
    if (a instanceof Error) {
      if (!error) error = { message: a.message, stack: a.stack }
      parts.push(`${a.name}: ${a.message}`)
      continue
    }
    if (typeof a === 'string') {
      parts.push(a)
      continue
    }
    try {
      parts.push(JSON.stringify(a))
    } catch {
      parts.push(String(a))
    }
  }
  const message = parts.join(' ').slice(0, MESSAGE_CAP)
  return { message, error }
}

function forward(level: 'debug' | 'info' | 'warn' | 'error', args: unknown[]): void {
  const add = getAdd()
  if (!add) return
  const now = Date.now()
  if (now - windowStart > WINDOW_MS) {
    if (dropped > 0) {
      // 上一窗口有丢弃：补一条摘要，让「日志不完整」这件事本身可见
      add('warn', 'renderer', `console 桥限流：上一窗口丢弃 ${dropped} 条`)
      dropped = 0
    }
    windowStart = now
    windowCount = 0
  }
  if (windowCount >= WINDOW_CAP) {
    dropped += 1
    return
  }
  windowCount += 1
  const { message, error } = serialize(args)
  try {
    add(level, 'renderer', message, error)
  } catch {
    /* 桥绝不把调用方带崩 */
  }
}

/** 入口模块最早期调用（createApp 之前），保证后续日志都进通道 */
export function installConsoleBridge(): void {
  if (installed) return
  if (!getAdd()) return // preload 未注入（浏览器/测试裸环境）时不挂
  installed = true
  const patch = (level: 'debug' | 'info' | 'warn' | 'error', original: (...a: unknown[]) => void) => {
    // eslint-disable-next-line no-inner-declarations -- 单点工具函数
    function bridged(...args: unknown[]): void {
      forward(level, args)
      // 原生输出保留：devtools 直看体验不变
      original(...args)
    }
    return bridged
  }
  const c = console as unknown as Record<string, (...a: unknown[]) => void>
  originals = [
    ['debug', c.debug],
    ['log', c.log],
    ['info', c.info],
    ['warn', c.warn],
    ['error', c.error]
  ]
  c.debug = patch('debug', originals[0][1].bind(console))
  c.log = patch('info', originals[1][1].bind(console))
  c.info = patch('info', originals[2][1].bind(console))
  c.warn = patch('warn', originals[3][1].bind(console))
  c.error = patch('error', originals[4][1].bind(console))
}

/** 测试用：摘桥（恢复原生 console） */
export function uninstallConsoleBridge(): void {
  installed = false
  windowCount = 0
  dropped = 0
  windowStart = 0
  if (originals) {
    const c = console as unknown as Record<string, (...a: unknown[]) => void>
    for (const [key, fn] of originals) c[key] = fn
    originals = null
  }
}
