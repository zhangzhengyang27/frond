/**
 * Frond · 脚本命令目录（P-3 2.7，对齐 Raycast Script Commands 的本地子集）
 *
 * 约定目录：userData/scripts/（设置页后续可换）。平铺扫描 .sh / .ps1 文件，
 * 每个文件 = 一条根搜索命令：文件名（去扩展）为标题，首个注释行为描述。
 * 目录不存在时自动创建并放一个 example.sh——「落一个脚本就能被搜到」的开箱体验。
 *
 * 执行语义：mac/linux 优先直接 spawn（尊重 shebang 与执行位），无执行位回落
 * `sh <file>`；Windows 用 PowerShell -File。30s 超时强杀，输出截断 8KB。
 * id 即文件名（运行时做包含校验 + basename 校验，杜绝目录穿越）。
 */
import { app, shell } from 'electron'
import { execFile } from 'child_process'
import { join, resolve, basename, sep } from 'path'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'fs'
import { promisify } from 'util'
import { isMac } from '../utils/platform'
import { log } from '../services/LogService'

const execFileAsync = promisify(execFile)

const SCRIPT_TIMEOUT_MS = 30_000
const MAX_OUTPUT_BYTES = 8 * 1024
const MAX_SCRIPT_BYTES = 64 * 1024
const SCRIPT_EXTENSIONS = new Set(['.sh', '.ps1'])

export interface ScriptCommandInfo {
  /** 文件名（含扩展名），运行时凭它做包含校验后定位 */
  id: string
  /** 文件名去扩展 */
  name: string
  /** 首个注释行（跳过 shebang）；无注释为空串 */
  description: string
  path: string
  mtimeMs: number
}

export function scriptsDir(): string {
  return join(app.getPath('userData'), 'scripts')
}

const EXAMPLE_SH = [
  '#!/bin/sh',
  '# Frond 示例脚本：修改我，或把任意 .sh / .ps1 放进本目录',
  'echo "Hello from Frond scripts"',
  ''
].join('\n')

/** 确保目录存在；首次创建时放一个 example.sh（返回是否为首次创建） */
export function ensureScriptsDir(): { dir: string; created: boolean } {
  const dir = scriptsDir()
  if (existsSync(dir)) return { dir, created: false }
  mkdirSync(dir, { recursive: true })
  try {
    writeFileSync(join(dir, 'example.sh'), EXAMPLE_SH, { mode: 0o755 })
  } catch (e) {
    // 示例脚本写失败不影响目录本身
    log.debug('script-commands', 'example.sh 写入失败', e)
  }
  return { dir, created: true }
}

