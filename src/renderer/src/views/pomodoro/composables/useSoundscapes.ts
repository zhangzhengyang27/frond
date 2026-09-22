/**
 * Leaf · useSoundscapes（P0-3 声景白噪音）
 *
 * 纯 WebAudio 合成，零音频资源依赖（无下载体积 / 无版权问题）：
 * - rain      雨声：带通白噪音 + 高频细雨 shimmer
 * - waves     海浪：棕噪音 + 慢 LFO 潮汐起伏
 * - forest    森林：低通风声 + 随机鸟鸣（正弦扫频）
 * - cafe      咖啡馆：低频人声嗡嗡 + 随机杯碟轻响 + 设备低鸣
 * - fireplace 壁炉：低频火堆隆隆 + 随机柴火噼啪
 * - none      静音（停止）
 *
 * 单例引擎：同一时刻只播一个场景；切换 = stop + start。
 * 音量 0..1 走 master GainNode，可实时调节。
 */

import { onScopeDispose, ref, type Ref } from 'vue'

export type SoundscapeId = 'none' | 'rain' | 'waves' | 'forest' | 'cafe' | 'fireplace'

export interface SoundscapeMeta {
  id: SoundscapeId
  label: string
  icon: string
}

export const SOUNDSCAPES: SoundscapeMeta[] = [
  { id: 'none', label: '无', icon: 'ri-volume-mute-line' },
  { id: 'rain', label: '雨声', icon: 'ri-rainy-line' },
  { id: 'waves', label: '海浪', icon: 'ri-water-flash-line' },
  { id: 'forest', label: '森林', icon: 'ri-plant-line' },
  { id: 'cafe', label: '咖啡馆', icon: 'ri-cup-line' },
  { id: 'fireplace', label: '壁炉', icon: 'ri-fire-line' }
]

/** 白噪音 / 棕噪音循环 buffer */
function makeNoiseBuffer(ctx: AudioContext, brown: boolean): AudioBuffer {
  const seconds = 3
  const buffer = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate)
  const data = buffer.getChannelData(0)
  let last = 0
  for (let i = 0; i < data.length; i += 1) {
    const white = Math.random() * 2 - 1
    if (brown) {
      last = (last + 0.02 * white) / 1.02
      data[i] = last * 3.5
    } else {
      data[i] = white
    }
  }
  return buffer
}

function noiseSource(ctx: AudioContext, brown: boolean): AudioBufferSourceNode {
  const src = ctx.createBufferSource()
  src.buffer = makeNoiseBuffer(ctx, brown)
  src.loop = true
  return src
}

/** 一个声景运行中的所有可停止资源 */
interface SceneHandle {
  stop(): void
}

