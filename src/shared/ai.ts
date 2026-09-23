/**
 * Frond · AI 集成类型定义（P0-3）
 *
 * OpenAI 兼容 API：支持自定义 base URL（可接 DeepSeek / 通义 / 本地 Ollama 等）。
 * 配置仅存本机（electron-store），不上传任何遥测。
 */

export interface AIConfig {
  /** 总开关 */
  enabled: boolean
  /** API Key（加密存储在 electron-store） */
  apiKey: string
  /** Base URL，默认 https://api.openai.com/v1 */
  baseUrl: string
  /** 模型名，默认 gpt-4o-mini */
  model: string
  /** 系统提示词 */
  systemPrompt: string
  /** 生成参数 */
  temperature: number
  maxTokens: number
  /** 已保存的模型预设列表（BYO Model 管理） */
  modelPresets: AIModelPreset[]
  /** 当前配置来自哪个内置 provider（决定拉模型列表的路径与是否要求 key） */
  provider?: AIProviderPreset['id']
}

/** 模型预设：一组 baseUrl + model + apiKey 的快捷配置 */
export interface AIModelPreset {
  id: string
  name: string
  baseUrl: string
  model: string
  apiKey: string
  /** 预设来源标记：custom / openai / deepseek / qwen / ollama / openrouter */
  provider?: string
}

export const DEFAULT_AI_CONFIG: AIConfig = {
  enabled: false,
  apiKey: '',
  baseUrl: 'https://api.openai.com/v1',
  model: 'gpt-4o-mini',
  systemPrompt: '你是一个简洁高效的助手，回答尽量简短直接。',
  temperature: 0.7,
  maxTokens: 1024,
  modelPresets: []
}

export interface AIChatMessage {
  role: 'system' | 'user' | 'assistant'
  content: string
}

export interface AIStreamChunk {
  /** 增量文本 */
  delta: string
  /** 是否结束 */
  done: boolean
  /** 错误信息（done=true 且有 error 时表示失败） */
  error?: string
}

/** 对话会话（持久化存储） */
export interface AIChatSession {
  id: string
  title: string
  messages: AIChatMessage[]
  createdAt: number
  updatedAt: number
  /** 使用的模型名（用于历史展示） */
  model?: string
}

// ───────────────────── BYOM：provider 目录与可用性判定（P-4①）─────────────────────

/**
 * 内置 provider 预设。这是**填表用的目录**，不是「已连接」的证明：
 * 选中只把 baseUrl/model/keyRequired 填好，key 仍要用户自己给（本地端点则不需要）。
 * modelsPath 是拉模型列表的相对路径——Ollama 的 /api/tags 返回 `{models:[{name}]}`，
 * OpenAI 兼容端点返回 `{data:[{id}]}`，解析差异在主进程侧按形态判断（不靠 provider 名）。
 */
export interface AIProviderPreset {
  id: 'openai' | 'ollama' | 'lmstudio' | 'openrouter' | 'deepseek' | 'qwen' | 'custom'
  label: string
  baseUrl: string
  model: string
  /** 本地端点不需要 key；远程一律要（没有凭据的远程调用不是本产品要支持的形态） */
  keyRequired: boolean
  modelsPath: string
  hint: string
}

export const AI_PROVIDERS: AIProviderPreset[] = [
  {
    id: 'openai',
    label: 'OpenAI',
    baseUrl: 'https://api.openai.com/v1',
    model: 'gpt-4o-mini',
    keyRequired: true,
    modelsPath: '/models',
    hint: 'OpenAI 兼容端点的鼻祖'
  },
  {
    id: 'ollama',
    label: 'Ollama（本地）',
    baseUrl: 'http://127.0.0.1:11434/v1',
    model: 'llama3.2',
    keyRequired: false,
    // Ollama 的模型清单在 /api/tags（/v1/models 也认，但拿不到大小与详情）
    modelsPath: '../api/tags',
    hint: '本机跑模型，不需要 API Key'
  },
  {
    id: 'lmstudio',
    label: 'LM Studio（本地）',
    baseUrl: 'http://127.0.0.1:1234/v1',
    model: '',
    keyRequired: false,
    modelsPath: '/models',
    hint: '本机跑模型，需在 LM Studio 里打开 local server'
  },
  {
    id: 'openrouter',
    label: 'OpenRouter',
    baseUrl: 'https://openrouter.ai/api/v1',
    model: 'openai/gpt-4o-mini',
    keyRequired: true,
    modelsPath: '/models',
    hint: '一个 key 打多家模型'
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    baseUrl: 'https://api.deepseek.com/v1',
    model: 'deepseek-chat',
    keyRequired: true,
    modelsPath: '/models',
    hint: ''
  },
  {
    id: 'qwen',
    label: '通义千问',
    baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
    model: 'qwen-plus',
    keyRequired: true,
    modelsPath: '/models',
    hint: 'DashScope 的 OpenAI 兼容端点'
  },
  {
    id: 'custom',
    label: '自定义',
    baseUrl: '',
    model: '',
    keyRequired: true,
    modelsPath: '/models',
    hint: '任何 OpenAI 兼容端点（vLLM / FastChat / 内网网关）'
  }
]

