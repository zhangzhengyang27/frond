<template>
  <CapsulePage :hints="hints">
    <div class="mcp-call">
      <div class="mcp-call-head" data-testid="mcp-call-head">
        <AppIcon icon="tools" :size="14" />
        <span class="mcp-call-tool">{{ tool }}</span>
        <span class="mcp-call-server">{{ serverLabel }}</span>
      </div>
      <div v-if="sentPairs.length" class="mcp-call-args">
        <div v-for="p in sentPairs" :key="p.name" class="mcp-call-arg">
          <span class="mcp-call-arg-name">{{ p.name }}</span>
          <span class="mcp-call-arg-value">{{ p.value === '' ? '（空）' : p.value }}</span>
        </div>
      </div>
      <div v-else data-testid="mcp-call-noargs" class="mcp-call-args mcp-call-arg">（无参数）</div>

      <div v-if="running" class="mcp-call-state" data-testid="mcp-call-running">
        <AppIcon icon="loader-4" :size="16" class="mcp-call-spin" />
        <span>运行中（未连接时会先连接）…</span>
      </div>
      <div v-else-if="error" class="mcp-call-state mcp-call-error" data-testid="mcp-call-error">
        <AppIcon icon="error-warning" :size="16" />
        <span>{{ error }}</span>
        <button class="mcp-call-btn" @click="run">重试</button>
      </div>
      <pre v-else class="mcp-call-out" data-testid="mcp-call-output">{{
        text || '（服务器没返回文本内容）'
      }}</pre>
      <p v-if="!running && !error && ignored > 0" class="mcp-call-dropped">
        另有 {{ ignored }} 项非文本内容未显示
      </p>
    </div>
  </CapsulePage>
</template>

<script setup lang="ts">
/**
 * MCP 工具调用结果页（P-4②「工具进根搜索」）：胶囊内跑一个工具并把输出摊开。
 *
 * 这一页存在的理由是**输出必须看得见**：toast 装不下一段 JSON，也留不住它——
 * 一个按下去什么都不发生的命令比没有这个命令更糟。
 * 发起调用的动作放在页面里而不是调用方：重试要重发同一份参数，
 * 让 LauncherApp 持有这些状态只是把 props 变成两份。
 */
import { computed, onMounted, ref } from 'vue'
import CapsulePage from './CapsulePage.vue'
import AppIcon from '@components/AppIcon.vue'

const props = defineProps<{
  serverId: string
  serverLabel: string
  tool: string
  /** 发出去的参数（界面按用户填的原样展示，定型发生在主进程） */
  args: Record<string, string>
}>()

const emit = defineEmits<{ cancel: [] }>()

const running = ref(false)
const error = ref('')
const text = ref('')
const ignored = ref(0)

const sentPairs = computed(() =>
  Object.entries(props.args ?? {}).map(([name, value]) => ({ name, value }))
)

const hints = computed(() => [
  { keys: '↵', label: text.value ? '复制输出' : '重新运行' },
  { keys: 'ESC', label: '返回' }
])

async function run(): Promise<void> {
  running.value = true
  error.value = ''
  try {
    const r = await window.api.ai.mcpRunTool(props.serverId, props.tool, props.args ?? {})
    text.value = r.text
    ignored.value = r.ignoredContent
    if (!r.ok) error.value = r.error || '服务器返回失败'
  } catch (e) {
    error.value = (e as Error)?.message ?? '调用失败'
  } finally {
    running.value = false
  }
}

/** ↵ 有输出就复制、没输出（或失败）就重跑；ESC 交回外层导航栈 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'Enter' && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.preventDefault()
    if (text.value) void window.api.action.invoke({ type: 'copyText', text: text.value })
    else if (!running.value) void run()
    return true
  }
  if (e.key === 'Escape') {
    emit('cancel')
    return true
  }
  return false
}

defineExpose({ handleKey })

onMounted(() => void run())
</script>

<style scoped>
.mcp-call {
  display: flex;
  flex-direction: column;
  gap: 10px;
  padding: 12px 16px 16px;
}

.mcp-call-head {
  display: flex;
  align-items: center;
  gap: 8px;
  color: var(--launcher-text-muted);
  font-size: 12px;
}

.mcp-call-tool {
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 13px;
  color: var(--launcher-text);
}

.mcp-call-server {
  margin-left: auto;
  color: var(--launcher-text-muted);
}

.mcp-call-args {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 12px;
  color: var(--launcher-text-muted);
}

.mcp-call-arg {
  display: flex;
  gap: 8px;
}

.mcp-call-arg-name {
  font-family: 'SF Mono', Menlo, monospace;
  min-width: 90px;
}

.mcp-call-arg-value {
  color: var(--launcher-text);
  word-break: break-all;
}

.mcp-call-dropped {
  margin: 0;
  font-size: 11px;
  color: var(--launcher-text-muted);
}

.mcp-call-state {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13px;
  color: var(--launcher-text-muted);
}

.mcp-call-error {
  color: var(--launcher-danger);
}

.mcp-call-spin {
  animation: mcp-spin 1s linear infinite;
}

@keyframes mcp-spin {
  to {
    transform: rotate(360deg);
  }
}

.mcp-call-btn {
  padding: 3px 10px;
  border: 1px solid var(--launcher-border);
  border-radius: 5px;
  background: transparent;
  color: var(--launcher-text);
  font-size: 12px;
  cursor: pointer;
}

.mcp-call-out {
  margin: 0;
  max-height: 260px;
  overflow: auto;
  padding: 10px 12px;
  border: 1px solid var(--launcher-border);
  border-radius: 8px;
  background: var(--launcher-input-bg);
  color: var(--launcher-text);
  font-family: 'SF Mono', Menlo, monospace;
  font-size: 12px;
  line-height: 1.5;
  white-space: pre-wrap;
  word-break: break-word;
}
</style>
