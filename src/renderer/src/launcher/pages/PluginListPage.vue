<template>
  <CapsulePage :hints="hints">
    <div class="plist-page">
      <div v-if="items.length === 0" class="plist-empty" data-testid="plugin-list-empty">
        {{ loading ? '加载中…' : emptyMessage || '（插件暂未提交列表）' }}
      </div>
      <div v-else class="plist-list">
        <div
          v-for="(item, index) in items"
          :key="index"
          class="plist-item"
          :class="{ selected: index === selectedIndex }"
          @mouseenter="selectedIndex = index"
          @click="runDefault(index)"
        >
          <div class="plist-icon">
            <AppIcon :icon="item.icon || 'plug-2'" :size="16" />
          </div>
          <div class="plist-text">
            <div class="plist-title">{{ item.title }}</div>
            <div v-if="item.subtitle" class="plist-sub">{{ item.subtitle }}</div>
          </div>
          <span v-for="a in item.accessories ?? []" :key="a" class="plist-accessory">{{ a }}</span>
        </div>
      </div>
    </div>
    <!-- Detail：选中条目详情 -->
    <template #detail>
      <div v-if="selected?.detail" class="plist-detail">
        <div class="plist-detail-name">{{ selected.title }}</div>
        <!-- 安全红线：markdown 路径先 marked → sanitize（detailHtml），再 v-html -->
        <pre v-if="selected.detailFormat !== 'markdown'" class="plist-detail-body">{{
          selected.detail
        }}</pre>
        <!-- eslint-disable-next-line vue/no-v-html -- detailHtml 已先 marked → sanitizeHtml 白名单过滤（事件属性/脚本不在白名单） -->
        <div v-else class="plist-detail-body plist-detail-md" v-html="detailHtml" />
      </div>
      <div v-else-if="selected" class="plist-detail">
        <div class="plist-detail-name">{{ selected.title }}</div>
        <div class="plist-detail-body plist-detail-muted">
          {{ selected.subtitle || '无详情' }}
        </div>
      </div>
      <div v-else class="plist-empty">选择左侧条目查看详情</div>
    </template>
  </CapsulePage>
</template>

<script setup lang="ts">
/**
 * M3.1 声明式 List 协议的宿主渲染：第三方插件提交 items 数据，
 * 这里用与第一方页完全一致的原生组件渲染（列表 + Detail + 底部动作）。
 */
import { computed, ref, watch } from 'vue'
import { marked } from 'marked'
import AppIcon from '@components/AppIcon.vue'
import CapsulePage from './CapsulePage.vue'
import sanitizeHtml from '@renderer/utils/sanitize-html-wrapper'
import type { PluginListItem } from '@shared/plugin-protocol'

const props = defineProps<{
  pluginId: string
  items: PluginListItem[]
  /** P-2.6：插件声明列表加载中（Raycast isLoading） */
  loading?: boolean
  /** 插件自定义空态文案（Raycast emptyView 的 Frond 形态：收字符串） */
  emptyMessage?: string | null
}>()

const selectedIndex = ref(0)

const selected = computed(() => props.items[selectedIndex.value] ?? null)

/**
 * markdown 详情的净化 HTML（detailFormat === 'markdown' 时）。
 * 白名单风格与 MarkdownPresentation.vue 一致（含 img/del，allowedSchemes 仅 http/https），
 * 链接强制 target=_blank + rel=noopener；事件属性/脚本不在白名单，sanitize 后才进 v-html。
 */
const detailHtml = computed<string>(() => {
  const item = selected.value
  if (!item?.detail || item.detailFormat !== 'markdown') return ''
  const raw = marked.parse(item.detail, { async: false })
  return sanitizeHtml(raw, {
    allowedTags: sanitizeHtml.defaults.allowedTags.concat(['img', 'del']),
    allowedAttributes: {
      '*': [
        'align',
        'alt',
        'height',
        'href',
        'name',
        'src',
        'target',
        'width',
        'class',
        'type',
        'checked',
        'disabled',
        'id'
      ],
      // 链接需放行 rel，配合 transformTags 的 target=_blank + rel=noopener
      a: ['rel']
    },
    allowedSchemes: ['http', 'https'],
    transformTags: {
      a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener' })
    }
  })
})

const hints = computed(() => {
  const actions = selected.value?.actions ?? []
  const rows = actions.slice(0, 3).map((a, i) => ({
    keys: i === 0 ? '↵' : a.hint || `⌘${i}`,
    label: a.label
  }))
  return [...rows, { keys: 'ESC', label: '返回' }]
})

watch(
  () => props.items,
  () => {
    selectedIndex.value = 0
  }
)

/** 执行条目动作（默认动作 = actions[0]） */
async function runItem(index: number, actionIndex = 0): Promise<void> {
  const item = props.items[index]
  const action = item?.actions[actionIndex]
  if (!item || !action) return
  if (action.type === 'copy' && action.payload !== undefined) {
    try {
      await navigator.clipboard.writeText(action.payload)
    } catch {
      /* 剪贴板失败静默 */
    }
    window.api.launcher.hide()
    return
  }
  if (action.type === 'open' && action.payload) {
    if (/^https?:\/\//.test(action.payload)) {
      void window.api.system.openExternal(action.payload)
    } else {
      void window.api.system.openPath(action.payload)
    }
    window.api.launcher.hide()
    return
  }
  // callback：回插件处理
  await window.api.launcher.runPluginAction(props.pluginId, index, actionIndex)
}

function runDefault(index: number): void {
  void runItem(index)
}

function moveSelection(delta: number): void {
  if (props.items.length === 0) return
  selectedIndex.value = (selectedIndex.value + delta + props.items.length) % props.items.length
  document
    .querySelectorAll('.plist-item')
    [selectedIndex.value]?.scrollIntoView({ block: 'nearest' })
}

