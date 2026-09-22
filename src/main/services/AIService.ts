/**
 * Leaf · AI 服务（P0-3）
 *
 * OpenAI 兼容 API 调用层：
 * - 配置存储在 electron-store（apiKey 仅存本机）
 * - 支持流式响应（SSE），通过 WebContents 推送增量 chunk
 * - 非流式兜底（流式失败时回退到完整响应）
 *
 * 设计约束：
 * - 不内置任何 API Key，用户自行配置
 * - baseUrl 可自定义（DeepSeek / 通义 / Ollama 等 OpenAI 兼容端点）
 * - 请求超时 60s，避免挂起
 */
import { ipcMain, type WebContents } from 'electron'
import { prefRepository } from '../db/repos'
import type {
  AIConfig,
  AIChatMessage,
  AIStreamChunk,
  AIChatSession,
  AIModelPreset
} from '../../shared/ai'
import { DEFAULT_AI_CONFIG } from '../../shared/ai'
import { encryptText, decryptText } from '../utils/crypto'
import { assertAiEndpointAllowed } from '../utils/aiEndpointGuard'

const STORE_KEY = 'ai.config'
const SESSIONS_KEY = 'ai.sessions'
const MAX_SESSIONS = 50
const MAX_MESSAGES_PER_SESSION = 100
/** 流式空闲超时：每收到数据就重置，慢模型的长回答不会被硬切 */
const STREAM_IDLE_TIMEOUT_MS = 60_000
/** 流式总时长硬上限：防服务端无限慢速滴漏 */
const STREAM_MAX_TOTAL_MS = 10 * 60 * 1000

// 存储：SQLite pref_preferences（原 electron-store，双栈收尾第二批；
// 旧 config.json 的 ai.config / ai.sessions 由 dataMigrations.migrateAiFromLegacyStore 导入）
function readKv<T>(key: string, fallback: T): T {
  const raw = prefRepository.get(key)
  if (!raw) return fallback
  try {
    return JSON.parse(raw) as T
  } catch {
    return fallback
  }
}

function writeKv(key: string, value: unknown): void {
  prefRepository.set(key, JSON.stringify(value))
}

/** 读取配置（与默认值合并，缺字段自动补齐；API Key 解密） */
export function getAIConfig(): AIConfig {
  const saved = readKv<Partial<AIConfig>>(STORE_KEY, {})
  const merged = { ...DEFAULT_AI_CONFIG, ...saved }
  // 解密 API Key（向后兼容：明文旧数据 decryptText 原样返回）
  if (merged.apiKey) merged.apiKey = decryptText(merged.apiKey)
  // 解密预设中的 API Key
  if (merged.modelPresets && Array.isArray(merged.modelPresets)) {
    merged.modelPresets = merged.modelPresets.map((p) => ({
      ...p,
      apiKey: p.apiKey ? decryptText(p.apiKey) : ''
    }))
  }
  return merged
}

/** 保存配置（增量合并；API Key 加密；baseUrl 变更时过端点守卫） */
export async function setAIConfig(patch: Partial<AIConfig>): Promise<AIConfig> {
  // baseUrl 是渲染端可写、主进程会携带 Authorization 请求的目标：
  // 入库前过一次端点守卫（请求时还会再校验，双保险）
  if (patch.baseUrl !== undefined && patch.baseUrl.trim()) {
    const guard = await assertAiEndpointAllowed(patch.baseUrl)
    if (!guard.ok) throw new Error(guard.reason)
  }
  const current = getAIConfig()
  const next = { ...current, ...patch }
  // 加密 API Key（避免重复加密）
  if (next.apiKey && !next.apiKey.startsWith('enc:')) {
    next.apiKey = encryptText(next.apiKey)
  }
  // 加密预设中的 API Key
  if (next.modelPresets && Array.isArray(next.modelPresets)) {
    next.modelPresets = next.modelPresets.map((p) => ({
      ...p,
      apiKey: p.apiKey && !p.apiKey.startsWith('enc:') ? encryptText(p.apiKey) : p.apiKey
    }))
  }
  writeKv(STORE_KEY, next)
  // 返回解密后的配置给调用方
  return getAIConfig()
}

