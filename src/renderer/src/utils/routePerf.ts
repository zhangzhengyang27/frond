import type { NavigationFailure, RouteLocationNormalized } from 'vue-router'

interface RoutePerfSample {
  name: string
  path: string
  duration: number
  timestamp: number
}

interface RoutePerfSummary {
  count: number
  avg: number
  p95: number
  max: number
}

interface RoutePerfPanel {
  samples: RoutePerfSample[]
  latest: RoutePerfSample | null
  summary: () => RoutePerfSummary
  clear: () => void
}

declare global {
  interface Window {
    __ROUTE_PERF__?: RoutePerfPanel
  }
}

const SAMPLE_LIMIT = 80
const DEV_LOG_THRESHOLD = 240
const WARN_THRESHOLD = 600

const routeStarts = new Map<string, number>()
const samples: RoutePerfSample[] = []

function getRouteKey(to: RouteLocationNormalized): string {
  return `${String(to.name || 'unknown')}@${to.fullPath}`
}

function updateDebugPanel(): void {
  window.__ROUTE_PERF__ = {
    samples: [...samples],
    latest: samples[samples.length - 1] || null,
    summary() {
      if (samples.length === 0) {
        return { count: 0, avg: 0, p95: 0, max: 0 }
      }

      const durations = samples.map((sample) => sample.duration).sort((a, b) => a - b)

      const avg = durations.reduce((sum, item) => sum + item, 0) / durations.length
      const p95Index = Math.min(durations.length - 1, Math.floor(durations.length * 0.95))

      return {
        count: durations.length,
        avg: Number(avg.toFixed(2)),
        p95: Number(durations[p95Index].toFixed(2)),
        max: Number(durations[durations.length - 1].toFixed(2))
      }
    },
    clear() {
      samples.length = 0
    }
  }
}

function recordSample(to: RouteLocationNormalized, duration: number): void {
  samples.push({
    name: String(to.name || 'unknown'),
    path: to.fullPath,
    duration: Number(duration.toFixed(2)),
    timestamp: Date.now()
  })

  if (samples.length > SAMPLE_LIMIT) {
    samples.shift()
  }

  updateDebugPanel()
}

export function startRouteTiming(to: RouteLocationNormalized): void {
  routeStarts.clear()
  routeStarts.set(getRouteKey(to), performance.now())
}

export function cancelRouteTiming(to: RouteLocationNormalized): void {
  routeStarts.delete(getRouteKey(to))
}

export function finishRouteTiming(
  to: RouteLocationNormalized,
  failure?: NavigationFailure | void
): void {
  const key = getRouteKey(to)

  if (failure) {
    cancelRouteTiming(to)
    return
  }

  const startedAt = routeStarts.get(key)
  if (startedAt == null) {
    return
  }

  routeStarts.delete(key)

  const duration = performance.now() - startedAt
  recordSample(to, duration)

  if (duration >= WARN_THRESHOLD) {
    console.warn(`[route-perf] slow route: ${to.fullPath} (${duration.toFixed(2)}ms)`)
    return
  }

  if (import.meta.env.DEV && duration >= DEV_LOG_THRESHOLD) {
    console.info(`[route-perf] route: ${to.fullPath} (${duration.toFixed(2)}ms)`)
  }
}
