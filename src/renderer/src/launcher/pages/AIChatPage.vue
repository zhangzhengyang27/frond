<template>
  <div class="ai-chat-page">
    <!-- 未配置提示 -->
    <div v-if="!configured" class="ai-empty">
      <div class="ai-empty-icon">
        <AppIcon icon="sparkling-2-line" :size="32" />
      </div>
      <div class="ai-empty-title">AI 未配置</div>
      <div class="ai-empty-desc">在设置中填写 API Key 后即可使用</div>
      <button class="ai-empty-btn" @mousedown.prevent="openSettings">打开 AI 设置</button>
    </div>

    <!-- 对话区域 -->
    <div v-else class="ai-main">
      <!-- 顶部工具栏 -->
      <div class="ai-toolbar">
        <button
          class="ai-tool-btn"
          title="历史对话"
          @mousedown.prevent="showHistory = !showHistory"
        >
          <AppIcon icon="history-line" :size="16" />
        </button>
        <button class="ai-tool-btn" title="新建对话" @mousedown.prevent="newChat">
          <AppIcon icon="edit-2-line" :size="16" />
        </button>
        <div class="ai-session-title" :title="currentTitle">{{ currentTitle }}</div>
        <div class="ai-model-selector" @mousedown.prevent="showPresetMenu = !showPresetMenu">
          <AppIcon icon="sparkling-line" :size="14" />
          <span class="ai-model-name">{{ currentModel }}</span>
          <AppIcon icon="arrow-down-s-line" :size="14" />
        </div>
        <!-- 预设菜单 -->
        <div v-if="showPresetMenu" class="ai-preset-menu" @mousedown.stop>
          <div class="ai-preset-header">切换模型预设</div>
          <div
            v-for="p in presets"
            :key="p.id"
            class="ai-preset-item"
            :class="{ active: p.model === currentModel }"
            @mousedown.prevent="applyPreset(p)"
          >
            <span class="ai-preset-name">{{ p.name }}</span>
            <span class="ai-preset-model">{{ p.model }}</span>
          </div>
          <div v-if="presets.length === 0" class="ai-preset-empty">
            暂无预设，在设置中添加模型预设
          </div>
          <div class="ai-preset-footer">
            <button class="ai-preset-manage" @mousedown.prevent="openSettings">管理预设</button>
          </div>
        </div>
      </div>

      <div class="ai-body">
        <!-- 历史侧边栏 -->
        <div v-if="showHistory" class="ai-history">
          <div class="ai-history-header">
            <span>历史对话</span>
            <button
              v-if="sessions.length > 0"
              class="ai-history-clear"
              @mousedown.prevent="clearAllSessions"
            >
              清空
            </button>
          </div>
          <div class="ai-history-list">
            <div
              v-for="s in sessions"
              :key="s.id"
              class="ai-history-item"
              :class="{ active: s.id === currentSessionId }"
              @mousedown.prevent="renameId === s.id ? null : loadSession(s)"
            >
              <!-- 重命名编辑态 -->
              <div v-if="renameId === s.id" class="ai-history-rename" @mousedown.stop>
                <input
                  ref="renameInputRef"
                  v-model="renameDraft"
                  class="ai-history-input"
                  type="text"
                  placeholder="会话标题…"
                  @keydown.enter.stop="commitRename"
                  @keydown.esc.stop="renameId = ''"
                />
              </div>
              <template v-else>
                <div class="ai-history-title" :title="s.title">{{ s.title }}</div>
                <div class="ai-history-meta">
                  <span>{{ formatTime(s.updatedAt) }}</span>
                  <button class="ai-history-op" title="重命名" @mousedown.stop="startRename(s)">
                    <AppIcon icon="edit-line" :size="12" />
                  </button>
                  <button class="ai-history-del" @mousedown.stop="deleteSession(s.id)">
                    <AppIcon icon="delete-bin-line" :size="12" />
                  </button>
                </div>
              </template>
            </div>
            <div v-if="sessions.length === 0" class="ai-history-empty">暂无历史对话</div>
          </div>
        </div>

        <!-- 消息区 -->
        <div ref="scrollRef" class="ai-messages">
          <div v-for="(msg, i) in messages" :key="i" class="ai-msg" :class="msg.role">
            <div class="ai-msg-role">{{ msg.role === 'user' ? '我' : 'AI' }}</div>
            <div class="ai-msg-content">{{ msg.content }}</div>
          </div>
          <div v-if="streaming" class="ai-msg assistant">
            <div class="ai-msg-role">AI</div>
            <div class="ai-msg-content streaming">
              {{ streamText }}<span class="cursor">▋</span>
            </div>
          </div>
        </div>
      </div>

      <!-- 输入框 -->
      <div class="ai-input-bar">
        <!-- 内联 :emoji 补全（弹层定位在该容器上方） -->
        <EmojiSuggest ref="emojiSuggestRef" :text="input" @pick="applyEmojiPick" />
        <input
          ref="inputRef"
          v-model="input"
          class="ai-input"
          type="text"
          placeholder="输入问题，回车发送；输入 :emoji 名称插入表情"
          :disabled="streaming"
          @keydown="onKeydown"
        />
        <button class="ai-send" :disabled="streaming || !input.trim()" @mousedown.prevent="send">
          发送
        </button>
      </div>
    </div>
    <PageFooterBar />
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onBeforeUnmount, nextTick, computed } from 'vue'
import PageFooterBar from './PageFooterBar.vue'
import AppIcon from '@components/AppIcon.vue'
import EmojiSuggest from '@components/EmojiSuggest.vue'
import { parseEmojiTrigger } from '@shared/emoji'
import { formatSmartDate } from '@utils/format'