/** 首个注释行（跳过 shebang 与空行），截 120 字符；读失败按无描述 */
function extractDescription(file: string): string {
  try {
    const head = readFileSync(file, 'utf-8').slice(0, 2048)
    for (const rawLine of head.split(/\r?\n/)) {
      const line = rawLine.trim()
      if (!line || line.startsWith('#!')) continue
      if (line.startsWith('#')) return line.replace(/^#+\s*/, '').slice(0, 120)
      break // 第一段非注释代码之后不再找
    }
  } catch {
    /* 读失败按无描述 */
  }
  return ''
}

/** 平铺扫描脚本目录（目录不存在返回空表，不隐式建目录——建目录由 ensureScriptsDir 显式做） */
export function listScriptCommands(): ScriptCommandInfo[] {
  const dir = scriptsDir()
  if (!existsSync(dir)) return []
  const out: ScriptCommandInfo[] = []
  try {
    for (const name of readdirSync(dir)) {
      if (name.startsWith('.')) continue
      const ext = name.slice(name.lastIndexOf('.')).toLowerCase()
      if (!SCRIPT_EXTENSIONS.has(ext)) continue
      const path = join(dir, name)
      let st: import('fs').Stats
      try {
        st = statSync(path)
      } catch {
        continue // 扫描与 stat 之间被删
      }
      if (!st.isFile() || st.size > MAX_SCRIPT_BYTES) continue
      out.push({
        id: name,
        name: name.slice(0, -ext.length),
        description: extractDescription(path),
        path,
        mtimeMs: st.mtimeMs
      })
    }
  } catch (e) {
    log.debug('script-commands', '扫描脚本目录失败', e)
  }
  return out.sort((a, b) => a.name.localeCompare(b.name, 'zh-Hans-CN'))
}

/** id → 磁盘路径（包含校验 + basename 校验；非法返回 null） */
export function resolveScriptPath(id: string): string | null {
  if (typeof id !== 'string' || !id) return null
  if (basename(id) !== id || id.startsWith('.')) return null
  const dir = resolve(scriptsDir())
  const target = resolve(dir, id)
  if (target !== dir && !target.startsWith(dir + sep)) return null
  const ext = id.slice(id.lastIndexOf('.')).toLowerCase()
  if (!SCRIPT_EXTENSIONS.has(ext)) return null
  return existsSync(target) ? target : null
}

export interface ScriptRunResult {
  ok: boolean
  /** stdout+stderr 合并（截 8KB）；失败时为已产出的部分输出 */
  output?: string
  error?: string
}

function clipOutput(raw: string): string {
  const text = raw.length > MAX_OUTPUT_BYTES ? `${raw.slice(0, MAX_OUTPUT_BYTES)}…` : raw
  return text.trim()
}

/** 执行脚本（30s 超时强杀；返回合并输出与退出码语义） */
export async function runScriptCommand(id: string): Promise<ScriptRunResult> {
  const file = resolveScriptPath(id)
  if (!file) return { ok: false, error: '脚本不存在或路径非法' }
  try {
    if (process.platform === 'win32') {
      const { stdout } = await execFileAsync(
        'powershell',
        ['-NoProfile', '-NonInteractive', '-ExecutionPolicy', 'Bypass', '-File', file],
        { timeout: SCRIPT_TIMEOUT_MS, maxBuffer: MAX_OUTPUT_BYTES * 2 }
      )
      return { ok: true, output: clipOutput(String(stdout ?? '')) }
    }
    // mac/linux：有执行位直接跑（尊重 shebang）；无执行位或 ENOEXEC（有执行位
    // 但没写 shebang——用户手写脚本的常见形态）都回落 `sh <file>`
    const executable = (statSync(file).mode & 0o111) !== 0
    try {
      const { stdout } = await execFileAsync(executable ? file : 'sh', executable ? [] : [file], {
        timeout: SCRIPT_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES * 2
      })
      return { ok: true, output: clipOutput(String(stdout ?? '')) }
    } catch (directError) {
      const de = directError as { code?: string }
      if (!executable || de.code !== 'ENOEXEC') throw directError
      const { stdout } = await execFileAsync('sh', [file], {
        timeout: SCRIPT_TIMEOUT_MS,
        maxBuffer: MAX_OUTPUT_BYTES * 2
      })
      return { ok: true, output: clipOutput(String(stdout ?? '')) }
    }
  } catch (error) {
    const e = error as { message?: string; killed?: boolean; stdout?: string; stderr?: string }
    const partial = clipOutput(String(e.stdout ?? '') + (e.stderr ? `\n${e.stderr}` : ''))
    if (e.killed) {
      return { ok: false, ...(partial ? { output: partial } : {}), error: `执行超过 ${SCRIPT_TIMEOUT_MS / 1000}s 已终止` }
    }
    return { ok: false, ...(partial ? { output: partial } : {}), error: e.message ?? '执行失败' }
  }
}

/** 打开脚本目录（首次调用会建目录+示例脚本） */
export async function openScriptsDir(): Promise<{ ok: boolean; error?: string }> {
  const { dir } = ensureScriptsDir()
  try {
    await shell.openPath(dir)
    return { ok: true }
  } catch (e) {
    log.warn('script-commands', `打开脚本目录失败: ${(e as Error).message}`)
    return { ok: false, error: (e as Error).message }
  }
}

/** 非 mac 平台的降级说明（跨平台语义与日历等模块同口径：能跑，但未真机验证） */
export function scriptCommandsSupported(): boolean {
  return isMac() || process.platform === 'win32' || process.platform === 'linux'
}
