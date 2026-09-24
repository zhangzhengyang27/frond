import { describe, it, expect, vi } from 'vitest'

/**
 * 导航 / 权限守卫的判据回归。
 *
 * 这两条判据判错的代价是「某个功能静默失效」或「攻击面敞开」，所以每条都按
 * 「改错会红」来写，而不是只跑一遍 happy path。
 */
vi.mock('electron', () => ({
  app: { on: vi.fn(), removeListener: vi.fn() },
  shell: { openExternal: vi.fn() },
  session: {}
}))
vi.mock('../../services/LogService', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() }
}))

import {
  isAllowedNavigation,
  isFirstPartyUrl,
  isOwnRendererUrl,
  decidePermission,
  PERMISSION_ALLOWLIST,
  INTERNAL_SENTINEL_SCHEMES,
  type FirstPartyContext
} from '../navigationGuard'

const APP_ROOT = '/Applications/Frond.app/Contents/Resources/app.asar/out'
const CTX: FirstPartyContext = { appRoot: APP_ROOT, devServerUrl: undefined }
const DEV_CTX: FirstPartyContext = { appRoot: APP_ROOT, devServerUrl: 'http://localhost:5173' }

const RENDERER = `file://${APP_ROOT}/renderer/index.html`

describe('isAllowedNavigation', () => {
  it('放行内部哨兵 frond-region://（录屏框选靠它，不是真导航）', () => {
    // ⚠ 这条是 C3-2 的核心回归：哨兵走 will-navigate 但由 RegionOverlay 自己
    // preventDefault 消费。不放行只会打误导性 warn，但日志噪音会训练人忽略真告警。
    expect(INTERNAL_SENTINEL_SCHEMES).toContain('frond-region:')
    expect(isAllowedNavigation('frond-region://select?x=1&y=2&width=10&height=10', CTX)).toBe(true)
    expect(isAllowedNavigation('frond-region://cancel', CTX)).toBe(true)
  })

  it('放行第一方产物目录下的 file:// 页面', () => {
    expect(isAllowedNavigation(RENDERER, CTX)).toBe(true)
    expect(isAllowedNavigation(`file://${APP_ROOT}/renderer/launcher.html`, CTX)).toBe(true)
  })

  it('拦掉产物目录之外的 file://（读本地文件即逃逸）', () => {
    expect(isAllowedNavigation('file:///etc/passwd', CTX)).toBe(false)
    expect(isAllowedNavigation('file:///Users/someone/.ssh/id_rsa', CTX)).toBe(false)
    // 前缀相近但不在目录内的也要拦（/out-evil 不是 /out）
    expect(isAllowedNavigation(`file://${APP_ROOT}-evil/index.html`, CTX)).toBe(false)
  })

  it('拦掉远程 http(s)（含看起来像第一方的域名）', () => {
    expect(isAllowedNavigation('https://evil.example.com/', CTX)).toBe(false)
    expect(isAllowedNavigation('http://localhost:5173/', CTX)).toBe(false) // 未配 devServer 时
  })

  it('dev 态放行 devServer，但仍拦其它 http', () => {
    expect(isAllowedNavigation('http://localhost:5173/index.html', DEV_CTX)).toBe(true)
    expect(isAllowedNavigation('http://localhost:9999/index.html', DEV_CTX)).toBe(false)
  })

  it('放行 Electron 内部与内建 scheme', () => {
    expect(isAllowedNavigation('about:blank', CTX)).toBe(true)
    expect(isAllowedNavigation('devtools://devtools/bundled/x.html', CTX)).toBe(true)
    expect(isAllowedNavigation('plugin://com.frond.regex/index.html', CTX)).toBe(true)
    expect(isAllowedNavigation('frond://settings', CTX)).toBe(true)
  })

  it('空串 / 危险 scheme 一律拦', () => {
    expect(isAllowedNavigation('', CTX)).toBe(false)
    expect(isAllowedNavigation('javascript:alert(1)', CTX)).toBe(false)
    expect(isAllowedNavigation('data:text/html,<script>x</script>', CTX)).toBe(false)
    expect(isAllowedNavigation('vbscript:msgbox(1)', CTX)).toBe(false)
  })
})

describe('isOwnRendererUrl 比 isFirstPartyUrl 更窄（权限判定必须用这个）', () => {
  it('plugin:// 算第一方导航，但**不算**自己的渲染进程', () => {
    const pluginUrl = 'plugin://com.frond.regex/index.html'
    expect(isFirstPartyUrl(pluginUrl, CTX)).toBe(true)
    // 判别性：若把权限判定换成 isFirstPartyUrl，插件页就会拿到 media
    expect(isOwnRendererUrl(pluginUrl, CTX)).toBe(false)
  })

  it('自己的渲染进程（file:// 产物 / devServer）两边都算', () => {
    expect(isFirstPartyUrl(RENDERER, CTX)).toBe(true)
    expect(isOwnRendererUrl(RENDERER, CTX)).toBe(true)
    expect(isOwnRendererUrl('http://localhost:5173/index.html', DEV_CTX)).toBe(true)
  })

  it('frond:// 与 about:blank 也不算自己的渲染进程', () => {
    expect(isOwnRendererUrl('frond://settings', CTX)).toBe(false)
    expect(isOwnRendererUrl('about:blank', CTX)).toBe(false)
  })
})

describe('decidePermission', () => {
  it('⚠ 第一方渲染进程请求 media 必须放行 —— 删了它录屏的麦克风/摄像头全废', () => {
    expect(PERMISSION_ALLOWLIST).toContain('media')
    const r = decidePermission('media', RENDERER, CTX)
    expect(r.grant).toBe(true)
    expect(r.reason).toContain('白名单')
  })

  it('第一方可放行的四项：media / clipboard-read / clipboard-sanitized-write / fullscreen', () => {
    for (const p of PERMISSION_ALLOWLIST) {
      expect(decidePermission(p, RENDERER, CTX).grant, `${p} 应放行`).toBe(true)
    }
    // 使用点：media=录屏、clipboard-read=AIChat 粘贴、clipboard-sanitized-write=全应用复制、
    // fullscreen=番茄钟全屏专注。这四条少了任何一条都有用户可见的功能挂掉。
    expect([...PERMISSION_ALLOWLIST].sort()).toEqual([
      'clipboard-read',
      'clipboard-sanitized-write',
      'fullscreen',
      'media'
    ])
  })

  it('插件页（plugin://）不给 media —— 插件是市场上可自由安装的第三方内容', () => {
    const r = decidePermission('media', 'plugin://com.frond.someplugin/index.html', CTX)
    expect(r.grant).toBe(false)
    expect(r.reason).toContain('非第一方')
  })

  it('远程页不给任何权限', () => {
    expect(decidePermission('media', 'https://evil.example.com/', CTX).grant).toBe(false)
    expect(decidePermission('clipboard-read', 'https://evil.example.com/', CTX).grant).toBe(false)
  })

  it('第一方也不给白名单外的权限（地理 / 通知 / 显示器采集 / 未知权限）', () => {
    for (const p of [
      'geolocation',
      'notifications',
      'display-capture',
      'midi',
      'hid',
      'serial',
      'usb',
      'unknown'
    ]) {
      const r = decidePermission(p, RENDERER, CTX)
      expect(r.grant, `${p} 不该放行`).toBe(false)
      expect(r.reason).toContain('不在白名单')
    }
  })

  it('空 URL 不给权限（拿不到请求方就按拒绝处理）', () => {
    expect(decidePermission('media', '', CTX).grant).toBe(false)
  })
})