/** 简单的 API Key 可用性检查（非空即可，不做远程验证） */
export function isAIConfigured(): boolean {
  const cfg = getAIConfig()
  return cfg.enabled && !!cfg.apiKey.trim() && !!cfg.baseUrl.trim() && !!cfg.model.trim()
}

/**
 * 非流式聊天：完整响应一次性返回。
 * 用于不支持流式的场景或流式失败兜底。
 */
async function chatNonStream(cfg: AIConfig, messages: AIChatMessage[]): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
  const guard = await assertAiEndpointAllowed(cfg.baseUrl)
  if (!guard.ok) throw new Error(guard.reason)
  const resp = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${cfg.apiKey}`
    },
    body: JSON.stringify({
      model: cfg.model,
      messages,
      temperature: cfg.temperature,
      max_tokens: cfg.maxTokens,
      stream: false
    }),
    signal: AbortSignal.timeout(60000)
  })
  if (!resp.ok) {
    const text = await resp.text().catch(() => '')
    throw new Error(`AI API ${resp.status}: ${text.slice(0, 200)}`)
  }
  const data = (await resp.json()) as {
    choices?: Array<{ message?: { content?: string } }>
  }
  return data.choices?.[0]?.message?.content ?? ''
}

/**
 * 流式失败时携带「已向渲染端推送的字符数」：handler 据此决定能否回退非流式
 * （已推送过部分内容时回退会整段重发 → 渲染端前缀重复）。
 */
class AIStreamError extends Error {
  pushedChars: number
  constructor(message: string, pushedChars: number) {
    super(message)
    this.name = 'AIStreamError'
    this.pushedChars = pushedChars
  }
}

/**
 * 流式聊天：通过 SSE 解析增量，逐 chunk 推送给指定 WebContents。
 * 返回完整文本。
 */
async function chatStream(
  cfg: AIConfig,
  messages: AIChatMessage[],
  target: WebContents,
  sessionId: string
): Promise<string> {
  const url = `${cfg.baseUrl.replace(/\/$/, '')}/chat/completions`
  const guard = await assertAiEndpointAllowed(cfg.baseUrl)
  if (!guard.ok) throw new Error(guard.reason)
  const controller = new AbortController()
  const startedAt = Date.now()
  // 已成功推送到渲染端的 delta 字符数（用于失败时判断能否非流式回退）
  let pushedChars = 0
  // 空闲超时：每收到一段数据就重置计时（替代绝对总超时——
  // 慢模型/长回答超 2 分钟被硬切的问题）；总时长上限另行兜底
  let idleTimer: ReturnType<typeof setTimeout> | null = null
  const armIdle = (): void => {
    if (idleTimer) clearTimeout(idleTimer)
    idleTimer = setTimeout(
      () => controller.abort(new Error('AI 响应空闲超时')),
      STREAM_IDLE_TIMEOUT_MS
    )
  }
  armIdle()

  // 推送目标销毁时中止请求并抛出——由调用方识别，跳过非流式兜底（避免重复请求计费）
  const push = (chunk: AIStreamChunk): void => {
    if (target.isDestroyed()) {
      controller.abort(new Error('target window closed'))
      throw new Error('target window closed')
    }
    if (chunk.delta) pushedChars += chunk.delta.length
    try {
      target.send('ai:stream-chunk', { sessionId, ...chunk })
    } catch {
      controller.abort(new Error('target window closed'))
      throw new Error('target window closed')
    }
  }

  try {
    try {
      const resp = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`
        },
        body: JSON.stringify({
          model: cfg.model,
          messages,
          temperature: cfg.temperature,
          max_tokens: cfg.maxTokens,
          stream: true
        }),
        signal: controller.signal
      })
      if (!resp.ok) {
        const text = await resp.text().catch(() => '')
        throw new Error(`AI API ${resp.status}: ${text.slice(0, 200)}`)
      }
      if (!resp.body) throw new Error('AI API 返回空响应体')

      const reader = resp.body.getReader()
      const decoder = new TextDecoder()
      let buffer = ''
      let fullText = ''

      while (true) {
        if (Date.now() - startedAt > STREAM_MAX_TOTAL_MS) {
          // 必须显式 abort：不中止的话响应体流与 socket 保持打开直到 GC
          controller.abort(new Error('AI 响应超过总时长上限'))
          throw new Error('AI 响应超过总时长上限')
        }
        const { done, value } = await reader.read()
        if (done) break
        armIdle()
        buffer += decoder.decode(value, { stream: true })
        const lines = buffer.split('\n')
        buffer = lines.pop() ?? ''
        for (const line of lines) {
          const trimmed = line.trim()
          if (!trimmed.startsWith('data:')) continue
          const payload = trimmed.slice(5).trim()
          if (payload === '[DONE]') {
            push({ delta: '', done: true })
            return fullText
          }
          try {
            const parsed = JSON.parse(payload) as {
              choices?: Array<{ delta?: { content?: string } }>
            }
            const delta = parsed.choices?.[0]?.delta?.content ?? ''
            if (delta) {
              fullText += delta
              push({ delta, done: false })
            }
          } catch {
            /* 忽略非 JSON 行 */
          }
        }
      }
      push({ delta: '', done: true })
      return fullText
    } catch (e) {
      throw new AIStreamError(e instanceof Error ? e.message : String(e), pushedChars)
    }
  } finally {
    if (idleTimer) clearTimeout(idleTimer)
  }
}