export function findProvider(id: string | undefined): AIProviderPreset | undefined {
  return AI_PROVIDERS.find((p) => p.id === id)
}

/**
 * 端点是不是「本机/局域网」——决定要不要 key，以及明文 http 能不能接受。
 * 只认字面 IP 与 localhost 主机名：不做 DNS（这是渲染端也会用的纯函数，
 * 真正的 DNS 复核在主进程 aiEndpointGuard 里）。
 */
export function isLocalAiBaseUrl(baseUrl: string): boolean {
  let url: URL
  try {
    url = new URL(baseUrl.trim())
  } catch {
    return false
  }
  if (url.protocol !== 'http:') return false
  const host = url.hostname.toLowerCase()
  if (host === 'localhost' || host.endsWith('.localhost')) return true
  if (/^127\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^10\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^192\.168\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  if (/^172\.(1[6-9]|2\d|3[01])\.\d{1,3}\.\d{1,3}$/.test(host)) return true
  return false
}

/** 配置是否「能用」：本地端点免 key，其余三件齐备才算齐 */
export function aiConfigUsable(cfg: {
  baseUrl?: string
  model?: string
  apiKey?: string
}): boolean {
  const base = (cfg.baseUrl ?? '').trim()
  const model = (cfg.model ?? '').trim()
  if (!base || !model) return false
  if (isLocalAiBaseUrl(base)) return true
  return !!(cfg.apiKey ?? '').trim()
}

/**
 * 把 provider 的 modelsPath 拼成完整 URL（纯函数）。
 *
 * 规则是**相对 baseUrl 解析**，不是相对 origin：
 * - `/models`（多数 OpenAI 兼容端点）→ `https://api.openai.com/v1/models`
 *   （按绝对路径解析会把 `/v1` 丢掉，那就是 404）；
 * - `../api/tags`（Ollama 的清单不在 /v1 下）→ `http://127.0.0.1:11434/api/tags`。
 * 所以开头斜杠去掉、`../` 保留，交给 URL 规范去回退。
 */
export function aiModelsUrl(baseUrl: string, modelsPath = '/models'): string | null {
  const base = (baseUrl ?? '').trim()
  if (!base) return null
  const withSlash = /\/$/.test(base) ? base : `${base}/`
  try {
    return new URL(modelsPath.replace(/^\//, ''), withSlash).toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

/**
 * 模型列表响应的两种形态 → 名字数组（纯函数）。
 * OpenAI 兼容：`{ data: [{ id }] }`；Ollama：`{ models: [{ name | model }] }`。
 * 按**响应形态**判断而不是按 provider 名：任何代理网关都可能转发成另一副样子。
 */
export function parseModelList(payload: unknown): string[] {
  if (!payload || typeof payload !== 'object') return []
  const obj = payload as { data?: unknown; models?: unknown }
  const out: string[] = []
  const push = (v: unknown): void => {
    if (typeof v === 'string' && v.trim()) out.push(v.trim())
    else if (v && typeof v === 'object') {
      const e = v as { id?: unknown; name?: unknown; model?: unknown }
      const name = e.id ?? e.name ?? e.model
      if (typeof name === 'string' && name.trim()) out.push(name.trim())
    }
  }
  if (Array.isArray(obj.data)) obj.data.forEach(push)
  else if (Array.isArray(obj.models)) obj.models.forEach(push)
  return [...new Set(out)].sort((a, b) => a.localeCompare(b))
}

/** 拉模型列表该走哪条路径（provider 未选/未知时按 OpenAI 兼容的 /models） */
export function modelsPathFor(provider: AIProviderPreset['id'] | undefined): string {
  return findProvider(provider)?.modelsPath ?? '/models'
}

/** 内置目录自检用：目录里每一项都得能拼出可用的模型清单地址 */
export function providerModelEndpoint(p: AIProviderPreset): string | null {
  return aiModelsUrl(p.baseUrl, p.modelsPath)
}
