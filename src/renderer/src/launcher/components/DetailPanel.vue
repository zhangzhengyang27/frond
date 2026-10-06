<template>
  <!-- eslint-disable-next-line vue/no-v-html —— renderedContent 经 marked+sanitizeHtml 白名单清洗（:20-30），内容源可信 -->
  <div class="detail-panel" v-html="renderedContent" />
</template>

<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { marked } from 'marked'

interface Props {
  title?: string | undefined
  content: string
  format?: 'text' | 'markdown' | undefined
}

const props = withDefaults(defineProps<Props>(), {
  format: 'markdown'
})

// B53-6：sanitize-html（378KB）动态 import——它是胶囊启动关键图里最大的一块，
// 且只有打开插件详情时才真正需要。渲染改异步 + 轮次守卫（快速切换详情时旧渲染
// 不得覆盖新内容）；挂载后空闲预热，首份详情不付 chunk 拉取延迟。
const renderedContent = ref('')
let renderSeq = 0

const SANITIZE_OPTIONS = {
  // 白名单过滤（与 PluginListPage 一致）：手写正则可被 <svg/onload=、
  // 实体化 javascript: 等形态绕过，胶囊窗持全量 window.api 不能冒险
  allowedTags: ['img', 'del'] as string[], // 与 defaults 合并在调用侧表达
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel'],
    img: ['src', 'alt', 'width', 'height'],
    code: ['class'],
    span: ['class']
  }
}

async function render(): Promise<void> {
  const seq = ++renderSeq
  if (props.format === 'text') {
    renderedContent.value = `<pre>${escapeHtml(props.content)}</pre>`
    return
  }
  try {
    const html = marked.parse(props.content, { async: false })
    const { default: sanitizeHtml } = await import('@renderer/utils/sanitize-html-wrapper')
    if (seq !== renderSeq) return
    renderedContent.value = sanitizeHtml(html, {
      allowedTags: [...sanitizeHtml.defaults.allowedTags, ...SANITIZE_OPTIONS.allowedTags],
      allowedAttributes: SANITIZE_OPTIONS.allowedAttributes,
      transformTags: {
        a: sanitizeHtml.simpleTransform('a', { target: '_blank', rel: 'noopener' })
      }
    })
  } catch {
    if (seq !== renderSeq) return
    renderedContent.value = escapeHtml(props.content)
  }
}

watch(
  () => [props.content, props.format] as const,
  () => {
    void render()
  },
  { immediate: true }
)

onMounted(() => {
  const warm = (): void => {
    void import('@renderer/utils/sanitize-html-wrapper')
  }
  if ('requestIdleCallback' in window) requestIdleCallback(warm, { timeout: 3000 })
  else setTimeout(warm, 1500)
})

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}
</script>

<style scoped>
.detail-panel {
  height: 100%;
  overflow-y: auto;
  padding: 16px 18px;
  font-size: 13px;
  line-height: 1.6;
  line-height: 1.6;
  color: var(--launcher-text);
}

.detail-panel :deep(h1),
.detail-panel :deep(h2),
.detail-panel :deep(h3) {
  color: var(--launcher-text);
  font-weight: 600;
  margin: 12px 0 8px;
}

.detail-panel :deep(h1) {
  font-size: 18px;
}
.detail-panel :deep(h2) {
  font-size: 16px;
}
.detail-panel :deep(h3) {
  font-size: 14px;
}

.detail-panel :deep(p) {
  margin: 8px 0;
}

.detail-panel :deep(code) {
  background: var(--launcher-bg-elevated);
  padding: 2px 6px;
  border-radius: 4px;
  font-size: 12px;
  font-family: 'SF Mono', Menlo, monospace;
}

.detail-panel :deep(pre) {
  background: var(--launcher-bg-elevated);
  padding: 12px;
  border-radius: 8px;
  overflow-x: auto;
  margin: 10px 0;
}

.detail-panel :deep(pre code) {
  background: transparent;
  padding: 0;
}

.detail-panel :deep(ul),
.detail-panel :deep(ol) {
  padding-left: 20px;
  margin: 8px 0;
}

.detail-panel :deep(li) {
  margin: 4px 0;
}

.detail-panel :deep(blockquote) {
  border-left: 3px solid rgba(0, 122, 255, 0.4);
  padding-left: 12px;
  margin: 10px 0;
  color: var(--launcher-text-dim);
}

.detail-panel :deep(a) {
  color: var(--text-brand);
  text-decoration: none;
}

.detail-panel :deep(a:hover) {
  text-decoration: underline;
}

.detail-panel :deep(hr) {
  border: none;
  border-top: 1px solid var(--launcher-border);
  margin: 16px 0;
}

.detail-panel :deep(table) {
  width: 100%;
  border-collapse: collapse;
  margin: 10px 0;
}

.detail-panel :deep(th),
.detail-panel :deep(td) {
  border: 1px solid var(--launcher-border);
  padding: 6px 10px;
  text-align: left;
}

.detail-panel :deep(th) {
  background: var(--launcher-bg-elevated);
  font-weight: 600;
}
</style>