// ─── 对话历史持久化 ───

function getSessions(): AIChatSession[] {
  return readKv<AIChatSession[]>(SESSIONS_KEY, [])
}

function saveSessions(sessions: AIChatSession[]): void {
  writeKv(SESSIONS_KEY, sessions)
}

/** 列出所有会话（按更新时间倒序） */
export function listSessions(): AIChatSession[] {
  return getSessions().sort((a, b) => b.updatedAt - a.updatedAt)
}

/** 获取单个会话 */
export function getSession(id: string): AIChatSession | undefined {
  return getSessions().find((s) => s.id === id)
}

/** 保存/更新会话（自动截断消息数，自动生成标题） */
export function saveSession(session: AIChatSession): AIChatSession {
  const sessions = getSessions()
  const now = Date.now()
  // 截断消息数
  if (session.messages.length > MAX_MESSAGES_PER_SESSION) {
    session.messages = session.messages.slice(-MAX_MESSAGES_PER_SESSION)
  }
  // 自动生成标题（取第一条用户消息前 30 字）
  if (!session.title || session.title === '新对话') {
    const firstUser = session.messages.find((m) => m.role === 'user')
    session.title = firstUser ? firstUser.content.slice(0, 30) : '新对话'
  }
  session.updatedAt = now

  const idx = sessions.findIndex((s) => s.id === session.id)
  if (idx >= 0) {
    sessions[idx] = session
  } else {
    session.createdAt = session.createdAt || now
    sessions.unshift(session)
  }
  // 限制会话总数
  if (sessions.length > MAX_SESSIONS) {
    sessions.length = MAX_SESSIONS
  }
  saveSessions(sessions)
  return session
}

/** 删除会话 */
export function deleteSession(id: string): void {
  saveSessions(getSessions().filter((s) => s.id !== id))
}

/** 清空所有会话 */
export function clearSessions(): void {
  prefRepository.delete(SESSIONS_KEY)
}

// ─── 模型预设管理（BYO Model） ───

/** 列出所有模型预设 */
export function listModelPresets(): AIModelPreset[] {
  return getAIConfig().modelPresets ?? []
}

/** 保存模型预设（新增或更新） */
export async function saveModelPreset(preset: AIModelPreset): Promise<AIModelPreset[]> {
  const cfg = getAIConfig()
  const presets = [...(cfg.modelPresets ?? [])]
  const idx = presets.findIndex((p) => p.id === preset.id)
  if (idx >= 0) {
    presets[idx] = preset
  } else {
    presets.push(preset)
  }
  await setAIConfig({ modelPresets: presets })
  return presets
}