interface ChatMsg {
  role: 'user' | 'assistant'
  content: string
}
interface Session {
  id: string
  title: string
  messages: ChatMsg[]
  createdAt: number
  updatedAt: number
  model?: string
}
interface Preset {
  id: string
  name: string
  baseUrl: string
  model: string
  apiKey: string
  provider?: string
}

const messages = ref<ChatMsg[]>([])
const input = ref('')
const configured = ref(false)
/** Quick AI 兜底：待配置确认后自动发送的初始问题 */
const pendingInitial = ref('')
const streaming = ref(false)
const streamText = ref('')
const scrollRef = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)
const emojiSuggestRef = ref<{ consumeKey: (e: KeyboardEvent) => boolean } | null>(null)

const showHistory = ref(false)
const showPresetMenu = ref(false)
const sessions = ref<Session[]>([])
const presets = ref<Preset[]>([])
const currentSessionId = ref('')
const currentModel = ref('gpt-4o-mini')
// 会话重命名编辑态
const renameId = ref('')
const renameDraft = ref('')
const renameInputRef = ref<HTMLInputElement | null>(null)

const sessionId = computed(
  () => currentSessionId.value || `ai-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`
)

/** 工具栏中央：当前会话标题（无会话显示引导文案） */
const currentTitle = computed(() => {
  if (currentSessionId.value) {
    return sessions.value.find((s) => s.id === currentSessionId.value)?.title || ''
  }
  return messages.value.length > 0 ? '未命名对话' : ''
})

let unregisterStream: (() => void) | null = null

async function checkConfig(): Promise<void> {
  try {
    configured.value = await window.api.ai.isConfigured()
    if (configured.value) {
      const cfg = (await window.api.ai.getConfig()) as { model: string }
      currentModel.value = cfg.model || 'gpt-4o-mini'
      await loadSessions()
      await loadPresets()
      // Quick AI 兜底：配置确认后就绪后自动发出排队的问题
      if (pendingInitial.value) {
        const text = pendingInitial.value
        pendingInitial.value = ''
        sendInitial(text)
      }
    }
  } catch {
    configured.value = false
  }
}

async function loadSessions(): Promise<void> {
  try {
    sessions.value = (await window.api.ai.listSessions()) as Session[]
  } catch {
    sessions.value = []
  }
}

async function loadPresets(): Promise<void> {
  try {
    presets.value = (await window.api.ai.listPresets()) as Preset[]
  } catch {
    presets.value = []
  }
}

function scrollToBottom(): void {
  nextTick(() => {
    if (scrollRef.value) scrollRef.value.scrollTop = scrollRef.value.scrollHeight
  })
}

function newChat(): void {
  if (streaming.value) return
  // 先落盘当前会话再开新会话，避免未完成对话丢失
  void persistAndReset()
}

async function persistAndReset(): Promise<void> {
  await saveCurrentSession()
  messages.value = []
  currentSessionId.value = ''
  renameId.value = ''
  inputRef.value?.focus()
}

async function loadSession(s: Session): Promise<void> {
  if (streaming.value) return
  await saveCurrentSession()
  currentSessionId.value = s.id
  messages.value = s.messages.map((m) => ({ role: m.role, content: m.content }))
  if (s.model) currentModel.value = s.model
  showHistory.value = false
  scrollToBottom()
}

/** 重命名：保留 title 传给主进程（saveSession 仅在 title 为空时才自动命名） */
function startRename(s: Session): void {
  renameId.value = s.id
  renameDraft.value = s.title || ''
  renameInputRef.value?.focus()
}