export function useSoundscapes(): {
  current: Ref<SoundscapeId>
  start: (id: SoundscapeId, vol?: number) => void
  stop: () => void
  setVolume: (v: number) => void
} {
  const current = ref<SoundscapeId>('none')

  let ctx: AudioContext | null = null
  let master: GainNode | null = null
  let scene: SceneHandle | null = null
  let volume = 0.6

  function ensureCtx(): AudioContext {
    if (!ctx) ctx = new AudioContext()
    if (ctx.state === 'suspended') void ctx.resume()
    return ctx
  }

  function ensureMaster(c: AudioContext): GainNode {
    if (!master) {
      master = c.createGain()
      master.gain.value = volume
      master.connect(c.destination)
    }
    return master
  }

  function setVolume(v: number): void {
    volume = Math.min(1, Math.max(0, v))
    if (master && ctx) {
      master.gain.setTargetAtTime(volume, ctx.currentTime, 0.05)
    }
  }

  function stop(): void {
    scene?.stop()
    scene = null
    current.value = 'none'
  }

  /** 停止并释放 AudioContext：组件卸载时不释放会随每次进出页面累积泄漏 */
  function dispose(): void {
    stop()
    if (ctx) {
      void ctx.close().catch(() => {})
      ctx = null
      master = null
    }
  }

  // composable 在组件 setup 中调用：作用域销毁（卸载）时释放
  onScopeDispose(dispose)

  function start(id: SoundscapeId, vol?: number): void {
    if (vol !== undefined) setVolume(vol)
    stop()
    if (id === 'none') return
    const c = ensureCtx()
    const out = ensureMaster(c)
    scene = buildScene(c, out, id)
    current.value = id
  }

  /** 随机定时器句柄集合（切场景/停止时全部清理） */
  function buildScene(c: AudioContext, out: GainNode, id: SoundscapeId): SceneHandle {
    const sources: Array<AudioScheduledSourceNode> = []
    const timers: ReturnType<typeof setTimeout>[] = []
    let stopped = false

    const track = <T extends AudioScheduledSourceNode>(n: T): T => {
      sources.push(n)
      return n
    }
    const later = (fn: () => void, ms: number, jitterMs: number): void => {
      const run = (): void => {
        if (stopped) return
        fn()
        timers.push(setTimeout(run, ms + Math.random() * jitterMs))
      }
      timers.push(setTimeout(run, Math.random() * ms))
    }
    const chain = (node: AudioNode, ...rest: AudioNode[]): void => {
      let from = node
      for (const to of rest) {
        from.connect(to)
        from = to
      }
      from.connect(out)
    }

    if (id === 'rain') {
      const n = track(noiseSource(c, false))
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 500
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 2400
      const g = c.createGain()
      g.gain.value = 0.35
      chain(n, hp, lp, g)
      // 高频细雨 shimmer
      const n2 = track(noiseSource(c, false))
      const bp = c.createBiquadFilter()
      bp.type = 'bandpass'
      bp.frequency.value = 5200
      bp.Q.value = 0.8
      const g2 = c.createGain()
      g2.gain.value = 0.05
      chain(n2, bp, g2)
      n.start()
      n2.start()
    } else if (id === 'waves') {
      const n = track(noiseSource(c, true))
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 480
      const g = c.createGain()
      g.gain.value = 0.34
      // 潮汐 LFO：约 14s 一个周期
      const lfo = track(c.createOscillator())
      lfo.frequency.value = 0.07
      const lfoGain = c.createGain()
      lfoGain.gain.value = 0.22
      lfo.connect(lfoGain)
      lfoGain.connect(g.gain)
      chain(n, lp, g)
      n.start()
      lfo.start()
    } else if (id === 'forest') {
      // 风
      const n = track(noiseSource(c, false))
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 320
      const g = c.createGain()
      g.gain.value = 0.07
      chain(n, lp, g)
      n.start()
      // 鸟鸣：正弦扫频短音组
      later(() => chirp(c, out, track), 3000, 7000)
    } else if (id === 'cafe') {
      // 人声嗡嗡（棕噪 + 低通）
      const n = track(noiseSource(c, true))
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 700
      const g = c.createGain()
      g.gain.value = 0.24
      chain(n, lp, g)
      n.start()
      // 设备低鸣
      const hum = track(c.createOscillator())
      hum.type = 'sine'
      hum.frequency.value = 118
      const humG = c.createGain()
      humG.gain.value = 0.015
      chain(hum, humG)
      hum.start()
      // 杯碟轻响
      later(() => clink(c, out), 3500, 6000)
    } else if (id === 'fireplace') {
      // 火堆隆隆
      const n = track(noiseSource(c, true))
      const lp = c.createBiquadFilter()
      lp.type = 'lowpass'
      lp.frequency.value = 360
      const g = c.createGain()
      g.gain.value = 0.22
      chain(n, lp, g)
      n.start()
      // 柴火噼啪
      later(() => crackle(c, out), 400, 900)
    }

    return {
      stop(): void {
        stopped = true
        for (const t of timers) clearTimeout(t)
        for (const s of sources) {
          try {
            s.stop()
          } catch {
            /* already stopped */
          }
        }
      }
    }
  }

  /** 鸟鸣：2–4 个快速上扬扫频 */
  function chirp(
    c: AudioContext,
    out: GainNode,
    track: <T extends AudioScheduledSourceNode>(n: T) => T
  ): void {
    const chirps = 2 + Math.floor(Math.random() * 2)
    for (let i = 0; i < chirps; i += 1) {
      const t0 = c.currentTime + i * 0.22
      const osc = track(c.createOscillator())
      osc.type = 'sine'
      const base = 2200 + Math.random() * 900
      osc.frequency.setValueAtTime(base, t0)
      osc.frequency.exponentialRampToValueAtTime(base * 1.5, t0 + 0.06)
      osc.frequency.exponentialRampToValueAtTime(base * 1.1, t0 + 0.14)
      const g = c.createGain()
      g.gain.setValueAtTime(0.0001, t0)
      g.gain.exponentialRampToValueAtTime(0.045, t0 + 0.02)
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.18)
      osc.connect(g)
      g.connect(out)
      osc.start(t0)
      osc.stop(t0 + 0.2)
    }
  }

  /** 杯碟轻响：高频三角波短衰减 */
  function clink(c: AudioContext, out: GainNode): void {
    const t0 = c.currentTime
    const osc = c.createOscillator()
    osc.type = 'triangle'
    osc.frequency.setValueAtTime(1900 + Math.random() * 700, t0)
    const g = c.createGain()
    g.gain.setValueAtTime(0.04, t0)
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.13)
    osc.connect(g)
    g.connect(out)
    osc.start(t0)
    osc.stop(t0 + 0.15)
    osc.onended = () => {
      try {
        osc.disconnect()
        g.disconnect()
      } catch {
        /* noop */
      }
    }
  }

  /** 柴火噼啪：短白噪爆发 + 高通 */
  function crackle(c: AudioContext, out: GainNode): void {
    const bursts = 1 + Math.floor(Math.random() * 3)
    for (let i = 0; i < bursts; i += 1) {
      const t0 = c.currentTime + i * (0.04 + Math.random() * 0.08)
      const dur = 0.02 + Math.random() * 0.05
      const buf = c.createBuffer(1, Math.ceil(c.sampleRate * dur), c.sampleRate)
      const data = buf.getChannelData(0)
      for (let j = 0; j < data.length; j += 1) {
        data[j] = (Math.random() * 2 - 1) * (1 - j / data.length)
      }
      const src = c.createBufferSource()
      src.buffer = buf
      const hp = c.createBiquadFilter()
      hp.type = 'highpass'
      hp.frequency.value = 1400
      const g = c.createGain()
      g.gain.value = 0.1 + Math.random() * 0.12
      src.connect(hp)
      hp.connect(g)
      g.connect(out)
      src.start(t0)
      src.onended = () => {
        try {
          src.disconnect()
          hp.disconnect()
          g.disconnect()
        } catch {
          /* noop */
        }
      }
    }
  }

  return { current, start, stop, setVolume }
}
