/**
 * 浏览器环境里 `url` 的替身（vite alias 指过来）。
 *
 * 渲染层代码没有 import 'url'，这里只为被打包进来的第三方依赖兜住。
 * URL / URLSearchParams 浏览器本来就有，直接转发；剩下三个 Node 专有的
 * 小工具给字符串实现（`fileURLToPath` 的语义就是去掉 file:// 前并解百分号）。
 */

export { URL, URLSearchParams }

export interface ParsedUrl {
  href: string
  protocol: string
  host: string
  hostname: string
  port: string
  pathname: string
  search: string
  hash: string
}

export function parse(target: string): ParsedUrl | null {
  try {
    const u = new URL(target)
    return {
      href: u.href,
      protocol: u.protocol,
      host: u.host,
      hostname: u.hostname,
      port: u.port,
      pathname: u.pathname,
      search: u.search,
      hash: u.hash
    }
  } catch {
    return null
  }
}

export function format(obj: Partial<ParsedUrl>): string {
  return (
    obj.href ??
    `${obj.protocol ?? ''}//${obj.host ?? ''}${obj.pathname ?? ''}${obj.search ?? ''}${obj.hash ?? ''}`
  )
}

export function fileURLToPath(url: string | URL): string {
  const href = typeof url === 'string' ? url : url.href
  if (!href.startsWith('file://')) throw new TypeError('invalid file URL')
  return decodeURIComponent(href.slice('file://'.length))
}

export function pathToFileURL(path: string): URL {
  return new URL(`file://${encodeURI(path).replace(/#/g, '%23').replace(/\?/g, '%3F')}`)
}

export default {
  URL,
  URLSearchParams,
  parse,
  format,
  fileURLToPath,
  pathToFileURL
}