async function commitRename(): Promise<void> {
  const id = renameId.value
  renameId.value = ''
  const title = renameDraft.value.trim()
  if (!id || !title) return
  const target = sessions.value.find((s) => s.id === id)
  if (!target) return
  try {
    await window.api.ai.saveSession({ ...target, title })
    await loadSessions()
  } catch {
    /* ignore */
  }
}

async function saveCurrentSession(): Promise<void> {
  if (messages.value.length === 0) return
  const now = Date.now()
  const existing = sessions.value.find((s) => s.id === currentSessionId.value)
  const session: Session = {
    id: currentSessionId.value || `sess-${now}`,
    // 保留既有标题（含用户重命名），为空时主进程用首条提问自动命名
    title: existing?.title ?? '',
    messages: messages.value,
    createdAt: existing?.createdAt ?? now,
    updatedAt: now,
    model: currentModel.value
  }
  try {
    const saved = (await window.api.ai.saveSession(session)) as Session
    currentSessionId.value = saved.id
    await loadSessions()
  } catch {
    /* 保存失败不影响使用 */
  }
}

async function deleteSession(id: string): Promise<void> {
  try {
    await window.api.ai.deleteSession(id)
    if (currentSessionId.value === id) {
      messages.value = []
      currentSessionId.value = ''
    }
    await loadSessions()
  } catch {
    /* ignore */
  }
}

async function clearAllSessions(): Promise<void> {
  try {
    await window.api.ai.clearSessions()
    messages.value = []
    currentSessionId.value = ''
    await loadSessions()
  } catch {
    /* ignore */
  }
}

async function applyPreset(p: Preset): Promise<void> {
  try {
    await window.api.ai.applyPreset(p.id)
    currentModel.value = p.model
    showPresetMenu.value = false
  } catch {
    /* ignore */
  }
}

async function send(): Promise<void> {
  const text = input.value.trim()
  if (!text || streaming.value) return
  input.value = ''
  messages.value.push({ role: 'user', content: text })
  streaming.value = true
  streamText.value = ''
  scrollToBottom()

  const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
  try {
    await window.api.ai.chat(sessionId.value, history)
  } catch {
    /* 错误由 stream chunk 的 error 字段传递 */
  }
}

function onKeydown(e: KeyboardEvent): void {
  // 内联 emoji 补全打开时优先消费方向键/回车/Tab/Esc
  if (emojiSuggestRef.value?.consumeKey(e)) return
  if (e.key === 'Enter' && !e.shiftKey) {
    e.preventDefault()
    void send()
  }
}

/** 选中的 Emoji 替换输入中 ":query" 尾部 */
function applyEmojiPick(emoji: string): void {
  const t = parseEmojiTrigger(input.value)
  if (!t) return
  input.value = input.value.slice(0, t.start) + emoji
  inputRef.value?.focus()
}

function openSettings(): void {
  showPresetMenu.value = false
  window.api.launcher.openModule('settings', '/settings')
}

const formatTime = formatSmartDate

/** 胶囊页键盘约定：返回 true 表示已消费，父级不再处理 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'Escape') {
    if (showPresetMenu.value) {
      showPresetMenu.value = false
      return true
    }
    if (showHistory.value) {
      showHistory.value = false
      return true
    }
    return false
  }
  return true
}

/** 外部传入初始问题（LauncherApp 空态回退调用） */
function sendInitial(text: string): void {
  if (!text || streaming.value) return
  messages.value.push({ role: 'user', content: text })
  streaming.value = true
  streamText.value = ''
  scrollToBottom()
  const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
  void window.api.ai.chat(sessionId.value, history).catch(() => {
    /* 错误由 stream chunk 传递 */
  })
}

/** Quick AI 兜底：页面可能尚未完成配置检查，先排队，配置就绪后再自动发送 */
function queueInitial(text: string): void {
  if (!text) return
  if (configured.value) {
    sendInitial(text)
  } else {
    pendingInitial.value = text
  }
}

/** AI 预设命令：读取剪贴板文本 + 预设提示词，自动发送 */
async function sendPreset(preset: 'translate' | 'summarize' | 'rewrite'): Promise<void> {
  if (streaming.value) return
  let text = ''
  try {
    text = await navigator.clipboard.readText()
  } catch {
    /* 剪贴板读取失败时用空文本 */
  }
  const prompts: Record<string, string> = {
    translate: text
      ? `请把以下文本翻译为中文，只输出译文：\n\n${text}`
      : '请把我接下来发送的文本翻译为中文',
    summarize: text
      ? `请用 3-5 个要点总结以下文本的核心内容：\n\n${text}`
      : '请总结我接下来发送的文本',
    rewrite: text
      ? `请润色改写以下文本，使其更流畅专业，保留原意：\n\n${text}`
      : '请润色改写我接下来发送的文本'
  }
  const prompt = prompts[preset]
  messages.value.push({ role: 'user', content: prompt })
  streaming.value = true
  streamText.value = ''
  scrollToBottom()
  const history = messages.value.map((m) => ({ role: m.role, content: m.content }))
  try {
    await window.api.ai.chat(sessionId.value, history)
  } catch {
    /* 错误由 stream chunk 传递 */
  }
}

