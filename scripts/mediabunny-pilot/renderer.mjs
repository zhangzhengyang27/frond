// Mediabunny P0 试点 · 渲染端管线（纯 JS）
// Canvas(1280x720@30fps 动画) → WebCodecs(avc) → Mediabunny fMP4 → StreamTarget
// → IPC 按字节偏移落盘（主进程 pwrite）。验证：编码/封装/流式写盘/收尾全链 + 内存平稳性。
import { Output, Mp4OutputFormat, StreamTarget, CanvasSource, Quality } from 'mediabunny'

const pilot = window.pilot

const OUT_PATH = '/tmp/mediabunny-pilot.mp4'
const DURATION_S = Number(new URLSearchParams(location.search).get('seconds') || 60)
const FPS = 30
const CANVAS_W = 1280
const CANVAS_H = 720

const logEl = document.getElementById('log')
const log = (line) => {
  logEl.textContent += line + '\n'
  // 同步转发到 console（主进程经 console-message 转发到 stdout，便于无头排查）
  console.log(line)
}

function fail(message) {
  log('[pilot-error] ' + message)
  void pilot.fail(message)
  throw new Error(message)
}

/** 动画帧：移动渐变背景 + 弹跳方块 + 时间戳文字（内容随时间变化，验证无定格） */
function drawFrame(canvas, t, frame) {
  const c = canvas.getContext('2d')
  if (!c) fail('canvas 2d context unavailable')
  const grad = c.createLinearGradient(0, 0, CANVAS_W, CANVAS_H)
  grad.addColorStop((t / 10) % 1, '#1a2a6c')
  grad.addColorStop((t / 10 + 0.5) % 1, '#b21f1f')
  grad.addColorStop((t / 10 + 0.75) % 1, '#fdbb2d')
  c.fillStyle = grad
  c.fillRect(0, 0, CANVAS_W, CANVAS_H)

  const bounce = Math.abs(Math.sin(t * 2))
  const bx = 100 + ((t * 80) % (CANVAS_W - 200))
  const by = 80 + bounce * (CANVAS_H - 260)
  c.fillStyle = '#ffffff'
  c.fillRect(bx, by, 90, 90)
  c.fillStyle = '#000000'
  c.fillRect(bx + 20, by + 25, 50, 40)

  c.fillStyle = '#fff'
  c.font = 'bold 42px monospace'
  c.fillText('P0 PILOT  t=' + t.toFixed(1) + 's  f=' + frame, 60, CANVAS_H - 50)
}

async function main() {
  window.__moduleBooted = true
  log('[pilot] start: ' + DURATION_S + 's @' + FPS + 'fps avc fMP4 -> ' + OUT_PATH)

  // WebCodecs avc 支持预检
  const support = await VideoEncoder.isConfigSupported({
    codec: 'avc1.640028',
    width: CANVAS_W,
    height: CANVAS_H,
    bitrate: 2500000,
    framerate: FPS
  })
  log('[pilot] avc supported=' + support.supported)
  if (!support.supported) fail('avc encoding not supported in this runtime')

  // 流式写盘桥：WritableStream → IPC pwrite（write 返回 Promise = 背压传导入口）
  const writeTimings = []
  const target = new StreamTarget(
    new WritableStream({
      async write(chunk) {
        const sentAt = performance.now()
        await pilot.write({ data: chunk.data, position: chunk.position })
        writeTimings.push(performance.now() - sentAt)
      }
    }),
    { chunked: true, chunkSize: 2 ** 20 }
  )

  const output = new Output({
    format: new Mp4OutputFormat({ fastStart: 'fragmented' }),
    target
  })
  const canvas = document.getElementById('stage')
  const videoSource = new CanvasSource(canvas, {
    codec: 'avc',
    bitrate: new Quality({ bitrate: 2500000 }),
    hardwareAcceleration: 'prefer-hardware',
    keyFrameInterval: 2
  })
  await output.addVideoTrack(videoSource, { frameRate: FPS })
  log('[pilot] video track added')
  await output.start()
  log('[pilot] output started')

  await pilot.begin(OUT_PATH)
  log('[pilot] sink opened')

  // 确定性 30fps 循环：await add() 背压传导（文档明确要求必须 await）
  const t0 = performance.now()
  const frameDur = 1 / FPS
  const heapSamples = []
  let frames = 0
  let firstAddMs = 0

  while (true) {
    const nextT = (frames + 1) * frameDur
    if (nextT > DURATION_S) break
    const wall = (performance.now() - t0) / 1000
    if (wall < nextT) await new Promise((r) => setTimeout(r, (nextT - wall) * 1000))
    drawFrame(canvas, nextT, frames + 1)
    const addStart = performance.now()
    await videoSource.add(nextT, frameDur)
    if (frames === 0) firstAddMs = performance.now() - addStart
    frames++
    if (frames % (FPS * 5) === 0) {
      const mem = performance.memory ? performance.memory.usedJSHeapSize / 1048576 : NaN
      heapSamples.push({ t: nextT, mb: mem })
      log('[pilot] t=' + nextT.toFixed(0) + 's frames=' + frames + ' heap=' + mem.toFixed(1) + 'MB')
    }
  }

  log('[pilot] recording done: frames=' + frames + ' firstAddMs=' + firstAddMs.toFixed(1))
  log('[pilot] finalizing…')
  await output.finalize()
  const totalWall = ((performance.now() - t0) / 1000).toFixed(1)

  const sorted = [...writeTimings].sort((a, b) => a - b)
  const pct = (p) => sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * p))].toFixed(1)
  const heapLine = heapSamples.map((s) => 't=' + s.t.toFixed(0) + 's:' + s.mb.toFixed(1) + 'MB').join(' ')
  const heapFirst = heapSamples[0] ? heapSamples[0].mb : NaN
  const heapLast = heapSamples[heapSamples.length - 1]
    ? heapSamples[heapSamples.length - 1].mb
    : NaN
  const drift = Number.isNaN(heapLast - heapFirst) ? 'n/a' : (heapLast - heapFirst).toFixed(1)

  const report = [
    '[pilot-report] wall=' + totalWall + 's target=' + DURATION_S + 's frames=' + frames +
      ' (expect ' + Math.floor(DURATION_S * FPS) + ')',
    '[pilot-report] chunks=' + writeTimings.length + ' writeLagMs p50=' + pct(0.5) +
      ' p95=' + pct(0.95) + ' max=' + sorted[sorted.length - 1].toFixed(1),
    '[pilot-report] heapSamples: ' + heapLine,
    '[pilot-report] heapDriftMB=' + drift + ' (last - first; 应近零，无泄漏性增长)'
  ].join('\n')
  log(report)
  await pilot.end(report)
}

main().catch((err) => {
  fail(String((err && err.stack) || err))
})
