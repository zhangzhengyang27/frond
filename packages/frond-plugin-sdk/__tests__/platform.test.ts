import { describe, it, expect, beforeEach, vi } from 'vitest'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

/**
 * P-2.3：SDK 接通宿主已有能力的单测（与 sdk.test.ts 同源——测构建产物 dist/index.js，
 * 这样测的就是插件真正拿到的那份字节码；改完 SDK 必须重建，见 HANDOFF §2）。
 */

const __dirname = dirname(fileURLToPath(import.meta.url))
const DIST = join(__dirname, '..', 'dist', 'index.js')

interface DbCall {
  op: 'put' | 'get' | 'remove'
  key: string
  data?: unknown
}

interface Stub {
  notified: string[]
  copied: string[]
  closed: number
  db: DbCall[]
  readTextValue: string
  getReturn: { id: string; data: unknown } | null
  context: { pluginId: string; cmd: string | null } | null
}

let stub: Stub
let sdk: typeof import('../dist/index.js')

beforeEach(async () => {
  stub = {
    notified: [],
    copied: [],
    closed: 0,
    db: [],
    readTextValue: 'clip',
    getReturn: null,
    context: { pluginId: 'com.test.demo', cmd: 'ping' }
  }
  vi.resetModules()
  ;(
    globalThis as unknown as {
      launcherApi: Record<string, unknown>
    }
  ).launcherApi = {
    getContext: () => Promise.resolve(stub.context),
    close: () => {
      stub.closed += 1
      return Promise.resolve(true)
    },
    notify: (body: unknown) => {
      stub.notified.push(String(body))
      return Promise.resolve(true)
    },
    copyText: (text: unknown) => {
      stub.copied.push(String(text))
      return Promise.resolve(true)
    },
    readText: () => Promise.resolve(stub.readTextValue),
    db: {
      put: (id: string, data: unknown) => {
        stub.db.push({ op: 'put', key: id, data })
        return Promise.resolve({ id })
      },
      get: (id: string) => {
        stub.db.push({ op: 'get', key: id })
        return Promise.resolve(stub.getReturn)
      },
      remove: (id: string) => {
        stub.db.push({ op: 'remove', key: id })
        return Promise.resolve({ ok: true })
      }
    }
  }
  sdk = await import(DIST)
})

describe('showToast', () => {
  it('字符串两参形态拼成一条通知正文', () => {
    sdk.showToast('已复制', 'abc')
    expect(stub.notified).toEqual(['已复制：abc'])
  })
  it('Raycast 对象形态取 title + message', () => {
    sdk.showToast({ style: 'info', title: '完成', message: '已同步' })
    expect(stub.notified).toEqual(['完成：已同步'])
  })
  it('空正文不发通知（避免宿主弹一条空白）', () => {
    sdk.showToast({})
    sdk.showToast('')
    expect(stub.notified).toEqual([])
  })
})

describe('剪贴板', () => {
  it('copyToClipboard → copyText；getClipboardText → readText', async () => {
    await sdk.copyToClipboard('x')
    expect(stub.copied).toEqual(['x'])
    await expect(sdk.getClipboardText()).resolves.toBe('clip')
  })
})

describe('插件上下文与自关（Action 命令要用）', () => {
  it('getPluginContext 透传宿主 getContext（含 cmd，用于分支要不要界面）', async () => {
    await expect(sdk.getPluginContext()).resolves.toEqual({
      pluginId: 'com.test.demo',
      cmd: 'ping'
    })
  })
  it('closePlugin 走宿主 close；无宿主时安全 no-op', async () => {
    await sdk.closePlugin()
    expect(stub.closed).toBe(1)
    delete (globalThis as { launcherApi?: unknown }).launcherApi
    await expect(sdk.closePlugin()).resolves.toBeUndefined()
    await expect(sdk.getPluginContext()).resolves.toBeNull()
  })
})

describe('LocalStorage / Cache 落到插件 KV', () => {
  it('LocalStorage 用 ls: 前缀，值包一层 {value}（只存字符串）', async () => {
    await sdk.setLocalStorageItem('token', 'v1')
    expect(stub.db[0]).toEqual({ op: 'put', key: 'ls:token', data: { value: 'v1' } })
    stub.getReturn = { id: 'ls:token', data: { value: 'v1' } }
    await expect(sdk.getLocalStorageItem('token')).resolves.toBe('v1')
  })
  it('非字符串值不当作文本返回（避免把对象 [object Object] 交给调用方）', async () => {
    stub.getReturn = { id: 'ls:token', data: { value: { nested: 1 } } }
    await expect(sdk.getLocalStorageItem('token')).resolves.toBeUndefined()
  })
  it('Cache 与 LocalStorage 前缀分开，互不覆盖', async () => {
    await sdk.setCacheItem('k', 'c')
    await sdk.setLocalStorageItem('k', 'l')
    expect(stub.db.map((c) => c.key)).toEqual(['cache:k', 'ls:k'])
  })
  it('Cache 带 ttl 时写入未来 expiresAt；过期读到即删并返回 undefined', async () => {
    await sdk.setCacheItem('k', 'v', 60)
    const written = stub.db[0].data as { value: string; expiresAt: number }
    expect(written.value).toBe('v')
    expect(written.expiresAt).toBeGreaterThan(Date.now())

    stub.getReturn = { id: 'cache:k', data: { value: 'v', expiresAt: Date.now() - 1 } }
    stub.db.length = 0
    await expect(sdk.getCacheItem('k')).resolves.toBeUndefined()
    expect(stub.db.map((c) => c.op)).toEqual(['get', 'remove'])
  })
})