/** 删除模型预设 */
export async function deleteModelPreset(id: string): Promise<AIModelPreset[]> {
  const cfg = getAIConfig()
  const presets = (cfg.modelPresets ?? []).filter((p) => p.id !== id)
  await setAIConfig({ modelPresets: presets })
  return presets
}

/** 应用预设：将预设的 baseUrl/model/apiKey 写入当前配置 */
export async function applyModelPreset(id: string): Promise<AIConfig | null> {
  const preset = listModelPresets().find((p) => p.id === id)
  if (!preset) return null
  return setAIConfig({
    baseUrl: preset.baseUrl,
    model: preset.model,
    apiKey: preset.apiKey || getAIConfig().apiKey
  })
}

/** 注册 AI IPC 处理器 */
export function registerAIIpc(): void {
  ipcMain.handle('ai:getConfig', () => getAIConfig())

  ipcMain.handle('ai:setConfig', (_e, patch: Partial<AIConfig>) => setAIConfig(patch))

  ipcMain.handle('ai:isConfigured', () => isAIConfigured())

  // ─── 对话历史 IPC ───
  ipcMain.handle('ai:listSessions', () => listSessions())
  ipcMain.handle('ai:getSession', (_e, id: string) => getSession(id) ?? null)
  ipcMain.handle('ai:saveSession', (_e, session: AIChatSession) => saveSession(session))
  ipcMain.handle('ai:deleteSession', (_e, id: string) => {
    deleteSession(id)
    return true
  })
  ipcMain.handle('ai:clearSessions', () => {
    clearSessions()
    return true
  })

  // ─── 模型预设 IPC ───
  ipcMain.handle('ai:listPresets', () => listModelPresets())
  ipcMain.handle('ai:savePreset', (_e, preset: AIModelPreset) => saveModelPreset(preset))
  ipcMain.handle('ai:deletePreset', (_e, id: string) => deleteModelPreset(id))
  ipcMain.handle('ai:applyPreset', (_e, id: string) => applyModelPreset(id))

  /**
   * 流式聊天：渲染端传入 sessionId 用于区分多次对话，
   * 主进程通过 ai:stream-chunk 事件推送增量。
   */
  ipcMain.handle(
    'ai:chat',
    async (event, payload: { sessionId: string; messages: AIChatMessage[] }) => {
      const cfg = getAIConfig()
      if (!isAIConfigured()) {
        return { ok: false, error: 'AI 未配置：请在设置中填写 API Key' }
      }
      const { sessionId, messages } = payload
      if (!Array.isArray(messages) || messages.length === 0) {
        return { ok: false, error: '消息为空' }
      }
      try {
        const full = await chatStream(cfg, messages, event.sender, sessionId)
        return { ok: true, text: full }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        // 推送目标已销毁：没有渲染端在等结果，回退请求只会白花一次 API 费用
        if (event.sender.isDestroyed()) {
          return { ok: false, error: '窗口已关闭' }
        }
        // 已向渲染端推送过部分内容：回退非流式会把完整文本整段重发，渲染端
        // 累加后前缀重复——只能终止流并报告错误
        const pushed = err instanceof AIStreamError ? err.pushedChars : 0
        if (pushed > 0) {
          event.sender.send('ai:stream-chunk', { sessionId, delta: '', done: true, error: msg })
          return { ok: false, error: msg }
        }
        // 流式失败且尚未推送任何内容 → 回退非流式（一次性返回完整响应）
        try {
          const full = await chatNonStream(cfg, messages)
          event.sender.send('ai:stream-chunk', { sessionId, delta: full, done: true })
          return { ok: true, text: full }
        } catch {
          event.sender.send('ai:stream-chunk', { sessionId, delta: '', done: true, error: msg })
          return { ok: false, error: msg }
        }
      }
    }
  )
}