/** 键盘分发（LauncherApp 集中转发）；返回 true 表示已消费 */
function handleKey(e: KeyboardEvent): boolean {
  if (e.key === 'ArrowDown') {
    moveSelection(1)
    return true
  }
  if (e.key === 'ArrowUp') {
    moveSelection(-1)
    return true
  }
  if (e.key === 'Enter') {
    void runItem(selectedIndex.value, 0)
    return true
  }
  // ⌘1-3：第 2/3 个动作（Raycast 动作面板键位风格）
  if ((e.metaKey || e.ctrlKey) && ['1', '2', '3'].includes(e.key)) {
    const actionIndex = Number(e.key)
    if (actionIndex >= 1 && actionIndex < (selected.value?.actions.length ?? 0)) {
      void runItem(selectedIndex.value, actionIndex)
      return true
    }
  }
  return false
}

defineExpose({ handleKey })
</script>

<style scoped>
.plist-page {
  padding: 6px;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.plist-list {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.plist-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 10px;
  border-radius: 9px;
  cursor: pointer;
}

.plist-item.selected {
  background: var(--launcher-accent-soft);
}

.plist-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 30px;
  height: 30px;
  border-radius: 8px;
  background: var(--launcher-bg-elevated);
  color: var(--launcher-text-dim);
  flex-shrink: 0;
}

.plist-item.selected .plist-icon {
  color: var(--launcher-accent);
}

.plist-text {
  flex: 1;
  min-width: 0;
}

.plist-title {
  font-size: 13px;
  font-weight: 500;
  color: var(--launcher-text);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.plist-sub {
  font-size: 11px;
  color: var(--launcher-text-muted);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.plist-accessory {
  font-size: 10px;
  color: var(--launcher-text-muted);
  border: 1px solid var(--launcher-border);
  border-radius: 999px;
  padding: 2px 8px;
  flex-shrink: 0;
}

.plist-detail {
  display: flex;
  flex-direction: column;
  gap: 8px;
  min-height: 0;
}

.plist-detail-name {
  font-size: 12px;
  font-weight: 500;
  color: var(--launcher-text);
}

.plist-detail-body {
  margin: 0;
  padding: 10px;
  border-radius: 8px;
  border: 1px solid var(--launcher-border);
  background: var(--launcher-bg-elevated);
  font-size: 11px;
  line-height: 1.6;
  color: var(--launcher-text-dim);
  white-space: pre-wrap;
  word-break: break-word;
  overflow-y: auto;
  max-height: 300px;
}

.plist-detail-muted {
  color: var(--launcher-text-muted);
}

/* markdown 详情：静态渲染（无 CodeMirror），代码块就是 pre>code + 简单样式 */
.plist-detail-md {
  white-space: normal;
}

.plist-detail-md :deep(p) {
  margin: 0.4em 0;
}

.plist-detail-md :deep(p:first-child),
.plist-detail-md :deep(*:first-child) {
  margin-top: 0;
}

.plist-detail-md :deep(*:last-child) {
  margin-bottom: 0;
}

.plist-detail-md :deep(h1),
.plist-detail-md :deep(h2),
.plist-detail-md :deep(h3),
.plist-detail-md :deep(h4) {
  margin: 0.8em 0 0.4em;
  font-weight: 600;
  color: var(--launcher-text);
}

.plist-detail-md :deep(h1) {
  font-size: 1.3em;
}

.plist-detail-md :deep(h2) {
  font-size: 1.15em;
}

.plist-detail-md :deep(h3),
.plist-detail-md :deep(h4) {
  font-size: 1em;
}

.plist-detail-md :deep(ul),
.plist-detail-md :deep(ol) {
  margin: 0.4em 0;
  padding-left: 1.5em;
}

.plist-detail-md :deep(li) {
  margin: 0.2em 0;
}

.plist-detail-md :deep(a) {
  color: var(--launcher-accent);
  text-decoration: none;
}

.plist-detail-md :deep(a:hover) {
  text-decoration: underline;
}

.plist-detail-md :deep(strong) {
  font-weight: 600;
  color: var(--launcher-text);
}

.plist-detail-md :deep(code) {
  font-family: 'SFMono-Regular', Consolas, 'Liberation Mono', Menlo, Courier, monospace;
  font-size: 0.92em;
  background: var(--launcher-bg-elevated);
  border-radius: 4px;
  padding: 0.1em 0.35em;
}

.plist-detail-md :deep(pre) {
  margin: 0.5em 0;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid var(--launcher-border);
  background: var(--launcher-bg-elevated);
  overflow-x: auto;
}

.plist-detail-md :deep(pre code) {
  background: transparent;
  padding: 0;
  white-space: pre-wrap;
  word-break: break-word;
}

.plist-detail-md :deep(blockquote) {
  margin: 0.5em 0;
  padding-left: 0.8em;
  border-left: 3px solid var(--launcher-border);
  color: var(--launcher-text-muted);
}

.plist-detail-md :deep(img) {
  max-width: 100%;
  height: auto;
  border-radius: 6px;
}

.plist-detail-md :deep(hr) {
  border: none;
  border-top: 1px solid var(--launcher-border);
  margin: 0.8em 0;
}

.plist-detail-md :deep(table) {
  border-collapse: collapse;
  margin: 0.5em 0;
}

.plist-detail-md :deep(th),
.plist-detail-md :deep(td) {
  border: 1px solid var(--launcher-border);
  padding: 4px 8px;
}

.plist-empty {
  padding: 22px 0;
  text-align: center;
  font-size: 12px;
  color: var(--launcher-text-muted);
}
</style>
