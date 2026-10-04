// Mediabunny P0 试点 · Electron 主进程（独立 harness，纯 JS）
// 职责：静态服务 harness 页面 + 接收渲染端的流式写盘 chunk（按 position 落盘）
// 运行：PILOT_SECONDS=60 npx electron scripts/mediabunny-pilot/main.mjs
import { app, BrowserWindow, ipcMain } from 'electron'
import fs from 'node:fs'
import http from 'node:http'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const OUT_PATH = process.env.PILOT_OUT || '/tmp/mediabunny-pilot.mp4'
const DURATION_S = Number(process.env.PILOT_SECONDS || 60)
const ROOT = path.resolve(HERE, '../..')

let fd = null
let bytesWritten = 0
let maxRss = 0
let maxWriteLag = 0

const MIME = {
  '.html': 'text/html',
  '.mjs': 'text/javascript',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json'
}

function startStaticServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = (req.url || '/').split('?')[0]
      let file
      if (url === '/' || url === '/index.html') file = path.join(HERE, 'index.html')
      else if (url === '/renderer.mjs') file = path.join(HERE, 'renderer.mjs')
      else if (url === '/vendor.mjs') file = path.join(HERE, 'vendor.mjs')
      else if (url.startsWith('/vendor/'))
        file = path.join(ROOT, 'node_modules/mediabunny/dist', url.slice('/vendor/'.length))
      else {
        res.writeHead(404)
        res.end('not found')
        return
      }
      if (!file.startsWith(ROOT) && !file.startsWith(HERE)) {
        res.writeHead(403)
        res.end()
        return
      }
      try {
        const body = fs.readFileSync(file)
        res.writeHead(200, {
          'content-type': MIME[path.extname(file)] || 'application/octet-stream'
        })
        res.end(body)
      } catch {
        res.writeHead(404)
        res.end('not found')
      }
    })
    server.listen(0, '127.0.0.1', () => {
      resolve(server.address().port)
    })
  })
}

app.whenReady().then(async () => {
  ipcMain.handle('pilot:begin', (_e, filePath) => {
    fd = fs.openSync(filePath, 'w')
    bytesWritten = 0
    return true
  })

  ipcMain.handle(
    'pilot:write',
    (_e, chunk) =>
      new Promise((resolve, reject) => {
        if (fd === null) {
          reject(new Error('no open fd'))
          return
        }
        const { data, position } = chunk
        const buf = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
        const t0 = Date.now()
        fs.write(fd, buf, 0, buf.length, position, (err) => {
          if (err) {
            reject(err)
            return
          }
          bytesWritten += buf.length
          maxWriteLag = Math.max(maxWriteLag, Date.now() - t0)
          maxRss = Math.max(maxRss, process.memoryUsage().rss)
          resolve(true)
        })
      })
  )

  ipcMain.handle('pilot:end', (_e, report) => {
    if (fd !== null) {
      fs.closeSync(fd)
      fd = null
    }
    const size = fs.existsSync(OUT_PATH) ? fs.statSync(OUT_PATH).size : -1
    console.log(`[pilot-main] file=${OUT_PATH} size=${size} bytesWritten=${bytesWritten}`)
    console.log(
      `[pilot-main] maxMainRssMB=${(maxRss / 1048576).toFixed(1)} maxWriteLagMs=${maxWriteLag}`
    )
    console.log(report)
    app.exit(0)
    return true
  })

  ipcMain.handle('pilot:fail', (_e, message) => {
    console.error(`[pilot-error] ${message}`)
    if (fd !== null) {
      fs.closeSync(fd)
      fd = null
    }
    app.exit(1)
    return true
  })

  try {
    const port = await startStaticServer()
    console.log(`[pilot-main] serving on 127.0.0.1:${port} target=${DURATION_S}s`)
    const win = new BrowserWindow({
      width: 680,
      height: 540,
      title: 'Mediabunny P0 Pilot',
      webPreferences: {
        preload: path.join(HERE, 'preload.cjs'),
        contextIsolation: true,
        nodeIntegration: false
      }
    })
    // 渲染端 console 全部转发到主进程 stdout（兼容新旧两种事件签名）
    win.webContents.on('console-message', (...args) => {
      const first = args[0]
      if (first && typeof first === 'object' && typeof first.message === 'string') {
        console.log(`[renderer] ${first.message}`)
      } else if (typeof args[2] === 'string') {
        console.log(`[renderer] ${args[2]}`)
      }
    })
    win.webContents.on('did-fail-load', (_e, code, desc, url) => {
      console.error(`[pilot-error] did-fail-load ${code} ${desc} ${url}`)
      app.exit(1)
    })
    win.webContents.on('render-process-gone', (_e, details) => {
      console.error(`[pilot-error] render-process-gone ${details.reason}`)
      app.exit(1)
    })
    await win.loadURL(`http://127.0.0.1:${port}/?seconds=${DURATION_S}`)
  } catch (err) {
    console.error('[pilot-error] bootstrap failed:', err)
    app.exit(1)
  }
})
