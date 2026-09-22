import { describe, it, expect } from 'vitest'
import {
  AI_PROVIDERS,
  aiConfigUsable,
  aiModelsUrl,
  findProvider,
  isLocalAiBaseUrl,
  modelsPathFor,
  parseModelList,
  providerModelEndpoint
} from '../ai'

/**
 * BYOM provider 目录与可用性判定（P-4①，纯函数）。
 *
 * 这一格里有两条是真踩过坑的：
 * - 模型清单地址必须**相对 baseUrl** 解析：按绝对路径解析会把 `/v1` 丢掉，
 *   打到 `https://api.openai.com/models` → 404，而界面只会显示「拉取失败」；
 * - 「配好了」不能等于「有 key」：Ollama / LM Studio 根本没有 key，
 *   旧的 isAIConfigured 因此把 BYOM 的主场景永远判成未配置。
 */

describe('aiModelsUrl', () => {
  it('/models 相对 baseUrl 解析，保住 /v1 前缀', () => {
    expect(aiModelsUrl('https://api.openai.com/v1', '/models')).toBe(
      'https://api.openai.com/v1/models'
    )
    expect(aiModelsUrl('https://api.openai.com/v1/', '/models')).toBe(
      'https://api.openai.com/v1/models'
    )
    expect(aiModelsUrl('https://openrouter.ai/api/v1', '/models')).toBe(
      'https://openrouter.ai/api/v1/models'
    )
  })

  it('../api/tags 能回退一层（Ollama 的清单不在 /v1 下）', () => {
    expect(aiModelsUrl('http://127.0.0.1:11434/v1', '../api/tags')).toBe(
      'http://127.0.0.1:11434/api/tags'
    )
  })

  it('缺省路径就是 /models；空或非法 baseUrl 返回 null', () => {
    expect(aiModelsUrl('http://127.0.0.1:1234/v1')).toBe('http://127.0.0.1:1234/v1/models')
    expect(aiModelsUrl('')).toBeNull()
    expect(aiModelsUrl('   ')).toBeNull()
    expect(aiModelsUrl('not a url')).toBeNull()
  })
})

describe('isLocalAiBaseUrl', () => {
  it('只有明文 http 且主机是本机/局域网字面量才算本地', () => {
    expect(isLocalAiBaseUrl('http://127.0.0.1:11434/v1')).toBe(true)
    expect(isLocalAiBaseUrl('http://localhost:11434/v1')).toBe(true)
    expect(isLocalAiBaseUrl('http://192.168.1.20:1234/v1')).toBe(true)
    expect(isLocalAiBaseUrl('http://10.0.0.5:8000/v1')).toBe(true)
    expect(isLocalAiBaseUrl('http://172.16.0.9:8000/v1')).toBe(true)
    expect(isLocalAiBaseUrl('https://127.0.0.1:11434/v1')).toBe(false) // https 不走这条免 key 判定
    expect(isLocalAiBaseUrl('http://8.8.8.8/v1')).toBe(false)
    expect(isLocalAiBaseUrl('http://172.15.0.9:8000/v1')).toBe(false) // 不在 RFC1918 段
    expect(isLocalAiBaseUrl('垃圾')).toBe(false)
  })
})

describe('aiConfigUsable', () => {
  it('本地端点免 key（BYOM 主场景），远程三件齐备才算齐', () => {
    expect(aiConfigUsable({ baseUrl: 'http://127.0.0.1:11434/v1', model: 'llama3.2', apiKey: '' })).toBe(
      true
    )
    expect(aiConfigUsable({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: '' })).toBe(
      false
    )
    expect(
      aiConfigUsable({ baseUrl: 'https://api.openai.com/v1', model: 'gpt-4o-mini', apiKey: 'sk-x' })
    ).toBe(true)
    expect(aiConfigUsable({ baseUrl: 'https://api.openai.com/v1', model: '', apiKey: 'sk-x' })).toBe(
      false
    )
    expect(aiConfigUsable({})).toBe(false)
  })
})

describe('parseModelList', () => {
  it('OpenAI 形态 {data:[{id}]}', () => {
    expect(
      parseModelList({ data: [{ id: 'gpt-b' }, { id: 'gpt-a' }, { name: 'no-id-but-name' }] })
    ).toEqual(['gpt-a', 'gpt-b', 'no-id-but-name'])
  })

  it('Ollama 形态 {models:[{name}]} 与纯字符串数组', () => {
    expect(parseModelList({ models: [{ name: 'llama3.2' }, { model: 'qwen2.5' }] })).toEqual([
      'llama3.2',
      'qwen2.5'
    ])
    expect(parseModelList({ data: ['a', 'a', 'b'] })).toEqual(['a', 'b'])
  })

  it('认不出的形态给空数组，不猜', () => {
    expect(parseModelList(null)).toEqual([])
    expect(parseModelList('[]')).toEqual([])
    expect(parseModelList({ models: 'nope' })).toEqual([])
    expect(parseModelList({ data: [{}, null, { id: '  ' }] })).toEqual([])
  })

  it('去重 + 字典序（界面下拉直接可用，不用调用方再整理）', () => {
    expect(parseModelList({ data: [{ id: 'b' }, { id: 'b' }, { id: 'a' }] })).toEqual(['a', 'b'])
  })
})

describe('AI_PROVIDERS 目录', () => {
  it('id 唯一，且都能拼出模型清单地址（自定义留空 baseUrl 除外）', () => {
    const ids = AI_PROVIDERS.map((p) => p.id)
    expect(new Set(ids).size).toBe(ids.length)
    for (const p of AI_PROVIDERS) {
      if (!p.baseUrl) continue
      expect(providerModelEndpoint(p), `${p.id} 拼不出地址`).toBeTruthy()
    }
  })

  it('免 key 的项必须是本地端点：远程无凭据不是本产品要支持的形态', () => {
    for (const p of AI_PROVIDERS.filter((x) => x.baseUrl)) {
      if (!p.keyRequired) expect(isLocalAiBaseUrl(p.baseUrl), `${p.id} 免 key 但端点不本地`).toBe(true)
    }
  })

  it('provider 名解析与缺省路径', () => {
    expect(findProvider('ollama')?.baseUrl).toBe('http://127.0.0.1:11434/v1')
    expect(findProvider('没有这个')).toBeUndefined()
    expect(findProvider(undefined)).toBeUndefined()
    expect(modelsPathFor('ollama')).toBe('../api/tags')
    expect(modelsPathFor(undefined)).toBe('/models')
    // 存量配置里可能是任何字符串（旧版本 / 手改），运行时按 OpenAI 兼容兜底
    expect(modelsPathFor('未知' as never)).toBe('/models')
  })
})
