/**
 * 浏览器环境里 `path` 的替身（vite alias 指过来）。
 *
 * 渲染层代码没有一个 import 'path'，这套实现只为**被打包进来的第三方依赖**存在
 * （它们 require('path') 只为拼字符串）。所以这里给的是真的 POSIX 字符串逻辑而不是空壳：
 * 一个返回 '' 的 join 会在依赖内部悄悄产出错误路径，比报错更难查。
 */

function normalizeParts(parts: string[], keepRoot: boolean): string {
  const out: string[] = []
  for (const part of parts) {
    if (!part || part === '.') continue
    if (part === '..') {
      if (out.length && out[out.length - 1] !== '..') out.pop()
      else if (!keepRoot) out.push('..')
      continue
    }
    out.push(part)
  }
  const joined = out.join('/')
  return keepRoot ? '/' + joined : joined || '.'
}

function split(p: string): { root: string; body: string } {
  const isAbs = p.startsWith('/')
  return { root: isAbs ? '/' : '', body: p }
}

export function join(...paths: string[]): string {
  const filtered = paths.filter((p) => !!p)
  if (filtered.length === 0) return '.'
  return normalizeParts(filtered.join('/').split('/'), filtered[0].startsWith('/'))
}

export function resolve(...paths: string[]): string {
  let resolved = ''
  for (let i = paths.length - 1; i >= 0; i--) {
    const p = paths[i]
    if (!p) continue
    resolved = p.startsWith('/') ? p : resolved ? `${resolved}/${p}` : p
    if (p.startsWith('/')) break
  }
  if (!resolved.startsWith('/')) resolved = `/${resolved}`
  return normalizeParts(resolved.split('/'), true)
}

export function normalize(p: string): string {
  const { root, body } = split(p)
  const trailing = p.endsWith('/') && p !== '/'
  const out = normalizeParts(body.split('/'), !!root)
  return root + out + (trailing && !out.endsWith('/') ? '/' : '') || '.'
}

export function isAbsolute(p: string): boolean {
  return p.startsWith('/')
}

export function dirname(p: string): string {
  const idx = p.lastIndexOf('/')
  if (idx < 0) return '.'
  if (idx === 0) return '/'
  return p.slice(0, idx)
}

export function basename(p: string, ext?: string): string {
  let base = p.slice(p.lastIndexOf('/') + 1)
  if (ext && base.endsWith(ext)) base = base.slice(0, -ext.length)
  return base
}

export function extname(p: string): string {
  const base = basename(p)
  const idx = base.lastIndexOf('.')
  return idx <= 0 ? '' : base.slice(idx)
}

export function relative(from: string, to: string): string {
  const a = resolve(from).split('/').filter(Boolean)
  const b = resolve(to).split('/').filter(Boolean)
  let i = 0
  while (i < a.length && i < b.length && a[i] === b[i]) i++
  const up: string[] = Array.from({ length: a.length - i }, () => '..')
  return [...up, ...b.slice(i)].join('/') || '.'
}

export const sep = '/'
export const delimiter = ':'

export default {
  join,
  resolve,
  normalize,
  isAbsolute,
  dirname,
  basename,
  extname,
  relative,
  sep,
  delimiter
}
