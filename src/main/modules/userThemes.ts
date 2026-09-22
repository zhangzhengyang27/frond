/**
 * Leaf · 用户主题文件加载（#12 Phase 2，主进程）
 *
 * 主题目录 = userData/themes/*.json，一份文件一套主题（对标 Vicinae extra/themes）。
 * 解析/校验/派生都在 src/shared/themeFile.ts（fail-closed + CSS 值白名单），
 * 本模块只管读盘与落盘：
 * - listThemesIn(dir)：逐份解析，非法文件不拖垮列表（rejected 带回 UI 提示）
 * - installThemeFileInto：从任意来源装进主题目录——**目标文件名由 id 派生**，
 *   绝不用来源文件名（防 ../ 与绝对路径穿越），且校验通过才写
 * - 读取带体积上限：主题文件是人手写的配置，超大即异常
 * dir 参数化的那层（*In / *Into）是无 electron 依赖的纯函数，供单测直接喂临时目录。
 */
import { app } from 'electron'
import { mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { parseThemeFile } from '../../shared/themeFile'
import type { ThemeDefinition } from '../../shared/themeSchema'

/** 单份主题文件的体积上限（配置级文本，超了就是拿错文件或恶意文件） */
export const MAX_THEME_FILE_BYTES = 256 * 1024

export interface UserThemeEntry {
  file: string
  theme: ThemeDefinition
}

export interface UserThemeRejection {
  file: string
  error: string
}

export function themesDir(): string {
  return join(app.getPath('userData'), 'themes')
}

export function ensureThemesDir(): string {
  const dir = themesDir()
  mkdirSync(dir, { recursive: true })
  return dir
}

function parseThemeJson(pathLabel: string, json: string): UserThemeEntry | UserThemeRejection {
  let raw: unknown
  try {
    raw = JSON.parse(json) as unknown
  } catch (e) {
    return { file: pathLabel, error: `JSON 解析失败：${(e as Error).message}` }
  }
  const parsed = parseThemeFile(raw)
  return parsed.ok
    ? { file: pathLabel, theme: parsed.theme }
    : { file: pathLabel, error: parsed.error }
}

function isRejection(entry: UserThemeEntry | UserThemeRejection): entry is UserThemeRejection {
  return (entry as UserThemeRejection).error !== undefined
}

/** id → 安全文件名（只留 a-z0-9-，杜绝路径分隔符与空名） */
export function safeThemeFileName(id: string): string {
  const slug = id
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48)
  return `${slug || 'theme'}.json`
}

/** 读取并解析目录内全部主题；id 重复只留先出现的，其余归 rejected */
export function listThemesIn(dir: string): {
  themes: UserThemeEntry[]
  rejected: UserThemeRejection[]
} {
  const themes: UserThemeEntry[] = []
  const rejected: UserThemeRejection[] = []
  let names: string[]
  try {
    names = readdirSync(dir)
  } catch {
    return { themes, rejected } // 目录不存在 = 还没有用户主题
  }
  const seen = new Set<string>()
  for (const name of names.filter((n) => n.toLowerCase().endsWith('.json')).sort()) {
    try {
      const full = join(dir, name)
      if (statSync(full).size > MAX_THEME_FILE_BYTES) {
        rejected.push({ file: name, error: `文件超过 ${MAX_THEME_FILE_BYTES / 1024}KB 上限` })
        continue
      }
      const entry = parseThemeJson(name, readFileSync(full, 'utf8'))
      if (isRejection(entry)) {
        rejected.push(entry)
        continue
      }
      if (seen.has(entry.theme.id)) {
        rejected.push({ file: name, error: `主题 id 重复：${entry.theme.id}` })
        continue
      }
      seen.add(entry.theme.id)
      themes.push(entry)
    } catch (e) {
      rejected.push({ file: name, error: (e as Error).message })
    }
  }
  return { themes, rejected }
}

export function listUserThemes(): { themes: UserThemeEntry[]; rejected: UserThemeRejection[] } {
  return listThemesIn(themesDir())
}

export function getUserTheme(id: string): ThemeDefinition | null {
  return listUserThemes().themes.find((t) => t.theme.id === id)?.theme ?? null
}

/**
 * 校验通过后写进 destDir（文件名由 id 生成，内容重新序列化——注释、未知键、
 * 脚本残留都不进主题目录）。
 */
export function installThemeFileInto(
  sourcePath: string,
  destDir: string
): { ok: true; theme: ThemeDefinition; file: string } | { ok: false; error: string } {
  try {
    if (statSync(sourcePath).size > MAX_THEME_FILE_BYTES) {
      return { ok: false, error: `文件超过 ${MAX_THEME_FILE_BYTES / 1024}KB 上限` }
    }
    const entry = parseThemeJson(sourcePath, readFileSync(sourcePath, 'utf8'))
    if (isRejection(entry)) return { ok: false, error: entry.error }
    mkdirSync(destDir, { recursive: true })
    const file = safeThemeFileName(entry.theme.id)
    writeFileSync(join(destDir, file), `${JSON.stringify(entry.theme, null, 2)}\n`, 'utf8')
    return { ok: true, theme: entry.theme, file }
  } catch (e) {
    return { ok: false, error: (e as Error).message }
  }
}

export function installThemeFile(
  sourcePath: string
): { ok: true; theme: ThemeDefinition } | { ok: false; error: string } {
  return installThemeFileInto(sourcePath, themesDir())
}