defineExpose({ handleKey, sendInitial, sendPreset, queueInitial })

onMounted(() => {
  void checkConfig()
  unregisterStream = window.api.ai.onStreamChunk((payload) => {
    if (payload.sessionId !== sessionId.value) return
    if (payload.error) {
      streamText.value = `错误：${payload.error}`
      streaming.value = false
      messages.value.push({ role: 'assistant', content: streamText.value })
      streamText.value = ''
      void saveCurrentSession()
      return
    }
    if (payload.delta) {
      streamText.value += payload.delta
      scrollToBottom()
    }
    if (payload.done) {
      streaming.value = false
      if (streamText.value) {
        messages.value.push({ role: 'assistant', content: streamText.value })
      }
      streamText.value = ''
      scrollToBottom()
      void saveCurrentSession()
    }
  })
})

onBeforeUnmount(() => {
  unregisterStream?.()
})
</script>

<style scoped>
.ai-chat-page {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ai-empty {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 10px;
  padding: 30px 20px;
}

.ai-empty-icon {
  color: var(--launcher-accent);
  opacity: 0.7;
}

.ai-empty-title {
  font-size: 15px;
  font-weight: 600;
  color: var(--launcher-text);
}

.ai-empty-desc {
  font-size: 12px;
  color: var(--launcher-text-muted);
}

.ai-empty-btn {
  margin-top: 8px;
  padding: 7px 18px;
  border: 1px solid var(--launcher-accent-strong);
  border-radius: 8px;
  background: var(--launcher-accent-soft);
  color: var(--launcher-accent);
  font-size: 12px;
  cursor: pointer;
}

.ai-main {
  display: flex;
  flex-direction: column;
  height: 100%;
  min-height: 0;
}

.ai-toolbar {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--launcher-hairline);
  flex-shrink: 0;
  position: relative;
}

.ai-tool-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 28px;
  height: 28px;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--launcher-text-muted);
  cursor: pointer;
  transition: background 0.15s;
}

.ai-tool-btn:hover {
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text);
}

.ai-session-title {
  flex: 1;
  min-width: 0;
  padding: 0 4px;
  font-size: 12px;
  font-weight: 600;
  color: var(--launcher-text-dim);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-model-selector {
  display: flex;
  align-items: center;
  gap: 4px;
  margin-left: auto;
  padding: 4px 10px;
  border-radius: 6px;
  background: var(--launcher-accent-soft);
  color: var(--launcher-accent);
  font-size: 12px;
  cursor: pointer;
  transition: background 0.15s;
}

.ai-model-selector:hover {
  background: var(--launcher-accent-soft);
}

.ai-model-name {
  max-width: 120px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-preset-menu {
  position: absolute;
  top: 100%;
  right: 12px;
  margin-top: 4px;
  width: 240px;
  background: var(--launcher-popover-bg);
  border: 1px solid var(--launcher-border);
  border-radius: 10px;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
  z-index: 100;
  overflow: hidden;
}

.ai-preset-header {
  padding: 10px 14px;
  font-size: 12px;
  font-weight: 600;
  color: var(--launcher-text-muted);
  border-bottom: 1px solid var(--launcher-hairline);
}

.ai-preset-item {
  display: flex;
  flex-direction: column;
  gap: 2px;
  padding: 8px 14px;
  cursor: pointer;
  transition: background 0.15s;
}

.ai-preset-item:hover {
  background: var(--launcher-accent-soft);
}

.ai-preset-item.active {
  background: var(--launcher-accent-soft);
}

.ai-preset-name {
  font-size: 13px;
  color: var(--launcher-text);
}

.ai-preset-model {
  font-size: 11px;
  color: var(--launcher-text-muted);
}

.ai-preset-empty {
  padding: 16px 14px;
  font-size: 12px;
  color: var(--launcher-text-muted);
  text-align: center;
}

.ai-preset-footer {
  padding: 8px 14px;
  border-top: 1px solid var(--launcher-hairline);
}

.ai-preset-manage {
  width: 100%;
  padding: 6px;
  border: none;
  border-radius: 6px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text-dim);
  font-size: 12px;
  cursor: pointer;
}

.ai-preset-manage:hover {
  background: var(--launcher-bg-elevated);
}

.ai-body {
  display: flex;
  flex: 1;
  min-height: 0;
}

.ai-history {
  width: 180px;
  border-right: 1px solid var(--launcher-hairline);
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}

.ai-history-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 8px 12px;
  font-size: 12px;
  font-weight: 600;
  color: var(--launcher-text-muted);
  border-bottom: 1px solid var(--launcher-hairline);
}

