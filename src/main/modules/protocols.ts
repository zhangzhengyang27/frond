import { protocol, net } from 'electron'
import { existsSync, statSync, createReadStream } from 'fs'
import { isAbsolute, extname } from 'path'
import { pathToFileURL } from 'url'
import { Readable } from 'stream'
import { convertHeicToPng, isHeicPath } from '../utils/imageConvert'
import { resolvePluginFile, getPlugin } from '../launcher/pluginStore'

/** 各协议允许加载的文件扩展名（路径来自渲染端，必须收窄到对应媒体类型） */
const IMAGE_EXTENSIONS = new Set([
  '.jpg',
  '.jpeg',
  '.png',
  '.gif',
  '.webp',
  '.bmp',
  '.svg',
  '.heic',
  '.heif',
  '.avif',
  '.ico'
])
const VIDEO_EXTENSIONS = new Set(['.webm', '.mp4', '.mov', '.mkv', '.avi', '.m4v', '.ogv'])
/** 手动流式响应需要显式 Content-Type（net.fetch(file://) 的 mime 自动推断不可用） */
const VIDEO_MIME: Record<string, string> = {
  '.webm': 'video/webm',
  '.mp4': 'video/mp4',
  '.m4v': 'video/mp4',
  '.mov': 'video/quicktime',
  '.mkv': 'video/x-matroska',
  '.avi': 'video/x-msvideo',
  '.ogv': 'video/ogg'
}

/** 校验协议请求的本地路径：绝对路径 + 存在 + 是文件 + 扩展名在白名单内 */
function validatedMediaPath(rawPath: string, allowed: Set<string>): string | null {
  const filePath = decodeURI(rawPath)
  if (!isAbsolute(filePath)) return null
  if (!allowed.has(extname(filePath).toLowerCase())) return null
  try {
    if (!existsSync(filePath) || !statSync(filePath).isFile()) return null
  } catch {
    return null
  }
  return filePath
}

/**
 * 媒体协议来源校验：仅第一方页面（file:// 应用页 / dev server）可经
 * image://、video:// 读取本地媒体。插件页（plugin://）与远程页面被拒，
 * 防止其用 onload/onerror 做任意本地文件存在性探测。file:// 页面对跨协议
 * <img>/<video> 可能不发送 Referer，空值放行（与旧行为等价）。
 */
function isFirstPartyMediaRequest(request: Request): boolean {
  const referer = request.headers.get('referer')
  if (!referer) return true
  if (referer.startsWith('file://')) return true
  const devServer = process.env.ELECTRON_RENDERER_URL
  if (devServer && referer.startsWith(devServer)) return true
  return false
}

/**
 * 注册 plugin:// 协议：plugin://<pluginId>/<相对路径>
 * 服务启动器插件的静态资源；realpath 校验防止目录穿越，webSecurity 保持开启。
 */
