import { createServer } from 'http'
import type { Server } from 'net'

/**
 * 只给单测用的最小 WebDAV 端。
 *
 * 覆盖面 = `webdav` 客户端实际会发的四类请求（用真客户端探测过）：
 * PROPFIND(Depth 0) 撑 `exists`/`stat`、MKCOL 撑 `createDirectory(recursive)`（它会逐级
 * 往上补父目录）、PUT 撑 `putFileContents`、GET 撑 `getFileContents`。
 * **不**覆盖真服务器（Nextcloud / 群晖）的鉴权跳转、锁、分块与 PROPFIND Depth 1 列表，
 * 所以这条过了不等于「任何 WebDAV 都能用」，只等于「Leaf 这一侧的链子是对的」。
 */
export interface DavHandle {
  url: string
  files: Map<string, Buffer>
  close: () => Promise<void>
}

const propfindBody = (href: string, isDir: boolean, size: number): string =>
  `<?xml version="1.0" encoding="utf-8"?>` +
  `<d:multistatus xmlns:d="DAV:" xmlns:s="http://sabredav.org/ns" xmlns:oc="http://owncloud.org/ns">` +
  `<d:response><d:href>${href}</d:href><d:propstat><d:prop>` +
  `<d:getlastmodified>Tue, 22 Sep 2026 10:00:00 GMT</d:getlastmodified>` +
  `<d:getetag>"leaf-test"</d:getetag>` +
  (isDir
    ? `<d:resourcetype><d:collection/></d:resourcetype>`
    : `<d:getcontentlength>${size}</d:getcontentlength>`) +
  `<d:displayname>${href.split('/').filter(Boolean).pop() ?? ''}</d:displayname>` +
  `</d:prop><d:status>HTTP/1.1 200 OK</d:status></d:propstat></d:response></d:multistatus>`

export function startDav(): Promise<DavHandle> {
  const files = new Map<string, Buffer>()
  const dirs = new Set<string>(['/'])
  const srv: Server = createServer((req, res) => {
    const path = decodeURIComponent(String(req.url).split('?')[0])
    const chunks: Buffer[] = []
    const reply = (code: number, body: Buffer | string, type?: string): void => {
      res.writeHead(code, type ? { 'content-type': type } : {})
      res.end(body)
    }
    const handle = (buf: Buffer): void => {
      if (req.method === 'OPTIONS') return reply(200, 'dav:1,2', 'text/plain')
      if (req.method === 'PROPFIND') {
        if (files.has(path))
          return reply(207, propfindBody(path, false, files.get(path)!.length), 'application/xml')
        if (dirs.has(path) || dirs.has(`${path}/`))
          return reply(207, propfindBody(path, true, 0), 'application/xml')
        return reply(404, 'not found', 'text/plain')
      }
      if (req.method === 'MKCOL') {
        const asDir = path.endsWith('/') ? path : `${path}/`
        if (dirs.has(asDir) || files.has(path)) return reply(405, 'exists', 'text/plain')
        dirs.add(asDir)
        return reply(201, '', 'text/plain')
      }
      if (req.method === 'PUT') {
        files.set(path, buf)
        return reply(201, '', 'text/plain')
      }
      if (req.method === 'GET' || req.method === 'HEAD') {
        if (!files.has(path)) return reply(404, 'not found', 'text/plain')
        return reply(200, files.get(path)!, 'application/octet-stream')
      }
      if (req.method === 'DELETE') {
        files.delete(path)
        dirs.delete(path.endsWith('/') ? path : `${path}/`)
        return reply(204, '', 'text/plain')
      }
      return reply(501, 'unsupported', 'text/plain')
    }
    req.on('data', (c: Buffer) => chunks.push(c))
    req.on('end', () => handle(Buffer.concat(chunks)))
  })
  return new Promise((resolve) => {
    srv.listen(0, '127.0.0.1', () => {
      const addr = srv.address()
      const port = typeof addr === 'object' && addr ? addr.port : 0
      resolve({
        url: `http://127.0.0.1:${port}`,
        files,
        close: () =>
          new Promise<void>((done) => {
            srv.close(() => done())
          })
      })
    })
  })
}