.ai-history-clear {
  border: none;
  background: transparent;
  color: var(--launcher-text-faint);
  font-size: 11px;
  cursor: pointer;
}

.ai-history-clear:hover {
  color: #ef4444;
}

.ai-history-list {
  flex: 1;
  overflow-y: auto;
  padding: 4px;
}

.ai-history-item {
  padding: 8px 10px;
  border-radius: 6px;
  cursor: pointer;
  margin-bottom: 2px;
}

.ai-history-item:hover {
  background: var(--launcher-bg-elevated);
}

.ai-history-item.active {
  background: var(--launcher-accent-bg);
}

.ai-history-title {
  font-size: 12px;
  color: var(--launcher-text);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.ai-history-meta {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: 3px;
}

.ai-history-meta span {
  font-size: 10px;
  color: var(--launcher-text-faint);
}

.ai-history-del {
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  color: var(--launcher-text-faint);
  cursor: pointer;
  padding: 2px;
  border-radius: 4px;
}

.ai-history-del:hover {
  color: #ef4444;
  background: rgba(239, 68, 68, 0.08);
}

.ai-history-op {
  display: flex;
  align-items: center;
  border: none;
  background: transparent;
  color: var(--launcher-text-faint);
  cursor: pointer;
  padding: 2px;
  margin-right: 2px;
  border-radius: 4px;
}

.ai-history-op:hover {
  color: var(--launcher-accent);
  background: var(--launcher-accent-bg);
}

.ai-history-rename {
  padding: 2px 0;
}

.ai-history-input {
  width: 100%;
  padding: 4px 6px;
  font-size: 12px;
  border: 1px solid var(--launcher-accent);
  border-radius: 6px;
  background: var(--launcher-input-bg);
  color: var(--launcher-text);
  outline: none;
}

.ai-history-empty {
  padding: 20px 12px;
  font-size: 12px;
  color: var(--launcher-text-faint);
  text-align: center;
}

.ai-messages {
  flex: 1;
  overflow-y: auto;
  padding: 12px 14px;
  display: flex;
  flex-direction: column;
  gap: 12px;
  min-height: 0;
}

.ai-msg {
  display: flex;
  flex-direction: column;
  gap: 4px;
  max-width: 90%;
}

.ai-msg.user {
  align-self: flex-end;
  align-items: flex-end;
}

.ai-msg.assistant {
  align-self: flex-start;
  align-items: flex-start;
}

.ai-msg-role {
  font-size: 10px;
  color: var(--launcher-text-faint);
  letter-spacing: 0.04em;
}

.ai-msg-content {
  font-size: 13px;
  line-height: 1.6;
  color: var(--launcher-text);
  background: var(--launcher-accent-soft);
  padding: 8px 12px;
  border-radius: 10px;
  white-space: pre-wrap;
  word-break: break-word;
}

.ai-msg.user .ai-msg-content {
  background: var(--launcher-accent);
  color: #fff;
}

.ai-msg-content.streaming {
  min-height: 20px;
}

.cursor {
  animation: blink 1s step-end infinite;
  opacity: 0.6;
}

@keyframes blink {
  50% {
    opacity: 0;
  }
}

.ai-input-bar {
  position: relative;
  display: flex;
  gap: 8px;
  padding: 10px 14px;
  border-top: 1px solid var(--launcher-hairline);
  flex-shrink: 0;
}

.ai-input {
  flex: 1;
  padding: 8px 12px;
  border: 1px solid var(--launcher-border);
  border-radius: 8px;
  background: transparent;
  color: var(--launcher-text);
  font-size: 13px;
  outline: none;
}

.ai-input:focus {
  border-color: var(--launcher-accent);
}

.ai-input:disabled {
  opacity: 0.5;
}

.ai-send {
  padding: 8px 16px;
  border: none;
  border-radius: 8px;
  background: var(--launcher-accent);
  color: #fff;
  font-size: 12px;
  cursor: pointer;
  flex-shrink: 0;
}

.ai-send:disabled {
  opacity: 0.4;
  cursor: default;
}
</style>
