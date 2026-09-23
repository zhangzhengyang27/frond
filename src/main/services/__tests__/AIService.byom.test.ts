import { describe, it, expect, beforeAll, afterAll, beforeEach, vi } from 'vitest'
import { createServer, type Server } from 'node:http'
import { AddressInfo } from 'node:net'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

/**
 * BYOM 端点探测（P-4①）**真联网**回归。
 *
 * 不打 mock：起一个真的 127.0.0.1 http 服务，把 AI 配置指过去，
 * 让 assertAiEndpointAllowed → URL 拼接 → fetch → parseModelList 整条链子跑通。
 * 这条链子上有三个各自能悄悄坏掉的点：本地端点该免 key 放行、
 * `/models` 必须相对 baseUrl 解析（绝对解析会丢掉 /v1）、
 * 两种响应形态（OpenAI {data:[{id}]} / Ollama {models:[{name}]}）都要认。
 */
const __userData = join(mkdtempSync(join(tmpdir(), 'frond-ai-byom-')), 'userData')
vi.mock('electron', () => ({
  app: { getPath: () => __userData, getVersion: () => '0.0.0-test', isReady: () => true },
  ipcMain: { handle: () => {} },
  BrowserWindow: { getAllWindows: () => [] }
}))

import Database from 'better-sqlite3'
import { migrations } from '../../db/migrations'
import { database } from '../../db/database'
import { setAIConfig, listModels, isAIConfigured } from '../AIService'
import { prefRepository } from '../../db/repos'

function injectDb(db: Database.Database): void {
  ;(database as unknown as { db: Database.Database | null }).db = db
}

let server: Server
let origin = ''

beforeAll(async () => {
  server = createServer((req, res) => {
    const url = req.url ?? ''
    const send = (code: number, body: unknown): void => {
      res.writeHead(code, { 'Content-Type': 'application/json' })
      res.end(JSON.stringify(body))
    }
    if (url === '/v1/models') {
      send(200, { data: [{ id: 'model-b' }, { id: 'model-a' }] })
      return
    }
    if (url === '/api/tags') {
      send(200, { models: [{ name: 'llama3.2:latest' }] })
      return
    }
    if (url.startsWith('/v1/noauth')) {
      send(401, { error: { message: 'bad key' } })
      return
    }
    if (url.startsWith('/v1/garbage')) {
      send(200, { hello: 'world' })
      return
    }
    if (url.startsWith('/v1/plain')) {
      res.writeHead(200, { 'Content-Type': 'text/plain' })
      res.end('not json at all')
      return
    }
    send(404, { error: 'no route' })
  })
  await new Promise<void>((r) => server.listen(0, '127.0.0.1', r))
  origin = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
})

afterAll(() => {
  server.close()
})

beforeEach(() => {
  injectDb(new Database(':memory:'))
  for (const m of migrations) {
    // 每个用例一本新库：setAIConfig 写的是 pref_preferences
    const db = (database as unknown as { db: Database.Database }).db
    const tx = db.transaction(() => {
      m.up(db)
      db.prepare('INSERT INTO meta (version, applied_at) VALUES (?, ?)').run(m.version, Date.now())
    })
    tx()
  }
})

describe('listModels（真起本地服务）', () => {
  it('本地端点没有 key 也算配好，并能拉到 OpenAI 形态的清单', async () => {
    await setAIConfig({ enabled: true, baseUrl: `${origin}/v1`, model: 'model-a', apiKey: '' })
    expect(isAIConfigured()).toBe(true) // 旧口径（要求 key）会把这条判成未配置
    const res = await listModels()
    expect(res.ok).toBe(true)
    expect(res.models).toEqual(['model-a', 'model-b'])
    expect(res.url).toBe(`${origin}/v1/models`)
  })

  it('Ollama 形态：../api/tags 回退一层，解析 {models:[{name}]}', async () => {
    await setAIConfig({
      enabled: true,
      baseUrl: `${origin}/v1`,
      model: 'llama3.2:latest',
      provider: 'ollama'
    })
    const res = await listModels()
    expect(res.url).toBe(`${origin}/api/tags`)
    expect(res.ok).toBe(true)
    expect(res.models).toEqual(['llama3.2:latest'])
  })

  it('端点回 401：ok=false 且把状态码带出来（界面要能说出为什么）', async () => {
    await setAIConfig({ enabled: true, baseUrl: `${origin}/v1/noauth`, model: 'x' })
    const res = await listModels()
    expect(res.ok).toBe(false)
    expect(res.error).toContain('401')
    expect(res.models).toEqual([])
  })

  it('回 200 但不是认识的形态 → 明确说「没返回可识别的模型列表」，不报空列表当成功', async () => {
    await setAIConfig({ enabled: true, baseUrl: `${origin}/v1/garbage`, model: 'x' })
    const res = await listModels()
    expect(res.ok).toBe(false)
    expect(res.error).toContain('没返回可识别的模型列表')
  })

  it('回的不是 JSON → 归到连不上，本地端点提示「没起来」', async () => {
    await setAIConfig({ enabled: true, baseUrl: `${origin}/v1/plain`, model: 'x' })
    const res = await listModels()
    expect(res.ok).toBe(false)
    expect(res.error).toContain('本地端点没起来')
  })

  it('SSRF：指向链路本地/元数据地址一律拒', async () => {
    // 保存这一关就先拦了（比等 listModels 去发请求更早、也更少留一次错误配置），
    // 所以这里断言的是「进不去」这件事，而不是它在哪一层被挡
    await expect(
      setAIConfig({ enabled: true, baseUrl: 'http://169.254.169.254/v1', model: 'x' })
    ).rejects.toThrow(/受限|元数据/)
    // 存量库里可能已经有这样的地址（守卫是后加的）：发请求前还要再过一遍
    prefRepository.set('ai.config', JSON.stringify({ enabled: true, baseUrl: 'http://169.254.169.254/v1', model: 'x', apiKey: 'k' }))
    const res = await listModels()
    expect(res.ok).toBe(false)
    expect(res.error).toMatch(/受限|元数据/)
  })
})