function registerPluginProtocol(): void {
  protocol.handle('plugin', async (request) => {
    try {
      const raw = request.url.replace(/^plugin:\/\//, '')
      const slashIdx = raw.indexOf('/')
      if (slashIdx <= 0) return new Response('Bad Request', { status: 400 })
      const pluginId = decodeURIComponent(raw.slice(0, slashIdx))
      const relativePath = decodeURIComponent(raw.slice(slashIdx + 1).split('?')[0] ?? '')
      // 已卸载 / 已禁用的插件不再提供资源：禁用 ≠ 不可读，页面内容不该继续暴露
      const plugin = getPlugin(pluginId)
      if (!plugin || !plugin.enabled) return new Response('Not Found', { status: 404 })
      const filePath = resolvePluginFile(pluginId, relativePath || 'index.html')
      if (!filePath) return new Response('Not Found', { status: 404 })
      return net.fetch(pathToFileURL(filePath).toString())
    } catch (err) {
      console.error('[Launcher] plugin protocol error:', request.url, err)
      return new Response('Internal Error', { status: 500 })
    }
  })
}

export function registerProtocols(): void {
  // 启动器插件协议（plugin://）
  registerPluginProtocol()

  // 注册 image:// 协议（使用现代 protocol.handle API，原生支持异步）
  protocol.handle('image', async (request) => {
    try {
      if (!isFirstPartyMediaRequest(request)) {
        return new Response('Forbidden', { status: 403 })
      }
      // 移除 'image://' 前缀
      const url = request.url.replace(/^image:\/\//, '')
      const filePath = validatedMediaPath(url, IMAGE_EXTENSIONS)
      if (!filePath) {
        console.error(`Image file refused or not found: ${url}`)
        return new Response('Not Found', { status: 404 })
      }

      let targetPath = filePath
      if (isHeicPath(filePath)) {
        try {
          targetPath = await convertHeicToPng(filePath)
        } catch (heicError) {
          console.error(`HEIC conversion failed: ${filePath}`, heicError)
          return new Response('Conversion Failed', { status: 500 })
        }
      }

      // 使用 net.fetch 加载本地文件
      return net.fetch(pathToFileURL(targetPath).toString())
    } catch (err) {
      console.error(`Error in image protocol handler: ${request.url}`, err)
      return new Response('Internal Error', { status: 500 })
    }
  })

  // rawfile:// 已移除：全仓无消费方，且「原样加载任意本地文件」是全盘文件读取面

  // 注册 video:// 协议（用于加载本地视频文件）
  // Range 支持：<video> 的 seek 走标准 bytes 请求，返回 206 分片流——
  // 此前 net.fetch(file://) 忽略 Range 返回 200 全量，Chromium 顺序缓冲整个
  // 文件，1GB+ 录制回放时渲染进程内存暴涨；流式后按需分块拉取
  protocol.handle('video', async (request) => {
    try {
      if (!isFirstPartyMediaRequest(request)) {
        return new Response('Forbidden', { status: 403 })
      }
      const url = request.url.replace(/^video:\/\//, '')
      const filePath = validatedMediaPath(url, VIDEO_EXTENSIONS)
      if (!filePath) {
        console.error(`Video file refused or not found: ${url}`)
        return new Response('Not Found', { status: 404 })
      }

      const total = statSync(filePath).size
      const mime = VIDEO_MIME[extname(filePath).toLowerCase()] ?? 'video/webm'

      const range = request.headers.get('range')
      if (range) {
        const m = /^bytes=(\d*)-(\d*)$/.exec(range.trim())
        if (m) {
          let start: number
          let end: number
          if (m[1] === '' && m[2] !== '') {
            // bytes=-N：最后 N 字节
            start = Math.max(0, total - Number(m[2]))
            end = total - 1
          } else {
            start = Number(m[1])
            end = m[2] === '' ? total - 1 : Math.min(Number(m[2]), total - 1)
          }
          if (Number.isNaN(start) || start > end || start >= total) {
            return new Response(null, {
              status: 416,
              headers: { 'Content-Range': `bytes */${total}` }
            })
          }
          const stream = createReadStream(filePath, { start, end })
          return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
            status: 206,
            headers: {
              'Content-Type': mime,
              'Content-Length': String(end - start + 1),
              'Content-Range': `bytes ${start}-${end}/${total}`,
              'Accept-Ranges': 'bytes'
            }
          })
        }
      }

      // 无 Range：200 全量元数据（仍走流，不整块读进内存）
      const stream = createReadStream(filePath)
      return new Response(Readable.toWeb(stream) as unknown as ReadableStream, {
        status: 200,
        headers: {
          'Content-Type': mime,
          'Content-Length': String(total),
          'Accept-Ranges': 'bytes'
        }
      })
    } catch (err) {
      console.error('Error handling video protocol:', err)
      return new Response('Internal Error', { status: 500 })
    }
  })
}
